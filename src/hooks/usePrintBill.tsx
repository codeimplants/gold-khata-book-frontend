import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { JewelleryFormValues, PrintContext, InvoiceTemplate } from "../types";
import { printBill } from "../print/printService";
import { printErrorMessage, ThermalPrintError, sendToPrinter, warmUpPrinter } from "../print/thermal";
import { buildReceiptModel, modelHasNonAscii } from "../print/thermal/receiptModel";
import { modelToEscPos } from "../print/thermal/receiptBuilder";
import {
  decodeToBilevel,
  imageToBands,
  centerHorizontally,
  stripBandToEscPos,
  PRINTER_DOTS,
} from "../print/thermal/raster";
import { nonAsciiLines, logoLine, planHybridReceipt, assembleHybrid } from "../print/thermal/hybrid";
import { stripLayout, STRIP_LOGO_HEIGHT } from "../print/thermal/ReceiptImageView";
import { useReceiptCapture } from "../print/thermal/useReceiptCapture";
import { PrintTimer, printDiagnosticsEnabled } from "../print/thermal/perf";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { setPrintMode, markPrinterChosen } from "../store/printPrefs/printPrefsSlice";
import { useTranslation } from "./useTranslation";
import PrinterChoiceSheet from "../components/PrinterChoiceSheet";

type PrintRequest = {
  values: JewelleryFormValues;
  ctx: PrintContext;
};

/**
 * Single entry point for printing a customer bill from any screen.
 *
 * Owns three behaviours that would otherwise be duplicated (and drift) across
 * CreateInvoiceScreen, OrderDetailsScreen and AdvanceOrderSuccessScreen:
 *
 *  1. First-run gating — the very first Print tap asks how the shop prints, since
 *     Print Settings is otherwise never visited and thermal support would go
 *     undiscovered. Asked once, never again.
 *  2. Printing with the saved preference, with no prompt on subsequent prints.
 *  3. Recovery when a thermal printer is unreachable: offering a one-off A4 print
 *     instead of a dead end, *without* rewriting the saved preference — a flat
 *     printer battery must not silently reconfigure the shop.
 */
export function usePrintBill(lang: any, template: InvoiceTemplate) {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const { mode, device, hasChosenPrinter } = useAppSelector(s => s.printPrefs);

  const { capture, host: captureHost } = useReceiptCapture();

  /**
   * A browser has no Bluetooth path — BLE, TCP and view-shot are all mocked in
   * the web bundle. Without this the first Print tap on web opened the chooser
   * and offered "thermal printer", which could only ever route to a pairing
   * screen that cannot pair. Web always prints the A4 document.
   */
  const isWeb = Platform.OS === "web";
  const effectiveMode = isWeb ? "standard" : mode;

  // Open the printer connection while the user is still reading the bill. RFCOMM setup
  // was 2.6s of a 3.2s first print; doing it here makes that print feel like a repeat
  // one. Fire-and-forget — the user may never tap Print, and a printer that is off
  // right now is not an error.
  useEffect(() => {
    if (effectiveMode !== "thermal" || !device) return;
    void warmUpPrinter(device);
  }, [effectiveMode, device]);
  const [chooserVisible, setChooserVisible] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [printing, setPrinting] = useState(false);
  // Held while the chooser is open so the print can resume once answered.
  const pending = useRef<PrintRequest | null>(null);

  const runPrint = useCallback(
    async (req: PrintRequest, forceStandard = false) => {
      setPrinting(true);
      try {
        if (effectiveMode === "thermal" && !forceStandard && device) {
          // Text is ~1KB and instant but ASCII-only; the rasterised image is ~30KB and
          // takes a few seconds but can print Devanagari/Gujarati. Choose per receipt
          // so an English bill never pays for a capability it doesn't use.
          const timer = new PrintTimer();
          const model = buildReceiptModel(req.values, req.ctx, lang);
          const needsImage = modelHasNonAscii(model);
          timer.note(`renderer     ${needsImage ? "IMAGE (raster)" : "TEXT (fast)"}`);
          timer.note(`transport    ${device.transport}`);
          timer.mark("build model");

          let commands: number[];
          if (needsImage) {
            // Only the lines containing Indic script become images; the rest stay on
            // the fast text path. This is what keeps cost proportional to how much
            // non-Latin text a bill has rather than to how many items it has.
            const imageLines = nonAsciiLines(model);
            const segments = planHybridReceipt(model);
            timer.note(`raster lines ${imageLines.length} of ${model.length}`);

            // A logo that silently fails to load still occupies its band, so the
            // receipt gets blank paper rather than an obvious error. Surface what the
            // URI actually is: prepareShopForPrint falls back to the original remote
            // URL when data-URI inlining fails, which needs a live network fetch.
            const logo = logoLine(model);
            timer.note(
              `logo         ${
                !logo
                  ? "none"
                  : logo.uri.startsWith("data:")
                  ? `inlined (${Math.round(logo.uri.length / 1024)} KB)`
                  : `REMOTE URL (${logo.uri.slice(0, 24)}…)`
              }`
            );
            timer.mark("plan");

            // The logo is decoded straight from its data URI — never rendered into the
            // capture — because an off-screen <Image> reports onLoad but does not
            // paint, so it captured as blank paper.
            let logoCommands: number[] = [];
            if (logo) {
              try {
                const decoded = await decodeToBilevel(logo.uri, PRINTER_DOTS, STRIP_LOGO_HEIGHT);
                // A raster always starts at the left margin, so a logo narrower than the
                // print head has to be padded out to centre it.
                logoCommands = imageToBands(centerHorizontally(decoded));
                timer.note(`logo image   ${decoded.width} x ${decoded.height} px`);
              } catch {
                // A logo that will not decode must not stop the bill printing.
                timer.note("logo image   DECODE FAILED");
              }
              timer.mark("logo decode");
            }

            const png = await capture(imageLines, "strip");
            timer.mark("capture");

            const strip = await decodeToBilevel(png, PRINTER_DOTS);
            timer.note(`image        ${strip.width} x ${strip.height} px`);
            timer.mark("decode+1bit");

            const layout = stripLayout(imageLines);
            commands = assembleHybrid(
              segments,
              i => stripBandToEscPos(strip, i, layout),
              logoCommands
            );
            timer.note(`escpos       ${Math.round(commands.length / 1024)} KB`);
            timer.mark("encode");
          } else {
            commands = modelToEscPos(model);
            timer.note(`escpos       ${Math.round(commands.length / 1024)} KB`);
            timer.mark("render text");
          }

          await sendToPrinter(device, commands, timer);

          if (printDiagnosticsEnabled()) {
            Alert.alert("Print timing (test build)", timer.summary());
          }
        } else {
          // isWeb forces the A4 path regardless of a thermal preference that may
          // have been saved on this account from a phone.
          await printBill(req.values, req.ctx, lang, template, {
            forceStandard: forceStandard || isWeb,
          });
        }
      } catch (e) {
        // Which path this attempt actually took — the same condition the try
        // block branched on. The catch used to assume thermal unconditionally,
        // so an A4 failure was worded as an unreachable Bluetooth printer and its
        // only action, "Set up printer", opened thermal pairing. A shop on A4 was
        // being sent to configure hardware it does not own.
        const attemptedThermal = effectiveMode === "thermal" && !forceStandard;
        const { title, body } = printErrorMessage(
          e,
          t,
          attemptedThermal ? "thermal" : "standard"
        );
        // Nothing else records why a print failed, and the alert deliberately
        // shows no raw error text — without this an A4 failure leaves no trace.
        console.warn(`[print] ${attemptedThermal ? "thermal" : "standard"} print failed:`, e);

        const recoverable =
          attemptedThermal && e instanceof ThermalPrintError && e.reason !== "no-printer";

        let buttons;
        if (recoverable) {
          buttons = [
            { text: t("printerChoice.tryAgain"), onPress: () => void runPrint(req) },
            {
              text: t("printerChoice.useRegularPrinter"),
              // This print only — deliberately does not dispatch setPrintMode.
              onPress: () => void runPrint(req, true),
            },
            { text: t("common.cancel"), style: "cancel" as const },
          ];
        } else if (attemptedThermal) {
          buttons = [
            {
              text: t("printerChoice.setUpPrinter"),
              onPress: () => navigation.navigate("ThermalPrinterSetup"),
            },
            { text: t("common.cancel"), style: "cancel" as const },
          ];
        } else {
          // A4 failed. There is no in-app setup to send them to — the printer is
          // the OS's business — so the only useful offer is another attempt.
          buttons = [
            { text: t("printerChoice.tryAgain"), onPress: () => void runPrint(req, forceStandard) },
            { text: t("common.cancel"), style: "cancel" as const },
          ];
        }

        Alert.alert(title, body, buttons);
      } finally {
        setPrinting(false);
      }
    },
    [lang, template, t, navigation, effectiveMode, isWeb, device, capture]
  );

  /** Call from a screen's Print button. */
  const print = useCallback(
    (values: JewelleryFormValues, ctx: PrintContext) => {
      // The first-run question is skipped on web: there is only one answer there,
      // and asking it would offer a printer the browser can never reach.
      if (!hasChosenPrinter && !isWeb) {
        pending.current = { values, ctx };
        setIsChanging(false);
        setChooserVisible(true);
        return;
      }
      void runPrint({ values, ctx });
    },
    [hasChosenPrinter, isWeb, runPrint]
  );

  /** Call from the "Change" link next to the Print button. */
  const openChooser = useCallback(() => {
    pending.current = null;
    setIsChanging(true);
    setChooserVisible(true);
  }, []);

  const chooseStandard = useCallback(() => {
    dispatch(setPrintMode("standard"));
    dispatch(markPrinterChosen());
    setChooserVisible(false);
    const req = pending.current;
    pending.current = null;
    if (req) void runPrint(req);
  }, [dispatch, runPrint]);

  const chooseThermal = useCallback(() => {
    dispatch(setPrintMode("thermal"));
    dispatch(markPrinterChosen());
    setChooserVisible(false);
    const req = pending.current;
    pending.current = null;
    // Already paired? Print straight away. Otherwise send them to pair — printing
    // now would only produce the "no printer" error they cannot yet act on.
    if (device) {
      if (req) void runPrint(req);
    } else {
      navigation.navigate("ThermalPrinterSetup");
    }
  }, [dispatch, device, navigation, runPrint]);

  /** "Printing to: X" caption for under the Print button. */
  const targetLabel =
    effectiveMode === "thermal"
      ? device
        ? t("printerChoice.printingTo").replace("{name}", device.name)
        : t("printerChoice.noPrinterYet")
      : t("printerChoice.printingToStandard");

  /**
   * Whether the "Change" link beside the caption is worth offering. False on
   * web, where the chooser has nothing to choose between.
   */
  const canChoosePrinter = !isWeb;

  // `chooser` is rendered by each bill screen; it carries the off-screen capture host
  // too, so a screen only has to place one element to get both.
  const chooser = (
    <>
      <PrinterChoiceSheet
        visible={chooserVisible}
        isChanging={isChanging}
        onChooseStandard={chooseStandard}
        onChooseThermal={chooseThermal}
        onClose={() => {
          pending.current = null;
          setChooserVisible(false);
        }}
      />
      {captureHost}
    </>
  );

  return { print, openChooser, targetLabel, canChoosePrinter, chooser, printing };
}

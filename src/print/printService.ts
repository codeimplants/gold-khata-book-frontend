import { Platform } from 'react-native';
import RNPrint from 'react-native-print';
import { generateInvoicePDF, describePdfError, lastPdfError } from '../utils/pdfService';
import { buildBillHTML } from './templates';
import { printThermal, ThermalPrintError } from './thermal';
import { store } from '../store';
import { JewelleryFormValues, PrintContext, InvoiceTemplate } from '../types';
import { MobileLang } from './templates/shared';

const PRINT_SETTLE_MS = 250; // let images finish painting before measuring

/**
 * How long the direct-HTML print fallback gets before it is treated as hung.
 *
 * Generous, because the wait includes the user reading Android's own print
 * dialog and choosing a printer — this is a stuck-forever guard, not a
 * performance budget. It only ever runs after PDF generation has already
 * failed, which is rare.
 */
const HTML_PRINT_TIMEOUT_MS = 60_000;

/**
 * The browser refused the print window.
 *
 * Its own class because the fix is the user's to apply and nothing else can
 * apply it: every print in the web build opens a tab, and a pop-up blocker —
 * on by default in Chrome, Safari and Firefox — refuses it silently. Telling
 * someone "check that a printer is set up" when the real answer is "allow
 * pop-ups for this site" sends them to the wrong settings screen entirely.
 */
export class PrintPopupBlockedError extends Error {
  constructor() {
    super('The browser blocked the print window');
    this.name = 'PrintPopupBlockedError';
  }
}

export const printHTML = async (html: string) => {
  if (Platform.OS === 'web') {
    const win = window.open('', '_blank');
    // Thrown, not returned. `return` here made every Print button in the web
    // build a no-op the moment a pop-up blocker was on: no tab, no error, no
    // toast — indistinguishable from a dead button, and every caller already
    // has a catch that would have said something.
    if (!win) throw new PrintPopupBlockedError();
    win.document.write(html);
    win.document.close();

    try {
      // Wait for the document (and its inlined base64 images) to settle so the
      // print snapshot isn't blank. The page size itself comes from the
      // template's own PAGE_CSS (@page A4, portrait) — we intentionally do NOT
      // override it to the content height, which produced a landscape page for
      // short invoices.
      await new Promise<void>((resolve) => {
        if (win.document.readyState === 'complete') {
          setTimeout(resolve, PRINT_SETTLE_MS);
        } else {
          win.addEventListener('load', () => setTimeout(resolve, PRINT_SETTLE_MS), { once: true });
          // Safety net in case 'load' never fires (e.g. no external resources)
          setTimeout(resolve, 1500);
        }
      });
    } catch (e) {
      console.warn('[printHTML] print settle failed:', e);
    }

    win.focus();
    win.print();
    win.close();
  } else {
    // Native: generate the same fixed-A4 PDF used for Share/Download and print
    // that exact file, so all three actions produce an identical document.
    const filePath = await generateInvoicePDF(html, 'invoice');
    if (filePath) {
      await RNPrint.print({ filePath });
      return;
    }

    // No PDF. The direct-HTML path still prints for most documents, so it stays
    // the fallback — but on Android it is the library's least reliable route: it
    // builds its own WebView inside a runOnUiThread Runnable whose exceptions
    // are outside the try that would reject the promise, and it nulls its
    // WebView reference at the end of onPageFinished. When either bites, the
    // promise settles neither way and this `await` never returns — the Print
    // button simply does nothing, forever, with no error to report.
    //
    // So it gets a deadline. Losing the race is reported as the PDF failure that
    // actually started it, which is the part worth knowing.
    const reason = describePdfError(lastPdfError());
    console.warn(`[print] PDF generation failed, printing HTML directly: ${reason || 'no reason given'}`);

    await Promise.race([
      RNPrint.print({ html }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Printing timed out${reason ? ` (${reason})` : ''}`)),
          HTML_PRINT_TIMEOUT_MS,
        ),
      ),
    ]);
  }
};

/** Single entry point for printing a customer bill (invoice / advance-order bill).
 * Routes to the existing A4/PDF flow (unchanged) or the Bluetooth thermal receipt flow
 * based on the user's saved print preference. Never silently falls back — if thermal
 * mode is selected but no printer is connected, this throws so the caller can show a
 * clear error instead of a confusing no-op. */
export const printBill = async (
  values: JewelleryFormValues,
  ctx: PrintContext,
  lang: MobileLang,
  template: InvoiceTemplate,
  /** `forceStandard` is the user explicitly choosing A4 for *this* print after a
   * thermal failure. It deliberately does not touch the saved preference — a printer
   * that was switched off must not silently reconfigure the shop. */
  options: { forceStandard?: boolean } = {}
) => {
  const { mode, device, paper } = store.getState().printPrefs;

  if (mode === 'thermal' && !options.forceStandard) {
    if (!device) {
      throw new ThermalPrintError('no-printer');
    }
    await printThermal(values, ctx, device);
    return;
  }

  // The shop's paper is a print-time property, not something the caller should
  // have to know about — but an explicit ctx.paper still wins, so a preview can
  // render a sheet the shop hasn't saved yet.
  const html = buildBillHTML(values, { paper, ...ctx }, lang, template);
  await printHTML(html);
};

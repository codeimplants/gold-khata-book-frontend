import { JewelleryFormValues, PrintContext } from '../../types';
import { buildThermalReceiptCommands } from './receiptBuilder';
import { bleTransport } from './bleTransport';
import { sppTransport } from './sppTransport';
import { tcpTransport } from './tcpTransport';
import {
  PrinterTransport,
  SavedPrinter,
  ThermalPrintError,
  TransportKind,
  TransportTimer,
} from './transport';

export { ThermalPrintError } from './transport';
export type { SavedPrinter, TransportKind, PrintFailure } from './transport';

const TRANSPORTS: Record<TransportKind, PrinterTransport> = {
  ble: bleTransport,
  spp: sppTransport,
  tcp: tcpTransport,
};

export function transportFor(kind: TransportKind): PrinterTransport {
  return TRANSPORTS[kind];
}

/**
 * Opens the printer connection ahead of a likely print, where that is expensive.
 *
 * Called when a bill screen mounts, so RFCOMM setup happens while the user reads the
 * bill instead of after they tap Print — it was the entire cost of a first print
 * (2.6s of a 3.2s job). Silent and best-effort: not printing at all is a normal
 * outcome, and a printer that is off right now is not an error.
 */
export async function warmUpPrinter(printer: SavedPrinter | null): Promise<void> {
  if (!printer) return;
  const transport = transportFor(printer.transport);
  if (!transport.isSupported() || !transport.warmUp) return;
  try {
    await transport.warmUp(printer);
  } catch {
    // Never surfaced — see above.
  }
}

/** Sends an already-built ESC/POS stream to a printer over whichever link it uses.
 * Shared by real bills and the setup screen's test print. */
export async function sendToPrinter(
  printer: SavedPrinter,
  commands: number[],
  timer?: TransportTimer
): Promise<void> {
  const transport = transportFor(printer.transport);
  if (!transport.isSupported()) throw new ThermalPrintError('unsupported-platform');
  await transport.write(printer, commands, timer);
}

/** Renders the receipt and prints it. Throws on any failure — callers must surface it
 * rather than silently falling back to standard A4 print. */
export async function printThermal(
  values: JewelleryFormValues,
  ctx: PrintContext,
  printer: SavedPrinter
): Promise<void> {
  await sendToPrinter(printer, buildThermalReceiptCommands(values, ctx));
}

/** Maps a printBill() failure to a localized alert title/body, so the three bill
 * screens neither duplicate this nor leak raw library error text.
 *
 * `attempted` is which path actually ran, and the caller has to say — the error
 * alone cannot tell us. An A4 print that fails throws whatever RNPrint or the PDF
 * writer threw, which is not a ThermalPrintError, and every such failure used to
 * fall through to the thermal wording: a shop printing to A4 was told "Couldn't
 * reach the printer. Check that it is switched on and in range." about a printer
 * it was not using. */
/**
 * Whether a failure is printService's PrintPopupBlockedError.
 *
 * Matched by name rather than by `instanceof`: printService imports this
 * module for printThermal, so importing the class back would close a cycle,
 * and Hermes does not always preserve the prototype chain across the release
 * bundle anyway.
 */
const isPrintPopupBlocked = (error: unknown): boolean =>
  (error as any)?.name === 'PrintPopupBlockedError';

export function printErrorMessage(
  error: unknown,
  t: (key: string) => string,
  attempted: 'thermal' | 'standard' = 'thermal'
): { title: string; body: string } {
  if (attempted === 'standard') {
    // A blocked pop-up is not a printer problem, and the standard wording
    // ("check that a printer is set up on this device") sends a web user to
    // the wrong place entirely — the fix is one click in their address bar.
    if (isPrintPopupBlocked(error)) {
      return {
        title: t('printerChoice.popupBlockedTitle'),
        body: t('printerChoice.popupBlockedBody'),
      };
    }
    return {
      title: t('printerChoice.standardFailedTitle'),
      body: t('printerChoice.standardFailedBody'),
    };
  }

  const title = t('thermalPrinter.printFailedTitle');
  if (error instanceof ThermalPrintError) {
    switch (error.reason) {
      case 'no-printer':
        return { title, body: t('thermalPrinter.noPrinterError') };
      case 'unsupported-platform':
        return { title, body: t('thermalPrinter.unsupportedPlatform') };
      default:
        return { title, body: t('thermalPrinter.testPrintFailedBody') };
    }
  }
  return { title, body: t('thermalPrinter.testPrintFailedBody') };
}

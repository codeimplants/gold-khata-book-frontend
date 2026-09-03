// Bluetooth Classic (RFCOMM/SPP) transport — Android only.
//
// Backed by our own TurboModule (android/.../classicbluetooth) rather than a third-party
// package; see src/specs/NativeClassicBluetooth.ts for why. iOS has no implementation
// because Apple forbids classic-Bluetooth accessories outside the MFi programme, so
// isSupported() is false there and the UI hides this option entirely.
import { Platform } from 'react-native';
import ClassicBluetooth from '../../specs/NativeClassicBluetooth';
import { bytesToBase64 } from './base64';
import { PrinterTransport, SavedPrinter, ThermalPrintError, TransportTimer } from './transport';

export type SppPrinter = Extract<SavedPrinter, { transport: 'spp' }>;

export type BondedDevice = { id: string; name: string };

const isAvailable = (): boolean => Platform.OS === 'android' && ClassicBluetooth != null;

/** Classic printers are paired in Android's own Bluetooth settings (PIN usually 0000),
 * not discovered in-app, so this lists already-bonded devices rather than scanning. */
export async function getBondedDevices(): Promise<BondedDevice[]> {
  if (!isAvailable()) return [];
  const json = await ClassicBluetooth!.getBondedDevices();
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function isBluetoothEnabled(): Promise<boolean> {
  if (!isAvailable()) return false;
  return ClassicBluetooth!.isEnabled();
}

export function makeSppPrinter(device: BondedDevice): SppPrinter {
  return { transport: 'spp', id: device.id, name: device.name || device.id };
}

async function write(
  printer: SavedPrinter,
  data: number[],
  timer?: TransportTimer
): Promise<void> {
  if (printer.transport !== 'spp') throw new ThermalPrintError('unreachable');
  if (!isAvailable()) throw new ThermalPrintError('unsupported-platform');

  // Base64 because the TurboModule bridge carries no binary type.
  const payload = bytesToBase64(data);
  timer?.mark('spp encode');

  try {
    const result = await ClassicBluetooth!.write(printer.id, payload);
    timer?.mark('spp transfer');
    // Socket work happens natively, so the native side reports its own split as
    // notes — recording them as marks would attribute JS elapsed time to them.
    try {
      const { connectMs, writeMs, bytes, reused } = JSON.parse(result);
      timer?.note(`spp payload  ${Math.round(bytes / 1024)} KB`);
      timer?.note(`  ↳ connect  ${connectMs} ms${reused ? ' (REUSED)' : ' (new)'}`);
      timer?.note(`  ↳ write    ${writeMs} ms (native)`);
    } catch {
      // Older build without native timings — the mark above still covers it.
    }
  } catch {
    throw new ThermalPrintError('unreachable');
  }
}

/** Opens the connection ahead of a likely print. Silent by design — see the interface
 * doc. RFCOMM setup is 0.8-3.0s and is the entire cost of a first print. */
async function warmUp(printer: SavedPrinter): Promise<void> {
  if (printer.transport !== 'spp' || !isAvailable()) return;
  try {
    await ClassicBluetooth!.connect(printer.id);
  } catch {
    // Printer off or out of range; the print path will connect normally if it comes.
  }
}

export const sppTransport: PrinterTransport = {
  write,
  warmUp,
  isSupported: isAvailable,
};

// WiFi / Ethernet transport. Network ESC/POS printers accept a raw byte stream on
// TCP port 9100 (the de-facto "JetDirect"/RAW printing port), so the exact same
// commands the Bluetooth path sends work unchanged — only delivery differs.
//
// Simpler than BLE in every respect: no GATT discovery, no MTU chunking (TCP handles
// segmentation), and no runtime permissions on Android. iOS does gate local-network
// access, which is why Info.plist carries NSLocalNetworkUsageDescription.
import TcpSocket from 'react-native-tcp-socket';
import { PrinterTransport, SavedPrinter, ThermalPrintError } from './transport';

export const DEFAULT_PRINTER_PORT = 9100;

/** Long enough to survive a printer waking from idle, short enough that a wrong IP
 * fails while the user is still looking at the screen. */
const CONNECT_TIMEOUT_MS = 6000;

export type TcpPrinter = Extract<SavedPrinter, { transport: 'tcp' }>;

export function makeTcpPrinter(host: string, port: number, name?: string): TcpPrinter {
  return {
    transport: 'tcp',
    id: `${host}:${port}`,
    name: name?.trim() || host,
    host,
    port,
  };
}

/** Opens a socket, writes every byte, and closes. Resolves only once the data has
 * been flushed — resolving on `connect` would report success for a print that never
 * reached the paper. */
function sendOverSocket(host: string, port: number, data: number[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (err?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.destroy();
      } catch {
        // already torn down
      }
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    };

    const timer = setTimeout(() => finish(new Error('timeout')), CONNECT_TIMEOUT_MS);

    // Uint8Array is accepted directly and is native to Hermes, so this needs no
    // Buffer polyfill (React Native has no global Buffer).
    const socket = TcpSocket.createConnection({ host, port }, () => {
      socket.write(Uint8Array.from(data), undefined, err => finish(err));
    });

    socket.on('error', (e: unknown) => finish(e ?? new Error('socket error')));
    socket.on('close', (hadError: boolean) => {
      // A close before the write callback means the printer dropped us mid-job.
      if (hadError) finish(new Error('closed with error'));
    });
  });
}

async function write(printer: SavedPrinter, data: number[]): Promise<void> {
  if (printer.transport !== 'tcp') throw new ThermalPrintError('unreachable');
  try {
    await sendOverSocket(printer.host, printer.port, data);
  } catch {
    throw new ThermalPrintError('unreachable');
  }
}

/** Probes whether something is listening on the printer port — used by the setup
 * screen to validate a typed IP before saving it. */
export async function probePrinter(host: string, port: number): Promise<boolean> {
  try {
    // ESC @ (initialise) is the safest possible probe: harmless if it is a printer,
    // and meaningless-but-inert if it is not.
    await sendOverSocket(host, port, [0x1b, 0x40]);
    return true;
  } catch {
    return false;
  }
}

export const tcpTransport: PrinterTransport = {
  write,
  isSupported: () => true, // WiFi works on every platform this app targets
};

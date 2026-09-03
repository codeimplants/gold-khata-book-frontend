// Transport-independent printer contract.
//
// A thermal printer is reachable over one of three mutually incompatible links, and
// which one a given printer speaks is a property of the hardware, not a user choice:
//
//   ble  — Bluetooth Low Energy (4.0+). Works on Android and iOS.
//   spp  — Bluetooth Classic / RFCOMM. What most sub-₹2,000 printers use.
//          Android only: iOS forbids classic Bluetooth for non-MFi accessories.
//   tcp  — WiFi / Ethernet, raw ESC/POS over TCP port 9100. Android and iOS.
//
// Everything above this layer (escpos.ts, receiptBuilder.ts) emits the same ESC/POS
// bytes regardless — only delivery differs. Adding a transport must never require
// touching receipt rendering.

export type TransportKind = 'ble' | 'spp' | 'tcp';

/** A printer the user has paired/configured, persisted in printPrefs. The shape is a
 * discriminated union on `transport` so each kind carries only the addressing it needs. */
export type SavedPrinter =
  | {
      transport: 'ble';
      id: string;
      name: string;
      /** Discovered on pairing so later prints can reconnect without re-scanning. */
      serviceUUID: string;
      characteristicUUID: string;
      writeWithResponse: boolean;
    }
  | {
      transport: 'spp';
      /** MAC address of an OS-bonded classic device. */
      id: string;
      name: string;
    }
  | {
      transport: 'tcp';
      /** `id` is host:port so it stays a stable identifier like the others. */
      id: string;
      name: string;
      host: string;
      port: number;
    };

/** Why a print failed, as a stable value the UI localizes. Raw library/OS error text
 * is never user-facing — see printErrorMessage() in ./index. */
export type PrintFailure =
  | 'no-printer'
  | 'unreachable'
  | 'unsupported-platform';

export class ThermalPrintError extends Error {
  reason: PrintFailure;
  constructor(reason: PrintFailure) {
    super(reason);
    this.reason = reason;
    this.name = 'ThermalPrintError';
  }
}

/** Structural subset of PrintTimer, so transports can report sub-stages without
 * importing the perf module (and without a cycle). */
export interface TransportTimer {
  mark(label: string): void;
  note(text: string): void;
}

/** Delivers a finished ESC/POS byte stream to one printer. Implementations own their
 * own connect/chunk/disconnect lifecycle — callers just hand over bytes. */
export interface PrinterTransport {
  /** Throws ThermalPrintError('unreachable') if the printer can't be reached.
   * `timer` is optional diagnostics only and must not affect behaviour. */
  write(printer: SavedPrinter, data: number[], timer?: TransportTimer): Promise<void>;
  /** False when the transport can't work on this OS (e.g. spp on iOS), so the UI can
   * hide it rather than offering something that will always fail. */
  isSupported(): boolean;

  /**
   * Optional: open the connection ahead of time so a following write does not pay for
   * it. Called speculatively when a bill screen opens.
   *
   * Must never throw or surface anything — the user may not go on to print at all, and
   * a printer that is off at this moment is not an error. Only worth implementing where
   * connection setup is expensive (RFCOMM at 0.8-3.0s; BLE at ~150ms is not).
   */
  warmUp?(printer: SavedPrinter): Promise<void>;
}

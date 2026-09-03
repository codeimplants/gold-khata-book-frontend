import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Bluetooth Classic (RFCOMM/SPP) printing — Android only.
 *
 * Most sub-₹2,000 thermal printers speak Bluetooth Classic, not BLE, and the two are
 * incompatible protocols; react-native-ble-plx cannot reach them at all. Rather than
 * depend on react-native-bluetooth-classic (last published Nov 2025, still labelled
 * for RN 0.73, New Architecture support unverified), this is a purpose-built
 * TurboModule over Android's BluetoothSocket API — a small, stable surface we own.
 *
 * There is deliberately no iOS implementation: Apple forbids classic-Bluetooth
 * accessory communication outside the MFi programme, which this class of hardware is
 * not enrolled in. Callers must check `sppTransport.isSupported()` first.
 *
 * This is also the app's only native Bluetooth surface on Android, so adapter-level
 * state (isEnabled/requestEnable) lives here even though it serves the BLE path too —
 * rather than adding a second native module that would duplicate the same adapter.
 */
export interface Spec extends TurboModule {
  /** Devices already bonded in Android's own Bluetooth settings. Classic printers are
   * paired at the OS level (usually PIN 0000), not discovered in-app, so this is a
   * lookup rather than a scan. Returns JSON: [{ id, name }]. */
  getBondedDevices(): Promise<string>;

  /** Opens an RFCOMM socket to `address`, writes the base64-decoded payload, closes.
   * Bytes are passed as base64 because the TurboModule bridge has no binary type.
   *
   * Returns JSON timings `{connectMs, writeMs, bytes}`. Socket work happens natively,
   * so without this the JS side can only see one opaque duration — and on the first
   * real measurement this transfer was 72% of a 4.1s print. */
  write(address: string, base64Data: string): Promise<string>;

  /** Whether the device has Bluetooth hardware and it is currently switched on. */
  isEnabled(): Promise<boolean>;

  /**
   * Opens and caches the printer connection without sending anything, so a subsequent
   * write finds it already open.
   *
   * RFCOMM setup measured 0.8-3.0s and is the whole cost of a first print. Called when
   * a bill screen opens, it happens while the user is reading the bill rather than
   * after they tap Print. Best-effort: failures are ignored, and the print path will
   * simply connect normally.
   */
  connect(address: string): Promise<void>;

  /**
   * Decodes a base64 image of any format BitmapFactory understands (PNG, JPEG, WebP,
   * GIF), scales it to fit `maxWidth` x `maxHeight` preserving aspect, and returns it
   * as 1-bit rows ready for ESC/POS.
   *
   * Native rather than JS for two reasons: BitmapFactory handles every format a shop
   * might upload, where a JS PNG decoder covers only one; and the JS decode+threshold
   * of a captured receipt measured 600-900ms, which BitmapFactory does in tens of
   * milliseconds.
   *
   * Returns JSON `{width, height, data}` where `data` is base64 of packed rows,
   * width/8 bytes per row, MSB leftmost — the layout GS v 0 expects.
   */
  decodeImageToBilevel(
    base64Image: string,
    maxWidth: number,
    maxHeight: number,
  ): Promise<string>;

  /**
   * Shows Android's own "An app wants to turn on Bluetooth" system dialog and resolves
   * true if Bluetooth ends up on (including when it already was). Resolves false if the
   * user declines or there is no adapter.
   *
   * This is the only supported way to do it: BluetoothAdapter.enable() was deprecated
   * and is a no-op for apps targeting Android 13+, so an app cannot switch the radio on
   * silently. iOS needs no equivalent — CoreBluetooth raises its own power alert the
   * first time a scan is attempted with Bluetooth off, which is why this is Android-only
   * despite serving the BLE path too.
   */
  requestEnable(): Promise<boolean>;
}

// `get` rather than `getEnforcing`: the module intentionally does not exist on iOS,
// and getEnforcing would throw there.
//
// This exact call shape is mandatory — RN's codegen parser matches on it, and anything
// else (an optional call, a wrapper) fails the build with "Unused NativeModule spec".
// react-native-web has no TurboModuleRegistry at all, so the web bundle resolves
// NativeClassicBluetooth.web.ts instead of this file rather than guarding here.
export default TurboModuleRegistry.get<Spec>('ClassicBluetooth');

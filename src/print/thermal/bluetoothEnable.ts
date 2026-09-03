import { Platform } from 'react-native';
import ClassicBluetooth from '../../specs/NativeClassicBluetooth';

/**
 * Makes the two platforms behave the same when Bluetooth is switched off.
 *
 * iOS already prompts by itself: CoreBluetooth raises a system power alert the first
 * time a scan runs with Bluetooth off. Android does not — the scan just fails, and
 * without this the user is told "Bluetooth is switched off" and left to find Settings
 * on their own, which is a dead end mid-way through pairing a printer.
 *
 * Returns true when it is safe to proceed with a scan. Never throws: a failure to ask
 * is not worse than the old behaviour, and the caller's existing 'bluetooth-off' error
 * path still reports it properly.
 */
export async function ensureBluetoothEnabled(): Promise<boolean> {
  // Also covers web, where the module is absent and there is nothing to enable.
  if (Platform.OS !== 'android' || ClassicBluetooth == null) return true;

  try {
    if (await ClassicBluetooth.isEnabled()) return true;
    return await ClassicBluetooth.requestEnable();
  } catch {
    // Permission refused or no foreground activity. Let the scan run and fail with
    // its own localized reason rather than inventing a second error surface here.
    return true;
  }
}

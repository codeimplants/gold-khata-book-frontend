import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { getBuildNumber, getVersionName } from './appVersion';

export interface DevicePayload {
  platform: 'android' | 'ios' | 'web';
  make?: string;
  model?: string;
  osVersion?: string;
  /**
   * The build this shopkeeper is actually running, so the admin dashboard can
   * answer "who is still on the version with the bug" without a second system.
   * Read from the installed binary (see appVersion.ts), never from the
   * APP_VERSION config constant, which is a hardcoded '0.0.1' in every env.
   */
  appVersion?: string;
  buildNumber?: string;
}

/** Undefined rather than null, so the key is omitted from the JSON body entirely. */
const versionFields = (): Pick<DevicePayload, 'appVersion' | 'buildNumber'> => ({
  appVersion: getVersionName() ?? undefined,
  buildNumber: getBuildNumber() ?? undefined,
});

const truncate = (value: string | undefined, maxLength: number): string | undefined =>
  value ? value.slice(0, maxLength) : value;

/**
 * True when running in the iOS Simulator.
 *
 * The Simulator's network stack goes stale after long uptime, host Wi-Fi
 * changes, or running several simulators at once. NetInfo then reports
 * isConnected as null/false despite the Mac being online, and because the
 * connectivity adapter treats "unknown" as offline, the whole app gets stuck
 * behind the full-screen offline gate — with no way to test anything.
 *
 * Evaluated once at module load: whether this is a simulator cannot change at
 * runtime, and isEmulatorSync() is a native bridge call.
 *
 * This is a DEVELOPMENT convenience only. It does NOT address the underlying
 * behaviour on real devices, where NetInfo also returns null transiently (during
 * network handover, waking from sleep, leaving airplane mode) and can show the
 * offline gate spuriously. Fixing that means changing the adapter to treat null
 * as online and debouncing before blocking.
 */
export const isIOSSimulator: boolean = (() => {
  if (Platform.OS !== 'ios') return false;
  try {
    return DeviceInfo.isEmulatorSync();
  } catch {
    // Never let a detection failure decide connectivity — assume real device.
    return false;
  }
})();

export async function getDevicePayload(): Promise<DevicePayload> {
  const platform = (Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web') as DevicePayload['platform'];

  if (platform === 'web') {
    try {
      return {
        platform,
        make: 'Browser',
        model: truncate(typeof navigator !== 'undefined' ? navigator.userAgent : undefined, 100),
        osVersion: truncate(typeof navigator !== 'undefined' ? navigator.platform : undefined, 50),
        ...versionFields(),
      };
    } catch {
      return { platform, ...versionFields() };
    }
  }

  try {
    const make = await DeviceInfo.getManufacturer();
    const model = DeviceInfo.getModel();
    return {
      platform,
      make: truncate(make, 100),
      model: truncate(model, 100),
      osVersion: truncate(String(Platform.Version), 50),
      ...versionFields(),
    };
  } catch {
    return { platform, osVersion: truncate(String(Platform.Version), 50), ...versionFields() };
  }
}

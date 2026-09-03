import DeviceInfo from 'react-native-device-info';

/**
 * Injected by webpack from android/app/build.gradle — web only. Declared with
 * a typeof guard at every use because on native the identifiers do not exist
 * at all, and a bare reference would throw ReferenceError rather than yield
 * undefined.
 */
declare const __APP_VERSION_NAME__: string | undefined;
declare const __APP_VERSION_CODE__: string | undefined;

const clean = (v: unknown): string | null => {
  const s = v == null ? '' : String(v).trim();
  // react-native-device-info returns the literal string 'unknown' rather than
  // throwing when it cannot resolve a value.
  return !s || s === 'unknown' || s === 'undefined' ? null : s;
};

/**
 * The user-facing version, e.g. "1.0.13".
 *
 * versionName on Android, CFBundleShortVersionString on iOS — read from the
 * installed binary, so it reflects the build the user actually has rather than
 * whatever the source tree currently says. On web react-native-device-info is
 * aliased to a stub, so the value is read out of build.gradle at bundle time.
 *
 * Safe to call at module scope: both DeviceInfo accessors are synchronous.
 */
export const getVersionName = (): string | null =>
  clean(DeviceInfo?.getVersion?.()) ??
  (typeof __APP_VERSION_NAME__ !== 'undefined'
    ? clean(__APP_VERSION_NAME__)
    : null);

/** The build number — versionCode on Android, CURRENT_PROJECT_VERSION on iOS. */
export const getBuildNumber = (): string | null =>
  clean(DeviceInfo?.getBuildNumber?.()) ??
  (typeof __APP_VERSION_CODE__ !== 'undefined'
    ? clean(__APP_VERSION_CODE__)
    : null);

/**
 * The application id — packageName on Android, CFBundleIdentifier on iOS.
 *
 * Lives here rather than with the other device fields because it shares this
 * file's one job: read identity from the *installed binary*, never from project
 * metadata. Nexus falls back to identifying an app by this when no API key is
 * resolved, which is what keeps force-update and the kill switch working on a
 * build that shipped with an empty key — so a wrong value here costs the only
 * remedy for a bad release.
 */
export const getBundleId = (): string | null =>
  clean(DeviceInfo?.getBundleId?.());

/**
 * Both together, for display only — e.g. "1.0.13 (13)".
 *
 * Analytics must use getVersionName()/getBuildNumber() separately: a composed
 * string cannot be grouped, filtered or ordered in a report.
 */
export const getAppVersion = (): string | null => {
  const name = getVersionName();
  if (!name) return null;
  const code = getBuildNumber();
  return code && code !== name ? `${name} (${code})` : name;
};

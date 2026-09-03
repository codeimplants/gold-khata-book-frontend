import { Platform } from 'react-native';

/**
 * TODO(gold-khata-book): set once the App Store listing exists.
 *
 * Empty on purpose. The value here was SoneBill's real App Store id (6757720737),
 * inherited by the fork — left in place, every "Update" and "Rate this app" tap
 * on iOS would have opened SoneBill's listing instead of this app's. Gold Khata
 * Book has no listing yet, so there is no correct value to put here.
 *
 * While it is empty, STORE_URL falls back to the `storeUrl` the version-control
 * backend returns (see resolveStoreUrl), which is the same path the app already
 * relies on for Android. Read it from App Store Connect after first submission.
 */
export const APP_STORE_ID = '';

/**
 * Where to send someone who wants to install or update the app.
 *
 * This is the source of truth, in the build, on purpose. A store listing URL is
 * a static fact about the app rather than something worth configuring remotely:
 * it is fixed by the bundle id and the numeric App Store id, and cannot change
 * without a different listing.
 *
 * It used to come from the version-control backend alone, and had done since the
 * update flow was first added — there has never been a hardcoded URL in this
 * repo. Nexus returns `storeUrl` for android but omits it for ios entirely, so
 * `Linking.openURL('')` did nothing and the Update button was dead on every
 * iPhone since the feature shipped. Nothing detected it because the call site
 * guarded on the value being present rather than treating its absence as a fault.
 *
 * Nexus's value is still honoured as a fallback, which is what covers the builds
 * already in the wild: 1.0.13 and 1.0.15 have no constant of their own, so
 * setting storeUrl in Nexus is the only thing that can fix the button for the
 * users running them.
 */
export const STORE_URL = Platform.select({
  // Guarded: without the id this would build ".../app/id", a dead link that
  // would also shadow the backend fallback below.
  ios: APP_STORE_ID ? `https://apps.apple.com/app/id${APP_STORE_ID}` : '',
  android: 'https://play.google.com/store/apps/details?id=com.goldkhatabook.app',
  default: '',
});

/** Ours, and the backend's only where we have none (web). */
export const resolveStoreUrl = (fromBackend?: string | null): string =>
  STORE_URL || fromBackend || '';

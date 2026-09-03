import { AppState, AppStateStatus, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import { ANALYTICS_ENABLED } from '@config';
import { getDevicePayload } from './deviceInfo';
import { getBuildNumber, getVersionName } from './appVersion';
import {
  getVersionControlConfig,
  hasVersionControlConfig,
  hydrateVersionControlConfig,
} from './versionControlConfig';

/**
 * The version to report, or nothing at all.
 *
 * There is deliberately no fallback. APP_VERSION is a hardcoded '0.0.1' in
 * development, preprod and production alike, so using it as a backstop does not
 * degrade gracefully — it asserts, as fact, a version no shop has ever run.
 * That reached the dashboard: a live Android shop showed 1.0.17 everywhere in
 * the app and 0.0.1 in the version column, indistinguishable from a genuinely
 * ancient install, with nothing recorded to tell the two apart afterwards.
 *
 * Omitting the key instead lets Nexus render "Unavailable", which is the true
 * statement. The column exists to answer "who is still on the version with the
 * bug", and a confident wrong answer is worse for that question than no answer.
 */
const reportedVersion = (): string | undefined => getVersionName() ?? undefined;

/**
 * Ships engagement telemetry to the centralized admin platform.
 *
 * This runs *alongside* @codeimplants/analytics (Firebase), not instead of it:
 * Firebase stays for aggregate product analytics, while the platform owns the
 * identity-linked engagement (who used the app, for how long, how many opens)
 * that drives per-user statistics and subscription lead lists.
 *
 * Two things the published @codeimplants/version-control client cannot do, and
 * which therefore live here:
 *  - it posts no deviceId, so it never populates the platform's Device table;
 *    we register the device (with make/model) explicitly via POST /sdk/device.
 *  - it has no notion of a logged-in user; we link device -> user via
 *    POST /sdk/user/identify.
 *
 * Every network call is best-effort and silently swallowed — telemetry must
 * never surface an error or block the app.
 */

/**
 * `tutorial_open` / `tutorial_play` carry the tutorial slug and the entry point
 * that led there (library, help icon, empty state, support FAB). That last one is
 * the point: it says which screens users are actually stuck on, so the next batch
 * of contextual "?" icons is decided by evidence rather than by guessing. Heavy
 * traffic on one tutorial is a signal to simplify that screen, not to re-record.
 */
type EventName =
  | 'app_open'
  | 'app_background'
  | 'login_success'
  | 'logout'
  | 'screen_view'
  | 'tutorial_open'
  | 'tutorial_play';

type QueuedEvent = {
  name: EventName;
  ts: string;
  deviceId: string;
  externalUserId?: string;
  platform?: string;
  appVersion?: string;
  payload?: Record<string, unknown>;
};

const FLUSH_INTERVAL_MS = 15_000;
const MAX_BATCH = 20;
const REQUEST_TIMEOUT_MS = 10_000;

let deviceId: string | null = null;
let currentUserId: string | undefined;
let queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let appStateSub: { remove: () => void } | null = null;
let lastAppState: AppStateStatus = 'active';
let started = false;

// Reads the resolved config rather than the compiled constants, so a key
// supplied by /api/platform/config switches telemetry back on without a new
// build. Still requires a key: unlike version/check, these endpoints are writes
// and Nexus will not accept package-name identification for them.
const isEnabled = (): boolean =>
  ANALYTICS_ENABLED !== false && hasVersionControlConfig();

const platformName = (): string =>
  Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

async function post(path: string, body: unknown): Promise<void> {
  // Pick up a cached key before deciding we are disabled — on a cold start the
  // compiled value may be empty while a good one is already on disk.
  await hydrateVersionControlConfig();
  if (!isEnabled()) return;
  const { backendUrl, apiKey } = getVersionControlConfig();
  // AbortController + setTimeout rather than AbortSignal.timeout(): the latter
  // is absent on some Hermes/RN versions, and because every failure here is
  // swallowed, a missing static would make telemetry silently never send.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    await fetch(`${backendUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    // Best-effort: never let telemetry break or slow the app.
  } finally {
    clearTimeout(timer);
  }
}

const DEVICE_ID_KEY = 'platform.deviceId';

/** RFC4122-ish v4 id; crypto.randomUUID is absent on many RN runtimes. */
function randomId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Stable per-install device id.
 *
 * getUniqueId() is native-only — under react-native-web it is unavailable or
 * returns a non-stable value, which would either drop web telemetry entirely or
 * inflate installs with a new "device" on every page load. So fall back to a
 * UUID persisted in AsyncStorage (localStorage on web).
 */
async function resolveDeviceId(): Promise<string | null> {
  if (deviceId) return deviceId;

  if (Platform.OS !== 'web') {
    try {
      const native = await DeviceInfo.getUniqueId();
      if (native) {
        deviceId = native;
        return deviceId;
      }
    } catch {
      // fall through to the stored id
    }
  }

  try {
    const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (stored) {
      deviceId = stored;
      return deviceId;
    }
    const generated = randomId();
    await AsyncStorage.setItem(DEVICE_ID_KEY, generated);
    deviceId = generated;
  } catch {
    deviceId = null;
  }
  return deviceId;
}

/** Register/refresh this device so installs and the make/model split are populated. */
async function registerDevice(): Promise<void> {
  const id = await resolveDeviceId();
  if (!id) return;

  const device = await getDevicePayload();

  await post('/sdk/device', {
    deviceId: id,
    platform: device.platform ?? platformName(),
    osVersion: device.osVersion,
    appVersion: reportedVersion(),
    buildNumber: getBuildNumber() ?? undefined,
    make: device.make,
    model: device.model,
    manufacturer: device.make,
  });
}

function enqueue(name: EventName, payload?: Record<string, unknown>): void {
  if (!isEnabled() || !deviceId) return;
  queue.push({
    name,
    ts: new Date().toISOString(),
    deviceId,
    externalUserId: currentUserId,
    platform: platformName(),
    appVersion: reportedVersion(),
    ...(payload ? { payload } : {}),
  });
  if (queue.length >= MAX_BATCH) void flush();
}

async function flush(): Promise<void> {
  if (queue.length === 0) return;
  const batch = queue;
  queue = [];
  await post('/sdk/events', { events: batch });
}

function onAppStateChange(next: AppStateStatus): void {
  // iOS emits 'inactive' for transient interruptions — a notification banner,
  // control centre, the app switcher, an incoming call — and also as a step on
  // the way into and out of 'background'. Treating it as backgrounding closed
  // the session and the return reopened it, so one notification banner became
  // an extra "open" with a near-zero duration attached, inflating opens and
  // dragging the average session length down on iOS only.
  //
  // Ignoring it without touching lastAppState is what keeps the pairs correct:
  // active -> inactive -> background still reports exactly one close, and
  // background -> inactive -> active exactly one open, because the transition
  // is judged against the last state that actually mattered.
  if (next === 'inactive') return;

  const wasActive = lastAppState === 'active';
  const isActive = next === 'active';

  if (!wasActive && isActive) {
    enqueue('app_open');
  } else if (wasActive && !isActive) {
    // Closes the session server-side; flush now or the app may be frozen
    // before the next interval tick and the session would stay open.
    enqueue('app_background');
    void flush();
  }
  lastAppState = next;
}

/** Start telemetry: register the device, open the first session, watch app state. */
export async function initPlatformAnalytics(): Promise<void> {
  if (started || !isEnabled()) return;
  started = true;

  await registerDevice();
  if (!deviceId) return;

  lastAppState = AppState.currentState ?? 'active';
  enqueue('app_open');

  appStateSub = AppState.addEventListener('change', onAppStateChange);
  flushTimer = setInterval(() => void flush(), FLUSH_INTERVAL_MS);
}

/**
 * Link this device to the logged-in user. `externalUserId` must be the app
 * backend's opaque user id (never the phone number) so the platform stays
 * pseudonymous and can still join back to the app's own records.
 */
export async function setPlatformUser(
  externalUserId: string,
  authMethod: 'otp' | 'email' | string = 'otp',
): Promise<void> {
  if (!isEnabled()) return;
  const id = await resolveDeviceId();
  if (!id) return;

  const changed = currentUserId !== externalUserId;
  currentUserId = externalUserId;
  if (!changed) return;

  await post('/sdk/user/identify', {
    deviceId: id,
    externalUserId,
    platform: platformName(),
    authMethod,
  });
}

/** Forget the current user (logout / impersonation), keeping the device session. */
export function clearPlatformUser(): void {
  currentUserId = undefined;
}

/** Track an ad-hoc engagement event. */
export function trackPlatformEvent(
  name: EventName,
  payload?: Record<string, unknown>,
): void {
  enqueue(name, payload);
}

/** Tear down listeners/timers (used by tests and hot reload). */
export function stopPlatformAnalytics(): void {
  appStateSub?.remove();
  appStateSub = null;
  if (flushTimer) clearInterval(flushTimer);
  flushTimer = null;
  started = false;
  void flush();
}

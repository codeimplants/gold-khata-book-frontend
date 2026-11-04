/**
 * Sends the errors a shop runs into to Crash reports (Nexus › Gold Khata Book ›
 * Crash reports; backend dev-help/crash-reports.md).
 *
 * - automatic: render crashes (AppErrorBoundary), unhandled JS errors, fatal
 *   errors, unhandled promise rejections (installCrashHandlers), and 5xx
 *   answers the backend did not record itself (apiClient)
 * - manual: "Report a problem" on the error screen, with the person's note
 *
 * Best effort, always. Nothing here throws, blocks, or shows anything: a
 * report that cannot be sent is kept (offline) or dropped. Reports go out
 * over plain fetch, never apiClient, so a failing report cannot start the
 * global loader, sign the shop out, or report itself.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import { API_BASE_URL } from '@config';
import { getVersionName } from '../utils/appVersion';
import { isOffline, subscribeConnectivity } from './connectivity';

export type CrashKind = 'render' | 'js' | 'promise' | 'native' | 'server';

interface ReportOptions {
  kind?: CrashKind;
  componentStack?: string | null;
  httpMethod?: string;
  httpStatus?: number;
  metadata?: Record<string, unknown>;
  /** Keep it for the next launch instead of sending now (the app is about to close) */
  keepForLater?: boolean;
}

type Payload = Record<string, unknown>;

const ENDPOINT = `${(API_BASE_URL || '').replace(/\/api\/?$/, '').replace(/\/$/, '')}/api/crash-reports`;
const QUEUE_KEY = 'crash_reports.queue.v1';
/** Enough to see what went wrong offline; older ones are dropped first. */
const QUEUE_MAX = 20;
/** The same error from the same kind is sent at most once a minute. */
const REPEAT_WINDOW_MS = 60 * 1000;
const SEND_TIMEOUT_MS = 10 * 1000;

let getToken: () => string | undefined = () => undefined;
let currentScreen: string | undefined;
const recent = new Map<string, number>();

/** Wired once from App: how to read the session token. */
export const configureCrashReporter = (options: { getToken: () => string | undefined }) => {
  getToken = options.getToken;
};

/** The route the user is on, kept by the NavigationContainer's onStateChange. */
export const setCrashScreen = (name: string | undefined) => {
  currentScreen = name;
};

const deviceDetails = (): Payload => {
  const details: Payload = { platform: Platform.OS };
  try {
    details.appVersion = getVersionName() || undefined;
  } catch {}
  try {
    if (Platform.OS === 'web') {
      details.osVersion = typeof navigator !== 'undefined' ? navigator.platform || undefined : undefined;
    } else {
      details.osVersion = `${Platform.OS} ${String(Platform.Version)}`;
      details.deviceModel =
        [DeviceInfo?.getBrand?.(), DeviceInfo?.getModel?.()].filter(Boolean).join(' ') || undefined;
    }
  } catch {}
  return details;
};

const toError = (value: unknown): Error => {
  if (value instanceof Error) return value;
  if (typeof value === 'string') return new Error(value);
  if (value && typeof value === 'object' && typeof (value as any).message === 'string') {
    const e = new Error((value as any).message);
    e.name = (value as any).name || 'Error';
    e.stack = (value as any).stack;
    return e;
  }
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error(String(value));
  }
};

/**
 * Not crashes: answers from the API (each screen handles its own; the server
 * records its 5xx), lost connections, cancelled requests, warnings, and
 * browser noise.
 */
const isIgnorable = (error: Error): boolean => {
  const name = error?.name || '';
  if (['APIError', 'NetworkError', 'TimeoutError', 'AbortError', 'CanceledError'].includes(name)) return true;
  const msg = String(error?.message || '');
  if (!msg.trim()) return true;
  if (msg === 'canceled' || /^warning:/i.test(msg)) return true;
  if (/network (request failed|error)|failed to fetch|load failed|request timeout/i.test(msg)) return true;
  if (/ResizeObserver loop/i.test(msg)) return true;
  return false;
};

/** true: the server took it (or refused it for good). false: try again later. */
const post = async (payload: Payload): Promise<boolean> => {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), SEND_TIMEOUT_MS) : null;
  try {
    const token = getToken();
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller?.signal,
    });
    // 4xx (a bad report, the rate limit, an older backend without the route)
    // will not get better by sending it again.
    return res.status < 500;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const readQueue = async (): Promise<Payload[]> => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

const writeQueue = async (list: Payload[]) => {
  try {
    if (list.length) await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(list.slice(-QUEUE_MAX)));
    else await AsyncStorage.removeItem(QUEUE_KEY);
  } catch {}
};

const enqueue = async (payload: Payload) => {
  await writeQueue([...(await readQueue()), { ...payload, metadata: { ...(payload.metadata as object), queued: true } }]);
};

let flushing = false;

/** Sends what was kept while offline. Stops at the first failure and keeps the rest. */
export const flushCrashQueue = async () => {
  if (flushing || isOffline()) return;
  flushing = true;
  try {
    const list = await readQueue();
    let sent = 0;
    for (const payload of list) {
      if (!(await post(payload))) break;
      sent += 1;
    }
    if (sent) await writeQueue((await readQueue()).slice(sent));
  } catch {
  } finally {
    flushing = false;
  }
};

const send = async (payload: Payload): Promise<boolean> => {
  if (isOffline()) {
    await enqueue(payload);
    return false;
  }
  const ok = await post(payload);
  if (!ok) await enqueue(payload);
  return ok;
};

/** Records an error automatically. Never throws. */
export const reportError = (value: unknown, options: ReportOptions = {}): Promise<unknown> | undefined => {
  try {
    const error = toError(value);
    if (options.kind !== 'server' && isIgnorable(error)) return;
    const kind = options.kind || 'js';
    const key = `${kind}|${error.message}`;
    const now = Date.now();
    const last = recent.get(key);
    if (last && now - last < REPEAT_WINDOW_MS) return;
    recent.set(key, now);
    if (recent.size > 50) recent.delete(recent.keys().next().value as string);

    const payload = {
      source: 'auto',
      kind,
      message: error.message || 'Unknown error',
      name: error.name,
      stack: error.stack,
      componentStack: options.componentStack || undefined,
      screen: currentScreen,
      httpMethod: options.httpMethod,
      httpStatus: options.httpStatus,
      metadata: options.metadata,
      ...deviceDetails(),
    };
    return (options.keepForLater ? enqueue(payload) : send(payload)).catch(() => {});
  } catch {
    // Reporting must never cause another error
  }
};

/**
 * A 5xx the app was given. One the backend answered itself (its JSON body) is
 * already in Crash reports with its stack — the server records every 5xx it
 * sends — so only answers from in front of it (nginx 502/504 while it is
 * down or restarting) are sent from here.
 */
export const reportServerError = (error: any) => {
  try {
    const status = typeof error?.statusCode === 'number' ? error.statusCode : error?.response?.status;
    if (typeof status !== 'number' || status < 500) return;
    const body = error?.details ?? error?.response?.data;
    if (body && typeof body === 'object' && (body as any).success === false) return;
    reportError(new Error(`Server answered ${status}${error?.message ? `: ${String(error.message).slice(0, 200)}` : ''}`), {
      kind: 'server',
      httpStatus: status,
    });
  } catch {}
};

/** The person's own report from the error screen. Resolves true once the server has it. */
export const reportManually = async (
  note: string,
  error?: Error | null,
  componentStack?: string | null,
): Promise<boolean> => {
  try {
    return await send({
      source: 'manual',
      kind: 'manual',
      userNote: note,
      message: error?.message || note.slice(0, 200),
      name: error?.name,
      stack: error?.stack,
      componentStack: componentStack || undefined,
      screen: currentScreen,
      ...deviceDetails(),
    });
  } catch {
    return false;
  }
};

let installed = false;

/** Catches errors no screen handled, and sends what was kept offline. Call once at start. */
export const installCrashHandlers = () => {
  if (installed) return;
  installed = true;

  try {
    // Sent when the server answers again, and shortly after start
    subscribeConnectivity(() => {
      if (!isOffline()) flushCrashQueue();
    });
    setTimeout(() => flushCrashQueue(), 5000);

    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return;
      window.addEventListener('error', (event: ErrorEvent) => {
        reportError(event.error || event.message, { kind: 'js' });
      });
      window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
        reportError(event.reason, { kind: 'promise' });
      });
      return;
    }

    const errorUtils = (global as any).ErrorUtils;
    if (errorUtils?.setGlobalHandler) {
      const previous = errorUtils.getGlobalHandler?.();
      errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
        if (!isFatal) {
          reportError(error, { kind: 'js', metadata: { isFatal: false } });
          previous?.(error, isFatal);
          return;
        }
        // A fatal error closes the app before a request could finish: write it
        // down (at most a second's wait) and send it on the next launch.
        const kept = reportError(error, { kind: 'native', metadata: { isFatal: true }, keepForLater: true });
        let handedOn = false;
        const handOn = () => {
          if (handedOn) return;
          handedOn = true;
          previous?.(error, isFatal);
        };
        setTimeout(handOn, 1000);
        Promise.resolve(kept).then(handOn, handOn);
      });
    }

    // Hermes: unhandled promise rejections. In development React Native uses
    // this hook for its own yellow-box warnings, so it is only taken over in
    // release builds.
    const hermes = (global as any).HermesInternal;
    if (!__DEV__ && hermes?.enablePromiseRejectionTracker) {
      hermes.enablePromiseRejectionTracker({
        allRejections: true,
        onUnhandled: (_id: number, rejection: unknown) => reportError(rejection, { kind: 'promise' }),
        onHandled: () => {},
      });
    }
  } catch {}
};

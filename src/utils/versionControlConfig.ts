import AsyncStorage from '@react-native-async-storage/async-storage';
import { VITE_VC_API_KEY, VITE_VC_BACKEND } from '@config';

/**
 * Where the Nexus backend URL and API key come from at runtime.
 *
 * These used to be compile-time constants only, which is how 1.0.15 shipped
 * broken: VITE_VC_API_KEY had just moved to a gitignored secrets.ts whose
 * template defaults to '', the release baked that empty string in, and the only
 * fix was a store release. Both values now resolve in priority order:
 *
 *   1. values from /api/platform/config (applied via applyRemoteConfig)
 *   2. the last such values seen, cached on device
 *   3. whatever was compiled into the binary
 *
 * (2) matters as much as (1): without it every cold start would run on the
 * compiled values until the config request came back, so a bad compiled value
 * would still break the version check that runs at launch.
 *
 * (3) is the first-run fallback, so it still has to be right — see the
 * store-guard check that refuses to build a prod bundle with an empty key.
 *
 * None of this is secret. The same values ship inside every binary and only
 * identify which app is calling.
 */
export interface VersionControlConfig {
    backendUrl: string;
    apiKey: string;
}

const CACHE_KEY = 'versionControl.config';

const compiled: VersionControlConfig = {
    backendUrl: String(VITE_VC_BACKEND ?? ''),
    apiKey: String(VITE_VC_API_KEY ?? ''),
};

let active: VersionControlConfig = compiled;
let hydrating: Promise<void> | null = null;

/** Listeners re-init anything holding a copy of the config (e.g. the SDK client). */
type Listener = (cfg: VersionControlConfig) => void;
const listeners = new Set<Listener>();

export const onVersionControlConfigChange = (fn: Listener): (() => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
};

const isUsable = (cfg?: Partial<VersionControlConfig> | null): cfg is VersionControlConfig =>
    Boolean(cfg?.backendUrl) && Boolean(cfg?.apiKey);

const same = (a: VersionControlConfig, b: VersionControlConfig): boolean =>
    a.backendUrl === b.backendUrl && a.apiKey === b.apiKey;

const activate = (cfg: VersionControlConfig): void => {
    if (same(cfg, active)) return;
    active = cfg;
    listeners.forEach(fn => {
        try {
            fn(active);
        } catch {
            // A misbehaving listener must not stop the others, or block config.
        }
    });
};

/** Current best-known config. Synchronous: callers already inside a request path. */
export const getVersionControlConfig = (): VersionControlConfig => active;

/** True when we have something worth sending. */
export const hasVersionControlConfig = (): boolean => isUsable(active);

/**
 * Load the cached config. Safe to call repeatedly and concurrently; the work
 * happens once and later callers await the same promise.
 */
export const hydrateVersionControlConfig = async (): Promise<void> => {
    if (!hydrating) {
        hydrating = (async () => {
            try {
                const raw = await AsyncStorage.getItem(CACHE_KEY);
                if (!raw) return;
                const cached = JSON.parse(raw) as Partial<VersionControlConfig>;
                if (isUsable(cached)) {
                    activate({ backendUrl: cached.backendUrl, apiKey: cached.apiKey });
                }
            } catch {
                // Corrupt or unreadable cache: fall through to the compiled values.
            }
        })();
    }
    return hydrating;
};

/**
 * Apply values fetched from /api/platform/config and remember them for next
 * launch. Incomplete payloads are ignored rather than allowed to blank out a
 * working config — a backend that omits the field must not disable the client.
 */
export const applyRemoteConfig = async (
    cfg?: Partial<VersionControlConfig> | null,
): Promise<void> => {
    if (!isUsable(cfg)) return;
    const next: VersionControlConfig = { backendUrl: cfg.backendUrl, apiKey: cfg.apiKey };
    if (same(next, active)) return;
    activate(next);
    try {
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next));
    } catch {
        // Cache write failure only costs us the head start on next launch.
    }
};

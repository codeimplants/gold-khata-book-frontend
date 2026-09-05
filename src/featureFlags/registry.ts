/**
 * Feature flags: what exists, what it defaults to, and how a flag is resolved.
 *
 * Adding a flag is one entry here plus wherever it is read. Nothing else — no
 * backend deploy, no migration, no app release. The backend stores flags as a
 * free-form key -> boolean map (`platformConfig.featureFlags`), so a key it has
 * never heard of is stored and served without change.
 *
 * ── Two layers, and why ──────────────────────────────────────────────────────
 *
 *  1. `platformConfig.featureFlags` — this product's own switch, edited in the
 *     Gold Khata Book admin. The everyday control.
 *  2. Nexus `featureFlags` — the cross-product control plane, which already owns
 *     force-update and the kill switch. It can only force a flag OFF.
 *
 * Nexus deliberately cannot force a flag ON. One clear rule beats two equal
 * sources of truth: with both able to win, a flag set in Nexus and forgotten
 * makes the product admin's toggle look broken, and nobody can tell which
 * setting is in force. "Nexus can kill, the product decides" is explainable in a
 * sentence and matches what each system already is.
 *
 * ── Flags fail OPEN, always ──────────────────────────────────────────────────
 *
 * Absent data never disables a feature. Missing map, missing key, unreachable
 * backend, unreachable Nexus — all mean "use the compiled default".
 *
 * This is not caution for its own sake. `VersionSDK.checkVersion()` returns
 * `{ action: 'NONE' }` with **no `raw`** on every failure path: network error,
 * timeout, bad API key. And 1.0.15 shipped with an empty VITE_VC_API_KEY, so
 * every Nexus call 401'd for twelve days with no visible symptom. Had flags
 * failed closed, every flagged feature in the app would have silently vanished
 * for that entire period, and the config mechanism meant to fix a bad release
 * would itself have been the thing breaking the app.
 */

import { APP_ENV } from '../config';

export type FeatureFlagKey = 'tutorials' | 'oldGoldMelt';

type FeatureFlagDefinition = {
  /** Used when neither layer has an opinion. */
  default: boolean;
  /** Why this flag exists — read by whoever finds it turned off in two years. */
  description: string;
};

export const FEATURE_FLAGS: Record<FeatureFlagKey, FeatureFlagDefinition> = {
  tutorials: {
    /**
     * OFF until the videos exist.
     *
     * Off in the *compiled* default, not merely in remote config, and the
     * difference matters. The "?" icons and empty-state links already hide
     * themselves when no tutorial covers their topic, but the Settings row does
     * not — it is gated on this flag alone. Were the default `true` with a remote
     * `false`, any install whose config request failed would fall back to the
     * default and show a menu row leading to "Tutorials coming soon". Shipping
     * unfinished is a property of the build, so the build is where it is decided.
     *
     * Turning it on later needs no release: a product flag of `true` from
     * /api/platform/config beats this default. That is the flag earning its keep.
     */
    default: false,
    description: 'In-app video tutorials: the library, the "?" icons and the empty-state links.',
  },

  oldGoldMelt: {
    /**
     * ON while testing, OFF in anything that reaches a shop.
     *
     * Melt is unfinished enough that it must not appear in a release, and
     * whether a build is a release is a property of the build — the same
     * argument as `tutorials` above, which is why this is a compiled default
     * rather than something switched off remotely.
     *
     * `APP_ENV` is the guard, NOT `__DEV__`. webpack.config.js defines
     * `__DEV__: true` unconditionally, so it is true in `npm run build` too and
     * would have shipped melt to the hosted web app. `APP_ENV` is set per
     * invocation — `dev` for `npm run dev` and the run-on-device scripts,
     * `prod` for `npm run build`, build-playstore-aab.ps1 and release-ios.sh —
     * so a store or web release cannot pick this up by accident.
     *
     * Flags here fail OPEN: absent config means "use the compiled default", so
     * the default IS the failure mode. `false` in prod is what keeps a shop
     * that does not take old ornaments from being shown melt controls because a
     * config request timed out. Turning it on for real shops later needs no
     * release — a product flag of `true` from /api/platform/config beats this.
     *
     * ── TO SHIP: delete the APP_ENV expression, make this `false`. ──
     *
     * This flag only decides whether the product OFFERS melt. Whether a
     * particular shop does is `shopDetails.oldGoldMelt`, and both have to say
     * yes — see `useOldGoldMelt`. Rollout is this flag's job; "we don't do melt
     * here" is the shopkeeper's, and conflating the two would mean turning the
     * feature on for everyone the moment one shop asked for it.
     */
    default: APP_ENV !== 'prod',
    description:
      'Old-gold melt: taking ornaments in for melt, the credit it earns a retailer, and drawing that credit down onto an order.',
  },
};

export type FeatureFlagMap = Partial<Record<string, boolean>>;

/**
 * Resolve one flag.
 *
 * Pure and total: any combination of missing, malformed or unknown input
 * resolves to a boolean, and never to `false` merely because something was
 * absent. Only an explicit `false` disables.
 */
export const resolveFeatureFlag = (
  key: FeatureFlagKey,
  productFlags?: FeatureFlagMap | null,
  nexusFlags?: FeatureFlagMap | null,
): boolean => {
  const compiled = FEATURE_FLAGS[key]?.default ?? false;

  // Layer 1: the product's own switch. Only a real boolean counts — a string
  // "false" from a hand-edited config must not read as a disable, because that
  // is a truthy value and would silently do the opposite of what it looks like.
  const product = productFlags?.[key];
  let enabled = typeof product === 'boolean' ? product : compiled;

  // Layer 2: Nexus, which can only take a flag away.
  if (nexusFlags?.[key] === false) enabled = false;

  return enabled;
};

/**
 * Pull the flag map out of a Nexus version-check response.
 *
 * Reads `decision.raw`, which the SDK sets to the entire backend response — so
 * Nexus can start serving `featureFlags` and already-published builds pick it up
 * with no app release and no SDK release. That is the whole reason this is
 * written now rather than when the Nexus side lands.
 *
 * Anything unexpected yields an empty map, which disables nothing.
 */
export const readNexusFeatureFlags = (raw: unknown): FeatureFlagMap => {
  const flags = (raw as { featureFlags?: unknown } | null | undefined)?.featureFlags;
  if (!flags || typeof flags !== 'object' || Array.isArray(flags)) return {};
  const out: FeatureFlagMap = {};
  for (const [key, value] of Object.entries(flags as Record<string, unknown>)) {
    // Only booleans are meaningful; ignore everything else rather than coercing,
    // so a malformed value cannot turn into an accidental disable.
    if (typeof value === 'boolean') out[key] = value;
  }
  return out;
};

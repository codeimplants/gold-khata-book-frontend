import type { Language } from '../localization';

/**
 * Shape of the tutorial library, plus the language-picking rules both tutorial
 * screens need.
 *
 * The library itself is server-driven (see utils/tutorialsCatalog.ts) so videos
 * can be added, re-ordered or retired without a store release. This file holds
 * only the types, the pure helpers, and the bundled fallback used before the
 * first successful fetch.
 */

export interface TutorialVideo {
  /** YouTube video id, not a URL. The player builds the embed URL from it. */
  youtubeId: string;
  /** Shown on the row so someone on mobile data knows the cost before tapping. */
  durationSec?: number;
}

/** English is always present and is the fallback for every other language. */
export type LocalizedText = Partial<Record<Language, string>> & { en: string };
export type LocalizedVideo = Partial<Record<Language, TutorialVideo>> & {
  en: TutorialVideo;
};

export interface Tutorial {
  slug: string;
  categoryId: string;
  title: LocalizedText;
  description?: Partial<Record<Language, string>>;
  video: LocalizedVideo;
  /** Screen keys this tutorial answers — see HELP_TOPICS below. */
  topics?: string[];
  /**
   * Inclusive app-version range this tutorial applies to. Both optional; neither
   * set means every version. See `appliesToVersion` for why this is filtered here
   * rather than server-side.
   */
  minAppVersion?: string;
  maxAppVersion?: string;
  order: number;
}

export interface TutorialCategory {
  slug: string;
  title: LocalizedText;
  order: number;
}

export interface TutorialLibrary {
  categories: TutorialCategory[];
  tutorials: Tutorial[];
}

/**
 * Screen keys for the contextual "?" header icon.
 *
 * Kept in the app rather than the backend because the app owns its own screen
 * names: adding a topic to a new screen must not need a backend change. An admin
 * types the matching string into a tutorial's `topics` list.
 */
export const HELP_TOPICS = {
  createInvoice: 'create-invoice',
  advanceOrder: 'advance-order',
  orderDetails: 'order-details',
  shopDetails: 'shop-details',
  gst: 'gst',
  printSettings: 'print-settings',
  metalRates: 'metal-rates',
  items: 'items',
  customers: 'customers',
  billHistory: 'bill-history',
  orders: 'orders',
} as const;

export type HelpTopic = (typeof HELP_TOPICS)[keyof typeof HELP_TOPICS];

/**
 * What the library falls back to before the first fetch succeeds — a fresh
 * install with no network, which is exactly when a new user is most lost.
 *
 * Empty on purpose. A tutorial needs a real YouTube id, and inventing one ships
 * a black player that reads as a broken app; the screen's empty state is honest
 * where a placeholder would not be. Once the first videos are recorded, paste
 * the same entries the admin editor holds in here so day-one offline installs
 * get them too. Nothing else needs to change: the screens already render from
 * whatever this resolves to.
 */
export const TUTORIAL_FALLBACK: TutorialLibrary = {
  categories: [],
  tutorials: [],
};

/**
 * Numeric-part comparison, so "1.0.10" > "1.0.9" — which string comparison gets
 * wrong, and which starts mattering the moment a version count passes 9. Missing
 * parts count as 0, so "1.1" and "1.1.0" are equal. Mirrors the same function in
 * gold-khata-book-backend/src/modules/tutorial/tutorial.model.ts.
 */
export const compareVersions = (a: string, b: string): number => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (Number.isNaN(diff)) return 0;
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
};

/**
 * Whether this build should be offered this tutorial.
 *
 * Filtered in the app rather than by the server for two reasons: the cached
 * library must stay correct offline *after* an app update, which a payload
 * filtered at fetch time would not be; and one cached copy then serves whatever
 * version the user upgrades to.
 *
 * An unreadable version resolves to showing the tutorial. A user who can't be
 * version-checked is better off with a possibly-dated video than with an empty
 * help screen.
 */
export const appliesToVersion = (tutorial: Tutorial, appVersion: string | null): boolean => {
  const { minAppVersion, maxAppVersion } = tutorial;
  if (!minAppVersion && !maxAppVersion) return true;
  if (!appVersion) return true;
  if (minAppVersion && compareVersions(appVersion, minAppVersion) < 0) return false;
  if (maxAppVersion && compareVersions(appVersion, maxAppVersion) > 0) return false;
  return true;
};

/**
 * Text in the active language, falling back to English.
 *
 * Returns whether it fell back, so the UI can say "in English" rather than
 * quietly showing the wrong language — most users here read Marathi, Hindi or
 * Gujarati, and a silent switch looks like a bug.
 */
export const pickText = (
  map: Partial<Record<Language, string>> | undefined,
  lang: Language,
): { text: string; isFallback: boolean } => {
  const own = map?.[lang]?.trim();
  if (own) return { text: own, isFallback: false };
  return { text: map?.en?.trim() ?? '', isFallback: Boolean(map?.en?.trim()) };
};

/** The video to play, and which language it is actually in. */
export const pickVideo = (
  video: LocalizedVideo,
  lang: Language,
): { video: TutorialVideo; lang: Language; isFallback: boolean } => {
  const own = video[lang];
  if (own?.youtubeId) return { video: own, lang, isFallback: false };
  return { video: video.en, lang: 'en', isFallback: lang !== 'en' };
};

/** "4:05" — omitted entirely when the duration is unknown. */
export const formatDuration = (durationSec?: number): string | undefined => {
  if (!durationSec || durationSec <= 0) return undefined;
  const total = Math.round(durationSec);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

/** Watch URL for the "Open in YouTube" action and for sharing. */
export const youtubeWatchUrl = (youtubeId: string): string =>
  `https://youtu.be/${youtubeId}`;

/**
 * Embed URL for the in-app player.
 *
 * youtube-nocookie.com is the privacy-preserving embed host — no tracking
 * cookies until playback starts. `playsinline=1` is required or iOS takes over
 * the screen with its native fullscreen player; `rel=0` keeps YouTube from
 * suggesting unrelated channels' videos when ours ends.
 */
export const youtubeEmbedUrl = (youtubeId: string, lang: Language): string =>
  `https://www.youtube-nocookie.com/embed/${youtubeId}` +
  `?rel=0&playsinline=1&modestbranding=1&hl=${lang}&cc_lang_pref=${lang}`;

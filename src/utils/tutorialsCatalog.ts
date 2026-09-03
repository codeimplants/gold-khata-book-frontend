import AsyncStorage from '@react-native-async-storage/async-storage';

import { apiClient } from '../api/apiClient';
import { withCoreRetry } from '../api/request';
import { getVersionName } from './appVersion';
import {
  TUTORIAL_FALLBACK,
  appliesToVersion,
  type Tutorial,
  type TutorialCategory,
  type TutorialLibrary,
} from '../tutorials/catalog';

/**
 * Where the in-app tutorial library comes from at runtime.
 *
 * Same three-tier resolution as versionControlConfig.ts, for the same reason:
 *
 *   1. the library from /api/tutorials
 *   2. the last library seen, cached on device
 *   3. the bundled TUTORIAL_FALLBACK
 *
 * (2) is what makes the screen usable on a train or in a shop with no signal —
 * the fetch fails and the user still gets the list they saw yesterday. (3) only
 * covers a first run that has never reached the network.
 *
 * Unlike the version-control config, this is fetched lazily when someone opens
 * the library rather than at launch. Most users never open it, and it must never
 * compete with the launch request that carries force-update and the kill switch.
 */

const CACHE_KEY = 'tutorials.catalog.v1';

/** Long enough that reopening the screen is free, short enough that a video
 *  swap reaches users the same day. */
const TTL_MS = 6 * 60 * 60 * 1000;

type CachedLibrary = TutorialLibrary & { fetchedAt: number };

let active: TutorialLibrary = TUTORIAL_FALLBACK;
let fetchedAt = 0;
let hydrating: Promise<void> | null = null;
let refreshing: Promise<void> | null = null;

type Listener = (library: TutorialLibrary) => void;
const listeners = new Set<Listener>();

export const onTutorialsChange = (fn: Listener): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/**
 * A library worth activating. Requires at least one tutorial with a slug and an
 * English video: a backend that answers with an empty or half-written list must
 * not blank out a working cached copy.
 */
const isUsable = (lib?: Partial<TutorialLibrary> | null): lib is TutorialLibrary =>
  Array.isArray(lib?.categories) &&
  Array.isArray(lib?.tutorials) &&
  lib.tutorials.length > 0 &&
  lib.tutorials.every(t => Boolean(t?.slug) && Boolean(t?.video?.en?.youtubeId));

const activate = (lib: TutorialLibrary, at: number): void => {
  active = lib;
  fetchedAt = at;
  listeners.forEach(fn => {
    try {
      fn(active);
    } catch {
      // A misbehaving listener must not stop the others.
    }
  });
};

/** Load the cached library. Safe to call repeatedly; the work happens once. */
export const hydrateTutorials = async (): Promise<void> => {
  if (!hydrating) {
    hydrating = (async () => {
      try {
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        if (!raw) return;
        const cached = JSON.parse(raw) as Partial<CachedLibrary>;
        // Read before the type guard below narrows `cached` to TutorialLibrary,
        // which does not carry fetchedAt.
        const cachedAt = typeof cached?.fetchedAt === 'number' ? cached.fetchedAt : 0;
        if (isUsable(cached)) {
          activate({ categories: cached.categories, tutorials: cached.tutorials }, cachedAt);
        }
      } catch {
        // Corrupt or unreadable cache: fall through to the bundled fallback.
      }
    })();
  }
  return hydrating;
};

const isStale = (): boolean => Date.now() - fetchedAt > TTL_MS;

/**
 * Fetch the library and remember it. Resolves either way — a failed refresh
 * leaves whatever was already active, because a help screen that shows
 * yesterday's list beats one that shows an error.
 *
 * `force` skips the TTL check, for pull-to-refresh.
 */
export const refreshTutorials = async (force = false): Promise<void> => {
  await hydrateTutorials();
  if (!force && !isStale()) return;
  if (refreshing) return refreshing;

  refreshing = (async () => {
    try {
      const res = await withCoreRetry(
        () =>
          apiClient.get<{ success: boolean; data: TutorialLibrary }>('/api/tutorials'),
        { action: 'fetchTutorials', component: 'tutorialsCatalog' },
      );
      const lib = res.data?.data;
      if (!isUsable(lib)) return;
      const now = Date.now();
      activate({ categories: lib.categories, tutorials: lib.tutorials }, now);
      try {
        await AsyncStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ ...lib, fetchedAt: now } satisfies CachedLibrary),
        );
      } catch {
        // Cache write failure only costs the head start on next launch.
      }
    } catch {
      // Offline or the endpoint is down. The active library stands.
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
};

/**
 * The library this build should show: active tutorials whose version range
 * covers the installed app, in the order an admin set.
 *
 * Synchronous, so a screen can render immediately from the cache and let a
 * refresh land afterwards through onTutorialsChange.
 */
export const getTutorials = (): TutorialLibrary => {
  const appVersion = getVersionName();
  const tutorials = active.tutorials.filter(t => appliesToVersion(t, appVersion));
  // Drop categories that ended up empty after version filtering — an empty
  // section header reads as a loading failure.
  const populated = new Set(tutorials.map(t => t.categoryId));
  return {
    categories: active.categories.filter(c => populated.has(c.slug)),
    tutorials,
  };
};

export const getTutorial = (slug?: string): Tutorial | undefined =>
  slug ? getTutorials().tutorials.find(t => t.slug === slug) : undefined;

/** Tutorials tagged with a screen's help topic, for the contextual "?" icon. */
export const getTutorialsForTopic = (topic?: string): Tutorial[] => {
  if (!topic) return [];
  return getTutorials().tutorials.filter(t => t.topics?.includes(topic));
};

/** Whether any tutorial covers a topic — used to hide the "?" icon when none does. */
export const hasTutorialsForTopic = (topic?: string): boolean =>
  getTutorialsForTopic(topic).length > 0;

/** Categories in display order, each with its tutorials. Empty groups omitted. */
export const getGroupedTutorials = (): Array<{
  category: TutorialCategory;
  tutorials: Tutorial[];
}> => {
  const { categories, tutorials } = getTutorials();
  return categories
    .map(category => ({
      category,
      tutorials: tutorials.filter(t => t.categoryId === category.slug),
    }))
    .filter(group => group.tutorials.length > 0);
};

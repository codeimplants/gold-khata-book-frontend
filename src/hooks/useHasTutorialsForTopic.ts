import { useEffect, useState } from 'react';

import {
  hasTutorialsForTopic,
  hydrateTutorials,
  onTutorialsChange,
  refreshTutorials,
} from '../utils/tutorialsCatalog';
import { useFeatureFlag } from './useFeatureFlag';

/**
 * Whether any tutorial covers a screen's help topic.
 *
 * Callers need this rather than just rendering a self-hiding button because a
 * header has to know whether the slot is occupied — a component that returns
 * null is still a truthy element, so layout decisions cannot be made from it.
 *
 * Reads the cached library first (AsyncStorage, no network), then kicks off the
 * TTL-gated refresh. That refresh is what lets a fresh install show the "?"
 * without the user having opened the library by hand first, and it stays well
 * away from the launch critical path — it only runs when a screen that declares
 * a help topic is mounted.
 */
export const useHasTutorialsForTopic = (topic?: string): boolean => {
  const enabled = useFeatureFlag('tutorials');
  const [hasHelp, setHasHelp] = useState(false);

  useEffect(() => {
    // Gated here rather than at each call site so one check covers every "?" icon
    // and every empty-state link — the two components that read this hook are the
    // only things that render those.
    if (!topic || !enabled) {
      setHasHelp(false);
      return;
    }
    let alive = true;
    const update = () => {
      if (alive) setHasHelp(hasTutorialsForTopic(topic));
    };
    const unsubscribe = onTutorialsChange(update);
    void hydrateTutorials().then(() => {
      update();
      void refreshTutorials();
    });
    return () => {
      alive = false;
      unsubscribe();
    };
    // `enabled` belongs here: the flag resolves to its compiled default while the
    // config request is in flight, so it can flip mid-session. Without it the
    // effect would not re-run and a remote "off" would only apply after a
    // remount — which on a screen the user is already sitting on means never.
  }, [topic, enabled]);

  return hasHelp;
};

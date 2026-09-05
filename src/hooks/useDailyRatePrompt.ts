import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppSelector } from '../store/hooks';
import { todayKey } from '../store/data/dataSlice';
import { useShopRate } from './useShopRate';

const ASKED_KEY = 'shop_rate_prompted_on';

/**
 * Asks for today's rate once a day, and then leaves the shopkeeper alone.
 *
 * "Once a day" is the whole design. A prompt on every launch is one people
 * learn to dismiss without reading, which is exactly how a shop ends up
 * trading at a rate nobody chose — so the day it was last shown is remembered
 * and it does not come back until the date changes.
 *
 * Dismissed counts as shown. Choosing the live rate is a decision, and
 * re-asking after it would be arguing with an answer already given; the rate
 * is still changeable any time from the dashboard or Settings.
 *
 * The marker is per-device on purpose. It records "this shopkeeper has been
 * asked on this screen today", which is a property of the sitting rather than
 * of the shop — and the rate itself is on the server, so a second device that
 * asks and gets an answer still sees the rate the first one set.
 */
export const useDailyRatePrompt = () => {
  const isGuest = useAppSelector(s => s.auth.isGuest);
  const { isOverride, loaded, liveRate } = useShopRate();
  const [visible, setVisible] = React.useState(false);
  const decided = React.useRef(false);

  React.useEffect(() => {
    // Wait for the answer. Prompting before the shop's rate has loaded would
    // ask people who already set one this morning.
    if (isGuest || !loaded || decided.current) return;
    // Nothing to prompt for without a market figure to decide against — the
    // rates call has not landed yet.
    if (liveRate <= 0) return;
    if (isOverride) { decided.current = true; return; }

    let cancelled = false;
    (async () => {
      const today = todayKey();
      let askedOn: string | null = null;
      try {
        askedOn = await AsyncStorage.getItem(ASKED_KEY);
      } catch {
        // A device that cannot read its own storage should still work; the
        // worst case is being asked twice, which beats never being asked.
      }
      if (cancelled) return;
      decided.current = true;
      if (askedOn !== today) setVisible(true);
    })();

    return () => { cancelled = true; };
  }, [isGuest, loaded, isOverride, liveRate]);

  const dismiss = React.useCallback(async () => {
    setVisible(false);
    try {
      await AsyncStorage.setItem(ASKED_KEY, todayKey());
    } catch {
      // See above — failing to remember is not worth failing the dismissal.
    }
  }, []);

  return { visible, dismiss };
};

import React from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchShopRate, todayKey } from '../store/data/dataSlice';
import type { MetalRates } from '../store/data/dataSlice';

export interface EffectiveRate {
  /** The rate every calculation should use. */
  rate: number;
  /** The market feed, kept separately so a screen can show both. */
  liveRate: number;
  /** True when the shopkeeper has set today's rate themselves. */
  isOverride: boolean;
  /** True once the answer is known — `!isOverride` before this is just "not
   *  loaded yet", and showing "using the live rate" then would be a guess. */
  loaded: boolean;
}

/**
 * The rate the shop is actually dealing at today.
 *
 * Two sources, and which one is in force has to be visible rather than
 * inferred: the shopkeeper's own rate for today when they have set one, the
 * live market feed when they have not. Every screen that prices anything reads
 * through here so they cannot disagree about what today's rate is — the same
 * reason `dues.ts` is the single definition of what a retailer owes.
 *
 * There is deliberately no carry-forward. Yesterday's rate is not today's, and
 * a rate that quietly stays in force for a week is worse than falling back to
 * the market, because nobody notices it happening.
 *
 * Guests never have an override: it lives on the shop record, and a guest has
 * no shop record. They stay on the live rate, which is what they had before
 * this existed.
 */
export const useShopRate = (): EffectiveRate => {
  const dispatch = useAppDispatch();
  const isGuest = useAppSelector(s => s.auth.isGuest);
  const liveRate = useAppSelector(
    s => Number(s.data.metalRates?.gold?.goldPrice24K995GW || 0),
  );

  const key = todayKey();
  const entry = useAppSelector(s => s.data.shopRates[key]);
  // `undefined` means never asked; `null` means asked and there is none.
  const loaded = isGuest || entry !== undefined;

  React.useEffect(() => {
    if (isGuest || entry !== undefined) return;
    dispatch(fetchShopRate({ date: key }));
  }, [dispatch, isGuest, entry, key]);

  const override = entry?.goldRate || 0;

  return {
    rate: override > 0 ? override : liveRate,
    liveRate,
    isOverride: override > 0,
    loaded,
  };
};

/**
 * The metal rates as the rest of the app should see them.
 *
 * The market feed with the 99.50 gold price swapped for whatever the shop is
 * actually dealing at today. Screens and helpers that already take a
 * `MetalRates` — `getRateForPurity`, the advance-order screens — take this
 * instead of the raw feed, so the shop's own rate reaches them without every
 * one of them having to learn about the override.
 *
 * Only the 99.50 gold price is replaced. Silver and the per-karat golds are
 * still the feed's, because the shop sets one rate and it is that one; the
 * others are quotes nothing here is struck at anyway.
 */
export const useEffectiveMetalRates = (): MetalRates | null => {
  const metalRates = useAppSelector(s => s.data.metalRates);
  const { rate } = useShopRate();

  return React.useMemo(() => {
    if (!metalRates) return metalRates;
    if (!rate || rate <= 0) return metalRates;
    return {
      ...metalRates,
      gold: { ...metalRates.gold, goldPrice24K995GW: rate },
    };
  }, [metalRates, rate]);
};

import { useAppSelector } from '../store/hooks';
import { useFeatureFlag } from './useFeatureFlag';

/**
 * Whether the retail billing fields should exist for this shop.
 *
 * Deliberately the same shape as `useOldGoldMelt`, and for the same reasons —
 * two switches, both of which have to say yes:
 *
 *   1. the `retail` feature flag — does the PRODUCT offer retail billing at
 *      all. Ours to control, off by default, and how it gets pulled back
 *      without a store release.
 *   2. `shopDetails.retailEnabled` — does THIS wholesaler also serve walk-in
 *      customers. The shopkeeper's own answer, on the shop record so the
 *      counter and the back office agree about it.
 *
 * Collapsing them into one would mean either turning retail on for every shop
 * the moment one asks for it, or letting a shop switch on something still being
 * rolled out.
 *
 * Undefined on the shop reads as off. A wholesaler who has never seen the
 * setting is not billing retail today, and showing making-charge and discount
 * fields on their order screen would invent a workflow they never asked for —
 * which is the state this hook exists to end.
 *
 * Guests get false regardless: a guest install has no shop record to hold the
 * setting.
 *
 * ── What this does NOT decide ───────────────────────────────────────────────
 *
 * Whether a PARTICULAR bill is retail or wholesale. A shop doing both needs to
 * say so per bill, and that switch does not exist yet. Until it does, a
 * retail-enabled shop sees the fields on every bill — which is why the flag
 * defaults off and this is not simply `shopDetails.retailEnabled` on its own.
 */
export const useRetail = (): boolean => {
  const flagEnabled = useFeatureFlag('retail');
  const isGuest = useAppSelector(s => s.auth.isGuest);
  const shopEnabled = useAppSelector(s => (s.data.shopDetails as any)?.retailEnabled);

  return flagEnabled && !isGuest && shopEnabled === true;
};

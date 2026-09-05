import { useAppSelector } from '../store/hooks';
import { useFeatureFlag } from './useFeatureFlag';

/**
 * Whether the old-gold melt controls should exist for this shop.
 *
 * Two switches, and both have to say yes:
 *
 *   1. the `oldGoldMelt` feature flag — does the PRODUCT offer melt at all.
 *      Ours to control, off by default, and how a bad rollout gets pulled back
 *      without a store release.
 *   2. `shopDetails.oldGoldMelt` — does THIS wholesaler take old ornaments.
 *      The shopkeeper's own answer, stored on the shop record so the counter PC
 *      and the back office agree about it.
 *
 * They are deliberately not one setting. Collapsing them would mean either
 * turning melt on for every shop the moment one asks for it, or letting a shop
 * switch on a feature we are still rolling out.
 *
 * Undefined on the shop means never answered, which reads as off: a wholesaler
 * who has never seen the setting is not doing melt in the app today, and
 * showing them a Melt tender on the order screen would be inventing a workflow
 * they never asked for.
 *
 * Guests get `false` regardless — melt credit is a per-retailer balance that
 * only exists on the server, and a guest install has no shop record to hold the
 * setting or account to hold the balance.
 */
export const useOldGoldMelt = (): boolean => {
  const flagEnabled = useFeatureFlag('oldGoldMelt');
  const isGuest = useAppSelector(s => s.auth.isGuest);
  const shopEnabled = useAppSelector(s => s.data.shopDetails?.oldGoldMelt);

  return flagEnabled && !isGuest && shopEnabled === true;
};

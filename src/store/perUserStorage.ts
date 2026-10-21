import AsyncStorage from '@react-native-async-storage/async-storage';
import { DATA_STORAGE_KEYS } from './data/dataSlice';

/**
 * What one account leaves on the phone's disk, removed when it logs out.
 *
 * The data slice is emptied in memory on logout (dataSlice.ts). This is the
 * on-disk half: a phone is often shared at the counter, and the next person to
 * sign in must not start from the last person's book.
 *
 * The keys are declared here and imported by the code that writes them, so a
 * new or renamed key cannot quietly fall out of this list.
 *
 * Deliberately NOT cleared, because they belong to the device and not to an
 * account: the app language, the printer and paper settings, the biometric
 * lock, and the "this device has registered" flag.
 *
 * Also not cleared, although it is per shop: `@catalog_taxonomy`, the
 * ornaments a shop added to the item list (useShopTaxonomy). It lives only on
 * this device, with no server copy yet, so removing it here would delete those
 * additions for good. Until it moves to the server or is keyed per account, the
 * next account on the phone sees those ornament names in the picker.
 */

/** Recent item picks, one key per metal. They name this shop's own catalogue. */
export const ITEM_PICKER_RECENT_PREFIX = '@itemPicker_recent_v1:';

/** The day the shopkeeper was last asked for today's rate (useDailyRatePrompt). */
export const RATE_PROMPTED_KEY = 'shop_rate_prompted_on';

const PER_USER_KEYS: string[] = [...DATA_STORAGE_KEYS, RATE_PROMPTED_KEY];
const PER_USER_PREFIXES = [ITEM_PICKER_RECENT_PREFIX];

export const clearPerUserStorage = async (): Promise<void> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const doomed = keys.filter(
      k => PER_USER_KEYS.includes(k) || PER_USER_PREFIXES.some(p => k.startsWith(p)),
    );
    if (doomed.length > 0) await AsyncStorage.multiRemove(doomed);
  } catch (err) {
    // The logout itself has already happened, and the in-memory book is
    // already gone. Failing to tidy the disk must not undo either.
    console.warn('[perUserStorage] could not clear per-user keys:', err);
  }
};

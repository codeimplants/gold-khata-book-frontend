import type { WitnessFormValue } from '../types';

/**
 * A blank witness row, carrying the id its photos will be addressed by.
 *
 * The id is generated here rather than server-side so the app can upload a
 * witness's ID proof immediately after the declaration saves, without having
 * to match rows back up by position. The backend keeps whatever id it is sent.
 */
export const makeEmptyWitness = (): WitnessFormValue => ({
  id: `wit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  name: '',
  pendingPhotos: [],
});

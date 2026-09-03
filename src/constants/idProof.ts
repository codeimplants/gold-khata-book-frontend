import type { IdProofType } from '../types';

/** Shared between the declaration form and the customer profile's optional
 *  ID-proof section, so the two pickers can never drift out of sync. */
export const ID_PROOF_TYPES: IdProofType[] = [
  'aadhaar',
  'pan',
  'voter',
  'driving_licence',
  'passport',
  'other',
];

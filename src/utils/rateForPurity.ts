import type { MetalRates } from '../store/data/dataSlice';
import { deriveRateFromPureGold } from './itemPlausibility';

/**
 * Today's per-gram rate for a purity, or 0 when we genuinely have no opinion.
 *
 * This lived twice — once in `InvoiceCreationScreen`, once in
 * `AdvanceOrderScreen` — with the same gap in both copies, so a fix to one
 * silently left the other wrong. One implementation now, imported by both.
 *
 * The gap: the upstream rate API quotes exactly four gold purities
 * (24K/22K/18K/14K), but the app offers nine. For 23K, 21K, 20K, 17K and 9K the
 * old code fell through to `return 0`, and zero does not read as "unknown"
 * downstream — it switches things off. Both the "Today's rate" hint and the
 * entire rate-sanity guard are gated on `liveRate > 0`, so on those five
 * purities the shopkeeper got no reference figure and no warning, whatever they
 * typed. Two of the production mis-entries found on 2026-08-13 were 20K, and
 * neither could have been caught.
 *
 * Unquoted purities are now derived from the 24K quote by purity fraction. That
 * is an approximation of metal value, not a shop's selling rate — it carries no
 * making or wastage spread. It is used for exactly two jobs, a ballpark hint and
 * deciding whether an entry is off by a factor of ten or a thousand, and it is
 * far better at both than zero.
 */
export const getRateForPurity = (
  purity: string | number,
  metalRates?: MetalRates | null,
): number => {
  if (!purity && purity !== 0) return 0;

  // A wholesale item stores purity as a NUMBER (91.6), where the retail screens
  // that built this helper stored a karat label ("22K - 91.6%"). Every branch
  // below is a string match, so a number reaching them threw
  // `purity.includes is not a function` and took the screen down. There is only
  // one wholesale rate — 24K at 99.50 — so a numeric purity resolves to it
  // rather than being pattern-matched into a per-karat quote it never had.
  if (typeof purity === 'number') {
    return metalRates?.gold?.goldPrice24K995GW || 0;
  }

  if (purity.includes('Silver')) {
    return purity.includes('Coin')
      ? metalRates?.silver?.silverBarPrice || 0
      : metalRates?.silver?.silverPrice || 0;
  }

  // Quoted purities always win over the derivation — a real quote beats maths.
  if (purity.includes('24K')) return metalRates?.gold?.goldPrice24K995GW || 0;
  if (purity.includes('22K')) return metalRates?.gold?.goldPrice22K || 0;
  if (purity.includes('18K')) return metalRates?.gold?.goldPrice18K || 0;
  if (purity.includes('14K')) return metalRates?.gold?.goldPrice14K || 0;

  return deriveRateFromPureGold(purity, metalRates?.gold?.goldPrice24K995GW || 0);
};

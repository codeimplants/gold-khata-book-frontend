import { GOLD_PURITY_OPTIONS } from '../constants/bill';
import { chargedPurity } from './goldPricing';

/**
 * Explaining the purity a wholesaler typed.
 *
 * A wholesaler enters the ROUNDED purity — 92 for 22K, 84 for 20K — because that
 * is the number they charge on and the number that goes on the bill. It is not
 * the metal's real fineness: 22K gold is 91.6% pure and is charged at 92%.
 *
 * That gap is the uplift in `chargedPurity` (`floor(actual) + 1`), and it is
 * real money. On 100 g at a 15,270 rate, the 0.4% between 91.6 and 92 is about
 * ₹6,100. Showing "91.6% + 0.4% = 92%" under the field states what the entered
 * number actually means, so the uplift is visible rather than folded silently
 * into a total.
 *
 * ── Why this is derived, not a table ────────────────────────────────────────
 *
 * The mapping is built at module load from GOLD_PURITY_OPTIONS run through
 * `chargedPurity`. Writing the pairs out by hand would create a third place
 * where purity lives, alongside the karat list and the pricing rule — and the
 * one most likely to be missed when a karat is added or the uplift rule
 * changes. Here, adding "19K - 79.2%" to the options list is enough; the split
 * for 80 appears on its own.
 *
 * The nine charged values are distinct (99.5, 96, 92, 88, 84, 76, 71, 59, 38),
 * so the inverse lookup is unambiguous. An entry that is not one of them — a
 * hand-typed 90, say — returns null and the hint simply does not render, rather
 * than inventing a fineness nobody stated.
 */
export interface PurityBreakdown {
  /** The metal's real fineness, e.g. 91.6 for 22K. */
  actual: number;
  /** What `chargedPurity` adds, e.g. 0.4. */
  uplift: number;
  /** The rounded purity the wholesaler entered, e.g. 92. */
  charged: number;
  /** The karat this came from, e.g. "22K". */
  karat: string;
}

const round1 = (n: number): number => Number(n.toFixed(1));

/**
 * charged purity -> the karat it came from.
 *
 * Built once. Later entries do not overwrite earlier ones, so if two karats
 * ever round to the same charged value the first in GOLD_PURITY_OPTIONS wins
 * and the behaviour stays deterministic instead of depending on list order.
 */
const BY_CHARGED: Map<number, PurityBreakdown> = (() => {
  const map = new Map<number, PurityBreakdown>();

  for (const option of GOLD_PURITY_OPTIONS) {
    // "22K - 91.6%" -> karat "22K", actual 91.6
    const match = /^(\d+K)\s*-\s*([\d.]+)\s*%$/.exec(option);
    if (!match) continue;

    const karat = match[1];
    const actual = Number(match[2]);
    if (!Number.isFinite(actual) || actual <= 0) continue;

    const charged = chargedPurity(actual);
    if (map.has(charged)) continue;

    map.set(charged, {
      actual,
      // Rounded to 1dp: floating point makes 92 - 91.6 land on
      // 0.40000000000000568, and "91.6% + 0.40000000000000568% = 92%" under a
      // field is worse than no hint at all.
      uplift: round1(charged - actual),
      charged,
      karat,
    });
  }

  return map;
})();

/**
 * The split for a rounded purity, or null when the value is not a karat the
 * app offers.
 *
 * Null is a normal answer, not a failure: the field accepts free text, and a
 * half-typed "9" on the way to "92" must not flash a hint for 9K.
 */
export const purityBreakdown = (entered: number | string): PurityBreakdown | null => {
  const value = Number(String(entered ?? '').trim());
  if (!Number.isFinite(value) || value <= 0) return null;

  const found = BY_CHARGED.get(value);
  if (!found) return null;

  // 24K is already at settlement fineness, so chargedPurity returns it
  // unchanged and there is no uplift to explain. Showing "99.5% + 0% = 99.5%"
  // would be noise.
  if (found.uplift <= 0) return null;

  return found;
};

/** "91.6% + 0.4% = 92%" — the hint as it reads under the field. */
export const formatPurityBreakdown = (entered: number | string): string | null => {
  const split = purityBreakdown(entered);
  if (!split) return null;
  return `${split.actual}% + ${split.uplift}% = ${split.charged}%`;
};

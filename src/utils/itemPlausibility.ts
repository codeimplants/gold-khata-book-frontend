/**
 * Is this weight/rate pair physically possible?
 *
 * Written from a real production case. Shop 9740423690 entered ornament weights
 * in milligrams — 2.030 gm typed as "2030" — with the correct rate, and got a
 * Rs.13-crore invoice. They deleted it and tried again. Seven times, across
 * three days. Then they found a workaround: keep the milligram weight and
 * divide the RATE by 1000 instead. 2030 x 15.123 is arithmetically identical to
 * 2.030 x 15,123, so every total, subtotal and printed grand total came out
 * exactly right while the weight and rate columns became nonsense (INV-37,
 * INV-40, INV-41).
 *
 * Two things follow, and they shape everything below:
 *
 *  1. The item card already showed them "Amount: Rs.1,37,08,000" on every one of
 *     those seven attempts. They never touched the weight field — they changed
 *     the rate. Money-level feedback proves something is wrong but does not
 *     locate WHICH field is wrong, so a finding here always names the field and
 *     carries the corrected number, never just a complaint.
 *
 *  2. The compensating pair is invisible to any per-field check: each value on
 *     its own is merely unusual, and the total is correct. Only the PAIR gives
 *     it away — weight ~1000x high AND rate ~1000x low, product intact. That is
 *     `scaled-pair` below, and it is the only signature we can auto-correct
 *     with certainty, because the intended values are recoverable exactly.
 *
 * Deliberately free of React, i18n and network so it can be unit-tested and
 * reused by the invoice form, the advance-order form and the saved-bill screen.
 * Message wording lives with the callers; this module only decides and computes.
 */

export type MetalKind = 'Gold' | 'Silver';

export type ItemFindingKind =
  /** weight x1000 and rate /1000 — total is right, both columns are wrong. */
  | 'scaled-pair'
  /** rate is far below anything real for this metal, weight looks normal. */
  | 'rate-too-low'
  /** rate is far above anything real — classically a per-10-gram entry. */
  | 'rate-too-high'
  /** weight alone is impossible for this metal (rate is fine). */
  | 'weight-too-high';

export interface ItemEntry {
  /** Item type ("Gold"/"Silver") and/or a purity label; either may carry the metal. */
  itemType?: string | null;
  purity?: string | null;
  /** Net weight in grams, as entered. */
  weight: number | string | null | undefined;
  /** Rate in rupees per gram, as entered. */
  rate: number | string | null | undefined;
}

export interface ItemFinding {
  kind: ItemFindingKind;
  metal: MetalKind;
  /** What was entered. */
  weight: number;
  rate: number;
  /** What we believe was meant. Only set for `scaled-pair`, where it is exact. */
  suggestedWeight?: number;
  suggestedRate?: number;
  /** The line total as entered, and as it would be if the suggestion is taken. */
  enteredTotal: number;
  suggestedTotal?: number;
}

/**
 * The window a real transaction has to sit inside, per metal. Generous on both
 * sides on purpose: this is a nudge, never a block, and a false positive costs
 * a shopkeeper an extra tap while a false negative costs a customer money.
 *
 * Gold spans 9K scrap to 24K bullion across years of rate movement, so the rate
 * window is wide. The weight ceiling is per LINE, not per bill — a single gold
 * ornament over 300 gm is exceptional; the milligram habit lands at 2000-10000.
 * Silver runs to kilograms legitimately (utensils, bars, scrap lots), so its
 * ceiling is far higher and its rate floor far lower.
 */
export const METAL_BOUNDS: Record<MetalKind, {
  rateMin: number;
  rateMax: number;
  weightMax: number;
}> = {
  Gold: { rateMin: 300, rateMax: 40000, weightMax: 300 },
  Silver: { rateMin: 5, rateMax: 900, weightMax: 5000 },
};

/** The factor the milligram habit introduces, in both directions. */
const SCALE = 1000;

/** How far off a scaled-back value may land and still count as "recovered". */
const RECOVERY_TOLERANCE = 0.25;

export const metalOf = (entry: Pick<ItemEntry, 'itemType' | 'purity'>): MetalKind =>
  /silver/i.test(String(entry.itemType ?? '')) || /silver/i.test(String(entry.purity ?? ''))
    ? 'Silver'
    : 'Gold';

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};

const within = (value: number, min: number, max: number) => value >= min && value <= max;

/**
 * Inspect one entered line. Returns `null` when the pair is plausible — which is
 * the overwhelmingly common case, so callers can treat a finding as exceptional.
 *
 * Order matters: `scaled-pair` is tested first because it is the only kind whose
 * intended values are known exactly, and a compensated line trips the weight and
 * rate tests individually too. Reporting it as "rate too low" would send the
 * shopkeeper to fix the rate — which is precisely the wrong field, and precisely
 * the mistake the production case already made on its own.
 */
export const inspectItemEntry = (entry: ItemEntry): ItemFinding | null => {
  const metal = metalOf(entry);
  const bounds = METAL_BOUNDS[metal];
  const weight = num(entry.weight);
  const rate = num(entry.rate);

  // A half-filled row is not a mistake, it is a row still being typed.
  if (weight <= 0 || rate <= 0) return null;

  const base: Omit<ItemFinding, 'kind'> = {
    metal,
    weight,
    rate,
    enteredTotal: weight * rate,
  };

  const rateTooLow = rate < bounds.rateMin;
  const rateTooHigh = rate > bounds.rateMax;
  const weightTooHigh = weight > bounds.weightMax;

  if (rateTooLow && weightTooHigh) {
    const suggestedWeight = weight / SCALE;
    const suggestedRate = rate * SCALE;
    // Only claim a recovery when scaling back actually lands both values inside
    // the window. Otherwise the pair is wrong in some way we cannot name, and
    // offering a confident "did you mean" would be worse than saying nothing
    // specific — fall through to the plain single-field findings below.
    if (
      within(suggestedWeight, 0, bounds.weightMax) &&
      within(suggestedRate, bounds.rateMin * (1 - RECOVERY_TOLERANCE), bounds.rateMax)
    ) {
      return {
        ...base,
        kind: 'scaled-pair',
        suggestedWeight,
        suggestedRate,
        // Identical to enteredTotal by construction; carried explicitly so the
        // UI can promise "the total does not change" from data, not from faith.
        suggestedTotal: suggestedWeight * suggestedRate,
      };
    }
  }

  if (rateTooHigh) {
    // The per-10-gram entry: the rupees are right, the unit is not. Recoverable
    // only when dividing by 10 lands back in range; otherwise it is just high.
    const scaledBack = rate / 10;
    return {
      ...base,
      kind: 'rate-too-high',
      ...(within(scaledBack, bounds.rateMin, bounds.rateMax)
        ? { suggestedRate: scaledBack, suggestedWeight: weight, suggestedTotal: weight * scaledBack }
        : {}),
    };
  }

  if (rateTooLow) return { ...base, kind: 'rate-too-low' };

  if (weightTooHigh) {
    // The milligram habit before it gets compensated: the rate is right, so the
    // intended weight is recoverable and the total moves by 1000x when fixed.
    // This is the moment the production case needed a hand and did not get one —
    // seven bills were deleted here rather than corrected.
    const scaledBack = weight / SCALE;
    return {
      ...base,
      kind: 'weight-too-high',
      ...(scaledBack > 0 && scaledBack <= bounds.weightMax
        ? { suggestedWeight: scaledBack, suggestedRate: rate, suggestedTotal: scaledBack * rate }
        : {}),
    };
  }

  return null;
};

/**
 * "2030 gm = 2.03 kg" — an implausible weight restated in the unit that makes it
 * obvious. Nobody sells two kilograms of gold across a counter, but "2030" in a
 * box reads as an ordinary number until someone converts it.
 *
 * Returns null below a kilogram, where grams are already the natural unit and a
 * conversion would be noise.
 */
export const asKilogramHint = (weightGm: number): string | null => {
  if (!(weightGm >= 1000)) return null;
  const kg = weightGm / 1000;
  return `${Number(kg.toFixed(3))} kg`;
};

/**
 * Live rates only exist for the four karats the upstream rate API quotes
 * (24K/22K/18K/14K). Every other purity the app offers — 23K, 21K, 20K, 17K, 9K
 * — had no rate at all, which silently switched off both the "Today's rate"
 * hint and the entire rate guard for those items. Two of the production
 * mis-entries were 20K, and they could not have been warned about.
 *
 * Deriving from the 24K quote by purity fraction is an approximation, not a
 * quote: it ignores the making/wastage spread a shop actually charges. That is
 * fine for its two jobs — showing a ballpark and deciding whether an entry is
 * off by a factor of ten or a thousand — and is far better than zero, which
 * reads as "no opinion" and disables the guard.
 */
export const purityFraction = (purity: string | null | undefined): number | null => {
  const match = String(purity ?? '').match(/(\d+(?:\.\d+)?)\s*%/);
  if (match) {
    const pct = parseFloat(match[1]);
    if (Number.isFinite(pct) && pct > 0 && pct <= 100) return pct / 100;
  }
  const karat = String(purity ?? '').match(/(\d+(?:\.\d+)?)\s*K/i);
  if (karat) {
    const k = parseFloat(karat[1]);
    if (Number.isFinite(k) && k > 0 && k <= 24) return k / 24;
  }
  return null;
};

/** 24K is quoted at 99.5% fine, not 100%, so the derivation is relative to that. */
const PURE_GOLD_FRACTION = 0.995;

export const deriveRateFromPureGold = (
  purity: string | null | undefined,
  pureGoldRate: number,
): number => {
  const fraction = purityFraction(purity);
  if (!fraction || !(pureGoldRate > 0)) return 0;
  return Math.round((pureGoldRate / PURE_GOLD_FRACTION) * fraction);
};

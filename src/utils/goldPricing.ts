/**
 * The wholesale pricing chain, mirrored from the server so the order screen can
 * price a line as it is typed.
 *
 * THE SERVER IS AUTHORITATIVE. This exists only to show a total before the
 * order is saved; every figure that ends up stored is recomputed by the Order
 * pre-save hook. Keep it in exact step with
 * `gold-khata-book-backend/src/common/utils/goldPricing.ts` — if you change one,
 * change both, and check `npm run verify:pricing` on the backend still passes.
 * A preview that disagrees with what saves is worse than no preview.
 */

/** The fineness every settlement is struck at. */
export const SETTLEMENT_FINENESS = 99.5;

const round3 = (n: number): number => Number((Number(n) || 0).toFixed(3));

/**
 * The purity the wholesaler actually charges on: `floor(actual) + 1`.
 *
 * Not `Math.ceil` — 18K is exactly 75 and still becomes 76. Stops at 23K,
 * because settlement metal is already 99.50 and uplifting it to 100 would
 * overcharge every payment made in pure gold.
 */
export const chargedPurity = (actualPurity: number): number => {
  const actual = Number(actualPurity) || 0;
  if (actual >= SETTLEMENT_FINENESS) return actual;
  return Math.floor(actual) + 1;
};

export interface LinePricing {
  chargedPurity: number;
  /** chargedPurity + wastage — the percentage the weight is taken at. */
  effectivePercent: number;
  fine999: number;
  /** What the retailer owes for this line, in grams of 99.50. */
  fine995: number;
}

/**
 * One line's fine-gold content.
 *
 * Wastage is ADDED to the charged purity, not multiplied against the fine
 * weight. `fine999` rounds to 3dp before the 99.50 conversion because that is
 * the figure written on the bill, and the retailer reconciles forward from
 * what is written.
 */
export const priceLine = (input: {
  weight: number;
  purity: number;
  wastage?: number;
}): LinePricing => {
  const purity = chargedPurity(input.purity);
  const effectivePercent = purity + (Number(input.wastage) || 0);

  const fine999 = round3(((Number(input.weight) || 0) * effectivePercent) / 100);
  const fine995 = round3((fine999 / SETTLEMENT_FINENESS) * 100);

  return { chargedPurity: purity, effectivePercent, fine999, fine995 };
};

/** Every line's 99.50 weight, summed — the order's metal position. */
export const totalFine995 = (
  items: { weight: number; purity: number; wastage?: number }[],
): number =>
  round3((items || []).reduce((sum, item) => sum + priceLine(item).fine995, 0));

/* ---------------------------------------------------------------------------
 * INBOUND vs OUTBOUND — the two directions are NOT the same conversion.
 *
 * Selling to a retailer converts 99.9 to 99.50 by ratio (/99.5 x 100).
 * Buying metal IN credits a flat +0.200% instead, which is the trade rule and
 * NOT the true ratio of +0.503%. On a 9.050 g lot the flat rule credits
 * 9.068 g where the ratio would give 9.096 g.
 *
 * Sharing one helper between the directions looks like removing duplication
 * and is really handing the wholesaler's margin back on every lot. Mirrored
 * from the backend's goldPricing.ts, which is authoritative.
 * ------------------------------------------------------------------------ */

/** Grams of settlement metal added converting 99.9 to 99.50 on the way IN. */
export const INBOUND_UPLIFT_PER_GRAM = 0.010 / 5;

/** 99.9 fine to the 99.50 the retailer is credited in. */
export const inboundFine995 = (fine999: number): number => {
  const fine = Number(fine999) || 0;
  return round3(fine + fine * INBOUND_UPLIFT_PER_GRAM);
};

/**
 * Metal handed over as a payment or a melt lot, in 99.50 terms.
 *
 * `purity` is used exactly as found — no uplift. Metal already at settlement
 * fineness passes through untouched rather than being credited a bonus it has
 * not earned.
 */
export const priceInboundMetal = (weight: number, purity: number): number => {
  const w = Number(weight) || 0;
  const p = Number(purity) || 0;
  if (w <= 0 || p <= 0) return 0;
  if (p >= SETTLEMENT_FINENESS) return round3(w * (p / SETTLEMENT_FINENESS));
  return inboundFine995(round3((w * p) / 100));
};

/** The weighings taken as a melt lot goes through the shop. */
export interface MeltLotWeights {
  /** What actually went into the pot, stones and lac already removed. */
  potWeight: number;
  /** The lagdi, once dirt and impurities have burnt off. */
  afterMelt: number;
  /** The lagdi again, after the skin test and rubbing took a little more. */
  afterTesting: number;
  /** What the test said, as a percentage. */
  purity: number;
}

export interface MeltLotPricing {
  /** potWeight - afterMelt: burnt off in the pot. */
  meltLoss: number;
  /** afterMelt - afterTesting: taken off by the test itself. */
  testLoss: number;
  /** afterTesting x purity — the pure content, at 99.9. */
  fine999: number;
  /** The same metal at 99.50, by the INBOUND trade rule — what gets credited. */
  fine995: number;
}

/**
 * What a melt lot is worth, stage by stage.
 *
 * The chain the shop actually walks: weigh what goes in the pot, weigh the
 * lagdi that comes out, weigh it again after testing, then apply the tested
 * purity. Every stage is kept because every one of them is a figure the
 * retailer can query later.
 *
 * The purity is the TESTED one, deliberately not run through `chargedPurity`.
 * That uplift (91.6 -> 92) is what a wholesaler charges a retailer when
 * SELLING; applying it to a lot the wholesaler is buying would credit metal
 * that was never in the bar.
 *
 * The result is converted to 99.50 because that is the fineness the retailer
 * account is denominated in — a lot that tests 9.050 fine at 99.9 is 9.095 of
 * settlement metal, and crediting the 99.9 figure straight would short the
 * retailer by about 0.5% of every lot they bring in.
 */
export const priceMeltLot = (w: MeltLotWeights): MeltLotPricing => {
  const pot = Number(w.potWeight) || 0;
  const melted = Number(w.afterMelt) || 0;
  const tested = Number(w.afterTesting) || 0;
  const purity = Number(w.purity) || 0;

  const fine999 = round3((tested * purity) / 100);

  return {
    meltLoss: round3(pot - melted),
    testLoss: round3(melted - tested),
    fine999,
    // INBOUND, not the ratio. A melt lot is metal the wholesaler is BUYING,
    // and the two directions convert differently on purpose — see the block
    // above. Using the outbound ratio here credited 9.095 where the trade rule
    // credits 9.068, handing back 0.027 g on a 9 g lot.
    fine995: priceInboundMetal(tested, purity),
  };
};

/** What that metal costs today. `rate` is per gram of 99.50. */
export const cashValueOfFine995 = (fine995: number, rate: number): number =>
  Number(((Number(fine995) || 0) * (Number(rate) || 0)).toFixed(2));

/** True once a line has enough entered to price. */
export const isLinePriceable = (item: {
  weight?: number | string;
  purity?: number | string;
}): boolean => Number(item.weight) > 0 && Number(item.purity) > 0;

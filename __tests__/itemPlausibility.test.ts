/**
 * Every fixture below is a real row pulled from production on 2026-08-13 while
 * diagnosing shop 9740423690's bills — not invented input. That is the point:
 * this file exists under the testing policy's one carve-out (pure money/weight
 * maths, after a bug reached a customer), so it asserts against what customers
 * were actually handed, and nothing else.
 */
import {
  inspectItemEntry,
  asKilogramHint,
  purityFraction,
  deriveRateFromPureGold,
} from '../src/utils/itemPlausibility';

const gold = (weight: number, rate: number, purity = '22K - 91.6%') =>
  inspectItemEntry({ itemType: 'Gold', purity, weight, rate });

const silver = (weight: number, rate: number) =>
  inspectItemEntry({ itemType: 'Silver', purity: 'Silver', weight, rate });

describe('the compensated pair (weight x1000, rate /1000)', () => {
  // The three live bills. Money is correct on all of them; only the columns lie.
  it.each([
    ['INV-41', 2030, 15.123, '22K - 91.6%', 2.03, 15123, 30699.69],
    ['INV-40', 2600, 15.19, '22K - 91.6%', 2.6, 15190, 39494],
    ['INV-37', 5030, 14.413, '24K - 99.5%', 5.03, 14413, 72497.39],
  ])('%s recovers the intended values exactly', (_no, w, r, purity, wantW, wantR, wantTotal) => {
    const finding = gold(w as number, r as number, purity as string);

    expect(finding?.kind).toBe('scaled-pair');
    expect(finding?.suggestedWeight).toBeCloseTo(wantW as number, 6);
    expect(finding?.suggestedRate).toBeCloseTo(wantR as number, 6);
    // The whole reason the mistake survived: the money never moves.
    expect(finding?.enteredTotal).toBeCloseTo(wantTotal as number, 2);
    expect(finding?.suggestedTotal).toBeCloseTo(finding!.enteredTotal, 6);
  });

  it('reports the pair, never "rate too low" — the rate is the wrong field to send them to', () => {
    // A compensated line trips the rate AND weight bounds individually. Naming
    // the rate is what the shopkeeper already did wrong seven times.
    expect(gold(2030, 15.123)?.kind).toBe('scaled-pair');
  });

  it('catches it on 20K, which had no live rate to compare against at all', () => {
    expect(gold(1200, 14.5, '20K - 83.3%')?.kind).toBe('scaled-pair'); // INV-29
    expect(gold(10460, 14.1, '20K - 83.3%')?.kind).toBe('scaled-pair'); // INV-39
  });
});

describe('correct bills stay silent', () => {
  it('passes the same shop\'s good gold bill', () => {
    expect(gold(20.13, 13910)).toBeNull(); // INV-32
  });

  it('passes the same shop\'s good silver bill', () => {
    expect(silver(10, 232)).toBeNull(); // INV-38
  });

  it('passes a heavy but real silver lot', () => {
    // Silver legitimately runs to kilograms; the gold ceiling must not apply.
    expect(silver(2500, 237)).toBeNull();
  });

  it('passes a half-typed row rather than nagging mid-entry', () => {
    expect(gold(2030, 0)).toBeNull();
    expect(gold(0, 15.123)).toBeNull();
  });
});

describe('the uncompensated milligram weight (phase one of the same habit)', () => {
  // Correct rate, milligram weight -> a crore-rupee bill. These were all deleted
  // by the shopkeeper, which is exactly the loop this guard is meant to break.
  it.each([
    ['INV-30', 10000, 13708],
    ['INV-27', 9500, 13708],
    ['INV-33', 10500, 13910],
  ])('%s is flagged on the weight, not the rate', (_no, w, r) => {
    expect(gold(w as number, r as number)?.kind).toBe('weight-too-high');
  });

  it('offers the intended weight, which is what would have broken the delete loop', () => {
    const finding = gold(10000, 13708); // INV-30, billed Rs.13.71 crore

    expect(finding?.suggestedWeight).toBeCloseTo(10, 6);
    expect(finding?.suggestedRate).toBe(13708); // the rate was never the problem
    expect(finding?.enteredTotal).toBeCloseTo(137080000, 2);
    expect(finding?.suggestedTotal).toBeCloseTo(137080, 2);
  });
});

describe('the per-10-gram rate (a different shop, and real money)', () => {
  it('flags shop 9560206712 INV-1 and recovers the per-gram rate', () => {
    const finding = gold(5.78, 134550);

    expect(finding?.kind).toBe('rate-too-high');
    expect(finding?.suggestedRate).toBeCloseTo(13455, 6);
    // Rs.8.04 lakh billed where Rs.80.4 thousand was owed — a 10x overcharge,
    // and the only one of these findings where the customer was charged wrong.
    expect(finding?.enteredTotal).toBeCloseTo(777699, 2);
    expect(finding?.suggestedTotal).toBeCloseTo(77769.9, 2);
  });

  it('still flags an absurd rate it cannot confidently rescale', () => {
    const finding = gold(5, 9_000_000);
    expect(finding?.kind).toBe('rate-too-high');
    expect(finding?.suggestedRate).toBeUndefined();
  });
});

describe('metal is read from either field', () => {
  it('treats a Silver purity on a Gold itemType as silver', () => {
    expect(inspectItemEntry({ itemType: 'Gold', purity: 'Silver', weight: 2500, rate: 237 })).toBeNull();
  });
});

describe('asKilogramHint', () => {
  it('restates an absurd gram figure in kilograms', () => {
    expect(asKilogramHint(2030)).toBe('2.03 kg');
    expect(asKilogramHint(10000)).toBe('10 kg');
  });

  it('says nothing below a kilogram, where grams are already natural', () => {
    expect(asKilogramHint(999)).toBeNull();
    expect(asKilogramHint(20.13)).toBeNull();
  });
});

describe('deriving a rate for the karats the upstream API does not quote', () => {
  const pureGold24K = 15300; // live 24K-99.5% quote on the day of the diagnosis

  it('reads a fraction from a percentage label, preferring it over the karat', () => {
    expect(purityFraction('22K - 91.6%')).toBeCloseTo(0.916, 6);
    expect(purityFraction('20K - 83.3%')).toBeCloseTo(0.833, 6);
  });

  it('falls back to karats when no percentage is present', () => {
    expect(purityFraction('21K')).toBeCloseTo(21 / 24, 6);
  });

  it('returns null for silver and junk, so callers keep their zero', () => {
    expect(purityFraction('Silver')).toBeNull();
    expect(purityFraction(undefined)).toBeNull();
  });

  it('lands 20K in the right neighbourhood of the real 22K quote', () => {
    const twentyK = deriveRateFromPureGold('20K - 83.3%', pureGold24K);
    // Ballpark, not a quotation: enough to catch a 10x or 1000x entry error.
    expect(twentyK).toBeGreaterThan(12000);
    expect(twentyK).toBeLessThan(14104); // must sit below the live 22K rate
  });

  it('gives nothing when there is no upstream quote to derive from', () => {
    expect(deriveRateFromPureGold('20K - 83.3%', 0)).toBe(0);
  });
});

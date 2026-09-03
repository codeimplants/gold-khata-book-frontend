/**
 * Amounts in words, Indian numbering system, for tax invoices.
 *
 * A formal GST invoice states the chargeable amount in words as well as figures
 * — it is the line a customer and an auditor both read to check the digits have
 * not been altered. So this groups in crore / lakh / thousand rather than the
 * Western million, and says "Ninety Three paise" rather than "point nine three".
 *
 * Rounding is deliberate: money arrives here as a float that may be 8629.999999
 * after rate x weight arithmetic, and "Eight Thousand Six Hundred Twenty Nine
 * and Ninety Nine paise" against a printed figure of 8,630.00 is the kind of
 * mismatch that makes a customer distrust the whole bill. Paise are rounded to
 * the nearest whole, and a carry rolls the rupees up with them.
 */

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];

const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

/** 0-99. Anything above is handled by the group walk below. */
const twoDigits = (n: number): string => {
  if (n < 20) return ONES[n];
  const t = TENS[Math.floor(n / 10)];
  const o = ONES[n % 10];
  return o ? `${t} ${o}` : t;
};

/** 0-999, i.e. one Indian group plus its hundreds. */
const threeDigits = (n: number): string => {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${ONES[h]} Hundred`);
  if (rest) parts.push(twoDigits(rest));
  return parts.join(' ');
};

/**
 * A whole number in Indian words. Returns '' for 0 so callers can decide
 * whether "Zero" belongs in their sentence.
 */
export const indianWords = (value: number): string => {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return '';

  // Groups are 2-digit above the first 3 digits: crore, lakh, thousand, then 0-999.
  const tail = n % 1000;
  n = Math.floor(n / 1000);
  const thousand = n % 100;
  n = Math.floor(n / 100);
  const lakh = n % 100;
  const crore = Math.floor(n / 100);

  const parts: string[] = [];
  // Crores past 99 keep counting in crores — "One Thousand Two Hundred Crore" —
  // which is how the Indian system scales rather than inventing a larger unit.
  if (crore) parts.push(`${crore > 99 ? indianWords(crore) : twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (tail) parts.push(threeDigits(tail));

  return parts.join(' ');
};

/**
 * The full "Indian Rupees ... Only" sentence a tax invoice prints.
 *
 * `label` lets the caller say "Indian Rupees" or just "Rupees" — the reference
 * bills in circulation use both.
 */
export const amountInWords = (amount: number, label = 'Indian Rupees'): string => {
  const safe = Number.isFinite(amount) ? Math.abs(amount) : 0;

  // Round to paise first, then split, so 0.995 becomes 1.00 rather than
  // "Zero and Ninety Nine paise" beside a printed 1.00.
  const totalPaise = Math.round(safe * 100);
  const rupees = Math.floor(totalPaise / 100);
  const paise = totalPaise % 100;

  const rupeeWords = rupees ? indianWords(rupees) : 'Zero';
  const paiseWords = paise ? ` and ${twoDigits(paise)} paise` : '';

  return `${label} ${rupeeWords}${paiseWords} Only`;
};

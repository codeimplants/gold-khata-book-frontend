/**
 * Formats a number to a string, removing trailing zeros after the decimal point.
 * If the number is an integer, the decimal point is also removed.
 * @param num The number to format
 * @param precision Maximum decimal places (default is 3)
 */
export const formatNumber = (num: number | string | undefined | null, precision: number = 3): string => {
  if (num === undefined || num === null) return '0';
  const n = typeof num === 'number' ? num : parseFloat(String(num));
  if (isNaN(n)) return '0';

  // Use toFixed to round to the desired precision, then cast to Number to strip trailing zeros
  return Number(n.toFixed(precision)).toString();
};

export const formatCurrencyValue = (value: number) =>
  `₹${value.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

/**
 * "₹250 / gm", "8%", "₹500 Fixed" — the making charge as the shopkeeper
 * entered it: the value together with what kind of charge it is.
 *
 * Written for one specific gap: the invoice item edit form shows making-charge
 * type (Per Gram / Fixed / Percentage) next to its value, but every read-only
 * view — the pre-save Preview screen and the saved-order detail view — showed
 * only a blended rupee total with no indication of type. A shopkeeper checking
 * a bill before confirming, or reopening one later, had no way to see how a
 * making charge was actually calculated.
 *
 * The printed bill's MAKING column had a worse version of the same problem: it
 * rendered the raw stored value as currency, so a 10% making charge printed as
 * "₹ 10.00" — a rate presented to the customer as a rupee amount. Every one of
 * the five templates now goes through here instead.
 *
 * Every branch keeps the number. A bare "Fixed" would leave the amount
 * recoverable only by working backwards from the line total.
 *
 * Accepts either raw form fields (makingChargeType/makingCharges, strings) or
 * persisted item fields (makingType/makingCharge, already-typed) since Preview
 * and the saved-order view read from two different shapes.
 *
 * `fixedLabel` is passed in rather than translated here: in-app callers resolve
 * it through `t()` and the print templates through `tl(lang, …)`, since a bill
 * prints in the customer's language, not the app's. "gm" and "%" are left
 * untranslated deliberately — they are units, and `fw()` already prints weights
 * as "19.000 gm" on every bill in every language.
 */
export const formatMakingChargeDetail = (
  item: {
    makingChargeType?: string;
    makingCharges?: string | number;
    makingType?: string;
    makingCharge?: string | number;
  },
  fixedLabel: string = 'Fixed',
): string | null => {
  const type = item.makingChargeType || item.makingType;
  const value = Number(item.makingCharges ?? item.makingCharge ?? 0);
  if (!type || value <= 0) return null;

  const normalized = type.toLowerCase();
  if (normalized === 'per gram' || normalized === 'pergram') {
    return `${formatCurrencyValue(value)} / gm`;
  }
  if (normalized === 'percentage' || normalized === 'percent' || normalized === '%') {
    return `${formatNumber(value, 2)}%`;
  }
  // "Fixed" — a flat rupee amount, not tied to weight or to the metal value.
  return `${formatCurrencyValue(value)} ${fixedLabel}`;
};

/**
 * The making charge's BASIS alone — "10%", "₹250 / gm", "Fixed" — with no
 * amount attached. For the printed bill's column header, where the basis is
 * stated once and each row's cell carries the rupee figure.
 *
 * Prefers `makingBasisType`/`makingBasisValue` when present. Those exist
 * precisely because the arithmetic pair gets flattened to a resolved amount +
 * `'Fixed'` when a saved order is mapped for printing, so reading the
 * arithmetic pair here reports "Fixed" for a percentage charge.
 */
export const formatMakingBasis = (
  item: {
    makingChargeType?: string;
    makingCharges?: string | number;
    makingType?: string;
    makingCharge?: string | number;
    makingBasisType?: string;
    makingBasisValue?: string | number;
  },
  fixedLabel: string = 'Fixed',
): string | null => {
  const type = item.makingBasisType || item.makingChargeType || item.makingType;
  const value = Number(
    item.makingBasisValue ?? item.makingCharges ?? item.makingCharge ?? 0,
  );
  if (!type || value <= 0) return null;

  const normalized = type.toLowerCase();
  if (normalized === 'per gram' || normalized === 'pergram') {
    return `${formatCurrencyValue(value)} / gm`;
  }
  if (normalized === 'percentage' || normalized === 'percent' || normalized === '%') {
    return `${formatNumber(value, 2)}%`;
  }
  return fixedLabel;
};

/**
 * The one making basis every line on the bill shares, or `null` when they
 * differ — a single column header cannot honestly describe a bill whose lines
 * were charged on different bases, so it says nothing rather than something
 * wrong. Mirrors what the on-screen preview already does with its
 * "Making Charges (10%)" totals label.
 *
 * Lines with no making charge are skipped rather than counted as a difference:
 * a bill of three 10% items and one with no making charge is still a 10% bill.
 */
export const getSharedMakingBasis = (
  items: Parameters<typeof formatMakingBasis>[0][],
  fixedLabel: string = 'Fixed',
): string | null => {
  const bases = new Set<string>();
  (items || []).forEach(item => {
    const basis = formatMakingBasis(item, fixedLabel);
    if (basis) bases.add(basis);
  });
  return bases.size === 1 ? [...bases][0] : null;
};

/**
 * "10%" or "₹100" — the discount as entered, for the same reason as
 * `formatMakingChargeDetail` above.
 *
 * The printed bill's DISCOUNT column had the identical defect: a 10% discount
 * rendered as "₹ 10.00", understating a Rs.29,942 reduction as ten rupees.
 *
 * No "Fixed" suffix here, unlike making charges. A discount has only two forms,
 * and a plain rupee figure beside a clearly-marked percentage is already
 * unambiguous — the word would be noise in a narrow column.
 */
export const formatDiscountDetail = (item: {
  discountType?: string;
  discount?: string | number;
}): string | null => {
  const value = Number(item.discount ?? 0);
  if (value <= 0) return null;

  const normalized = (item.discountType || '').toLowerCase();
  if (normalized === 'percentage' || normalized === 'percent' || normalized === '%') {
    return `${formatNumber(value, 2)}%`;
  }
  return formatCurrencyValue(value);
};

/**
 * Date (and time, when it means anything) for an order in a list.
 *
 * The two timestamps on an order are not interchangeable:
 *  - `date` is the *invoice date*, chosen by the shopkeeper. It comes from a
 *    date picker as "YYYY-MM-DD", so `new Date(...)` puts it at midnight — its
 *    time component is always 00:00 and tells you nothing.
 *  - `createdAt` is when the record was actually written, and is the only
 *    source of a real time.
 *
 * So the date shown is always the invoice date (that is what is printed on the
 * bill and what GST periods are filed by), and the creation time is appended
 * *only when the two fall on the same day*. Back-date a bill to last Tuesday and
 * appending today's clock time would read as "last Tuesday at 4:15 PM", which
 * never happened.
 */
export const formatOrderDateTime = (
  date?: string | Date | null,
  createdAt?: string | Date | null,
): string => {
  if (!date && !createdAt) return 'N/A';

  const invoiceDate = date ? new Date(date) : new Date(createdAt!);
  if (Number.isNaN(invoiceDate.getTime())) return 'N/A';

  const datePart = invoiceDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  if (!createdAt) return datePart;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return datePart;

  const sameDay =
    created.getFullYear() === invoiceDate.getFullYear() &&
    created.getMonth() === invoiceDate.getMonth() &&
    created.getDate() === invoiceDate.getDate();

  if (!sameDay) return datePart;

  const timePart = created.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return `${datePart}, ${timePart}`;
};

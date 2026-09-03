import { BillItem, JewelleryFormValues } from '../types';
import { GST_RATE } from '../constants/bill';
import { formatNumber } from './formatter';

/**
 * Renders an optional numeric value for a text input, treating zero as "not set".
 *
 * Blank numeric fields are stored as 0 in two places — the catalog-product save
 * payload, and every persisted invoice item — so populating a form from either
 * one used to drop a literal "0" into Gross Wt, Making Charges and Discount that
 * the shopkeeper had to select and delete before typing a real value.
 *
 * Blank is arithmetically identical: `calculateItemValues` below reads all of
 * these through `Number(x) || 0`, so an empty box and a "0" both compute as
 * zero. The only difference is that the placeholder shows through and typing
 * works immediately.
 *
 * Note this cannot distinguish "deliberately zero" from "left blank" — a making
 * charge explicitly set to 0 also renders empty. That is intentional: the two
 * mean the same thing to every calculation, and the blank field is what the
 * shopkeeper meant.
 */
export const optionalNumberField = (value: unknown, fallback = ''): string => {
  if (value === null || value === undefined || value === '') return fallback;
  // A stored 0 means "nothing was saved here", not "the answer is zero", so it
  // defers to the fallback exactly as an absent value does.
  //
  // Without this, picking a saved item wiped the Gross Wt the shopkeeper had
  // already typed. `grossWt` on a catalogue product is `default: 0`, so every
  // item saved without a weight stores 0; `handleAutoFill` passes the typed
  // value as the fallback, and the fallback was never reached. The bill then
  // failed its own "Gross Weight is required" check on a field that had been
  // filled in, and the only workaround anyone found was deleting the account —
  // which works because it deletes the catalogue with it.
  //
  // Callers that pass no fallback keep the previous behaviour: 0 still renders
  // as '' and the placeholder shows through.
  if (Number(value) === 0) return fallback;
  return String(value);
};

export const calculateItemValues = (item: BillItem) => {
  const gross = Number(item.grossWt) || 0;
  const less = Number(item.lessWt) || 0;
  const rate = Number(item.ratePerGm) || 0;
  const making = Number(item.makingCharges) || 0;
  const other = Number(item.otherChargesAmount) || 0;
  const discount = Number(item.discount) || 0;

  const netWt = gross - less;
  const goldPrice = netWt * rate;

  let makingTotal = 0;

  if (item.makingChargeType === 'Per Gram') {
    makingTotal = gross * making;
  } else if (item.makingChargeType === 'Percentage' || item.makingChargeType === '%') {
    makingTotal = (gross * rate * making) / 100;
  } else {
    makingTotal = making;
  }

  let subtotal = goldPrice + makingTotal + other;

  if (item.discountType === 'Percentage') {
    subtotal = subtotal - (subtotal * discount) / 100;
  } else {
    subtotal = subtotal - discount;
  }

  // Blank, not "0", until a weight has actually been entered. Net Wt is shown
  // in an input, and a zero there has to be cleared before typing while being
  // indistinguishable from a deliberate zero.
  const weightEntered =
    String(item.grossWt ?? '').trim() !== '' || String(item.lessWt ?? '').trim() !== '';

  return {
    netWt: weightEntered ? formatNumber(netWt, 3) : '',
    itemTotal: formatNumber(Math.max(0, subtotal), 3),
  };
};

export const calculateFormTotals = (
  v: JewelleryFormValues,
  gstRateInput?: number,
) => {
  const customGstRate = gstRateInput !== undefined ? gstRateInput : GST_RATE;
  const itemsSubtotal = (v.items ?? []).reduce(
    (sum, item) => sum + Number(item.itemTotal || 0),
    0,
  );

  const exchangeTotal = v.enableExchange
    ? (v.exchanges ?? []).reduce((sum, ex) => sum + Number(ex.amount || 0), 0)
    : 0;

  const subtotalBeforeGst = itemsSubtotal - exchangeTotal;

  const gst = v.includeGst ? subtotalBeforeGst * customGstRate : 0;

  const grandTotal = subtotalBeforeGst + gst;

  return {
    subtotal: formatNumber(subtotalBeforeGst, 3),
    gst: formatNumber(gst, 3),
    grandTotal: formatNumber(Math.max(0, grandTotal), 3),
  };
};

export const normalizeMakingType = (value?: string) =>
  value ? value.toString().toLowerCase().replace(/\s+/g, '') : '';

export const calculateItemMakingCharge = (
  item: any,
  settlementRate: number,
) => {
  const netWt = Number(item.netWeight || item.netWt || item.weight || 0);
  const grossWt = Number(item.grossWeight || item.grossWt || netWt);
  if (settlementRate <= 0 || netWt <= 0) return 0;
  const itemGoldValue = netWt * settlementRate;
  const mType = normalizeMakingType(
    item.makingChargeType ||
    item.makingType ||
    item.makingCharge ||
    item.makingCharges ||
    '',
  );
  const mValue = Number(
    item.makingChargeValue ||
    item.makingCharge ||
    item.makingCharges ||
    item.makingChargeAmount ||
    0,
  );
  if (mType.includes('%') || mType.includes('percentage')) {
    return (grossWt * settlementRate * mValue) / 100;
  }
  if (mType.includes('pergram')) {
    return grossWt * mValue;
  }
  return mValue;
};

export function calcItemTotal(item: any): number {
  return getItemComponents(item).net;
}

export function getItemComponents(item: any) {
  const netWt = Number(item.netWeight ?? item.netWt ?? item.weight ?? 0);
  const grossWt = Number(item.grossWeight ?? item.grossWt ?? netWt);
  // `rate` is the persisted order shape; `ratePerGm` is the in-form BillItem shape.
  // Without the fallback this silently returns a zero metal value for form data.
  const rate = Number(item.rate ?? item.ratePerGm ?? 0);
  const makingCharge = Number(
    item.makingCharge ?? item.makingCharges ?? item.makingChargeValue ?? 0,
  );
  const chargeAmount = Number(
    item.chargeAmount ?? item.otherChargesAmount ?? 0,
  );
  const discount = Number(item.discount ?? 0);

  // Metal Value = Net Weight * Rate
  const goldValue = netWt * rate;

  const makingType = (
    item.makingType ||
    item.makingChargeType ||
    ''
  ).toLowerCase();
  
  let makingTotal = 0;
  if (['percentage', 'percent', '%'].includes(makingType)) {
    makingTotal = (grossWt * rate * makingCharge) / 100;
  } else if (['pergram', 'per gram'].includes(makingType)) {
    makingTotal = grossWt * makingCharge;
  } else {
    makingTotal = makingCharge;
  }

  const gross = goldValue + makingTotal + chargeAmount;

  const discountType = (item.discountType || '').toLowerCase();
  const discValue = ['percentage', 'percent', '%'].includes(discountType)
    ? (gross * discount) / 100
    : discount;

  const net = Math.max(0, gross - discValue);

  return {
    goldValue: isNaN(goldValue) ? 0 : goldValue,
    makingTotal: isNaN(makingTotal) ? 0 : makingTotal,
    chargeAmount: isNaN(chargeAmount) ? 0 : chargeAmount,
    discountValue: isNaN(discValue) ? 0 : discValue,
    net: isNaN(net) ? 0 : net,
  };
}

export const calculateAdvanceMakingCharges = (
  items: any[],
  settlementRate: number,
) => {
  if (!Array.isArray(items) || settlementRate <= 0) return 0;
  return items.reduce((sum: number, it: any) => {
    const netWt = Number(it.netWeight || it.netWt || it.weight || 0);
    const grossWt = Number(it.grossWeight ?? it.grossWt ?? netWt);
    const itemGoldValue = netWt * settlementRate;
    const mType = normalizeMakingType(
      it.makingChargeType || it.makingType || it.makingCharge || '',
    );
    const mValue = Number(
      it.makingChargeValue ||
      it.makingCharge ||
      it.makingCharges ||
      it.makingChargeAmount ||
      0,
    );
    let total = 0;
    if (mType.includes('%') || mType.includes('percentage')) {
      total = (grossWt * settlementRate * mValue) / 100;
    } else if (mType.includes('pergram')) {
      total = grossWt * mValue;
    } else {
      total = mValue;
    }
    return sum + total;
  }, 0);
};

/**
 * What an advance order actually settles for, at the rate agreed on the day.
 *
 * Both places that needed this had their own version, and both computed
 * `goldValue + makingCharges` and stopped - so a per-item discount or an other
 * charge simply vanished from the final bill. ADV-80 carried a Rs 200 discount
 * and was settled for 2,52,511.71 against an invoice that said 2,52,311.71: the
 * shop collected money its own bill did not account for.
 *
 * The line math mirrors calculateItemValues and the backend`s
 * calculateInvoiceDetails exactly - gold on net weight, making on gross,
 * other charges added, discount taken off, floored at zero - so an advance
 * order settles for what the same goods would cost on a full-payment bill.
 * The only difference is the rate, which is the settlement rate rather than
 * whatever was quoted when the order was booked.
 *
 * GST last, on the discounted subtotal: tax applies to the transaction value
 * after a trade discount shown on the bill.
 */
export const calculateAdvanceSettlement = (
  items: any[],
  settlementRate: number,
  opts: { includeGst: boolean; gstRatePercent: number },
) => {
  const list = Array.isArray(items) ? items : [];

  let goldValue = 0;
  let makingCharges = 0;
  let otherCharges = 0;
  let discountTotal = 0;
  let subtotal = 0;

  for (const it of list) {
    const netWt = Number(it.netWeight ?? it.netWt ?? it.weight ?? 0) || 0;
    const grossWt = Number(it.grossWeight ?? it.grossWt ?? netWt) || 0;

    const gold = netWt * settlementRate;

    const mType = normalizeMakingType(
      it.makingChargeType || it.makingType || '',
    );
    const mValue =
      Number(
        it.makingChargeValue ??
          it.makingCharge ??
          it.makingCharges ??
          it.makingChargeAmount ??
          0,
      ) || 0;
    const making =
      mType.includes('%') || mType.includes('percentage')
        ? (grossWt * settlementRate * mValue) / 100
        : mType.includes('pergram')
          ? grossWt * mValue
          : mValue;

    const other =
      Number(it.chargeAmount ?? it.otherChargesAmount ?? it.otherChargeAmount ?? 0) || 0;

    const beforeDiscount = gold + making + other;
    const discount = Number(it.discount ?? 0) || 0;
    const discountValue = String(it.discountType ?? '')
      .toLowerCase()
      .includes('percent')
      ? (beforeDiscount * discount) / 100
      : discount;

    goldValue += gold;
    makingCharges += making;
    otherCharges += other;
    discountTotal += Math.min(discountValue, beforeDiscount);
    subtotal += Math.max(beforeDiscount - discountValue, 0);
  }

  const gstAmount = opts.includeGst
    ? subtotal * (opts.gstRatePercent / 100)
    : 0;

  return {
    goldValue,
    makingCharges,
    otherCharges,
    discount: discountTotal,
    subtotal,
    gstAmount,
    grandTotal: subtotal + gstAmount,
  };
};
/**
 * What the shopkeeper typed the "other charge" on each line was FOR — hallmark,
 * meena, polish — deduplicated, in the order first seen.
 *
 * "Other Charges: ₹2,000" on its own is unreadable a month later, and a
 * customer querying a bill has no way to ask about it. Only lines that actually
 * carry an amount contribute: a description left on a line whose charge was
 * later zeroed is not a charge.
 *
 * Reads both field names for the same reason `getItemComponents` does —
 * `chargeDescription` is the persisted order/invoice shape, and
 * `otherChargesDescription` is the in-form BillItem shape.
 */
export function getOtherChargeLabels(items: any[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];

  (items || []).forEach(item => {
    if (getItemComponents(item).chargeAmount <= 0) return;
    const raw = String(
      item.chargeDescription ?? item.otherChargesDescription ?? '',
    ).trim();
    // "Charges" and "N/A" are what two of the save paths write when the
    // shopkeeper left the description blank. Echoing those back as if they
    // were a real answer is worse than showing nothing.
    if (!raw || /^(charges|n\/a)$/i.test(raw)) return;
    const key = raw.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    labels.push(raw);
  });

  return labels;
}

/**
 * The label for the "other charges" row — the charge's own name when there is
 * one, so the bill reads `Hallmark   ₹2,000` rather than the generic
 * `Other Charges   ₹2,000`. That is what the shopkeeper typed it as and what
 * the customer will ask about.
 *
 * Several lines carrying different charges join up: `Hallmark, Meena`. Only
 * when nothing was named at all does it fall back to `baseLabel`.
 *
 * `maxLength` exists for the 32-column thermal receipt, where an over-long left
 * side is silently truncated by `padLine` and would eat into the amount. A name
 * that does not fit falls back to the generic label rather than being cut
 * mid-word into something misleading.
 */
export function formatOtherChargesLabel(
  baseLabel: string,
  items: any[],
  maxLength?: number,
): string {
  const labels = getOtherChargeLabels(items);
  if (labels.length === 0) return baseLabel;

  const named = labels.join(', ');
  if (maxLength && named.length > maxLength) return baseLabel;
  return named;
}

/**
 * Aggregated bill totals, matching the breakdown the on-screen bill shows
 * (Total Amount / Making Charges / Other Charges / Total Discount).
 *
 * Shared so the printed receipt cannot drift from what the shopkeeper just read on
 * screen — the two were previously computed in different places and disagreed.
 */
export function getBillTotals(items: any[]) {
  return (items || []).reduce(
    (acc, item) => {
      const c = getItemComponents(item);
      return {
        metalValue: acc.metalValue + c.goldValue,
        makingCharges: acc.makingCharges + c.makingTotal,
        otherCharges: acc.otherCharges + c.chargeAmount,
        discount: acc.discount + c.discountValue,
        itemsTotal: acc.itemsTotal + c.net,
      };
    },
    { metalValue: 0, makingCharges: 0, otherCharges: 0, discount: 0, itemsTotal: 0 },
  );
}

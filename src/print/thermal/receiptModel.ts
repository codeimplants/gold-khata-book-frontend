// The receipt as structured lines, independent of how it is finally rendered.
//
// There are two renderers with very different constraints:
//   - ESC/POS text  (receiptBuilder.ts)      — fast, tiny, ASCII-only
//   - rasterised image (ReceiptImageView)    — slower and ~25x larger, but can print
//                                              Devanagari/Gujarati and the ₹ sign
//
// Building the content once here is what keeps them from drifting: a row added to the
// totals shows up in both automatically. Which renderer runs is decided by
// modelHasNonAscii() rather than by a setting, so an English shop keeps instant text
// printing and a Marathi shop gets a correct receipt without anyone choosing.
import { JewelleryFormValues, PrintContext } from '../../types';
import { MobileLang, advanceBalanceDue, fc, fw, gstLabel, pn, tl } from '../templates/shared';
import { formatOtherChargesLabel, getBillTotals } from '../../utils/calculations';
import { getSharedMakingBasis } from '../../utils/formatter';
import { getFullImageUrl } from '../../utils/imageUtils';

export const RECEIPT_WIDTH = 32;

/** Formatted amount without the currency symbol, for places where 32 columns cannot
 * afford one (per-gram rates sitting beside a six-figure total). */
function amountOnly(value?: string | number): string {
  return fc(value).replace('₹', '').trim();
}

export type ReceiptLine =
  | { kind: 'text'; text: string; align?: 'left' | 'center'; bold?: boolean; large?: boolean }
  | { kind: 'row'; left: string; right: string; bold?: boolean }
  /** The shop logo. Always rasterised — there is no text equivalent — so a receipt
   * with a logo necessarily takes the image path. */
  | { kind: 'logo'; uri: string }
  | { kind: 'divider' }
  | { kind: 'space' };

export function buildReceiptModel(
  values: JewelleryFormValues,
  ctx: PrintContext,
  lang: MobileLang
): ReceiptLine[] {
  const shop = ctx.shopDetails;
  const shopName = shop?.shopName || shop?.name || 'Jewellery Shop';
  const shopAddress = [shop?.address, shop?.city, shop?.state].filter(Boolean).join(', ');
  const gstNo = shop?.gstNo?.trim() || shop?.gstNumber?.trim();
  const itemsTotal = values.items.reduce((s, i) => s + pn(i.itemTotal), 0);

  const lines: ReceiptLine[] = [];

  // Header. prepareShopForPrint has already inlined the logo as a data URI, so it can
  // be rendered directly without a network fetch mid-print.
  const logoUri = getFullImageUrl(shop?.logo);
  if (logoUri) lines.push({ kind: 'logo', uri: logoUri });
  lines.push({ kind: 'text', text: shopName, align: 'center', bold: true, large: true });
  if (shopAddress) lines.push({ kind: 'text', text: shopAddress, align: 'center' });
  if (shop?.phone) lines.push({ kind: 'text', text: String(shop.phone), align: 'center' });
  if (gstNo) lines.push({ kind: 'text', text: `GSTIN: ${gstNo}`, align: 'center' });
  lines.push({ kind: 'divider' });

  // Bill meta + customer
  lines.push({ kind: 'row', left: `${tl(lang, 'invoice')} #${ctx.billNo}`, right: ctx.billDate });
  lines.push({ kind: 'text', text: values.customerName });
  if (values.phone) lines.push({ kind: 'text', text: String(values.phone) });
  lines.push({ kind: 'divider' });

  // Items — purity/qty and rate are shown because the on-screen bill shows them, and
  // a customer checking the paper against the screen should find the same numbers.
  values.items.forEach(item => {
    lines.push({ kind: 'text', text: item.itemName });

    // Separators are spaces, never '·': any non-ASCII character here would print as
    // '?' in text mode and, worse, push an otherwise-English bill onto the slow
    // raster path for the sake of a bullet.
    const detail = [item.purity, `${item.pcs} ${tl(lang, 'pcs')}`, fw(item.netWt)]
      .filter(Boolean)
      .join('  ');
    if (detail) lines.push({ kind: 'text', text: `  ${detail}` });

    // The rate carries no currency prefix: with 32 columns, "@ Rs. 13,202.00" plus a
    // six-figure amount overflows and padLine silently truncates the rate.
    lines.push({
      kind: 'row',
      left: `  @ ${amountOnly(item.ratePerGm)}`,
      right: fc(item.itemTotal),
    });
  });
  lines.push({ kind: 'divider' });

  // Totals — the same breakdown the on-screen bill shows. These rows were missing
  // from the printed receipt, so paper and screen disagreed on how a total was
  // reached even when the total itself matched.
  const totals = getBillTotals(values.items);
  lines.push({ kind: 'row', left: tl(lang, 'totalAmount'), right: fc(totals.metalValue) });
  if (totals.makingCharges > 0) {
    // The basis in brackets where every line shares one, matching the A4 bill's
    // column header: "Making (10%)".
    const basis = getSharedMakingBasis(values.items, tl(lang, 'makingFixed'));
    lines.push({
      kind: 'row',
      left: basis ? `${tl(lang, 'making')} (${basis})` : tl(lang, 'making'),
      right: fc(totals.makingCharges),
    });
  }
  if (totals.otherCharges > 0) {
    // Named where it fits — the charge's own name, `Hallmark`, rather than the
    // generic label. The budget is the 32 columns minus the amount and one
    // space; past that `padLine` truncates the LEFT side, so an over-long name
    // would be cut mid-word rather than costing the amount.
    // formatOtherChargesLabel drops back to the generic label instead.
    const amount = fc(totals.otherCharges);
    lines.push({
      kind: 'row',
      left: formatOtherChargesLabel(tl(lang, 'otherCharges'), values.items, RECEIPT_WIDTH - amount.length - 1),
      right: amount,
    });
  }
  if (totals.discount > 0) {
    lines.push({ kind: 'row', left: tl(lang, 'discount'), right: `-${fc(totals.discount)}` });
  }

  // Same rule as the A4 bill: the subtotal only earns a line when an exchange
  // deduction or GST comes between it and the total below. Otherwise it repeats
  // the total, and paper is the one place a wasted line is literally costly.
  const showGstRow = Boolean(values.includeGst && pn(values.gst) > 0);
  if (showGstRow || values.exchanges?.length) {
    lines.push({ kind: 'row', left: tl(lang, 'subtotal'), right: fc(itemsTotal) });
  }

  values.exchanges?.forEach(ex => {
    const label = ex.itemName ? `${ex.itemName} (${ex.type})` : `${ex.type} ${tl(lang, 'exchange')}`;
    lines.push({ kind: 'row', left: label, right: `-${fc(ex.amount)}` });
  });

  if (showGstRow) {
    lines.push({ kind: 'row', left: gstLabel(values.gstPercentage), right: fc(values.gst) });
  }

  const payments = values.paymentSummary?.payments || [];
  if (payments.length > 0) {
    lines.push({ kind: 'row', left: tl(lang, 'total'), right: fc(values.grandTotal), bold: true });
    const totalPaid = payments.reduce((sum, p) => sum + pn(p.amount), 0);
    lines.push({ kind: 'row', left: tl(lang, 'advancePayment'), right: `-${fc(totalPaid)}` });
    const balanceDue = advanceBalanceDue(values, totalPaid);
    lines.push({ kind: 'row', left: tl(lang, 'balanceDue'), right: fc(balanceDue), bold: true });
  } else {
    lines.push({ kind: 'row', left: tl(lang, 'total'), right: fc(values.grandTotal), bold: true });
  }

  // Footer
  lines.push({ kind: 'space' });
  lines.push({ kind: 'text', text: tl(lang, 'thankYou'), align: 'center' });

  return lines;
}

/** Every string the receipt will print, for the ASCII check below. */
function stringsOf(lines: ReceiptLine[]): string[] {
  const out: string[] = [];
  lines.forEach(l => {
    if (l.kind === 'text') out.push(l.text);
    else if (l.kind === 'row') out.push(l.left, l.right);
  });
  return out;
}

/**
 * Whether this one line needs the image renderer.
 *
 * Checked per line rather than per receipt so only the handful of lines actually
 * containing Indic script get rasterised. Rasterising the whole receipt made the cost
 * scale with bill size instead of with how much non-Latin text there is — a six-item
 * bill with a single Marathi name took ~9s.
 */
export function lineHasNonAscii(line: ReceiptLine): boolean {
  // A logo has no text form at all, so it always takes the image path.
  if (line.kind === 'logo') return true;
  return stringsOf([line]).some(s => /[^\x20-\x7e₹]/.test(s));
}

/**
 * Whether this receipt needs the image renderer. The ₹ sign is excluded deliberately:
 * it is the one non-ASCII character the text renderer can substitute ("Rs."), so a
 * plain English bill should not be pushed onto the slow path just for a currency
 * symbol.
 */
export function modelHasNonAscii(lines: ReceiptLine[]): boolean {
  return lines.some(lineHasNonAscii);
}

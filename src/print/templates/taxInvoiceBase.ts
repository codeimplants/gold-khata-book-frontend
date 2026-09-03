import { JewelleryFormValues, PrintContext } from '../../types';
import {
  MobileLang,
  fc,
  fw,
  pn,
  tl,
  tp,
  fill,
  esc,
  imgTag, signatureBlock,
  buildPageCss,
  footerPinCss,
  buildBillLines,
} from './shared';
import { getItemComponents } from '../../utils/calculations';
import { amountInWords } from '../../utils/numberToWords';

/**
 * The formal GST tax-invoice body, shared by every template that uses it.
 *
 * Built from a customer's own reference bill: a ruled table with visible cell
 * borders, an HSN/SAC column, Quantity / Rate / per / Amount, a tax summary,
 * the chargeable amount in words, a declaration and a jurisdiction line. It is
 * the layout Indian jewellers recognise as "a proper tax invoice" rather than a
 * styled receipt, and the ruled black-on-white grid is most of why it reads as
 * one — which is also why it prints legibly on a tired laser.
 *
 * One builder rather than three near-identical templates: the differences a
 * shopkeeper actually picks between are the header treatment and the colour, so
 * those are the only things `TaxInvoiceTheme` varies. Duplicating this table
 * three times is how you end up with two of them quietly missing a tax row.
 *
 * Deliberately NOT included: bank details and PAN. Shop Details does not collect
 * them, and inventing empty rows on a tax document is worse than omitting them.
 * Add them here once those fields exist.
 */
export type TaxInvoiceTheme = {
  /** Whether to render the shop's details from app data at the top. */
  showShopHeader: boolean;
  /** Accent colour. Empty string means an ink-only, black-and-white document. */
  accent: string;
  /** Fill behind the table head; empty means no fill (survives "no background graphics"). */
  headFill: string;
  /** Border colour for the grid. */
  rule: string;
};

const ti = (lang: MobileLang, key: string) => tp(lang, 'taxInvoice', key);

/** A ruled cell. The grid is the whole point, so borders are explicit. */
const cell = (
  content: string,
  opts: { align?: string; bold?: boolean; rule: string; pad?: string; colSpan?: number } ,
) => {
  const { align = 'left', bold = false, rule, pad = '5px 7px', colSpan } = opts;
  return `<td${colSpan ? ` colspan="${colSpan}"` : ''} style="border:1px solid ${rule};padding:${pad};text-align:${align};font-size:11px;${
    bold ? 'font-weight:700;color:#000;' : 'color:#111;'
  }vertical-align:top;">${content}</td>`;
};

export const buildTaxInvoiceHTML = (
  values: JewelleryFormValues,
  ctx: PrintContext,
  lang: MobileLang,
  theme: TaxInvoiceTheme,
): string => {
  const shop = ctx.shopDetails;
  const { accent, headFill, rule } = theme;
  const hasGstNo = Boolean(shop?.gstNo?.trim() || shop?.gstNumber?.trim());
  const gstNo = shop?.gstNo || shop?.gstNumber || '';
  const addressParts = [shop?.address, shop?.city, shop?.state].filter(Boolean);
  const shopAddress = addressParts.join(', ');
  const shopName = shop?.shopName || shop?.name || '';

  const itemsTotal = values.items.reduce((s, i) => s + pn(i.itemTotal), 0);
  const showGst = Boolean(values.includeGst && pn(values.gst) > 0);
  const grandTotal = pn(values.grandTotal) || itemsTotal + (showGst ? pn(values.gst) : 0);

  const totalWeight = values.items.reduce((s, i) => s + pn(i.netWt), 0);
  // Jewellery sits under HSN 7113. The per-item field wins when the shop set one.
  const hsnOf = (item: any) => esc(item.hsnCode || '7113');

  // The item's Amount is the METAL value, not `itemTotal`.
  //
  // `itemTotal` already folds in making and other charges net of discount, so
  // printing it here while also giving those their own rows below would count
  // them twice — a customer adding the Amount column would not reach the Total.
  // It was also internally wrong on its own terms: the row states a Quantity and
  // a Rate, and 11.200 gm x Rs.6,500 is 72,800, not the 76,800 that `itemTotal`
  // showed. Now the row multiplies out, and the column genuinely sums.
  const itemRows = values.items
    .map((item, index) => {
      const description = `
        <div style="font-weight:700;color:#000;font-size:11.5px;">${esc(item.itemName)}</div>
        <div style="font-size:10px;color:#333;margin-top:2px;">${esc(item.metalType)} · ${esc(item.purity)}</div>`;

      return `<tr>
        ${cell(String(index + 1), { rule, align: 'center' })}
        ${cell(description, { rule })}
        ${cell(hsnOf(item), { rule, align: 'center' })}
        ${cell(fw(item.netWt), { rule, align: 'right', bold: true })}
        ${cell(fc(item.ratePerGm), { rule, align: 'right' })}
        ${cell(ti(lang, 'perGms'), { rule, align: 'center' })}
        ${cell(fc(getItemComponents(item).goldValue), { rule, align: 'right', bold: true })}
      </tr>`;
    })
    .join('');

  /** A full-width breakdown line: label right-aligned, figure in the Amount column. */
  const summaryRow = (
    label: string,
    amount: string,
    opts: {
      rate?: string;
      per?: string;
      italic?: boolean;
      strong?: boolean;
      /** Fills the Quantity column — the Total line states the bill's weight. */
      qty?: string;
    } = {},
  ) => `<tr${opts.strong && headFill ? ` style="background:${headFill};"` : ''}>
      ${cell('', { rule })}
      ${cell(
        `<div style="text-align:right;font-weight:700;color:#000;${opts.italic ? 'font-style:italic;' : ''}${opts.strong ? 'font-size:12.5px;' : ''}">${label}</div>`,
        { rule },
      )}
      ${cell('', { rule })}
      ${cell(opts.qty ?? '', { rule, align: 'right', bold: true })}
      ${cell(opts.rate ?? '', { rule, align: 'right' })}
      ${cell(opts.per ?? '', { rule, align: 'center' })}
      ${cell(
        opts.strong ? `<span style="font-size:13px;">${amount}</span>` : amount,
        { rule, align: 'right', bold: true },
      )}
    </tr>`;

  // Same lines, same order, same figures as every other template — including the
  // old-gold exchange and advance-payment lines this table used to omit, which
  // is why its column stopped reconciling with its own Total on those bills.
  // `buildBillLines` is the single source of truth; this only draws them.
  const breakdown = buildBillLines(values, itemsTotal, lang, ctx.combinePayments)
    // The item rows above already state the metal value per line, so the
    // aggregate metal line would be a second statement of the same money.
    .filter(line => line.label !== tl(lang, 'totalAmount'))
    .map(line =>
      summaryRow(line.label, line.amount, {
        rate: line.rate,
        per: line.unit,
        italic: Boolean(line.rate),
        strong: line.strong,
        // The reference bill states the bill's total weight beside its total
        // value; that belongs on Total, not on a Balance Due underneath it.
        qty: line.label === tl(lang, 'total') ? fw(totalWeight) : undefined,
      }),
    );

  // A shop with no details saved yet would otherwise get an empty bordered box
  // above the title — visible in the template preview before onboarding, and on
  // a real bill if someone prints before filling in Shop Details.
  const header = theme.showShopHeader && shopName
    ? `
  <div style="border:1px solid ${rule};border-bottom:0;padding:10px 12px;${accent ? `background:${accent};` : ''}display:flex;align-items:center;gap:12px;">
    ${shop?.logo ? imgTag(shop.logo, 'width:52px;height:52px;object-fit:contain;flex-shrink:0;') : ''}
    <div style="flex:1;">
      <div style="font-size:19px;font-weight:700;color:${accent ? '#fff' : '#000'};line-height:1.2;">${esc(shopName)}</div>
      ${shopAddress ? `<div style="font-size:10.5px;color:${accent ? 'rgba(255,255,255,0.95)' : '#222'};margin-top:3px;">${esc(shopAddress)}</div>` : ''}
      <div style="font-size:10.5px;color:${accent ? 'rgba(255,255,255,0.95)' : '#222'};margin-top:2px;">
        ${shop?.phone ? esc(shop.phone) : ''}${shop?.email ? ` · ${esc(shop.email)}` : ''}
      </div>
      ${hasGstNo ? `<div style="font-size:10.5px;font-weight:700;color:${accent ? '#fff' : '#000'};margin-top:2px;">GSTIN: ${esc(gstNo)}</div>` : ''}
    </div>
  </div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
${buildPageCss(ctx.paper)}
${footerPinCss(ctx.paper)}
* { box-sizing: border-box; }
body { margin: 0; padding: 0; font-family: Arial, "Noto Sans", sans-serif; color: #111; background: #fff; font-size: 11px; }
table { width: 100%; border-collapse: collapse; }
</style>
</head>
<body>

${header}

<div style="border:1px solid ${rule};border-bottom:0;padding:6px 12px;text-align:center;">
  <span style="font-size:14px;font-weight:700;letter-spacing:1px;color:#000;">${ti(lang, 'title')}</span>
</div>

<div style="display:flex;border:1px solid ${rule};border-bottom:0;">
  <div style="flex:1;padding:7px 12px;border-right:1px solid ${rule};">
    <div style="font-size:10px;color:#333;">${tl(lang, 'invoice')}</div>
    <div style="font-size:13px;font-weight:700;color:#000;margin-top:1px;">${esc(ctx.billNo)}</div>
    <div style="font-size:10.5px;color:#222;margin-top:2px;">${esc(ctx.billDate)}</div>
  </div>
  <div style="flex:1.4;padding:7px 12px;">
    <div style="font-size:10px;color:#333;">${tl(lang, 'billTo')}</div>
    <div style="font-size:13px;font-weight:700;color:#000;margin-top:1px;">${esc(values.customerName)}</div>
    ${String(values.phone ?? '').trim() ? `<div style="font-size:10.5px;color:#222;margin-top:2px;">${esc(values.phone)}</div>` : ''}
    ${values.address?.trim() ? `<div style="font-size:10.5px;color:#222;">${esc(values.address)}</div>` : ''}
  </div>
</div>

<!-- The grid grows to the foot of the page rather than the closing boxes
     being detached from it — see footerPinCss. The empty last row carries the
     column rules down, so a two-line bill still prints as one unbroken frame
     instead of a small table adrift above a signature. -->
<div class="bill-grow">
<table>
  <thead>
    <tr${headFill ? ` style="background:${headFill};"` : ''}>
      ${cell(ti(lang, 'slNo'), { rule, align: 'center', bold: true })}
      ${cell(ti(lang, 'description'), { rule, bold: true })}
      ${cell(ti(lang, 'hsnSac'), { rule, align: 'center', bold: true })}
      ${cell(ti(lang, 'quantity'), { rule, align: 'right', bold: true })}
      ${cell(ti(lang, 'rate'), { rule, align: 'right', bold: true })}
      ${cell(ti(lang, 'per'), { rule, align: 'center', bold: true })}
      ${cell(ti(lang, 'amount'), { rule, align: 'right', bold: true })}
    </tr>
  </thead>
  <tbody>
    ${itemRows}
    ${breakdown.join('')}
    <tr class="bill-filler">
      ${cell('', { rule })}
      ${cell('', { rule })}
      ${cell('', { rule })}
      ${cell('', { rule })}
      ${cell('', { rule })}
      ${cell('', { rule })}
      ${cell('', { rule })}
    </tr>
  </tbody>
</table>
</div>

<div style="border:1px solid ${rule};border-top:0;padding:6px 7px;">
  <div style="display:flex;justify-content:space-between;">
    <span style="font-size:10.5px;color:#333;">${ti(lang, 'amountChargeable')}</span>
    <span style="font-size:9.5px;color:#333;font-style:italic;">E. &amp; O.E</span>
  </div>
  <div style="font-size:12px;font-weight:700;color:#000;margin-top:3px;">${esc(amountInWords(grandTotal))}</div>
</div>

<div style="display:flex;border:1px solid ${rule};border-top:0;">
  <div style="flex:1.3;padding:7px 9px;border-right:1px solid ${rule};">
    <div style="font-size:10.5px;font-weight:700;color:#000;text-decoration:underline;">${ti(lang, 'declaration')}</div>
    <div style="font-size:10px;color:#222;margin-top:3px;line-height:1.5;">${ti(lang, 'declarationText')}</div>
  </div>
  <div style="flex:1;padding:7px 9px;text-align:right;display:flex;flex-direction:column;justify-content:space-between;">
    <div style="font-size:10.5px;font-weight:700;color:#000;">${shopName ? `${ti(lang, 'for')} ${esc(shopName)}` : ''}</div>
    ${signatureBlock(shop?.signature, lang, {
      rule,
      captionColor: '#222',
      align: 'right',
      // The declaration box already draws the cell border under this.
      showRule: false,
      // "Pre-Printed Bill (Professional)" is this layout on the shop's own
      // stationery, so it meets short sheets too and the signature shrinks the
      // same way. The shop name is NOT passed: this layout already prints
      // "For <Shop Name>" directly above the block, which is the convention on
      // an Indian tax invoice.
      paper: ctx.paper,
    })}
  </div>
</div>

<div class="bill-tail">
  <div style="text-align:center;font-size:10.5px;color:#111;margin-top:7px;">
    ${shop?.city ? esc(fill(ti(lang, 'jurisdictionLine'), { city: shop.city })) : ''}
  </div>
  <div style="text-align:center;font-size:10px;color:#333;margin-top:3px;">${ti(lang, 'computerGenerated')}</div>
</div>

</body>
</html>`;
};

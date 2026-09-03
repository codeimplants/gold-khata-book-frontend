import { JewelleryFormValues, PrintContext } from '../../types';
import {
  MobileLang,
  fc,
  fw,
  pn,
  tl,
  esc,
  imgTag, signatureBlock,
  closingSection,
  itemPhotoStrip,
  footerBand,
  buildPageCss,
  footerPinCss,
  buildTotalsBlock,
  NUM_FONT,
} from './shared';
import { getSharedMakingBasis, formatDiscountDetail } from '../../utils/formatter';
import { getItemComponents } from '../../utils/calculations';

/**
 * For shops that print onto their own pre-printed stationery.
 *
 * Two things make this different from the other five templates rather than a
 * flag on them:
 *
 * 1. **No shop header at all.** The shop's name, address, phone and GSTIN are
 *    already on the paper, printed by a press. Rendering them again would
 *    overprint the letterhead. The blank strip they occupy is reserved by
 *    `@page margin-top` (see buildPageCss) so it holds on page two as well —
 *    a shopkeeper loads a whole stack of letterhead, not one sheet.
 *
 *    Note this template must still emit the invoice number and date itself.
 *    In `minimal` those live *inside* the header block, so simply dropping the
 *    header there would silently lose the bill number.
 *
 * 2. **Built for a narrow sheet.** Custom stationery is routinely much narrower
 *    than A4, where `minimal`'s seven columns stop fitting. Pieces, making and
 *    discount move under the item name, leaving four columns that stay readable
 *    from roughly 90mm up to full A4.
 *
 * Type is deliberately larger and darker than the other templates — 10px column
 * headers in #444 rather than 8px in #888. Shopkeepers reported the printed bill
 * reads too small and too faint, and there was no reason to reproduce that in
 * something new. (Correcting the other five is a separate type-scale pass.)
 *
 * No background fills or gradients either: they would fight the letterhead, and
 * browsers drop them anyway unless the user ticks "Background graphics".
 */
export const buildLetterheadHTML = (
  values: JewelleryFormValues,
  ctx: PrintContext,
  lang: MobileLang,
): string => {
  const shop = ctx.shopDetails;
  // The signature is kept even though other shop details are not: letterhead
  // carries the shop's identity, but it is not signed at the press.
  const hasSignature = Boolean(shop?.signature);
  const hasAddress = Boolean(values.address?.trim());
  const hasPhone = Boolean(String(values.phone ?? '').trim());
  const itemsTotal = values.items.reduce((s, i) => s + pn(i.itemTotal), 0);

  const makingBasis = getSharedMakingBasis(values.items, tl(lang, 'makingFixed'));

  const itemRows = values.items
    .map(item => {
      const making = getItemComponents(item).makingTotal;
      const disc = formatDiscountDetail(item);
      const pcs = pn(item.pcs);

      // Everything that would have been its own column on A4, folded into one
      // line under the item name so the money columns keep their width.
      const detail = [
        `${esc(item.metalType)} · ${esc(item.purity)}`,
        pcs > 0 ? `${tl(lang, 'pcs')}: ${pcs}` : '',
        making > 0
          ? `${tl(lang, 'making')}${makingBasis ? ` (${esc(makingBasis)})` : ''}: ${fc(making)}`
          : '',
        disc ? `${tl(lang, 'discount')}: ${esc(disc)}` : '',
      ]
        .filter(Boolean)
        .join('  ·  ');

      return `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #d4d4d4;vertical-align:top;">
          <div style="font-size:12px;font-weight:600;color:#000;">${esc(item.itemName)}</div>
          <div style="font-size:10px;color:#555;margin-top:2px;line-height:1.45;">${detail}</div>
          ${itemPhotoStrip(item as any, values.includeItemPhotosOnBill, ctx.paper)}
        </td>
        <td style="padding:8px 6px;border-bottom:1px solid #d4d4d4;text-align:right;font-size:12.5px;font-weight:700;color:#111;vertical-align:top;white-space:nowrap;${NUM_FONT}">${fw(item.netWt)}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #d4d4d4;text-align:right;font-size:12.5px;font-weight:700;color:#111;vertical-align:top;white-space:nowrap;${NUM_FONT}">${fc(item.ratePerGm)}</td>
        <td style="padding:8px 0;border-bottom:1px solid #d4d4d4;text-align:right;font-size:13.5px;font-weight:700;color:#000;vertical-align:top;white-space:nowrap;${NUM_FONT}">${fc(item.itemTotal)}</td>
      </tr>`;
    })
    .join('');

  const totals = buildTotalsBlock(
    values,
    itemsTotal,
    lang,
    `display:flex;justify-content:space-between;font-size:12.5px;font-weight:600;color:#222;margin-bottom:5px;gap:14px;${NUM_FONT}`,
    `display:flex;justify-content:space-between;font-size:16px;font-weight:700;color:#000;border-top:2px solid #000;padding-top:8px;margin-top:7px;gap:14px;${NUM_FONT}`,
    ctx.combinePayments,
  );

  const th =
    'font-size:11.5px;text-transform:uppercase;letter-spacing:0.4px;color:#000;font-weight:700;padding:0 0 7px;border-bottom:1.5px solid #000;';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
${buildPageCss(ctx.paper)}
${footerPinCss(ctx.paper)}
* { box-sizing: border-box; }
body { margin: 0; padding: 0; font-family: Georgia, serif; color: #111; background: #fff; font-size: 12px; }
table { width: 100%; border-collapse: collapse; }
</style>
</head>
<body>

<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding-bottom:8px;">
  <div>
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:#666;margin-bottom:3px;">${tl(lang, 'billTo')}</div>
    <div style="font-size:13px;font-weight:700;color:#000;">${esc(values.customerName)}</div>
    ${hasPhone ? `<div style="font-size:11px;color:#444;margin-top:1px;">${esc(values.phone)}</div>` : ''}
    ${hasAddress ? `<div style="font-size:11px;color:#444;margin-top:1px;">${esc(values.address)}</div>` : ''}
  </div>
  <div style="text-align:right;white-space:nowrap;">
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:#666;margin-bottom:3px;">${tl(lang, 'invoice')}</div>
    <div style="font-size:17px;font-weight:700;color:#000;${NUM_FONT}">${esc(ctx.billNo)}</div>
    <div style="font-size:11.5px;color:#222;margin-top:1px;${NUM_FONT}">${esc(ctx.billDate)}</div>
  </div>
</div>

<table style="margin-top:6px;">
  <thead>
    <tr>
      <th style="${th}text-align:left;">${tl(lang, 'items')}</th>
      <th style="${th}text-align:right;">${tl(lang, 'netWt')}</th>
      <th style="${th}text-align:right;">${tl(lang, 'ratePerGm')}</th>
      <th style="${th}text-align:right;">${tl(lang, 'amount')}</th>
    </tr>
  </thead>
  <tbody>${itemRows}</tbody>
</table>

<!-- Signature and thank-you sit at the foot of the page — and on a short sheet
     the signature moves up beside the totals. This template prints on the
     shop's own stationery, where both matter most: a signature drifting into
     the middle of the sheet is the most visible of all, and a slip has no
     second page to spare. See closingSection and footerPinCss. -->
${closingSection({
  totals,
  totalsRowStyle: 'display:flex;justify-content:flex-end;padding-top:12px;',
  totalsWidth: '170px',
  signRowStyle: 'display:flex;justify-content:flex-start;padding-top:18px;',
  paper: ctx.paper,
  signature: signatureBlock(shop?.signature, lang, {
    rule: '#999',
    captionColor: '#555',
    // The shop's name is already pre-printed at the top of this stationery,
    // but it belongs here too: under the caption it is the signature's
    // attribution, not a second header.
    shopName: shop?.shopName || shop?.name || '',
    paper: ctx.paper,
  }),
  band: footerBand(lang, {
    paper: ctx.paper,
    bandStyle: 'border-top:1px solid #d4d4d4;padding-top:8px;margin-top:12px;',
    thankYouStyle: 'font-size:10px;font-style:italic;color:#555;',
    noteStyle: 'font-size:10px;color:#444;',
  }),
})}

</body>
</html>`;
};

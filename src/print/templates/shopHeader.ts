import { JewelleryFormValues, PrintContext } from '../../types';
import { MobileLang, fc, fw, pn, tl, imgTag, signatureBlock, footerBand, closingSection, buildPageCss, footerPinCss, buildTotalsBlock } from './shared';
import { getSharedMakingBasis, formatDiscountDetail } from '../../utils/formatter';
import { getItemComponents } from '../../utils/calculations';

export const buildShopHeaderHTML = (
  values: JewelleryFormValues,
  ctx: PrintContext,
  lang: MobileLang,
): string => {
  const shop = ctx.shopDetails;
  const hasSignature = Boolean(shop?.signature);
  const hasGstNo = Boolean(shop?.gstNo?.trim() || shop?.gstNumber?.trim());
  const hasAddress = Boolean(values.address?.trim());
  // A customer's phone number is optional. Guarded like the address above
  // rather than interpolated raw, which printed "undefined" on a reprint of
  // a bill for a customer saved without one.
  const hasPhone = Boolean(String(values.phone ?? '').trim());

  const itemsTotal = values.items.reduce((s, i) => s + pn(i.itemTotal), 0);
  // "MAKING (10%)" — the basis stated once, when every line shares one.
  // Null when they differ, and then the header says only "MAKING": one
  // header cannot describe lines charged on different bases.
  const makingBasis = getSharedMakingBasis(values.items, tl(lang, 'makingFixed'));
  const makingHeader = makingBasis
    ? `${tl(lang, 'making')} (${makingBasis})`
    : tl(lang, 'making');

  const itemRows = values.items.map(item => {
    // The rupee amount this line's making charge came to. What it was
    // calculated FROM — "10%", "₹250 / gm" — is stated once in the column
    // header instead, so a money column holds money.
    const making = getItemComponents(item).makingTotal;
    const disc = formatDiscountDetail(item);
    return `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;vertical-align:middle;">
          <div style="font-size:12px;font-weight:600;color:#111827;margin-bottom:2px;">${item.itemName}</div>
          <span style="display:inline-block;background:#f3f4f6;border:1px solid #d1d5db;border-radius:3px;padding:1px 5px;font-size:10.5px;color:#4b5563;">
            ${item.metalType} · ${item.purity}
          </span>
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:12px;">${item.pcs}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:12px;">${fw(item.netWt)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:12px;">${making > 0 ? fc(making) : '—'}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:12px;">${disc || '—'}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:12px;">${fc(item.ratePerGm)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;font-weight:700;color:#111827;">${fc(item.itemTotal)}</td>
      </tr>`;
  }).join('');

  const totals = buildTotalsBlock(
    values, itemsTotal, lang,
    'display:flex;justify-content:space-between;font-size:11px;color:#4b5563;margin-bottom:6px;gap:20px;',
    'display:flex;justify-content:space-between;font-size:14px;font-weight:700;color:#111827;border-top:2px solid #111827;padding-top:9px;margin-top:8px;gap:20px;',
    ctx.combinePayments,
  );

  const gstCard = hasGstNo
    ? `<div style="flex:1;min-width:100px;border:1px solid #d1d5db;border-radius:6px;padding:8px 10px;background:#f9fafb;">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#374151;font-weight:700;margin-bottom:3px;">${tl(lang, 'gstDetails')}</div>
        <div style="font-size:10px;font-weight:600;color:#111827;">${shop?.gstNo || shop?.gstNumber || ''}</div>
      </div>` : '';

  const bannerTag = imgTag(shop?.shopHeader, 'display:block;width:100%;height:210px;object-fit:fill;');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
${buildPageCss(ctx.paper)}
${footerPinCss(ctx.paper)}
* { box-sizing: border-box; }
body { margin: 0; padding: 0; font-family: "Noto Sans", Arial, sans-serif; color: #111827; background: #fff; font-size: 12px; }
table { width: 100%; border-collapse: collapse; }
</style>
</head>
<body>

<!-- SHOP HEADER BANNER -->
${bannerTag || '<div style="width:100%;height:210px;background:#f3f4f6;"></div>'}

<!-- META CARDS -->
<div style="display:flex;gap:8px;margin:10px 18px;flex-wrap:wrap;">
  <div style="flex:1;min-width:100px;border:1px solid #d1d5db;border-radius:6px;padding:8px 10px;background:#f9fafb;">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#374151;font-weight:700;margin-bottom:3px;">${tl(lang, 'invoice')}</div>
    <div style="font-size:11px;font-weight:700;color:#111827;">${ctx.billNo}</div>
    <div style="font-size:10.5px;color:#374151;margin-top:1px;">${ctx.billDate}</div>
  </div>
  <div style="flex:1;min-width:100px;border:1px solid #d1d5db;border-radius:6px;padding:8px 10px;background:#f9fafb;">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#374151;font-weight:700;margin-bottom:3px;">${tl(lang, 'billTo')}</div>
    <div style="font-size:11px;font-weight:700;color:#111827;">${values.customerName}</div>
    ${hasPhone ? `<div style="font-size:10.5px;color:#374151;">${values.phone}</div>` : ''}
    ${hasAddress ? `<div style="font-size:10.5px;color:#374151;">${values.address}</div>` : ''}
  </div>
  ${gstCard}
</div>

<!-- ITEMS -->
<div style="padding:0 18px;">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
    <div style="flex:1;height:1px;background:#d1d5db;"></div>
    <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:2px;color:#374151;font-weight:700;">${tl(lang, 'items')}</div>
    <div style="flex:1;height:1px;background:#d1d5db;"></div>
  </div>
  <table>
    <thead>
      <tr style="background:#f9fafb;border-top:1.5px solid #d1d5db;border-bottom:1.5px solid #d1d5db;">
        <th style="font-size:10px;text-transform:uppercase;color:#374151;font-weight:700;padding:7px 8px;text-align:left;">${tl(lang, 'items')}</th>
        <th style="font-size:10px;text-transform:uppercase;color:#374151;font-weight:700;padding:7px;text-align:center;">${tl(lang, 'pcs')}</th>
        <th style="font-size:10px;text-transform:uppercase;color:#374151;font-weight:700;padding:7px;text-align:center;">${tl(lang, 'netWt')}</th>
        <th style="font-size:10px;text-transform:uppercase;color:#374151;font-weight:700;padding:7px;text-align:right;">${makingHeader}</th>
        <th style="font-size:10px;text-transform:uppercase;color:#374151;font-weight:700;padding:7px;text-align:right;">${tl(lang, 'discount')}</th>
        <th style="font-size:10px;text-transform:uppercase;color:#374151;font-weight:700;padding:7px;text-align:right;">${tl(lang, 'ratePerGm')}</th>
        <th style="font-size:10px;text-transform:uppercase;color:#374151;font-weight:700;padding:7px 8px;text-align:right;">${tl(lang, 'amount')}</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
</div>

<!-- BOTTOM — totals stay with the rows they add up; only the signature and
     the thank-you band drop to the foot of the page. See footerPinCss. -->
${closingSection({
  totals,
  totalsRowStyle: 'display:flex;justify-content:flex-end;padding:12px 18px 16px;margin-top:6px;',
  totalsWidth: '190px',
  signRowStyle: 'display:flex;justify-content:flex-start;padding:0 18px 16px;',
  paper: ctx.paper,
  signature: signatureBlock(shop?.signature, lang, {
    rule: '#e5e7eb',
    captionColor: '#4b5563',
    shopName: shop?.shopName || shop?.name || '',
    paper: ctx.paper,
  }),
  // Empty string on a sheet with no room for it. See closingTier.
  band: footerBand(lang, {
    paper: ctx.paper,
    bandStyle: 'background:#f3f4f6;padding:8px 18px;',
    thankYouStyle: 'font-size:10.5px;text-transform:uppercase;letter-spacing:0.5px;color:#374151;',
  }),
})}

</body>
</html>`;
};

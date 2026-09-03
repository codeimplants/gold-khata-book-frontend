import { JewelleryFormValues, PrintContext } from '../../types';
import { MobileLang, fc, fw, pn, tl, imgTag, signatureBlock, itemPhotoStrip, footerBand, closingSection, buildPageCss, footerPinCss, buildTotalsBlock } from './shared';
import { getSharedMakingBasis, formatDiscountDetail } from '../../utils/formatter';
import { getItemComponents } from '../../utils/calculations';

export const buildModernHTML = (
  values: JewelleryFormValues,
  ctx: PrintContext,
  lang: MobileLang,
): string => {
  const shop = ctx.shopDetails;
  const hasLogo = Boolean(shop?.logo);
  const hasSignature = Boolean(shop?.signature);
  const hasGstNo = Boolean(shop?.gstNo?.trim() || shop?.gstNumber?.trim());
  const hasAddress = Boolean(values.address?.trim());
  // A customer's phone number is optional. Guarded like the address above
  // rather than interpolated raw, which printed "undefined" on a reprint of
  // a bill for a customer saved without one.
  const hasPhone = Boolean(String(values.phone ?? '').trim());
  const addressParts = [shop?.address, shop?.city, shop?.state].filter(Boolean);
  const shopAddress = addressParts.join(', ');
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
        <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;vertical-align:middle;">
          <div style="font-size:12px;font-weight:600;color:#111827;margin-bottom:2px;">${item.itemName}</div>
          <span style="display:inline-block;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:3px;padding:1px 5px;font-size:10.5px;color:#374151;">
            ${item.metalType} · ${item.purity}
          </span>
          ${itemPhotoStrip(item as any, values.includeItemPhotosOnBill, ctx.paper)}
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;text-align:center;font-size:12px;">${item.pcs}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;text-align:center;font-size:12px;">${fw(item.netWt)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px;">${making > 0 ? fc(making) : '—'}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px;">${disc || '—'}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px;">${fc(item.ratePerGm)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:13px;font-weight:700;">${fc(item.itemTotal)}</td>
      </tr>`;
  }).join('');

  const totals = buildTotalsBlock(
    values, itemsTotal, lang,
    'display:flex;justify-content:space-between;font-size:11px;color:#374151;margin-bottom:5px;gap:16px;',
    'display:flex;justify-content:space-between;font-size:14px;font-weight:600;color:#111827;border-top:1px solid #e5e7eb;padding-top:8px;margin-top:6px;gap:16px;',
    ctx.combinePayments,
  );

  const gstCard = hasGstNo
    ? `<div style="flex:1;min-width:90px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:7px;padding:8px 10px;">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#4b5563;margin-bottom:3px;">${tl(lang, 'gstDetails')}</div>
        <div style="font-size:10px;font-weight:600;color:#111827;">${shop?.gstNo || shop?.gstNumber || ''}</div>
      </div>` : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
${buildPageCss(ctx.paper)}
${footerPinCss(ctx.paper)}
* { box-sizing: border-box; }
body { margin: 0; padding: 0; font-family: "Inter", -apple-system, Arial, sans-serif; color: #111827; background: #fff; font-size: 12px; }
table { width: 100%; border-collapse: collapse; }
</style>
</head>
<body>

<div style="height:4px;background:linear-gradient(90deg,#C9A84C,#F0D060,#C9A84C);"></div>

<div style="padding:18px 20px 14px;background:#fffdf5;border-bottom:1px solid #f0e8c8;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
    <div style="display:flex;align-items:center;gap:10px;">
      ${hasLogo ? imgTag(shop?.logo, 'width:48px;height:48px;border-radius:6px;object-fit:contain;border:1px solid #f0e8c8;') : ''}
      <div>
        <div style="font-size:20px;font-weight:700;color:#1C1008;letter-spacing:0.5px;">${shop?.shopName || shop?.name || 'Jewellery Shop'}</div>
        ${shop?.shopDesc ? `<div style="font-size:10px;color:#4b5563;font-style:italic;margin-top:1px;">${shop.shopDesc}</div>` : ''}
        <div style="height:1.5px;width:60px;background:linear-gradient(90deg,#C9A84C,#F0D060);border-radius:2px;margin:5px 0;"></div>
        ${shopAddress ? `<div style="font-size:10px;color:#374151;">📍 ${shopAddress}</div>` : ''}
        ${shop?.phone ? `<div style="font-size:10px;color:#374151;">📞 ${shop.phone}${shop?.email ? ` · ✉ ${shop.email}` : ''}</div>` : ''}
      </div>
    </div>
    <div style="text-align:right;flex-shrink:0;">
      <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#4b5563;margin-bottom:2px;">${tl(lang, 'invoice')}</div>
      <div style="font-size:14px;font-weight:700;color:#1C1008;">${ctx.billNo}</div>
      <div style="font-size:10px;color:#374151;margin-top:1px;">${ctx.billDate}</div>
    </div>
  </div>
</div>

<div style="height:3px;background:linear-gradient(90deg,#C9A84C,#F0D060,#C9A84C);"></div>

<div style="display:flex;gap:8px;margin:12px 20px;flex-wrap:wrap;">
  <div style="flex:1;min-width:90px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:7px;padding:8px 10px;">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#4b5563;margin-bottom:3px;">${tl(lang, 'invoice')}</div>
    <div style="font-size:11px;font-weight:600;color:#111827;">${ctx.billNo}</div>
    <div style="font-size:10.5px;color:#374151;margin-top:1px;">${ctx.billDate}</div>
  </div>
  <div style="flex:1;min-width:90px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:7px;padding:8px 10px;">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#4b5563;margin-bottom:3px;">${tl(lang, 'billTo')}</div>
    <div style="font-size:11px;font-weight:600;color:#111827;">${values.customerName}</div>
    ${hasPhone ? `<div style="font-size:10.5px;color:#374151;">${values.phone}</div>` : ''}
    ${hasAddress ? `<div style="font-size:10.5px;color:#374151;">${values.address}</div>` : ''}
  </div>
  ${gstCard}
</div>

<div style="padding:0 20px;">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
    <div style="flex:1;height:0.5px;background:#e5e7eb;"></div>
    <span style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#4b5563;">${tl(lang, 'items')}</span>
    <div style="flex:1;height:0.5px;background:#e5e7eb;"></div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="font-size:10px;text-transform:uppercase;color:#1f2937;font-weight:700;padding:0 8px 8px;border-bottom:1px solid #e5e7eb;text-align:left;">${tl(lang, 'items')}</th>
        <th style="font-size:10px;text-transform:uppercase;color:#1f2937;font-weight:700;padding:0 8px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">${tl(lang, 'pcs')}</th>
        <th style="font-size:10px;text-transform:uppercase;color:#1f2937;font-weight:700;padding:0 8px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">${tl(lang, 'netWt')}</th>
        <th style="font-size:10px;text-transform:uppercase;color:#1f2937;font-weight:700;padding:0 8px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${makingHeader}</th>
        <th style="font-size:10px;text-transform:uppercase;color:#1f2937;font-weight:700;padding:0 8px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${tl(lang, 'discount')}</th>
        <th style="font-size:10px;text-transform:uppercase;color:#1f2937;font-weight:700;padding:0 8px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${tl(lang, 'ratePerGm')}</th>
        <th style="font-size:10px;text-transform:uppercase;color:#1f2937;font-weight:700;padding:0 8px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${tl(lang, 'amount')}</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
</div>

<!-- Totals stay with the rows they add up; only the signature and the
     thank-you strip drop to the foot of the page. See footerPinCss. -->
${closingSection({
  totals,
  totalsRowStyle: 'display:flex;justify-content:flex-end;padding:14px 20px 18px;margin-top:4px;',
  totalsWidth: '180px',
  signRowStyle: 'display:flex;justify-content:flex-start;padding:0 20px 18px;',
  paper: ctx.paper,
  signature: signatureBlock(shop?.signature, lang, {
    rule: '#e5e7eb',
    captionColor: '#4b5563',
    shopName: shop?.shopName || shop?.name || '',
    paper: ctx.paper,
  }),
  band: footerBand(lang, {
    paper: ctx.paper,
    bandStyle: 'border-top:1px solid #f0e8c8;padding:9px 20px;background:#fffdf5;',
    thankYouStyle: 'font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#4b5563;',
    noteStyle: 'font-size:10.5px;color:#4b5563;',
  }),
  // The gold rule belongs to the footer, not after it: left outside the pinned
  // block it would sit at the very page edge on its own.
  after: '<div style="height:4px;background:linear-gradient(90deg,#C9A84C,#F0D060,#C9A84C);"></div>',
})}

</body>
</html>`;
};

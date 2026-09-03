import { JewelleryFormValues, PrintContext } from '../../types';
import { MobileLang, fc, fw, pn, tl, imgTag, signatureBlock, itemPhotoStrip, footerBand, closingSection, buildPageCss, footerPinCss, buildTotalsBlock } from './shared';
import { getSharedMakingBasis, formatDiscountDetail } from '../../utils/formatter';
import { getItemComponents } from '../../utils/calculations';
import { getFullImageUrl } from '../../utils/imageUtils';

export const buildTraditionalHTML = (
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
        <td style="padding:10px 8px;border-bottom:1px solid #fde8c8;vertical-align:middle;">
          <div style="font-size:12px;font-weight:600;color:#1a0a00;margin-bottom:2px;">${item.itemName}</div>
          <span style="display:inline-block;background:#fff3e0;border:1px solid #f5a623;border-radius:3px;padding:1px 5px;font-size:10.5px;color:#c85a00;">
            ${item.metalType} · ${item.purity}
          </span>
          ${itemPhotoStrip(item as any, values.includeItemPhotosOnBill, ctx.paper)}
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #fde8c8;text-align:center;font-size:12px;">${item.pcs}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #fde8c8;text-align:center;font-size:12px;">${fw(item.netWt)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #fde8c8;text-align:right;font-size:12px;">${making > 0 ? fc(making) : '—'}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #fde8c8;text-align:right;font-size:12px;">${disc || '—'}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #fde8c8;text-align:right;font-size:12px;">${fc(item.ratePerGm)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #fde8c8;text-align:right;font-size:13px;font-weight:700;color:#1a0a00;">${fc(item.itemTotal)}</td>
      </tr>`;
  }).join('');

  const totals = buildTotalsBlock(
    values, itemsTotal, lang,
    'display:flex;justify-content:space-between;font-size:11px;color:#4a3423;margin-bottom:6px;gap:20px;',
    'display:flex;justify-content:space-between;font-size:14px;font-weight:700;color:#fff;background:linear-gradient(90deg,#c85a00,#f5a623);padding:9px 12px;border-radius:4px;margin-top:8px;gap:20px;',
    ctx.combinePayments,
  );

  const gstCard = (hasGstNo)
    ? `<div style="flex:1;min-width:100px;border:1px solid #f5a623;border-radius:6px;padding:8px 10px;background:#fffbf5;">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#c85a00;font-weight:700;margin-bottom:3px;">${tl(lang, 'gstDetails')}</div>
        <div style="font-size:10px;font-weight:600;color:#1a0a00;">${shop?.gstNo || shop?.gstNumber || ''}</div>
      </div>` : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
${buildPageCss(ctx.paper)}
${footerPinCss(ctx.paper)}
* { box-sizing: border-box; }
body { margin: 0; padding: 0; font-family: "Noto Sans", Arial, sans-serif; color: #1a0a00; background: #fff; font-size: 12px; }
table { width: 100%; border-collapse: collapse; }
</style>
</head>
<body>

<!-- HEADER -->
<div style="background:linear-gradient(135deg,#c85a00 0%,#f5a623 45%,#f5c842 70%,#e06a00 100%);">
  <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 18px 5px;border-bottom:1px solid rgba(255,255,255,0.25);">
    <div style="font-size:10.5px;font-weight:700;color:rgba(255,255,255,0.9);letter-spacing:1px;text-transform:uppercase;">${tl(lang, 'cashMemo')}</div>
    ${shop?.shopDesc ? `<div style="font-size:10px;color:rgba(255,255,255,0.9);text-align:center;letter-spacing:1px;">${shop.shopDesc}</div>` : '<div></div>'}
    <div style="text-align:right;font-size:10px;color:rgba(255,255,255,0.95);font-weight:600;line-height:1.6;">${shop?.phone || ''}</div>
  </div>

  <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px 10px;gap:12px;">
    <div style="flex-shrink:0;width:52px;height:52px;border-radius:50%;border:2.5px solid rgba(255,255,255,0.8);overflow:hidden;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;">
      ${hasLogo
        ? imgTag(shop?.logo, 'width:100%;height:100%;object-fit:cover;')
        : '<div style="font-size:18px;color:rgba(255,255,255,0.7);">💍</div>'}
    </div>
    <div style="flex:1;text-align:center;">
      <div style="font-size:24px;font-weight:800;color:#fff;text-shadow:0 2px 5px rgba(0,0,0,0.2);letter-spacing:1px;line-height:1.1;">${shop?.shopName || shop?.name || 'Jewellery Shop'}</div>
    </div>
    <div style="text-align:right;flex-shrink:0;">
      <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.75);margin-bottom:2px;">${tl(lang, 'invoice')}</div>
      <div style="font-size:13px;font-weight:700;color:#fff;">${ctx.billNo}</div>
      <div style="font-size:10px;color:rgba(255,255,255,0.85);margin-top:1px;">${ctx.billDate}</div>
    </div>
  </div>

  ${shopAddress ? `<div style="text-align:center;font-size:10px;color:rgba(255,255,255,0.9);padding:0 18px 10px;line-height:1.4;">📍 ${shopAddress}${shop?.email ? ` · ✉ ${shop.email}` : ''}</div>` : ''}
  <div style="height:3px;background:rgba(0,0,0,0.15);"></div>
</div>

<!-- META CARDS -->
<div style="display:flex;gap:8px;margin:10px 18px;flex-wrap:wrap;">
  <div style="flex:1;min-width:100px;border:1px solid #f5a623;border-radius:6px;padding:8px 10px;background:#fffbf5;">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#c85a00;font-weight:700;margin-bottom:3px;">${tl(lang, 'invoice')}</div>
    <div style="font-size:11px;font-weight:700;color:#1a0a00;">${ctx.billNo}</div>
    <div style="font-size:10.5px;color:#4a3423;margin-top:1px;">${ctx.billDate}</div>
  </div>
  <div style="flex:1;min-width:100px;border:1px solid #f5a623;border-radius:6px;padding:8px 10px;background:#fffbf5;">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#c85a00;font-weight:700;margin-bottom:3px;">${tl(lang, 'billTo')}</div>
    <div style="font-size:11px;font-weight:700;color:#1a0a00;">${values.customerName}</div>
    ${hasPhone ? `<div style="font-size:10.5px;color:#4a3423;">${values.phone}</div>` : ''}
    ${hasAddress ? `<div style="font-size:10.5px;color:#4a3423;">${values.address}</div>` : ''}
  </div>
  ${gstCard}
</div>

<!-- ITEMS -->
<div style="padding:0 18px;">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
    <div style="flex:1;height:1px;background:#f5a623;"></div>
    <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:2px;color:#c85a00;font-weight:700;">${tl(lang, 'items')}</div>
    <div style="flex:1;height:1px;background:#f5a623;"></div>
  </div>
  <table>
    <thead>
      <tr style="background:#fff7ee;border-top:1.5px solid #f5a623;border-bottom:1.5px solid #f5a623;">
        <th style="font-size:10px;text-transform:uppercase;color:#c85a00;font-weight:700;padding:7px 8px;text-align:left;">${tl(lang, 'items')}</th>
        <th style="font-size:10px;text-transform:uppercase;color:#c85a00;font-weight:700;padding:7px;text-align:center;">${tl(lang, 'pcs')}</th>
        <th style="font-size:10px;text-transform:uppercase;color:#c85a00;font-weight:700;padding:7px;text-align:center;">${tl(lang, 'netWt')}</th>
        <th style="font-size:10px;text-transform:uppercase;color:#c85a00;font-weight:700;padding:7px;text-align:right;">${makingHeader}</th>
        <th style="font-size:10px;text-transform:uppercase;color:#c85a00;font-weight:700;padding:7px;text-align:right;">${tl(lang, 'discount')}</th>
        <th style="font-size:10px;text-transform:uppercase;color:#c85a00;font-weight:700;padding:7px;text-align:right;">${tl(lang, 'ratePerGm')}</th>
        <th style="font-size:10px;text-transform:uppercase;color:#c85a00;font-weight:700;padding:7px 8px;text-align:right;">${tl(lang, 'amount')}</th>
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
    bandStyle: 'background:linear-gradient(90deg,#c85a00,#f5a623);padding:8px 18px;',
    thankYouStyle: 'font-size:10.5px;text-transform:uppercase;letter-spacing:0.5px;color:#fff;',
  }),
})}

</body>
</html>`;
};

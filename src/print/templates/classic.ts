import { JewelleryFormValues, PrintContext } from '../../types';
import { MobileLang, fc, fw, pn, tl, imgTag, signatureBlock, itemPhotoStrip, footerBand, closingSection, buildPageCss, footerPinCss, buildTotalsBlock } from './shared';
import { getSharedMakingBasis, formatDiscountDetail } from '../../utils/formatter';
import { getItemComponents } from '../../utils/calculations';

export const buildClassicHTML = (
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

  const itemRows = values.items.map((item, idx) => {
    // The rupee amount this line's making charge came to. What it was
    // calculated FROM — "10%", "₹250 / gm" — is stated once in the column
    // header instead, so a money column holds money.
    const making = getItemComponents(item).makingTotal;
    const disc = formatDiscountDetail(item);
    const rowBg = idx % 2 === 0 ? '#f8fafc' : '#fff';
    return `
      <tr style="background:${rowBg};">
        <td style="padding:9px 10px;border-bottom:1px solid #e2e8f0;vertical-align:middle;">
          <div style="font-size:12px;font-weight:600;color:#0f172a;">${item.itemName}</div>
          <div style="font-size:10.5px;color:#334155;margin-top:2px;">${item.metalType} · ${item.purity}</div>
          ${itemPhotoStrip(item as any, values.includeItemPhotosOnBill, ctx.paper)}
        </td>
        <td style="padding:9px 10px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:11px;color:#334155;">${item.pcs}</td>
        <td style="padding:9px 10px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:11px;color:#334155;">${fw(item.netWt)}</td>
        <td style="padding:9px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:11px;color:#334155;">${making > 0 ? fc(making) : '—'}</td>
        <td style="padding:9px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:11px;color:#334155;">${disc || '—'}</td>
        <td style="padding:9px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:11px;color:#334155;">${fc(item.ratePerGm)}</td>
        <td style="padding:9px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:12px;font-weight:700;color:#1e3a5f;">${fc(item.itemTotal)}</td>
      </tr>`;
  }).join('');

  const totals = buildTotalsBlock(
    values, itemsTotal, lang,
    'display:flex;justify-content:space-between;font-size:11px;color:#334155;margin-bottom:4px;gap:16px;',
    'display:flex;justify-content:space-between;font-size:14px;font-weight:700;color:#fff;background:#1e3a5f;padding:8px 12px;border-radius:4px;margin-top:8px;gap:16px;',
    ctx.combinePayments,
  );

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
${buildPageCss(ctx.paper)}
${footerPinCss(ctx.paper)}
* { box-sizing: border-box; }
body { margin: 0; padding: 0; font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; background: #fff; font-size: 12px; }
table { width: 100%; border-collapse: collapse; }
</style>
</head>
<body>

<div style="background:#1e3a5f;padding:20px 22px 16px;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
    <div style="display:flex;align-items:center;gap:10px;">
      ${hasLogo ? imgTag(shop?.logo, 'width:48px;height:48px;border-radius:5px;object-fit:contain;border:1.5px solid rgba(255,255,255,0.3);background:rgba(255,255,255,0.1);padding:3px;') : ''}
      <div>
        <div style="font-size:22px;font-weight:700;color:#fff;">${shop?.shopName || shop?.name || 'Jewellery Shop'}</div>
        ${shop?.shopDesc ? `<div style="font-size:10px;color:rgba(255,255,255,0.65);font-style:italic;margin-top:1px;">${shop.shopDesc}</div>` : ''}
        <div style="margin-top:6px;font-size:10px;color:rgba(255,255,255,0.75);line-height:1.5;">
          ${shopAddress ? `📍 ${shopAddress}` : ''}
          ${shop?.phone ? `<br>📞 ${shop.phone}${shop?.email ? ` · ✉ ${shop.email}` : ''}` : ''}
        </div>
      </div>
    </div>
    <div style="text-align:right;flex-shrink:0;">
      <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.5);margin-bottom:3px;">${tl(lang, 'invoice')}</div>
      <div style="font-size:16px;font-weight:700;color:#fff;">${ctx.billNo}</div>
      <div style="font-size:10px;color:rgba(255,255,255,0.7);margin-top:2px;">${ctx.billDate}</div>
    </div>
  </div>
</div>

<div style="height:3px;background:linear-gradient(90deg,#3b82f6,#60a5fa,#3b82f6);"></div>

<div style="display:flex;gap:8px;margin:12px 22px;flex-wrap:wrap;">
  <div style="flex:1;min-width:90px;border:1px solid #e2e8f0;border-radius:5px;padding:8px 10px;border-top:3px solid #1e3a5f;">
    <div style="font-size:10px;text-transform:uppercase;color:#334155;font-weight:600;margin-bottom:3px;">${tl(lang, 'invoice')}</div>
    <div style="font-size:11px;font-weight:700;color:#0f172a;">${ctx.billNo}</div>
    <div style="font-size:10.5px;color:#334155;">${ctx.billDate}</div>
  </div>
  <div style="flex:1;min-width:90px;border:1px solid #e2e8f0;border-radius:5px;padding:8px 10px;border-top:3px solid #1e3a5f;">
    <div style="font-size:10px;text-transform:uppercase;color:#334155;font-weight:600;margin-bottom:3px;">${tl(lang, 'billTo')}</div>
    <div style="font-size:11px;font-weight:700;color:#0f172a;">${values.customerName}</div>
    ${hasPhone ? `<div style="font-size:10.5px;color:#334155;">${values.phone}</div>` : ''}
    ${hasAddress ? `<div style="font-size:10.5px;color:#334155;">${values.address}</div>` : ''}
  </div>
  ${hasGstNo ? `<div style="flex:1;min-width:90px;border:1px solid #e2e8f0;border-radius:5px;padding:8px 10px;border-top:3px solid #1e3a5f;">
    <div style="font-size:10px;text-transform:uppercase;color:#334155;font-weight:600;margin-bottom:3px;">${tl(lang, 'gstDetails')}</div>
    <div style="font-size:10px;font-weight:600;color:#0f172a;">${shop?.gstNo || shop?.gstNumber || ''}</div>
  </div>` : ''}
</div>

<div style="padding:0 22px;">
  <div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#1e3a5f;font-weight:700;padding:7px 0;border-bottom:2px solid #1e3a5f;margin-bottom:0;">${tl(lang, 'items')}</div>
  <table>
    <thead>
      <tr style="background:#f1f5f9;">
        <th style="font-size:10px;text-transform:uppercase;color:#1e293b;font-weight:700;padding:8px 10px;text-align:left;border-bottom:1px solid #e2e8f0;">${tl(lang, 'items')}</th>
        <th style="font-size:10px;text-transform:uppercase;color:#1e293b;font-weight:700;padding:8px;text-align:center;border-bottom:1px solid #e2e8f0;">${tl(lang, 'pcs')}</th>
        <th style="font-size:10px;text-transform:uppercase;color:#1e293b;font-weight:700;padding:8px;text-align:center;border-bottom:1px solid #e2e8f0;">${tl(lang, 'netWt')}</th>
        <th style="font-size:10px;text-transform:uppercase;color:#1e293b;font-weight:700;padding:8px;text-align:right;border-bottom:1px solid #e2e8f0;">${makingHeader}</th>
        <th style="font-size:10px;text-transform:uppercase;color:#1e293b;font-weight:700;padding:8px;text-align:right;border-bottom:1px solid #e2e8f0;">${tl(lang, 'discount')}</th>
        <th style="font-size:10px;text-transform:uppercase;color:#1e293b;font-weight:700;padding:8px;text-align:right;border-bottom:1px solid #e2e8f0;">${tl(lang, 'ratePerGm')}</th>
        <th style="font-size:10px;text-transform:uppercase;color:#1e293b;font-weight:700;padding:8px 10px;text-align:right;border-bottom:1px solid #e2e8f0;">${tl(lang, 'amount')}</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
</div>

<!-- Totals stay with the rows they add up; only the signature and the
     thank-you strip drop to the foot of the page — except on a short sheet,
     where the signature comes up beside the totals. See closingSection. -->
${closingSection({
  totals,
  totalsRowStyle: 'display:flex;justify-content:flex-end;padding:14px 22px 18px;margin-top:4px;',
  totalsWidth: '180px',
  signRowStyle: 'display:flex;justify-content:flex-start;padding:0 22px 18px;',
  paper: ctx.paper,
  signature: signatureBlock(shop?.signature, lang, {
    rule: '#e2e8f0',
    captionColor: '#475569',
    shopName: shop?.shopName || shop?.name || '',
    paper: ctx.paper,
  }),
  band: footerBand(lang, {
    paper: ctx.paper,
    bandStyle: 'background:#f8fafc;border-top:1px solid #e2e8f0;padding:10px 22px;',
    thankYouStyle: 'font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#475569;',
    noteStyle: 'font-size:10.5px;color:#475569;',
  }),
})}
</div>

</body>
</html>`;
};

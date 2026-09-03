import { JewelleryFormValues, PrintContext } from '../../types';
import { MobileLang, fc, fw, pn, tl, imgTag, signatureBlock, itemPhotoStrip, footerBand, closingSection, buildPageCss, footerPinCss, buildTotalsBlock, NUM_FONT } from './shared';
import { getSharedMakingBasis, formatDiscountDetail } from '../../utils/formatter';
import { getItemComponents } from '../../utils/calculations';

export const buildMinimalHTML = (
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
        <td style="padding:9px 0;border-bottom:1px solid #e5e7eb;vertical-align:middle;">
          <div style="font-size:12px;font-weight:500;color:#111;">${item.itemName}</div>
          <div style="font-size:10.5px;color:#333;margin-top:1px;">${item.metalType} · ${item.purity}</div>
          ${itemPhotoStrip(item as any, values.includeItemPhotosOnBill, ctx.paper)}
        </td>
        <td style="padding:9px 8px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:12px;font-weight:700;color:#222;${NUM_FONT}">${item.pcs}</td>
        <td style="padding:9px 8px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:12px;font-weight:700;color:#222;${NUM_FONT}">${fw(item.netWt)}</td>
        <td style="padding:9px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:12px;font-weight:700;color:#222;${NUM_FONT}">${making > 0 ? fc(making) : '—'}</td>
        <td style="padding:9px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:12px;font-weight:700;color:#222;${NUM_FONT}">${disc || '—'}</td>
        <td style="padding:9px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:12px;font-weight:700;color:#222;${NUM_FONT}">${fc(item.ratePerGm)}</td>
        <td style="padding:9px 0;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13.5px;font-weight:700;color:#000;${NUM_FONT}">${fc(item.itemTotal)}</td>
      </tr>`;
  }).join('');

  const totals = buildTotalsBlock(
    values, itemsTotal, lang,
    `display:flex;justify-content:space-between;font-size:12px;font-weight:600;color:#222;margin-bottom:5px;gap:16px;${NUM_FONT}`,
    `display:flex;justify-content:space-between;font-size:15.5px;font-weight:700;color:#000;border-top:2px solid #000;padding-top:8px;margin-top:7px;gap:16px;${NUM_FONT}`,
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
body { margin: 0; padding: 28px 26px; font-family: Georgia, serif; color: #111; background: #fff; font-size: 12px; }
table { width: 100%; border-collapse: collapse; }
</style>
</head>
<body>

<div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:14px;border-bottom:2px solid #111;">
  <div style="display:flex;align-items:center;gap:10px;">
    ${hasLogo ? imgTag(shop?.logo, 'width:44px;height:44px;border-radius:4px;object-fit:contain;') : ''}
    <div>
      <div style="font-size:22px;font-weight:700;color:#111;">${shop?.shopName || shop?.name || 'Jewellery Shop'}</div>
      ${shop?.shopDesc ? `<div style="font-size:10px;color:#444;font-style:italic;margin-top:1px;">${shop.shopDesc}</div>` : ''}
      <div style="margin-top:5px;font-size:10px;color:#555;line-height:1.5;">
        ${shopAddress || ''}
        ${shop?.phone ? `<br>${shop.phone}${shop?.email ? ` · ${shop.email}` : ''}` : ''}
        ${hasGstNo ? `<br>GSTIN: ${shop?.gstNo || shop?.gstNumber}` : ''}
      </div>
    </div>
  </div>
  <div style="text-align:right;">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#333;margin-bottom:3px;">${tl(lang, 'invoice')}</div>
    <div style="font-size:18px;font-weight:700;color:#000;${NUM_FONT}">${ctx.billNo}</div>
    <div style="font-size:11px;color:#222;margin-top:1px;${NUM_FONT}">${ctx.billDate}</div>
  </div>
</div>

<div style="display:flex;justify-content:space-between;margin:14px 0;gap:16px;">
  <div>
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#333;margin-bottom:4px;">${tl(lang, 'billTo')}</div>
    <div style="font-size:13px;font-weight:600;color:#111;">${values.customerName}</div>
    ${hasPhone ? `<div style="font-size:11px;color:#333;">${values.phone}</div>` : ''}
    ${hasAddress ? `<div style="font-size:11px;color:#333;">${values.address}</div>` : ''}
  </div>
</div>

<div style="border-top:1px solid #111;padding-top:8px;">
  <table>
    <thead>
      <tr>
        <th style="font-size:11.5px;text-transform:uppercase;letter-spacing:0.4px;color:#000;font-weight:700;padding:0 0 7px;text-align:left;border-bottom:1px solid #e5e7eb;">${tl(lang, 'items')}</th>
        <th style="font-size:11.5px;text-transform:uppercase;letter-spacing:0.4px;color:#000;font-weight:700;padding:0 8px 7px;text-align:center;border-bottom:1px solid #e5e7eb;">${tl(lang, 'pcs')}</th>
        <th style="font-size:11.5px;text-transform:uppercase;letter-spacing:0.4px;color:#000;font-weight:700;padding:0 8px 7px;text-align:center;border-bottom:1px solid #e5e7eb;">${tl(lang, 'netWt')}</th>
        <th style="font-size:11.5px;text-transform:uppercase;letter-spacing:0.4px;color:#000;font-weight:700;padding:0 8px 7px;text-align:right;border-bottom:1px solid #e5e7eb;">${makingHeader}</th>
        <th style="font-size:11.5px;text-transform:uppercase;letter-spacing:0.4px;color:#000;font-weight:700;padding:0 8px 7px;text-align:right;border-bottom:1px solid #e5e7eb;">${tl(lang, 'discount')}</th>
        <th style="font-size:11.5px;text-transform:uppercase;letter-spacing:0.4px;color:#000;font-weight:700;padding:0 8px 7px;text-align:right;border-bottom:1px solid #e5e7eb;">${tl(lang, 'ratePerGm')}</th>
        <th style="font-size:11.5px;text-transform:uppercase;letter-spacing:0.4px;color:#000;font-weight:700;padding:0 0 7px;text-align:right;border-bottom:1px solid #e5e7eb;">${tl(lang, 'amount')}</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
</div>

<!-- Totals stay with the items they add up. Only the signature and the
     thank-you line move to the foot of the page — pulling the totals down
     there too would leave a short bill with its figures stranded half a page
     below the rows that produced them. -->
${closingSection({
  totals,
  totalsRowStyle: 'display:flex;justify-content:flex-end;padding-top:16px;',
  totalsWidth: '180px',
  signRowStyle: 'display:flex;justify-content:flex-start;padding-top:16px;',
  paper: ctx.paper,
  signature: signatureBlock(shop?.signature, lang, {
    rule: '#e5e7eb',
    captionColor: '#333',
    shopName: shop?.shopName || shop?.name || '',
    paper: ctx.paper,
  }),
  band: footerBand(lang, {
    paper: ctx.paper,
    bandStyle: 'border-top:1px solid #e5e7eb;padding-top:10px;margin-top:14px;',
    thankYouStyle: 'font-size:10px;font-style:italic;color:#333;',
    noteStyle: 'font-size:10.5px;color:#555;',
  }),
})}

</body>
</html>`;
};

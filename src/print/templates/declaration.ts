import type { PurchaseOldGold, DeclarationPrintContext } from '../../types';
import { MobileLang, fc, td, fill, esc, imgTag, PAGE_CSS } from './shared';

/**
 * A4 declaration / affidavit for old gold taken in from a customer.
 *
 * Layout follows the paper form Indian jewellers already use — shop letterhead,
 * serial number and date, the numbered ownership clauses, the customer's
 * identification block, an ornament table, then witness and signature lines.
 * The Marathi strings in localization/mr.ts are the source text; every other
 * language is a translation of it.
 *
 * Deliberately A4-only. An 80mm thermal receipt cannot carry signature blocks,
 * so printService routes this straight to the PDF/HTML path and never to
 * thermal.
 */

const LINE = 'border-bottom:1px dotted #555;display:inline-block;min-width:60px;';

/** A labelled fill-in line. Renders the value, or a blank rule when empty. */
const field = (label: string, value?: string, minWidth = '260px') => `
  <div style="margin-bottom:9px;font-size:11px;color:#111;display:flex;align-items:flex-end;gap:6px;">
    <span style="white-space:nowrap;">${esc(label)} :</span>
    <span style="${LINE}flex:1;min-width:${minWidth};padding:0 4px 1px;font-weight:600;">${esc(value) || '&nbsp;'}</span>
  </div>`;

/**
 * Bank account numbers are shown as the last 4 digits only. The full number is
 * kept on the record, but this document gets shared over WhatsApp — printing it
 * in full would put the customer's account number into every forward.
 */
const maskAccount = (value?: string): string => {
  const digits = (value || '').replace(/\s/g, '');
  if (!digits) return '';
  if (digits.length <= 4) return digits;
  return `${'X'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
};

const formatDate = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())} / ${pad(d.getMonth() + 1)} / ${d.getFullYear()}`;
};

/** Rows in the ornament table on a blank form — enough for a busy counter. */
const BLANK_FORM_ROWS = 10;

export const buildDeclarationHTML = (
  declaration: PurchaseOldGold,
  ctx: DeclarationPrintContext,
  lang: MobileLang = 'en',
  /** Photos pre-inlined as data URIs by prepareDeclarationPhotosForPrint. */
  inlinePhotos: string[] = [],
): string => {
  const shop = ctx.shopDetails;
  const t = (key: string) => td(lang, key);

  // Blank mode: an empty form to print, hand-fill, or pass to a shopkeeper who
  // does not use the app. Everything computed is suppressed — a printed
  // "₹ 0.00" total on a form nobody has filled in reads as an error.
  const isBlank = ctx.blank === true;

  const addressParts = [shop?.address, shop?.city, shop?.state].filter(Boolean);
  const shopAddress = addressParts.join(', ');

  // The clause reads "...myself / my family member (Name: ____)". When the
  // seller owns the goods there is no third party to name, so the blank is
  // ruled out rather than left invitingly empty. A blank form leaves the rule
  // open for whoever fills it in by hand.
  const ownerName = isBlank
    ? '_______________________________'
    : declaration.ownerIsSelf
      ? '—'
      : declaration.familyMemberName || '';

  /**
   * Every ID the seller produced.
   *
   * Falls back to the legacy singular fields when `idProofs` is absent, which
   * is the case for every declaration signed before multi-ID existed — those
   * are legal documents and must keep reprinting exactly as issued.
   */
  const idProofEntries: Array<{ type: string; number: string; otherLabel?: string }> = isBlank
    ? []
    : declaration.idProofs?.length
      ? declaration.idProofs
      : [
          {
            type: declaration.idProofType,
            number: declaration.idProofNumber,
            otherLabel: declaration.idProofOtherLabel,
          },
        ];

  const idProofRows = idProofEntries
    .map(entry => {
      const label =
        entry.type === 'other'
          ? entry.otherLabel || t('idProof.types.other')
          : t(`idProof.types.${entry.type}`);
      return `${field(t('doc.idProofType'), label)}${field(
        t('doc.idProofNumber'),
        entry.number,
      )}`;
    })
    .join('');

  /**
   * Only the row the answer applies to.
   *
   * `hasPurchaseReceipt` is absent on older records, where neither answer was
   * captured — those print whichever field actually holds text, which is what
   * they did before. A blank form keeps both rules to fill in by hand.
   */
  const receiptRows = isBlank
    ? `${field(t('doc.receiptDetails'), '')}${field(t('doc.noReceiptReason'), '')}`
    : declaration.hasPurchaseReceipt === true
      ? field(t('doc.receiptDetails'), declaration.purchaseReceiptDetails)
      : declaration.hasPurchaseReceipt === false
        ? field(t('doc.noReceiptReason'), declaration.noReceiptReason)
        : `${field(t('doc.receiptDetails'), declaration.purchaseReceiptDetails)}${field(
            t('doc.noReceiptReason'),
            declaration.noReceiptReason,
          )}`;

  // A blank form has to cover both cases, and outright sale is the common one.
  const clause2Key =
    !isBlank && declaration.mode === 'exchange'
      ? 'doc.clause2Exchange'
      : 'doc.clause2';

  const clauses = [
    fill(t('doc.clause1'), { ownerName: esc(ownerName) }),
    t(clause2Key),
    t('doc.clause3'),
  ]
    .map(
      (text, i) => `
      <div style="display:flex;gap:6px;margin-bottom:8px;font-size:10.5px;line-height:1.65;color:#111;text-align:justify;">
        <span style="flex-shrink:0;font-weight:700;">${i + 1})</span>
        <span>${text}</span>
      </div>`,
    )
    .join('');

  /**
   * The ornament rows, always an array.
   *
   * `declaration.items` is required by the type and by the backend schema, so
   * every record written by this app has one — but a print is the last place
   * that should be discovered to be wrong. Reading `.some` straight off the
   * field threw `Cannot read properties of undefined` for anything that ever
   * arrived without it, and the caller turns any throw into "Could not print
   * the declaration", which names neither the record nor the reason.
   *
   * An empty table prints instead: the shopkeeper gets a page with the
   * customer, the clauses and blank ornament rules, which is a document they
   * can still act on, rather than an error they cannot.
   */
  const items = Array.isArray(declaration.items) ? declaration.items : [];

  // A blank form always shows the amount column — whoever fills it in by hand
  // needs somewhere to write the value.
  const showAmountColumn =
    isBlank || items.some(i => i.amount != null && i.amount > 0);

  const itemRows = (isBlank ? [] : items)
    .map(
      (item, idx) => `
      <tr>
        <td style="border:1px solid #333;padding:7px 6px;text-align:center;font-size:11px;">${idx + 1}</td>
        <td style="border:1px solid #333;padding:7px 8px;font-size:11px;">
          ${esc(item.description)}
          ${item.metalType || item.purity
            ? `<span style="color:#666;font-size:9px;"> (${esc([item.metalType, item.purity].filter(Boolean).join(' · '))})</span>`
            : ''}
        </td>
        <td style="border:1px solid #333;padding:7px 8px;text-align:right;font-size:11px;">${Number(item.grams || 0).toFixed(3)}</td>
        ${showAmountColumn
          ? `<td style="border:1px solid #333;padding:7px 8px;text-align:right;font-size:11px;">${item.amount ? fc(item.amount) : '—'}</td>`
          : ''}
      </tr>`,
    )
    .join('');

  // Only a blank form gets empty rows, and only because empty rows are the
  // entire point of one — it exists to be filled in by hand.
  //
  // A filled declaration used to be padded to four rows, on the theory that a
  // short list still reads as a form. It does not: this document is a record of
  // what was actually taken in, and ruled lines under the last ornament read as
  // room for more to be added after signing. A one-ornament declaration prints
  // one row.
  const blankRowCount = isBlank ? BLANK_FORM_ROWS : 0;
  const blankRows = Array.from({ length: blankRowCount })
    .map(
      () => `
      <tr>
        <td style="border:1px solid #333;padding:7px 6px;height:18px;">&nbsp;</td>
        <td style="border:1px solid #333;padding:7px 8px;">&nbsp;</td>
        <td style="border:1px solid #333;padding:7px 8px;">&nbsp;</td>
        ${showAmountColumn ? '<td style="border:1px solid #333;padding:7px 8px;">&nbsp;</td>' : ''}
      </tr>`,
    )
    .join('');

  const payout = declaration.payout || { method: 'none' as const };
  const payoutRows: string[] = [];
  if (isBlank) {
    // Rules to write on rather than values to read.
    payoutRows.push(
      `<span><b>${esc(t('doc.payoutMethod'))}:</b> <span style="${LINE}min-width:150px;">&nbsp;</span></span>`,
      `<span><b>${esc(t('doc.payoutReference'))}:</b> <span style="${LINE}min-width:150px;">&nbsp;</span></span>`,
    );
  } else if (payout.method !== 'none') {
    const methodLabel =
      payout.method === 'online'
        ? `${t('payout.online')}${payout.onlineType ? ` · ${t(`payout.${payout.onlineType}`)}` : ''}`
        : t('payout.cash');
    payoutRows.push(`<span><b>${esc(t('doc.payoutMethod'))}:</b> ${esc(methodLabel)}</span>`);
    if (payout.reference) {
      payoutRows.push(`<span><b>${esc(t('doc.payoutReference'))}:</b> ${esc(payout.reference)}</span>`);
    }
    if (payout.bankName) {
      payoutRows.push(`<span><b>${esc(t('doc.payoutBank'))}:</b> ${esc(payout.bankName)}</span>`);
    }
    if (payout.bankAccountNumber) {
      payoutRows.push(`<span><b>${esc(t('doc.payoutAccount'))}:</b> ${esc(maskAccount(payout.bankAccountNumber))}</span>`);
    }
    if (payout.bankIfsc) {
      payoutRows.push(`<span><b>${esc(t('doc.payoutIfsc'))}:</b> ${esc(payout.bankIfsc)}</span>`);
    }
    if (payout.upiId) {
      payoutRows.push(`<span><b>${esc(t('doc.payoutUpi'))}:</b> ${esc(payout.upiId)}</span>`);
    }
  }

  const payoutBlock = payoutRows.length
    ? `<div style="margin-top:12px;border:1px solid #333;padding:8px 10px;">
         <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.2px;color:#555;margin-bottom:5px;font-weight:700;">${esc(t('doc.payoutHeading'))}</div>
         <div style="display:flex;flex-wrap:wrap;gap:4px 20px;font-size:10.5px;color:#111;">${payoutRows.join('')}</div>
       </div>`
    : '';

  const photosBlock = inlinePhotos.length
    ? `<div style="margin-top:12px;">
         <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.2px;color:#555;margin-bottom:6px;font-weight:700;">${esc(t('doc.photosHeading'))}</div>
         <div style="display:flex;flex-wrap:wrap;gap:8px;">
           ${inlinePhotos
             .map(src => `<img src="${src}" style="width:104px;height:104px;object-fit:cover;border:1px solid #333;" />`)
             .join('')}
         </div>
       </div>`
    : '';

  const witnessLine = (index: number) => {
    const w = declaration.witnesses?.[index];
    return `
      <div style="display:flex;align-items:flex-end;gap:6px;font-size:11px;">
        <span>${index + 1})</span>
        <span style="${LINE}min-width:190px;padding:0 4px 1px;">${esc(w?.name) || '&nbsp;'}</span>
      </div>`;
  };

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
${PAGE_CSS}
* { box-sizing: border-box; }
body { margin: 0; padding: 26px 30px; font-family: Georgia, serif; color: #111; background: #fff; font-size: 12px; }
table { width: 100%; border-collapse: collapse; }
</style>
</head>
<body>

<!-- Shop letterhead. Omitted entirely when the form is for another shop to use,
     since printing this shop's name on it would be actively wrong. -->
${shop
  ? `<div style="text-align:center;padding-bottom:8px;">
  ${shop?.logo ? imgTag(shop.logo, 'width:48px;height:48px;object-fit:contain;margin-bottom:4px;') : ''}
  <div style="font-size:23px;font-weight:700;letter-spacing:0.5px;">${esc(shop?.shopName || shop?.name || '')}</div>
  ${shopAddress ? `<div style="font-size:10px;color:#333;margin-top:3px;">${esc(shopAddress)}</div>` : ''}
  ${shop?.phone ? `<div style="font-size:10px;color:#333;margin-top:1px;">${esc(t('doc.mobile'))}: ${esc(shop.phone)}</div>` : ''}
</div>`
  : `<div style="padding-bottom:10px;">
  <div style="${LINE}width:70%;margin:0 auto 10px;height:26px;"></div>
  <div style="${LINE}width:55%;margin:0 auto;height:16px;"></div>
</div>`}

<!-- Number + date. Blank rules on an unfilled form — it is numbered and
     dated by hand, or serialised by the press.

     The label depends on what the number is. A standalone purchase carries its
     own serial (POG-3) and reads "Sr. No."; a declaration written against an
     exchange carries the bill's number (INV-49, ADV-83) and reads "Bill No.",
     because that is what it is — a reference to the transaction this document
     is evidence for, not a serial in a series of its own. A retailer holding
     both papers can then see at a glance that they belong together. -->
<div style="display:flex;justify-content:space-between;align-items:flex-end;font-size:11px;font-weight:600;padding:6px 0;border-top:1px solid #333;">
  <span>${esc(t(declaration.mode === 'exchange' ? 'doc.billNo' : 'doc.srNo'))}: ${isBlank
    ? `<span style="${LINE}min-width:90px;">&nbsp;</span>`
    : esc(declaration.declarationNumber)}</span>
  <span>${esc(t('doc.date'))}: ${isBlank
    ? `<span style="${LINE}min-width:130px;">&nbsp;</span>`
    : esc(formatDate(declaration.declarationDate))}</span>
</div>

<div style="text-align:center;font-size:10.5px;font-style:italic;color:#333;margin-top:6px;">${esc(t('doc.regarding'))}</div>

<div style="text-align:center;margin:8px 0 12px;">
  <span style="display:inline-block;border:2px solid #111;padding:5px 24px;font-size:16px;font-weight:700;letter-spacing:1px;">${esc(t('doc.heading'))}</span>
</div>

<div style="font-size:12px;font-weight:700;">${esc(t('doc.part1'))}</div>
<div style="font-size:10px;color:#333;margin:2px 0 9px;">${esc(t('doc.part1Note'))}</div>

${clauses}

<div style="margin-top:12px;display:flex;gap:12px;align-items:flex-start;">
  <div style="flex:1;">
    ${field(t('doc.customerName'), declaration.customerSnapshot?.name)}
    ${field(t('doc.address'), declaration.customerSnapshot?.address)}
    ${field(t('doc.mobile'), declaration.customerSnapshot?.phone)}
    ${isBlank ? field(t('doc.idProofType'), '') + field(t('doc.idProofNumber'), '') : idProofRows}
    ${receiptRows}
  </div>
  ${
    // Only when the customer had a photo on file. A blank form must stay blank,
    // and a shop that never photographs customers should see no empty box.
    //
    // Prefers the inlined data URI: a remote URL renders on screen but is
    // dropped by both PDF paths (react-native-html-to-pdf snapshots before
    // remote images load; html2canvas drops cross-origin images), so falling
    // back to it means the photo shows in preview and vanishes when printed.
    !isBlank && (ctx.customerPhoto || declaration.customerSnapshot?.photoUrl)
      ? `<div style="flex:0 0 auto;border:1px solid #999;padding:2px;">
           ${imgTag(
             ctx.customerPhoto || declaration.customerSnapshot?.photoUrl,
             'width:72px;height:88px;object-fit:cover;display:block;',
           )}
         </div>`
      : ''
  }
</div>

<div style="text-align:center;font-size:12px;font-weight:700;margin:14px 0 7px;">${esc(t('doc.itemsHeading'))}</div>

<table>
  <thead>
    <tr>
      <th style="border:1px solid #333;padding:6px;font-size:10px;width:46px;">${esc(t('doc.colSr'))}</th>
      <th style="border:1px solid #333;padding:6px;font-size:10px;text-align:left;">${esc(t('doc.colDescription'))}</th>
      <th style="border:1px solid #333;padding:6px;font-size:10px;width:82px;">${esc(t('doc.colGrams'))}</th>
      ${showAmountColumn ? `<th style="border:1px solid #333;padding:6px;font-size:10px;width:104px;">${esc(t('doc.colAmount'))}</th>` : ''}
    </tr>
  </thead>
  <tbody>
    ${itemRows}
    ${blankRows}
    <tr>
      <td colspan="2" style="border:1px solid #333;padding:7px 8px;text-align:right;font-size:11px;font-weight:700;">${esc(t('doc.total'))}</td>
      <td style="border:1px solid #333;padding:7px 8px;text-align:right;font-size:11px;font-weight:700;">${
        isBlank ? '&nbsp;' : Number(declaration.totalGrams || 0).toFixed(3)
      }</td>
      ${showAmountColumn
        ? `<td style="border:1px solid #333;padding:7px 8px;text-align:right;font-size:11px;font-weight:700;">${
            isBlank ? '&nbsp;' : fc(declaration.totalAmount)
          }</td>`
        : ''}
    </tr>
  </tbody>
</table>

${payoutBlock}
${photosBlock}

<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:26px;gap:24px;">
  <div>
    <div style="font-size:11px;font-weight:700;margin-bottom:8px;">${esc(t('doc.witnesses'))} :</div>
    ${witnessLine(0)}
    <div style="height:8px;"></div>
    ${witnessLine(1)}
  </div>
  <div style="text-align:center;min-width:180px;">
    <div style="border-bottom:1px solid #333;height:44px;position:relative;">
      ${declaration.customerSignature
        ? // Sits on the ruled line rather than replacing it, so a signed
          // declaration reads the same as a hand-signed one. The SVG is cropped
          // to the ink when captured, so object-fit:contain scales the whole
          // signature into this box instead of showing a speck of a full-screen
          // canvas.
          imgTag(
            declaration.customerSignature,
            'position:absolute;bottom:2px;left:0;right:0;margin:0 auto;max-width:100%;height:40px;object-fit:contain;',
          )
        : ''}
    </div>
    <div style="font-size:10.5px;margin-top:4px;">${esc(t('doc.customerSignature'))}</div>
  </div>
</div>

</body>
</html>`;
};

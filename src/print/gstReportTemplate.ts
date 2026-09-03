import { toDisplayDate } from '../utils/gstPeriods';

/**
 * A4 HTML for the GST report PDF (net summary → Part A outward → Part B
 * inward). Rendered through the same html→pdf pipeline as invoices
 * (pdfService on native, printService/window.print on RN Web).
 */

const esc = (v: unknown): string =>
    String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

const money = (n: unknown): string =>
    `&#8377; ${(Number(n) || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

const PAGE_CSS = `@page { size: A4; margin: 10mm; }
* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
body { font-family: Arial, 'Segoe UI', sans-serif; color: #111827; font-size: 11px; margin: 0; }
h1 { font-size: 18px; margin: 0; }
h2 { font-size: 13px; margin: 18px 0 6px; color: #1F2937; border-bottom: 2px solid #6D5EF7; padding-bottom: 3px; }
table { width: 100%; border-collapse: collapse; margin-top: 4px; }
th { background: #F3F4F6; text-align: left; padding: 5px 6px; font-size: 10px; border: 1px solid #E5E7EB; }
td { padding: 4px 6px; border: 1px solid #E5E7EB; font-size: 10px; }
td.num, th.num { text-align: right; }
tr.totals td { font-weight: bold; background: #F9FAFB; }
tr.muted td { color: #9CA3AF; }
.meta { color: #6B7280; font-size: 11px; margin-top: 3px; }
.net-box { display: flex; gap: 10px; margin-top: 10px; }
.net-card { flex: 1; border: 1px solid #E5E7EB; border-radius: 8px; padding: 10px; }
.net-card .label { color: #6B7280; font-size: 10px; }
.net-card .value { font-size: 15px; font-weight: bold; margin-top: 3px; }
.net-card.highlight { background: #EEF2FF; border-color: #6D5EF7; }
.footnote { color: #6B7280; font-size: 9px; margin-top: 14px; line-height: 1.5; }
`;

export function buildGstReportHTML(report: any): string {
    const { shop, period, outward, inward, net } = report;
    const os = outward?.summary || {};
    const is = inward?.summary || {};
    const itc = is.eligibleItc || {};

    const hasLegacy = (outward?.rows || []).some((r: any) => r.legacyDerived);
    const hasUnregistered = (is.unregisteredCount || 0) > 0;

    const outwardRowsHtml = (outward?.rows || [])
        .map(
            (r: any) => `<tr>
<td>${esc(r.invoiceNumber)}${r.legacyDerived ? ' *' : ''}</td>
<td>${esc(toDisplayDate(r.invoiceDate))}</td>
<td>${esc(r.customerName)}</td>
<td>${esc(r.customerGstin)}</td>
<td>${esc(r.billType)}</td>
<td>${esc(r.hsnCodes)}</td>
<td class="num">${money(r.taxableValue)}</td>
<td class="num">${esc(r.gstRate ?? '')}</td>
<td class="num">${money(r.cgst)}</td>
<td class="num">${money(r.sgst)}</td>
<td class="num">${money(r.igst)}</td>
<td class="num">${money(r.invoiceTotal)}</td>
</tr>`,
        )
        .join('');

    const hsnRowsHtml = (outward?.hsnSummary || [])
        .map(
            (h: any) => `<tr>
<td>${esc(h.hsnCode)}</td>
<td class="num">${esc(h.billCount)}</td>
<td class="num">${money(h.taxableValue)}</td>
<td class="num">${money(h.cgst)}</td>
<td class="num">${money(h.sgst)}</td>
<td class="num">${money(h.igst)}</td>
</tr>`,
        )
        .join('');

    const inwardRowsHtml = (inward?.rows || [])
        .map(
            (r: any) => `<tr${r.registered ? '' : ' class="muted"'}>
<td>${esc(r.purchaseInvoiceNumber)}</td>
<td>${esc(toDisplayDate(r.purchaseDate))}</td>
<td>${esc(r.supplierName)}</td>
<td>${esc(r.supplierGstin)}</td>
<td>${r.registered ? 'Yes' : 'No'}</td>
<td class="num">${money(r.taxableValue)}</td>
<td class="num">${money(r.cgst)}</td>
<td class="num">${money(r.sgst)}</td>
<td class="num">${money(r.igst)}</td>
<td class="num">${money(r.total)}</td>
</tr>`,
        )
        .join('');

    const netRow = (label: string, key: string, highlight = false) => `<tr${highlight ? ' class="totals"' : ''}>
<td>${label}</td>
<td class="num">${money(net?.outputTax?.[key])}</td>
<td class="num">${money(net?.itc?.[key])}</td>
<td class="num">${money(net?.netPayable?.[key])}</td>
</tr>`;

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>${PAGE_CSS}</style>
</head>
<body>
<h1>GST Report</h1>
<div class="meta">
${esc(shop?.name || '')}${shop?.gstin ? ` &bull; GSTIN: ${esc(shop.gstin)}` : ''}<br/>
Period: ${esc(toDisplayDate(period?.startDate))} &ndash; ${esc(toDisplayDate(period?.endDate))}
</div>

<div class="net-box">
  <div class="net-card">
    <div class="label">Output Tax (Sales)</div>
    <div class="value">${money(net?.outputTax?.total)}</div>
  </div>
  <div class="net-card">
    <div class="label">Input Tax Credit (Purchases)</div>
    <div class="value">${money(net?.itc?.total)}</div>
  </div>
  <div class="net-card highlight">
    <div class="label">Net Payable</div>
    <div class="value">${money(net?.netPayable?.total)}</div>
  </div>
</div>

<h2>Part A &mdash; Outward Supplies (Sales)</h2>
<div class="meta">
${esc(os.billCount || 0)} bill(s) &bull; B2B: ${esc(os.b2bCount || 0)} &bull; B2C: ${esc(os.b2cCount || 0)}
</div>
<table>
<tr>
<th>Invoice No</th><th>Date</th><th>Retailer</th><th>GSTIN</th><th>Type</th><th>HSN</th>
<th class="num">Taxable</th><th class="num">Rate %</th><th class="num">CGST</th><th class="num">SGST</th><th class="num">IGST</th><th class="num">Total</th>
</tr>
${outwardRowsHtml}
<tr class="totals">
<td colspan="6">TOTALS</td>
<td class="num">${money(os.taxableValue)}</td>
<td></td>
<td class="num">${money(os.cgst)}</td>
<td class="num">${money(os.sgst)}</td>
<td class="num">${money(os.igst)}</td>
<td class="num">${money(os.invoiceTotal)}</td>
</tr>
</table>

<h2>HSN Summary</h2>
<table>
<tr><th>HSN</th><th class="num">Bills</th><th class="num">Taxable</th><th class="num">CGST</th><th class="num">SGST</th><th class="num">IGST</th></tr>
${hsnRowsHtml}
</table>

<h2>Part B &mdash; Inward Supplies (Purchases / ITC)</h2>
<div class="meta">
${esc(is.purchaseCount || 0)} purchase(s) &bull; Registered: ${esc(is.registeredCount || 0)} &bull; Unregistered: ${esc(is.unregisteredCount || 0)}
</div>
<table>
<tr>
<th>Purchase Inv No</th><th>Date</th><th>Supplier</th><th>GSTIN</th><th>Reg.</th>
<th class="num">Taxable</th><th class="num">CGST</th><th class="num">SGST</th><th class="num">IGST</th><th class="num">Total</th>
</tr>
${inwardRowsHtml}
<tr class="totals">
<td colspan="5">TOTALS</td>
<td class="num">${money(is.taxableValue)}</td>
<td class="num">${money(is.cgst)}</td>
<td class="num">${money(is.sgst)}</td>
<td class="num">${money(is.igst)}</td>
<td></td>
</tr>
<tr class="totals">
<td colspan="5">ELIGIBLE ITC (REGISTERED ONLY)</td>
<td></td>
<td class="num">${money(itc.cgst)}</td>
<td class="num">${money(itc.sgst)}</td>
<td class="num">${money(itc.igst)}</td>
<td class="num">${money(itc.total)}</td>
</tr>
</table>

<h2>Net Summary</h2>
<table>
<tr><th>Head</th><th class="num">Output Tax</th><th class="num">Input Tax Credit</th><th class="num">Net Payable</th></tr>
${netRow('CGST', 'cgst')}
${netRow('SGST', 'sgst')}
${netRow('IGST', 'igst')}
${netRow('TOTAL', 'total', true)}
</table>

<div class="footnote">
${hasLegacy ? '* GST split derived from the invoice total (invoice created before CGST/SGST breakdown was recorded).<br/>' : ''}
${hasUnregistered ? 'Greyed purchase rows have no supplier GSTIN — ITC eligibility to be confirmed by your CA.<br/>' : ''}
Net payable is plain per-head arithmetic shown before GSTR-3B set-off ordering; final set-off is computed at filing.
</div>
</body>
</html>`;
}

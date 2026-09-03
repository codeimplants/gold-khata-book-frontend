import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { toDisplayDate } from './gstPeriods';

/**
 * Multi-section GST report CSV for the CA.
 * Rules: RFC quoting; CSV-injection guard (leading = + - @ get a ' prefix);
 * plain 2-decimal numbers, no currency symbol; UTF-8 BOM so Excel renders
 * Devanagari/Gujarati names. Column contract mirrored in gold-khata-book-web.
 */

const escapeCsvField = (value: unknown): string => {
    let str = String(value ?? '');
    // Guard against CSV/formula injection in user-entered text
    if (/^[=+\-@]/.test(str)) str = `'${str}`;
    if (/[",\n\r]/.test(str)) str = `"${str.replace(/"/g, '""')}"`;
    return str;
};

const row = (cells: unknown[]): string => cells.map(escapeCsvField).join(',');

const num = (n: unknown): string => (Number(n) || 0).toFixed(2);

export function buildGstReportCsv(report: any): string {
    const lines: string[] = [];
    const { shop, period, outward, inward, net } = report;

    lines.push(row(['GST REPORT']));
    lines.push(row(['Shop', shop?.name || '']));
    lines.push(row(['GSTIN', shop?.gstin || '']));
    lines.push(
        row([
            'Period',
            `${toDisplayDate(period?.startDate)} - ${toDisplayDate(period?.endDate)}`,
        ]),
    );
    lines.push('');

    // ── Part A: outward supplies (sales) ──
    lines.push(row(['PART A - OUTWARD SUPPLIES (SALES)']));
    lines.push(
        row([
            'Invoice No',
            'Date',
            'Retailer Name',
            'Retailer GSTIN',
            'Type',
            'HSN',
            'Taxable Value',
            'GST Rate %',
            'CGST',
            'SGST',
            'IGST',
            'Invoice Total',
            'Place of Supply',
        ]),
    );
    (outward?.rows || []).forEach((r: any) => {
        lines.push(
            row([
                r.invoiceNumber,
                toDisplayDate(r.invoiceDate),
                r.customerName,
                r.customerGstin,
                r.billType,
                r.hsnCodes,
                num(r.taxableValue),
                r.gstRate ?? '',
                num(r.cgst),
                num(r.sgst),
                num(r.igst),
                num(r.invoiceTotal),
                r.placeOfSupply,
            ]),
        );
    });
    const os = outward?.summary || {};
    lines.push(
        row([
            'TOTALS',
            '',
            '',
            '',
            '',
            '',
            num(os.taxableValue),
            '',
            num(os.cgst),
            num(os.sgst),
            num(os.igst),
            num(os.invoiceTotal),
            '',
        ]),
    );
    lines.push('');

    lines.push(row(['HSN SUMMARY']));
    lines.push(row(['HSN', 'Bills', 'Taxable Value', 'CGST', 'SGST', 'IGST']));
    (outward?.hsnSummary || []).forEach((h: any) => {
        lines.push(
            row([
                h.hsnCode,
                h.billCount,
                num(h.taxableValue),
                num(h.cgst),
                num(h.sgst),
                num(h.igst),
            ]),
        );
    });
    lines.push('');

    // ── Part B: inward supplies (purchases / ITC) ──
    lines.push(row(['PART B - INWARD SUPPLIES (PURCHASES / ITC)']));
    lines.push(
        row([
            'Purchase Inv No',
            'Date',
            'Supplier Name',
            'Supplier GSTIN',
            'Registered',
            'HSN',
            'Taxable Value',
            'GST Rate %',
            'CGST',
            'SGST',
            'IGST',
            'Total',
        ]),
    );
    (inward?.rows || []).forEach((r: any) => {
        lines.push(
            row([
                r.purchaseInvoiceNumber,
                toDisplayDate(r.purchaseDate),
                r.supplierName,
                r.supplierGstin,
                r.registered ? 'Yes' : 'No',
                r.hsnCode,
                num(r.taxableValue),
                r.gstRate ?? '',
                num(r.cgst),
                num(r.sgst),
                num(r.igst),
                num(r.total),
            ]),
        );
    });
    const is = inward?.summary || {};
    lines.push(
        row([
            'TOTALS',
            '',
            '',
            '',
            '',
            '',
            num(is.taxableValue),
            '',
            num(is.cgst),
            num(is.sgst),
            num(is.igst),
            '',
        ]),
    );
    const itc = is.eligibleItc || {};
    lines.push(
        row([
            'ELIGIBLE ITC (REGISTERED ONLY)',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            num(itc.cgst),
            num(itc.sgst),
            num(itc.igst),
            num(itc.total),
        ]),
    );
    lines.push('');

    // ── Net summary ──
    lines.push(row(['NET SUMMARY']));
    lines.push(row(['Head', 'Output Tax', 'Input Tax Credit', 'Net Payable']));
    const heads: Array<['CGST' | 'SGST' | 'IGST' | 'TOTAL', string]> = [
        ['CGST', 'cgst'],
        ['SGST', 'sgst'],
        ['IGST', 'igst'],
        ['TOTAL', 'total'],
    ];
    heads.forEach(([label, key]) => {
        lines.push(
            row([
                label,
                num(net?.outputTax?.[key]),
                num(net?.itc?.[key]),
                num(net?.netPayable?.[key]),
            ]),
        );
    });
    lines.push('');
    lines.push(
        row([
            'Note',
            'Net payable shown before GSTR-3B set-off ordering. ITC eligibility of unregistered purchases to be confirmed by your CA.',
        ]),
    );

    return lines.join('\r\n');
}

/** UTF-8 BOM so Excel detects encoding and renders Indic scripts correctly. */
const BOM = '\uFEFF';

export async function shareGstReportCsv(csv: string, fileName: string): Promise<void> {
    if (Platform.OS === 'web') {
        // RNFS / react-native-share are native-only (same fork as printService)
        const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${fileName}.csv`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
        return;
    }

    const path = `${RNFS.CachesDirectoryPath}/${fileName}.csv`;
    await RNFS.writeFile(path, BOM + csv, 'utf8');
    await Share.open({
        url: `file://${path}`,
        type: 'text/csv',
        filename: `${fileName}.csv`,
        failOnCancel: false,
    });
}

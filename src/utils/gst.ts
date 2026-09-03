/**
 * Client-side mirror of the backend's GST derivation (invoice.gst.ts).
 * Used for guest-mode invoices/purchases and for legacy local records that
 * predate the GST extension. Keep the logic in sync with the backend —
 * the API contract (not shared code) is the parity anchor.
 */

export const GSTIN_REGEX = /^[0-9]{2}[A-Z0-9]{13}$/;

export const DEFAULT_HSN_CODE = '7113'; // Gold/silver jewellery

export type SupplyType = 'intra' | 'inter';

export interface GstSplit {
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    supplyType: SupplyType;
    placeOfSupply?: string;
}

const round2 = (n: number) => Number((Number(n) || 0).toFixed(2));
const round3 = (n: number) => Number((Number(n) || 0).toFixed(3));

export function gstinStateCode(gstin?: string | null): string | undefined {
    if (!gstin) return undefined;
    const normalized = gstin.trim().toUpperCase();
    if (!GSTIN_REGEX.test(normalized)) return undefined;
    return normalized.slice(0, 2);
}

/** First 2 GSTIN chars = state code; missing counterparty GSTIN => intra. */
export function computeSupplyType(
    shopGstin?: string | null,
    otherGstin?: string | null,
): SupplyType {
    const shopState = gstinStateCode(shopGstin);
    const otherState = gstinStateCode(otherGstin);
    if (!shopState || !otherState) return 'intra';
    return shopState === otherState ? 'intra' : 'inter';
}

/** Intra: CGST = SGST = half. Inter: all IGST. */
export function splitGstAmount(
    gstAmount: number,
    shopGstin?: string | null,
    otherGstin?: string | null,
): GstSplit {
    const supplyType = computeSupplyType(shopGstin, otherGstin);
    const total = round3(gstAmount);
    const placeOfSupply = gstinStateCode(otherGstin) ?? gstinStateCode(shopGstin);

    if (supplyType === 'inter') {
        return { cgstAmount: 0, sgstAmount: 0, igstAmount: total, supplyType, placeOfSupply };
    }

    const half = round3(total / 2);
    return {
        cgstAmount: half,
        sgstAmount: round3(total - half),
        igstAmount: 0,
        supplyType,
        placeOfSupply,
    };
}

// ─── Guest-mode GST report (same shape as GET /api/sales/gst-report) ─────────

const isGstBill = (o: any) => o.includeGST !== false && (o.gstAmount ?? 0) > 0;

const sumBy = (rows: any[], key: string) =>
    round2(rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0));

export function buildOutwardSection(
    orders: any[],
    startDate: Date,
    endDate: Date,
    shopGstin?: string,
    shopGstRate?: number,
    customersById?: Record<string, { name?: string }>,
) {
    const inRange = (o: any) => {
        const d = new Date(o.date).getTime();
        return d >= startDate.getTime() && d <= endDate.getTime();
    };

    const rows = orders
        .filter(o => o.type === 'full' && !o.deletedAt && isGstBill(o) && inRange(o))
        .map(o => {
            const hasStoredSplit =
                o.cgstAmount != null || o.sgstAmount != null || o.igstAmount != null;
            const split = hasStoredSplit
                ? {
                      cgstAmount: o.cgstAmount ?? 0,
                      sgstAmount: o.sgstAmount ?? 0,
                      igstAmount: o.igstAmount ?? 0,
                      supplyType: o.supplyType ?? 'intra',
                      placeOfSupply: o.placeOfSupply ?? gstinStateCode(o.shopGstin || shopGstin),
                  }
                : splitGstAmount(o.gstAmount || 0, o.shopGstin || shopGstin, o.customerGstin);
            const subTotal = Number(o.subTotal) || 0;
            const gstRate =
                o.gstRate ??
                (subTotal > 0
                    ? round2(((o.gstAmount || 0) / subTotal) * 100)
                    : shopGstRate ?? 3);
            const hsnCodes =
                Array.from(
                    new Set(
                        (o.items || [])
                            .map((it: any) => it?.hsnCode)
                            .filter((c: any) => typeof c === 'string' && c.length > 0),
                    ),
                ).join(', ') || DEFAULT_HSN_CODE;
            return {
                invoiceId: o.id,
                invoiceNumber: o.invoiceNumber || '',
                invoiceDate: o.date,
                customerName: customersById?.[o.customerId]?.name || '',
                customerGstin: o.customerGstin || '',
                billType: o.customerGstin ? 'B2B' : 'B2C',
                hsnCodes,
                taxableValue: subTotal,
                gstRate,
                cgst: split.cgstAmount,
                sgst: split.sgstAmount,
                igst: split.igstAmount,
                invoiceTotal: Number(o.amount) || 0,
                supplyType: split.supplyType,
                placeOfSupply: split.placeOfSupply || '',
                legacyDerived: !hasStoredSplit,
            };
        });

    rows.sort((a, b) => {
        const numA = parseInt(a.invoiceNumber.replace(/\D/g, ''), 10);
        const numB = parseInt(b.invoiceNumber.replace(/\D/g, ''), 10);
        if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
        return a.invoiceNumber.localeCompare(b.invoiceNumber);
    });

    const summary = {
        billCount: rows.length,
        b2bCount: rows.filter(r => r.billType === 'B2B').length,
        b2cCount: rows.filter(r => r.billType === 'B2C').length,
        taxableValue: sumBy(rows, 'taxableValue'),
        cgst: sumBy(rows, 'cgst'),
        sgst: sumBy(rows, 'sgst'),
        igst: sumBy(rows, 'igst'),
        totalTax: round2(rows.reduce((acc, r) => acc + r.cgst + r.sgst + r.igst, 0)),
        invoiceTotal: sumBy(rows, 'invoiceTotal'),
    };

    const hsnMap = new Map<string, any>();
    rows.forEach(row => {
        const entry =
            hsnMap.get(row.hsnCodes) ||
            { billCount: 0, taxableValue: 0, cgst: 0, sgst: 0, igst: 0 };
        entry.billCount += 1;
        entry.taxableValue += row.taxableValue;
        entry.cgst += row.cgst;
        entry.sgst += row.sgst;
        entry.igst += row.igst;
        hsnMap.set(row.hsnCodes, entry);
    });
    const hsnSummary = Array.from(hsnMap.entries()).map(([hsnCode, v]) => ({
        hsnCode,
        billCount: v.billCount,
        taxableValue: round2(v.taxableValue),
        cgst: round2(v.cgst),
        sgst: round2(v.sgst),
        igst: round2(v.igst),
    }));

    return { summary, hsnSummary, rows };
}

export function buildInwardSection(purchases: any[], startDate: Date, endDate: Date) {
    const rows = purchases
        .filter(p => {
            const d = new Date(p.purchaseDate).getTime();
            return d >= startDate.getTime() && d <= endDate.getTime();
        })
        .map(p => ({
            purchaseId: p.id,
            purchaseInvoiceNumber: p.purchaseInvoiceNumber,
            purchaseDate: p.purchaseDate,
            supplierName: p.supplierName,
            supplierGstin: p.supplierGstin || '',
            registered: Boolean(p.supplierGstin),
            hsnCode: p.hsnCode || '',
            taxableValue: Number(p.taxableValue) || 0,
            gstRate: p.gstRate ?? null,
            cgst: p.cgstAmount ?? 0,
            sgst: p.sgstAmount ?? 0,
            igst: p.igstAmount ?? 0,
            total: round2((Number(p.taxableValue) || 0) + (Number(p.gstAmount) || 0)),
            supplyType: p.supplyType || 'intra',
        }))
        .sort(
            (a, b) =>
                new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime(),
        );

    const registeredRows = rows.filter(r => r.registered);
    const eligibleItc = {
        cgst: sumBy(registeredRows, 'cgst'),
        sgst: sumBy(registeredRows, 'sgst'),
        igst: sumBy(registeredRows, 'igst'),
        total: round2(
            registeredRows.reduce((acc, r) => acc + r.cgst + r.sgst + r.igst, 0),
        ),
    };

    const summary = {
        purchaseCount: rows.length,
        registeredCount: registeredRows.length,
        unregisteredCount: rows.length - registeredRows.length,
        taxableValue: sumBy(rows, 'taxableValue'),
        cgst: sumBy(rows, 'cgst'),
        sgst: sumBy(rows, 'sgst'),
        igst: sumBy(rows, 'igst'),
        eligibleItc,
    };

    return { summary, rows };
}

export function buildNetSummary(outwardSummary: any, eligibleItc: any) {
    const outputTax = {
        cgst: outwardSummary.cgst,
        sgst: outwardSummary.sgst,
        igst: outwardSummary.igst,
        total: outwardSummary.totalTax,
    };
    // Per-head arithmetic floored at 0; GSTR-3B set-off ordering is the CA's job.
    const netPayable = {
        cgst: round2(Math.max(outputTax.cgst - eligibleItc.cgst, 0)),
        sgst: round2(Math.max(outputTax.sgst - eligibleItc.sgst, 0)),
        igst: round2(Math.max(outputTax.igst - eligibleItc.igst, 0)),
        total: round2(outputTax.total - eligibleItc.total),
    };
    return { outputTax, itc: eligibleItc, netPayable };
}

/** Full guest-mode report matching GET /api/sales/gst-report response.data. */
export function buildLocalGstReport(params: {
    orders: any[];
    purchases: any[];
    startDate: Date;
    endDate: Date;
    shopName?: string;
    shopGstin?: string;
    shopGstRate?: number;
    customersById?: Record<string, { name?: string }>;
}) {
    const start = new Date(params.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(params.endDate);
    end.setHours(23, 59, 59, 999);

    const outward = buildOutwardSection(
        params.orders,
        start,
        end,
        params.shopGstin,
        params.shopGstRate,
        params.customersById,
    );
    const inward = buildInwardSection(params.purchases, start, end);
    const net = buildNetSummary(outward.summary, inward.summary.eligibleItc);

    return {
        period: { startDate: start.toISOString(), endDate: end.toISOString() },
        shop: { name: params.shopName || '', gstin: params.shopGstin || '' },
        outward,
        inward,
        net,
    };
}

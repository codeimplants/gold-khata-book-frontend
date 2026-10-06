import type { Order, RetailerAccount } from '../store/data/dataSlice';

/**
 * The day book (rojmel): every entry in the khata in the order it happened.
 *
 * A wholesaler's book has these kinds of line against a retailer:
 *
 *   - a SALE: ornaments given on account. The retailer now owes their fine
 *     weight (`order.totalWeight`, grams at 99.50, computed by the server).
 *   - a RECEIPT: what the retailer paid against a sale. Metal handed over is
 *     `payment.fineWeight`, already converted to 99.50 by the server's
 *     inbound pricing. Cash is `payment.amount`.
 *   - HELD: cash or gold handed over and kept on the retailer's account
 *     instead of being set against a sale. Cash paid with the rate to be fixed
 *     later, an advance in cash or gold for purchases to come, a melt credit.
 *     It came in that day, so it counts in the day's totals.
 *   - a TRANSFER: something already held moving onto a sale (the retailer
 *     fixing the rate on held cash, or gold held used against a sale), or a
 *     sale's overpayment moving onto the account. Nothing came in: the money
 *     was counted on the day it arrived, so a transfer never adds to a total.
 *   - a PAYOUT: held cash or gold handed back to the retailer.
 *
 * This only reads fields the server already computed. It does no pricing and
 * no balance arithmetic. What a retailer OWES stays in utils/dues.ts, and a
 * day book total is "what moved", never "what is owed".
 *
 * Excluded:
 *   - orders in the trash (`deletedAt` set). The Retailers list and the
 *     retailer screen already leave them out. A trashed sale is not part of
 *     the book until restored.
 *   - cancelled sales, which never happened as far as the book is concerned.
 *   - empty payment rows (no cash and no metal), which record nothing.
 */
export type DayBookKind = 'sale' | 'receipt' | 'held' | 'transfer' | 'payout';

export interface DayBookEntry {
  /** Stable across renders: order id plus the payment's own id or index. */
  id: string;
  kind: DayBookKind;
  /** Epoch ms of when the entry happened (order date, or payment date). */
  at: number;
  /** The sale it belongs to. Absent on held cash, gold advances and payouts. */
  orderId?: string;
  /** The sale's document number, e.g. INV-12. */
  docNo?: string;
  customerId: string;
  /** Fine gold at 99.50 given to the retailer. Sales only. */
  goldOut: number;
  /** Fine gold at 99.50 in: a receipt's metal, gold held, or (for a transfer
   *  or payout) the grams that moved. */
  goldIn: number;
  /** Rupees in: a receipt's cash, cash held, or (for a transfer or payout)
   *  the rupees that moved. */
  cashIn: number;
  /** Which account a receipt's cash cleared: buying metal down, or charges. */
  settles?: 'metal' | 'cash';
  /**
   * What a held, transfer or payout line is about:
   *   cash-held     cash kept on the account, rate not fixed
   *   gold-advance  gold left on the account
   *   melt          a melt lot's credit
   *   fix-rate      held cash put on a sale at `rate`
   *   gold-used     gold held put on a sale
   *   overpaid      a sale's surplus kept as held cash
   *   cash-back / gold-back   handed back to the retailer
   */
  detail?:
    | 'cash-held' | 'gold-advance' | 'melt'
    | 'fix-rate' | 'gold-used' | 'overpaid'
    | 'cash-back' | 'gold-back';
  /** The rate held cash was converted at (fix-rate), per gram of 99.50. */
  rate?: number;
  /** Gold advance only: weight and purity as handed over. */
  grossWeight?: number;
  purity?: number;
  note?: string;
}

const toTime = (value: unknown): number => {
  if (!value) return 0;
  const t = new Date(value as any).getTime();
  return Number.isFinite(t) ? t : 0;
};

/**
 * A payment that drew on the retailer's account rather than bringing anything
 * in. The server marks these `paymentType: 'credit'`; payments made before it
 * did carry only the notes it wrote, so those are recognised by them.
 */
const LEGACY_TRANSFER_NOTES = /^(Allocated from held cash|Applied from melt credit|Applied from gold held)/;
const isTransferPayment = (p: any) =>
  p?.paymentType === 'credit' || LEGACY_TRANSFER_NOTES.test(String(p?.notes || ''));

/** An overpayment moved onto the account: linked to its sale since the server
 *  started recording it, and recognised by the note it wrote before that. */
const isOverpaymentCredit = (e: any) => !!e?.orderId || /^Overpaid on/.test(String(e?.notes || ''));

export const buildDayBook = (orders: Order[], accounts: RetailerAccount[] = []): DayBookEntry[] => {
  const entries: DayBookEntry[] = [];

  for (const order of orders as any[]) {
    if (!order || order.deletedAt || order.status === 'cancelled') continue;

    const customerId = String(order.customerId || '');
    const saleAt = toTime(order.date) || toTime(order.createdAt);
    const docNo = order.orderNumber || order.invoiceNumber;

    entries.push({
      id: `${order.id}:sale`,
      kind: 'sale',
      at: saleAt,
      orderId: order.id,
      docNo,
      customerId,
      goldOut: Number(order.totalWeight || 0),
      goldIn: 0,
      cashIn: 0,
    });

    (order.payments || []).forEach((p: any, i: number) => {
      const cashIn = Number(p?.amount || 0);
      const goldIn = Number(p?.fineWeight || 0);
      if (cashIn <= 0 && goldIn <= 0) return;
      const transfer = isTransferPayment(p);
      entries.push({
        id: `${order.id}:pay:${p?._id || p?.id || i}`,
        kind: transfer ? 'transfer' : 'receipt',
        at: toTime(p?.date) || saleAt,
        orderId: order.id,
        docNo,
        customerId,
        goldOut: 0,
        goldIn,
        cashIn,
        settles: p?.settles === 'cash' ? 'cash' : 'metal',
        ...(transfer
          ? {
              detail: cashIn > 0 ? 'fix-rate' as const : 'gold-used' as const,
              ...(cashIn > 0 && Number(p?.goldRate) > 0 ? { rate: Number(p.goldRate) } : {}),
            }
          : {}),
        note: p?.notes || undefined,
      });
    });
  }

  // The account side. Draw-downs onto a sale (cash-allocated, melt-applied)
  // are left out here: the payment they made on the sale is already listed
  // above as a transfer, and listing both would show one movement twice.
  const docNos = new Map<string, string | undefined>(
    (orders as any[]).filter(Boolean).map(o => [String(o.id), o.orderNumber || o.invoiceNumber]),
  );
  for (const account of accounts) {
    const customerId = String(account?.customerId || '');
    (account?.entries || []).forEach((e, i) => {
      const base = {
        id: `acct:${customerId}:${e.id || i}`,
        at: toTime(e.date),
        customerId,
        goldOut: 0,
        note: e.notes || undefined,
      };
      switch (e.type) {
        case 'cash-received':
          if (isOverpaymentCredit(e)) {
            entries.push({
              ...base, kind: 'transfer', detail: 'overpaid', goldIn: 0, cashIn: e.cashDelta,
              ...(e.orderId ? { orderId: e.orderId, docNo: docNos.get(e.orderId) } : {}),
            });
          } else {
            entries.push({ ...base, kind: 'held', detail: 'cash-held', goldIn: 0, cashIn: e.cashDelta });
          }
          break;
        case 'gold-received':
          entries.push({
            ...base, kind: 'held', detail: 'gold-advance', goldIn: e.metalDelta, cashIn: 0,
            ...(e.goldWeight ? { grossWeight: e.goldWeight } : {}),
            ...(e.goldPurity ? { purity: e.goldPurity } : {}),
          });
          break;
        case 'melt-credited':
          entries.push({ ...base, kind: 'held', detail: 'melt', goldIn: e.metalDelta, cashIn: 0 });
          break;
        case 'cash-refunded':
          entries.push({ ...base, kind: 'payout', detail: 'cash-back', goldIn: 0, cashIn: Math.abs(e.cashDelta) });
          break;
        case 'melt-paid-out':
          entries.push({ ...base, kind: 'payout', detail: e.rate ? 'cash-back' : 'gold-back', goldIn: Math.abs(e.metalDelta), cashIn: 0, ...(e.rate ? { rate: e.rate } : {}) });
          break;
        default:
          break;
      }
    });
  }

  // Newest first, and stable for entries at the same instant: a sale settled
  // in the same minute it was raised lists its receipt above the sale.
  return entries.sort((a, b) => b.at - a.at || (a.kind === b.kind ? 0 : a.kind === 'sale' ? 1 : b.kind === 'sale' ? -1 : 0));
};

/** Whether a line brought something IN that day: the lines a total adds up. */
export const countsAsIn = (e: DayBookEntry) => e.kind === 'receipt' || e.kind === 'held';

/** Local calendar day key, e.g. "2026-10-05", for grouping entries by date. */
export const dayKey = (at: number): string => {
  const d = new Date(at);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

/** What moved on one day: the totals a day book prints under its date. */
export interface DayTotals {
  goldOut: number;
  goldIn: number;
  cashIn: number;
  count: number;
}

/**
 * Sales out, and what came IN. Transfers and payouts are listed but not added:
 * a transfer moved money the book already counted, and adding it would count
 * the same rupee twice.
 */
export const totalsOf = (entries: DayBookEntry[]): DayTotals =>
  entries.reduce<DayTotals>(
    (t, e) => ({
      goldOut: t.goldOut + (e.kind === 'sale' ? e.goldOut : 0),
      goldIn: t.goldIn + (countsAsIn(e) ? e.goldIn : 0),
      cashIn: t.cashIn + (countsAsIn(e) ? e.cashIn : 0),
      count: t.count + 1,
    }),
    { goldOut: 0, goldIn: 0, cashIn: 0, count: 0 },
  );

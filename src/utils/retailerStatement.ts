import type { Order } from '../store/data/dataSlice';
import { orderOutstanding, formatGrams, CASH_SETTLED_EPSILON, WEIGHT_SETTLED_EPSILON_GM } from './dues';
import { formatCurrencyValue } from './formatter';

/**
 * A retailer's position across every order, in a form that can be sent to them.
 *
 * One statement, not one message per bill. A wholesaler chasing payment has to
 * answer two questions at once — "which bill is this for" and "what do I owe
 * you in total" — and a per-order reminder answers only the first, which is why
 * chasing three bills used to mean three messages the retailer then had to add
 * up themselves.
 *
 * Metal and cash stay on separate lines throughout. They are independent
 * accounts (see dues.ts): a retailer can clear all their metal and still owe
 * charges, and pricing the grams into the rupee total would count the same
 * debt twice.
 */

export interface StatementLine {
  orderNumber: string;
  date: string;
  /** Grams of 99.50 still owed on this order. */
  gold: number;
  /** Rupees still owed against charges on this order. */
  cash: number;
  settled: boolean;
}

export interface RetailerStatement {
  lines: StatementLine[];
  totalGold: number;
  totalCash: number;
  /** Rupees the wholesaler is holding for this retailer, unapplied. */
  heldCash: number;
  /** Grams of melt credit held, likewise unapplied. */
  meltCredit: number;
  /** True when nothing is owed and nothing is held — there is no reason to send. */
  isClear: boolean;
}

const asDate = (order: Order): string =>
  new Date(order.date || order.createdAt || Date.now()).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

/**
 * Builds the statement from the orders already in the store.
 *
 * Settled orders are kept as lines rather than filtered out: a retailer who
 * paid INV-4 last week and is being chased for INV-5 needs to see that INV-4
 * is acknowledged, or the message reads as if the payment was never received.
 * Only soft-deleted orders are dropped — those are not the retailer's business.
 */
export const buildRetailerStatement = (
  orders: Order[],
  account?: { heldCash?: number; meltCredit?: number },
): RetailerStatement => {
  const lines: StatementLine[] = orders
    .filter((o: any) => !o.deletedAt)
    .map(order => {
      const due = orderOutstanding(order);
      return {
        orderNumber: order.orderNumber || order.invoiceNumber || '—',
        date: asDate(order),
        gold: due.gold,
        cash: due.cash,
        settled: due.gold <= 0 && due.cash <= 0,
      };
    });

  const totalGold = lines.reduce((sum, l) => sum + l.gold, 0);
  const totalCash = lines.reduce((sum, l) => sum + l.cash, 0);
  const heldCash = Number(account?.heldCash || 0);
  const meltCredit = Number(account?.meltCredit || 0);

  return {
    lines,
    totalGold,
    totalCash,
    heldCash,
    meltCredit,
    isClear:
      totalGold < WEIGHT_SETTLED_EPSILON_GM &&
      totalCash < CASH_SETTLED_EPSILON &&
      heldCash < CASH_SETTLED_EPSILON &&
      meltCredit < WEIGHT_SETTLED_EPSILON_GM,
  };
};

/**
 * The statement as WhatsApp text.
 *
 * Plain text on purpose. It renders in the conversation itself, so the retailer
 * reads what they owe without opening an attachment, and it behaves identically
 * on web and on a phone — unlike a file, which the web share path can only
 * attempt. The PDF is the formal copy for whoever asks for one.
 *
 * No markdown table: WhatsApp does not render one, and a monospace-aligned
 * column collapses on a narrow phone. One short line per bill instead.
 */
export const statementToWhatsAppText = (
  statement: RetailerStatement,
  opts: {
    retailerName: string;
    shopName?: string;
    gramShort: string;
    /**
     * Today's rate, used ONLY to price the metal total as an estimate.
     *
     * dues.ts is emphatic that grams and rupees are separate accounts and that
     * adding one to the other double-counts — so this never joins the total,
     * it restates it. A retailer being asked to settle needs a rupee figure to
     * act on, and the rate is printed beside it so nobody mistakes an estimate
     * at today's rate for a fixed debt.
     */
    rate?: number;
    /** Labels, so the message goes out in the shop's own language. */
    labels: {
      heading: string;
      settled: string;
      due: string;
      totalDue: string;
      approxAt: string;
      perGram: string;
      credit: string;
      meltCredit: string;
      nothingDue: string;
    };
  },
): string => {
  const { labels, gramShort } = opts;
  const out: string[] = [];

  out.push(opts.retailerName);
  out.push(`${labels.heading} ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`);

  // Only when there is a list to separate. A retailer holding nothing but an
  // advance has no order lines, and the blank line left a gap under the date.
  if (statement.lines.length > 0) out.push('');

  for (const line of statement.lines) {
    if (line.settled) {
      out.push(`${line.orderNumber} · ${line.date} — ${labels.settled}`);
      continue;
    }
    const parts: string[] = [];
    if (line.gold > 0) parts.push(formatGrams(line.gold, gramShort));
    if (line.cash > 0) parts.push(formatCurrencyValue(line.cash));
    out.push(`${line.orderNumber} · ${line.date} — ${parts.join(' + ')} ${labels.due}`);
  }

  out.push('');

  const totals: string[] = [];
  if (statement.totalGold > 0) totals.push(formatGrams(statement.totalGold, gramShort));
  if (statement.totalCash > 0) totals.push(formatCurrencyValue(statement.totalCash));
  out.push(totals.length ? `${labels.totalDue}: ${totals.join(' + ')}` : labels.nothingDue);

  // The metal restated in rupees, so the retailer has a figure to pay against.
  // Priced and labelled with the rate it used — a gram balance is fixed, its
  // rupee value is not, and a statement that hid that would be quoting a price
  // it cannot hold to.
  if (statement.totalGold > 0 && (opts.rate || 0) > 0) {
    const approx = statement.totalGold * (opts.rate as number)
      + statement.totalCash;
    out.push(`${labels.approxAt} ${formatCurrencyValue(approx)} @ ${formatCurrencyValue(opts.rate as number)}/${labels.perGram}`);
  }

  // Credit is listed separately rather than netted off the total. The two are
  // different things — one is a debt, the other is the wholesaler holding the
  // retailer's money — and netting them hides the second entirely.
  if (statement.heldCash >= CASH_SETTLED_EPSILON) {
    out.push(`${labels.credit}: ${formatCurrencyValue(statement.heldCash)}`);
  }
  if (statement.meltCredit >= WEIGHT_SETTLED_EPSILON_GM) {
    out.push(`${labels.meltCredit}: ${formatGrams(statement.meltCredit, gramShort)}`);
  }

  if (opts.shopName) {
    out.push('');
    out.push(`— ${opts.shopName}`);
  }

  return out.join('\n');
};

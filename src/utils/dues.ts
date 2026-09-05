import type { Order } from '../store/data/dataSlice';

/**
 * What a retailer still owes, and the one place that decides it.
 *
 * A retailer carries TWO independent balances, not one:
 *
 *   - the METAL account, in grams — gold handed over as goods and not yet
 *     returned as gold or bought out with cash
 *   - the CASH account, in rupees — making charges, other charges and GST,
 *     which are owed as money and never convert to metal
 *
 * They settle independently: a retailer can clear all their metal and still owe
 * charges, or the reverse. Both come from fields the server maintains on the
 * order, so the arithmetic lives in one place (the Order pre-save hook) and
 * every screen reads the same answer.
 *
 * `estimatedBalance` is deliberately NOT used. It is both accounts priced as a
 * single rupee figure — `remainingWeight * rate + outstandingCash` — so showing
 * it beside the weight counts the same debt twice: a retailer owing 5 gm reads
 * as "5.000 gm" AND "Rs.75,000", which is that 5 gm again in rupees. It is for
 * "what would close this today", never for a dues total.
 */
export interface Outstanding {
  /** Grams of metal still owed. */
  gold: number;
  /** Rupees still owed against charges. */
  cash: number;
}

/**
 * Grams below which the metal account counts as settled.
 *
 * Mirrors WEIGHT_SETTLED_EPSILON_GM in the backend's order.model.ts, which is
 * what decides there that an order's weight is paid off. Weights carry full
 * float precision deliberately, so a fully-settled order routinely lands at
 * ~1e-13 rather than exactly 0 — without this, every settled order would show
 * its retailer as owing a sliver of gold. It is also exactly where a 3-decimal
 * display stops rounding to "0.000", so the threshold and the screen agree.
 */
export const WEIGHT_SETTLED_EPSILON_GM = 0.0005;

/**
 * Half a rupee — the cash counterpart of the weight epsilon. Dues render with
 * no decimals, so below this a balance shows as ₹0; counting it would list a
 * retailer as owing while displaying nothing owed.
 */
export const CASH_SETTLED_EPSILON = 0.5;

/**
 * The two balances on one order, or zeroes when it cannot carry any.
 *
 * Only a PENDING ADVANCE order is ever outstanding. A full-payment order is
 * settled the moment it is raised, a completed one has both accounts zeroed by
 * the server, and a cancelled one was never owed. `paymentMode` defaults to
 * 'advance' because orders written before the field existed were all advances.
 */
export const orderOutstanding = (order: Order): Outstanding => {
  if (order.status !== 'pending') return { gold: 0, cash: 0 };
  if ((order.paymentMode ?? 'advance') !== 'advance') return { gold: 0, cash: 0 };

  const gold = Number(order.remainingWeight || 0);
  const cash = Number(order.outstandingCash || 0);

  return {
    gold: gold >= WEIGHT_SETTLED_EPSILON_GM ? gold : 0,
    cash: cash >= CASH_SETTLED_EPSILON ? cash : 0,
  };
};

/** True when either account has something left on it. */
export const hasOutstanding = (o: Outstanding): boolean => o.gold > 0 || o.cash > 0;

/** Both accounts summed across a set of orders. */
export const sumOutstanding = (orders: Order[]): Outstanding =>
  orders.reduce<Outstanding>(
    (total, order) => {
      const due = orderOutstanding(order);
      return { gold: total.gold + due.gold, cash: total.cash + due.cash };
    },
    { gold: 0, cash: 0 },
  );

/** "3.250 gm" — weights print to 3dp everywhere in this app. */
export const formatGrams = (grams: number, unit: string): string =>
  `${Number(grams || 0).toFixed(3)} ${unit}`;

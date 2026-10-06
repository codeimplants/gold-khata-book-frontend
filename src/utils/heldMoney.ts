import type { Order } from '../store/data/dataSlice';
import { orderOutstanding, CASH_SETTLED_EPSILON, WEIGHT_SETTLED_EPSILON_GM } from './dues';

/**
 * Spending what a retailer has left with the shop: cash held (rate not fixed)
 * and gold held (advances and melt credit), across the sales they owe on.
 *
 * Only a PLAN of which sale gets how much. Each step is posted to the server
 * (`allocateCash`, `applyMeltCredit`), which converts the cash at the rate
 * given, checks every figure against the balance again, and moves anything
 * paid beyond a sale back onto the account. Nothing here settles anything.
 *
 * Oldest sale first, the way a wholesaler applies money that came in against
 * the account rather than against one bill.
 */

const at = (o: any) => new Date(o?.date || o?.createdAt || 0).getTime() || 0;

/** Pending sales with metal still owed, oldest first. */
export const salesOwingMetal = (orders: Order[]): Order[] =>
  orders
    .filter((o: any) => !o?.deletedAt && orderOutstanding(o).gold > 0)
    .sort((a, b) => at(a) - at(b));

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface CashStep {
  orderId: string;
  /** Rupees of held cash to put on this sale. */
  amount: number;
}

/**
 * Held cash spread over the sales owing metal, converted at `rate` (per gram
 * of 99.50). Each sale takes at most what its metal due is worth at that rate;
 * whatever is left after the last sale stays held.
 */
export const planCashAllocation = (orders: Order[], amount: number, rate: number): CashStep[] => {
  if (!(amount >= CASH_SETTLED_EPSILON) || !(rate > 0)) return [];
  const steps: CashStep[] = [];
  let left = round2(amount);
  for (const order of salesOwingMetal(orders)) {
    if (left < CASH_SETTLED_EPSILON) break;
    const worth = round2(orderOutstanding(order).gold * rate);
    const take = Math.min(left, worth);
    if (take < CASH_SETTLED_EPSILON) continue;
    steps.push({ orderId: order.id, amount: take });
    left = round2(left - take);
  }
  return steps;
};

export interface GoldStep {
  orderId: string;
  /** Grams of 99.50 held gold to put on this sale. */
  weight: number;
}

/** Held gold spread over the sales owing metal, gram for gram, no rate. */
export const planGoldApplication = (orders: Order[], grams: number): GoldStep[] => {
  if (!(grams > WEIGHT_SETTLED_EPSILON_GM)) return [];
  const steps: GoldStep[] = [];
  let left = grams;
  for (const order of salesOwingMetal(orders)) {
    if (left <= WEIGHT_SETTLED_EPSILON_GM) break;
    const take = Math.min(left, orderOutstanding(order).gold);
    if (take <= WEIGHT_SETTLED_EPSILON_GM) continue;
    steps.push({ orderId: order.id, weight: take });
    left -= take;
  }
  return steps;
};

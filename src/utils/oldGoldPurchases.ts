import type { PurchaseOldGold } from '../types';

/**
 * What "Sold to us" counts.
 *
 * One collection holds two different things, told apart by `mode`:
 *
 * - `standalone` — the shop bought old gold outright. There is no bill; the
 *   declaration *is* the transaction record.
 * - `exchange`   — old gold came in against a new ornament. The bill is the
 *   transaction record and this document is evidence attached to it, reachable
 *   from the order it belongs to.
 *
 * Only the first kind is a purchase in its own right, so only the first kind is
 * counted. Including exchanges inflated every count, and did worse to the
 * dashboard total: that value was already deducted inside the invoice it came
 * from, so adding it again counted the same gold twice, in opposite directions.
 *
 * A note for whoever adds the Purchase tab from dev-help/transaction-structure.md:
 * do not reach for this to mean "old gold acquired". The exchange declaration
 * is optional — a shopkeeper can complete an exchange and never generate one —
 * so this collection undercounts acquisitions by design. That figure has to
 * come from the orders' own exchange rows, plus these.
 */
export const isStandalonePurchase = (d: Pick<PurchaseOldGold, 'mode'>): boolean =>
  d.mode !== 'exchange';

/** The Sold to Us records for a shop, in the order given. */
export const standalonePurchases = <T extends Pick<PurchaseOldGold, 'mode'>>(
  list: T[] = [],
): T[] => list.filter(isStandalonePurchase);

/** The Sold to Us records for one customer. */
export const standalonePurchasesFor = <
  T extends Pick<PurchaseOldGold, 'mode' | 'customerId'>,
>(
  list: T[] = [],
  customerId?: string,
): T[] => list.filter(d => d.customerId === customerId && isStandalonePurchase(d));

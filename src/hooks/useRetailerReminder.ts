import React from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchRetailerAccount } from '../store/data/dataSlice';
import { useTranslation } from './useTranslation';
import { buildRetailerStatement, statementToWhatsAppText } from '../utils/retailerStatement';
import { retailerDisplayName } from '../utils/retailerName';
import { openWhatsApp } from '../utils/whatsappUtils';
import { useShopRate } from './useShopRate';

/**
 * "Send this retailer their statement", from anywhere a retailer appears.
 *
 * The same action sits on the dashboard dues list, the Retailers tab and an
 * order row, and it has to send the same message from all three — three
 * screens each assembling their own version of a payment reminder is how a
 * retailer ends up chased for two different figures on the same day.
 *
 * The statement is always the RETAILER's, never one bill's, even when the tap
 * came from an order card. That is not a shortcut: a retailer paying against a
 * single bill still needs to see the rest of their account, and the message
 * names every bill anyway, so it answers "which bill" and "what do I owe in
 * total" at once. An order row is just a place the question gets asked.
 */
export const useRetailerReminder = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const orders = useAppSelector(s => s.data.orders);
  const customers = useAppSelector(s => s.data.customers);
  const shopDetails = useAppSelector(s => s.data.shopDetails);
  const accounts = useAppSelector(s => s.data.retailerAccounts);
  // The rate the shop is dealing at, not the market feed: a statement that
  // restates a metal balance in rupees should use the same number the bills
  // were struck at.
  const { rate: liveRate } = useShopRate();

  const gramShort = t('common.gramShort') || 'gm';

  const labels = React.useMemo(() => ({
    heading: t('statement.asOn') || 'Balance as on',
    settled: t('statement.settled') || 'settled',
    due: t('statement.due') || 'due',
    totalDue: t('statement.totalDue') || 'Total due',
    approxAt: t('statement.approxAt') || 'Approx',
    perGram: gramShort,
    credit: t('statement.credit') || 'Credit with us',
    meltCredit: t('statement.meltCredit') || 'Melt credit',
    nothingDue: t('statement.nothingDue') || 'Nothing due',
  }), [t, gramShort]);

  /**
   * Opens WhatsApp with this retailer's statement written out.
   *
   * The account is fetched HERE rather than by the list that renders the
   * button. A dues list of twenty retailers would otherwise fire twenty
   * balance requests to populate buttons that mostly never get pressed; this
   * way exactly one request is made, at the moment someone actually asks.
   *
   * The fetch is awaited but not required: it is thin-cached and short-lived
   * (see STALE_TIMES_MS), and a reminder that goes out without the credit line
   * is worth more than one that does not go out at all.
   */
  const remind = React.useCallback(async (customerId: string) => {
    if (!customerId) return;

    const action: any = await dispatch(fetchRetailerAccount({ customerId }) as any);

    /**
     * Prefer the value the thunk just returned, not the store.
     *
     * `accounts` here is the snapshot this callback closed over, from before
     * the dispatch — reading it back would use the balance as it was a moment
     * ago and miss the one just fetched. The store is still the fallback, and
     * it is the RIGHT answer when the thunk short-circuits: its `condition`
     * skips the request while the cached balance is fresh, and then rejects
     * with no payload.
     */
    const account = fetchRetailerAccount.fulfilled.match(action)
      ? action.payload
      : accounts[customerId];

    const customer = customers.find((c: any) => c.id === customerId);
    const own = orders.filter((o: any) => o.customerId === customerId && !o.deletedAt);

    const statement = buildRetailerStatement(own, account);

    const message = statementToWhatsAppText(statement, {
      retailerName: customer ? retailerDisplayName(customer.shopName, customer.name) : '',
      shopName: shopDetails?.shopName || shopDetails?.name,
      gramShort,
      rate: liveRate,
      labels,
    });

    await openWhatsApp(customer?.phone, message);
  }, [dispatch, accounts, customers, orders, shopDetails, gramShort, liveRate, labels]);

  return { remind };
};

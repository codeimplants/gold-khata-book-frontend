// The Day Book tab (rojmel): everything written in the khata, day by day.
//
// A wholesaler closes each day by reading down the day book: what went out to
// retailers as sales, and what came back in as metal or cash. Each date
// carries its own totals, as the last line under a day in a paper day book
// would.
//
// It took the tab that SoneBill's Orders list held, a billing-app view of
// invoices with search, status chips and a total per bill. That list still
// exists, because trash, restore and per-sale actions live there. It moved to
// a pushed "Sales" screen, linked from this header. App Review rejected the
// app as a SoneBill copy under guideline 4.3(a) (APP_STORE_4.3_REWORK.md).
//
// No arithmetic of its own: entries and totals come from utils/dayBook.ts,
// which only reads figures the server computed.
import React from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { List, Plus, ScrollText } from 'lucide-react-native';

import { useTranslation } from '../../hooks/useTranslation';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchCustomers, fetchOrders, fetchRetailerAccounts } from '../../store/data/dataSlice';
import LedgerHeader, { LedgerHeaderAction } from '../../components/ledger/LedgerHeader';
import EntryRow from '../../components/ledger/EntryRow';
import { useContentContainerStyle } from '../../constants/layout';
import { buildDayBook, dayKey, totalsOf, type DayBookEntry, type DayTotals } from '../../utils/dayBook';
import { formatGrams } from '../../utils/dues';
import { Brand, tabularNums } from '../../theme/brand';

type Filter = 'all' | 'sale' | 'receipt';

const LOCALES: Record<string, string> = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN', gu: 'gu-IN' };

const inr = (n: number) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

/** "Today", "Yesterday", or "Sat, 3 Oct" in the app's language. */
const dayLabel = (key: string, at: number, t: any, language: string) => {
  const now = new Date();
  if (key === dayKey(now.getTime())) return t('dayBook.today') || 'Today';
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (key === dayKey(y.getTime())) return t('dayBook.yesterday') || 'Yesterday';
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };
  const sameYear = new Date(at).getFullYear() === now.getFullYear();
  if (!sameYear) opts.year = 'numeric';
  try {
    return new Date(at).toLocaleDateString(LOCALES[language] || 'en-IN', opts);
  } catch {
    return new Date(at).toLocaleDateString('en-IN', opts);
  }
};

type Section = { key: string; at: number; totals: DayTotals; data: DayBookEntry[] };

export default function DayBookScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const { t, language } = useTranslation();
  const contentStyle = useContentContainerStyle();
  const orders = useAppSelector(s => s.data.orders);
  const customers = useAppSelector(s => s.data.customers);
  const accountsById = useAppSelector(s => s.data.retailerAccounts);
  const [filter, setFilter] = React.useState<Filter>('all');
  const [refreshing, setRefreshing] = React.useState(false);

  React.useEffect(() => {
    dispatch(fetchCustomers());
    dispatch(fetchOrders());
    dispatch(fetchRetailerAccounts());
  }, [dispatch]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      dispatch(fetchCustomers({ force: true })),
      dispatch(fetchOrders({ force: true })),
      dispatch(fetchRetailerAccounts()),
    ]);
    setRefreshing(false);
  }, [dispatch]);

  const nameById = React.useMemo(
    () => new Map<string, string>(customers.map((c: any) => [String(c.id), c.name])),
    [customers],
  );

  // Cash held and gold advances are entries in the book as much as sales are:
  // they came in on a day, and the day's totals include them.
  const all = React.useMemo(
    () => buildDayBook(orders, Object.values(accountsById || {})),
    [orders, accountsById],
  );

  const sections = React.useMemo<Section[]>(() => {
    // Receipts means everything that is not a sale: money in against a sale,
    // money held on the account, and held money moving onto a sale.
    const visible = filter === 'all'
      ? all
      : all.filter(e => (filter === 'sale' ? e.kind === 'sale' : e.kind !== 'sale'));
    const byDay = new Map<string, DayBookEntry[]>();
    for (const e of visible) {
      const k = dayKey(e.at);
      const list = byDay.get(k);
      if (list) list.push(e);
      else byDay.set(k, [e]);
    }
    // Entries are already newest first, so the days come out newest first.
    return [...byDay.entries()].map(([key, data]) => ({ key, at: data[0].at, totals: totalsOf(data), data }));
  }, [all, filter]);

  const gm = t('common.gramShort') || 'gm';

  const tabs: { key: Filter; label: string }[] = [
    { key: 'all', label: t('dashboard.dues.all') || 'All' },
    { key: 'sale', label: t('dayBook.sales') || 'Sales' },
    { key: 'receipt', label: t('dayBook.receipts') || 'Receipts' },
  ];

  return (
    <View style={styles.screen}>
      <LedgerHeader
        title={t('tabs.orders') || 'Day Book'}
        subtitle={`${all.length} ${t('dayBook.entries') || 'entries'}`}
        right={
          <LedgerHeaderAction
            icon={List}
            label={t('dayBook.salesList') || 'Sales'}
            onPress={() => navigation.navigate('SalesList')}
          />
        }
      />

      <View style={[styles.tabs, contentStyle]}>
        {tabs.map(tab => {
          const active = filter === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setFilter(tab.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={styles.tab}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
              <View style={[styles.tabLine, active && styles.tabLineActive]} />
            </Pressable>
          );
        })}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        stickySectionHeadersEnabled
        contentContainerStyle={[{ paddingBottom: 40 }, contentStyle]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Brand.primary]} />}
        renderSectionHeader={({ section }) => {
          const s = section as Section;
          return (
            <View style={styles.dayHead}>
              <Text style={styles.dayTitle}>{dayLabel(s.key, s.at, t, language)}</Text>
              {/* The day's totals, each only when something moved: a day with
                  no receipts does not need "In 0.000 gm" printed under it. */}
              <View style={styles.dayTotals}>
                {s.totals.goldOut > 0 && (
                  <Text style={[styles.dayTotal, tabularNums]}>
                    <Text style={styles.dayTotalLabel}>{t('dayBook.goldOut') || 'Gold out'} </Text>
                    <Text style={{ color: Brand.gold }}>{formatGrams(s.totals.goldOut, gm)}</Text>
                  </Text>
                )}
                {s.totals.goldIn > 0 && (
                  <Text style={[styles.dayTotal, tabularNums]}>
                    <Text style={styles.dayTotalLabel}>{t('dayBook.goldIn') || 'Gold in'} </Text>
                    <Text style={{ color: Brand.received }}>{formatGrams(s.totals.goldIn, gm)}</Text>
                  </Text>
                )}
                {s.totals.cashIn > 0 && (
                  <Text style={[styles.dayTotal, tabularNums]}>
                    <Text style={styles.dayTotalLabel}>{t('dayBook.cashIn') || 'Cash in'} </Text>
                    <Text style={{ color: Brand.received }}>{inr(s.totals.cashIn)}</Text>
                  </Text>
                )}
              </View>
            </View>
          );
        }}
        renderItem={({ item }) => (
          <View style={styles.rowWrap}>
            <EntryRow
              entry={item}
              name={nameById.get(item.customerId) || 'Unknown'}
              t={t}
              language={language}
              showDate={false}
              onPress={() => (item.orderId
                ? navigation.navigate('OrderDetails', { orderId: item.orderId })
                : navigation.navigate('CustomerDetails', { customerId: item.customerId }))}
            />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <ScrollText size={28} color={Brand.primary} />
            </View>
            <Text style={styles.emptyText}>
              {t('dayBook.empty') || 'Nothing in the book yet. Tap + to record your first sale.'}
            </Text>
            <Pressable style={styles.emptyButton} onPress={() => navigation.navigate('NewOrder')}>
              <Plus size={16} color="#FFFFFF" />
              <Text style={styles.emptyButtonText}>{t('newEntry.sale') || 'New sale'}</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Brand.paper,
  },
  tabs: {
    flexDirection: 'row',
    gap: 22,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: Brand.paper,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.lineStrong,
  },
  tab: {
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: Brand.inkMuted,
  },
  tabTextActive: {
    color: Brand.primary,
    fontWeight: '700',
  },
  tabLine: {
    height: 3,
    alignSelf: 'stretch',
    marginTop: 8,
    backgroundColor: 'transparent',
  },
  tabLineActive: {
    backgroundColor: Brand.goldFill,
  },
  dayHead: {
    backgroundColor: Brand.paper,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Brand.line,
  },
  dayTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Brand.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  dayTotals: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 14,
    rowGap: 2,
    marginTop: 4,
  },
  dayTotal: {
    fontSize: 13,
    fontWeight: '700',
  },
  dayTotalLabel: {
    fontWeight: '500',
    color: Brand.inkMuted,
  },
  rowWrap: {
    backgroundColor: Brand.card,
    paddingHorizontal: 16,
  },
  empty: {
    alignItems: 'center',
    marginTop: 72,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: Brand.inkMuted,
    textAlign: 'center',
    lineHeight: 21,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Brand.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    height: 42,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});

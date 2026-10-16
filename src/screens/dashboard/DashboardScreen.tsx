// src/screens/dashboard/DashboardScreen.tsx
//
// The Khata tab: the wholesaler's home screen.
//
// It answers the questions a wholesaler opens the app with: how much fine gold
// and cash is owed to me, by whom, and what was written in the book lately.
//
// It replaced the dashboard inherited from SoneBill: a gradient header with a
// centred logo, a large orange rate card, two tinted total tiles, a floating
// purple "+" and pill-shaped filters. App Review rejected the app under
// guideline 4.3(a) because it still looked like SoneBill. See
// APP_STORE_4.3_REWORK.md and src/theme/brand.ts for the Ledger design this
// follows.
import React from 'react';
import { StyleSheet, RefreshControl, BackHandler, Text, View, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronRight,
  Flame,
  Globe,
} from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../navigation/types';

import { useTranslation } from '../../hooks/useTranslation';
import { useOldGoldMelt } from '../../hooks/useOldGoldMelt';
import RemindButton from '../../components/customers/RemindButton';
import SetRateModal from '../../components/common/SetRateModal';
import LedgerSheet from '../../components/ledger/LedgerSheet';
import { useShopRate } from '../../hooks/useShopRate';
import { useDailyRatePrompt } from '../../hooks/useDailyRatePrompt';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  fetchCustomers,
  fetchOrders,
  fetchRetailerAccounts,
  fetchMetalRates,
  fetchMeltLots,
} from '../../store/data/dataSlice';
import ExitAppModal from '../../components/ExitAppModal';
import RateAppCard from '../../components/common/RateAppCard';
import LanguagePopover, { type PopoverAnchor } from '../../components/common/LanguagePopover';
import LedgerHeader, { LedgerHeaderAction } from '../../components/ledger/LedgerHeader';
import { LAYOUT, useContentContainerStyle } from '../../constants/layout';
import { orderOutstanding, hasOutstanding, formatGrams } from '../../utils/dues';
import { buildDayBook } from '../../utils/dayBook';
import { CASH_SETTLED_EPSILON, WEIGHT_SETTLED_EPSILON_GM } from '../../utils/dues';
import EntryRow from '../../components/ledger/EntryRow';
import { GemBullet, GoldFrame } from '../../components/ledger/Motifs';
import { Brand, tabularNums } from '../../theme/brand';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

/** Indian-format currency, no decimals (₹2,76,581). */
const inr = (n: number) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const LOCALES: Record<string, string> = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN', gu: 'gu-IN' };

/** "Monday, 5 October" in the app's language, falling back to English. */
const longDate = (d: Date, language: string) => {
  const opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };
  try {
    return d.toLocaleDateString(LOCALES[language] || 'en-IN', opts);
  } catch {
    return d.toLocaleDateString('en-IN', opts);
  }
};

/** Which column the balances table is narrowed to. */
type DuesFilter = 'all' | 'gold' | 'silver' | 'cash';

/** How many of the newest entries the home screen shows before "Open day book". */
const RECENT_LIMIT = 5;

/* ---------------- PIECES ---------------- */

/**
 * Today's 99.50 rate in one line under the header.
 *
 * It says plainly whether the shop is on the live feed or a rate the owner
 * set. The two look the same otherwise, and the difference is every sale
 * raised today. Tapping anywhere opens the rate sheet.
 */
const RateStrip = ({
  t,
  rate,
  isOverride,
  liveRate,
  onPress,
}: {
  t: any;
  rate: number;
  isOverride: boolean;
  liveRate: number;
  onPress: () => void;
}) => (
  <Pressable onPress={onPress} accessibilityRole="button" style={styles.rateStrip}>
    <View style={{ flex: 1 }}>
      <Text style={styles.rateLabel}>{t('khata.rateLabel') || "Today's rate · 99.50"}</Text>
      <Text style={[styles.rateValue, tabularNums]}>
        {rate > 0 ? inr(rate) : '—'}
        <Text style={styles.rateUnit}>{`  / ${t('common.gramShort') || 'gm'}`}</Text>
      </Text>
      {isOverride && liveRate > 0 && (
        <Text style={styles.rateSub}>
          {(t('rate.liveIs') || 'Live rate')} {inr(liveRate)}
        </Text>
      )}
    </View>
    <View style={[styles.rateTag, isOverride ? styles.rateTagYours : styles.rateTagLive]}>
      <Text style={[styles.rateTagText, { color: isOverride ? Brand.gold : Brand.primary }]}>
        {isOverride ? (t('khata.rateYours') || 'Your rate') : (t('khata.rateLive') || 'Live')}
      </Text>
    </View>
    <Text style={styles.rateChange}>
      {isOverride ? (t('rate.change') || 'Change') : (t('rate.set') || 'Set')}
    </Text>
  </Pressable>
);

/** Held gold, silver and cash as named figures, each only when there is some:
 *  "Gold 22.800 gm", "Silver 20.000 gm", "Cash ₹6,74,214". */
const heldParts = (t: any, gold: number, silver: number, cash: number): string[] => {
  const gm = t('common.gramShort') || 'gm';
  return [
    gold >= WEIGHT_SETTLED_EPSILON_GM ? `${t('dashboard.dues.gold') || 'Gold'} ${formatGrams(gold, gm)}` : null,
    silver >= WEIGHT_SETTLED_EPSILON_GM ? `${t('dashboard.dues.silver') || 'Silver'} ${formatGrams(silver, gm)}` : null,
    cash >= CASH_SETTLED_EPSILON ? `${t('dashboard.dues.cash') || 'Cash'} ${inr(cash)}` : null,
  ].filter(Boolean) as string[];
};

/** The two balances owed to the wholesaler, side by side, never added together. */
const OwedSummary = ({
  t,
  gold,
  cash,
  silver = 0,
  owingCount,
  heldGold,
  heldCash,
  heldSilver = 0,
  onHeldPress,
  onPress,
}: {
  t: any;
  gold: number;
  cash: number;
  /** Silver owed, in grams of silver: a third account, shown only when set. */
  silver?: number;
  owingCount: number;
  /** Totals of what the shop is holding FOR retailers: gold advances and melt
   *  credit, and cash whose rate is not fixed yet. Theirs, not owed to you. */
  heldGold: number;
  heldCash: number;
  /** Grams of silver held for retailers, beside the gold and cash held. */
  heldSilver?: number;
  /** Opens whose it is: the strip names amounts, the sheet names retailers. */
  onHeldPress?: () => void;
  onPress: () => void;
}) => (
  <Pressable onPress={onPress} accessibilityRole="button" style={[styles.card, styles.heroCard]}>
    {/* The figure this screen is about, framed like a hallmark certificate. */}
    <GoldFrame />
    <View style={styles.kickerRow}>
      <GemBullet />
      <Text style={styles.cardKicker}>{t('khata.owedToYou') || 'Owed to you'}</Text>
    </View>
    <View style={styles.owedRow}>
      <View style={styles.owedCol}>
        <Text style={styles.owedLabel}>{t('khata.fineGold') || 'Fine gold (99.50)'}</Text>
        <Text
          style={[styles.owedValue, { color: Brand.gold }, tabularNums]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {formatGrams(gold, t('common.gramShort') || 'gm')}
        </Text>
      </View>
      <View style={styles.owedDivider} />
      <View style={styles.owedCol}>
        <Text style={styles.owedLabel}>{t('khata.cash') || 'Cash'}</Text>
        <Text
          style={[styles.owedValue, { color: Brand.ink }, tabularNums]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {inr(cash)}
        </Text>
      </View>
    </View>
    {/* Silver owed, on its own line: a gram of silver is not a gram of gold,
        so it never joins the gold figure above. Hidden for a gold-only book. */}
    {silver >= WEIGHT_SETTLED_EPSILON_GM && (
      // Slate, not the green of "Held for retailers" below: this is owed TO
      // the shop, and in the held strip's colour it read as money held.
      <View style={[styles.heldStrip, { backgroundColor: Brand.silverSoft }]}>
        <Text style={[styles.heldStripLabel, { color: Brand.silver }]}>{t('khata.silverOwed') || 'Silver owed'}</Text>
        <Text style={[styles.heldStripValue, { color: Brand.silver }, tabularNums]} numberOfLines={1} adjustsFontSizeToFit>
          {formatGrams(silver, t('common.gramShort') || 'gm')}
        </Text>
      </View>
    )}
    {/* Shown beside the dues, never subtracted from them: this is the
        retailers' own money and metal sitting with the shop, and netting it
        off would hide that the shop is holding it. */}
    {/* What retailers have left WITH the shop: their advances, and cash
        whose rate is not fixed yet. The owner read the bare figures as more
        dues (2026-10-17), so each one is named, the line says what they are,
        and a tap says whose. Its own press target: the card around it goes to
        the retailer list. */}
    {(heldGold >= WEIGHT_SETTLED_EPSILON_GM || heldCash >= CASH_SETTLED_EPSILON || heldSilver >= WEIGHT_SETTLED_EPSILON_GM) && (
      <Pressable
        onPress={onHeldPress}
        accessibilityRole="button"
        style={({ pressed }) => [styles.heldBox, pressed && { opacity: 0.7 }]}
      >
        <View style={styles.heldTop}>
          <Text style={styles.heldStripLabel}>{t('khata.heldForRetailers') || 'Held for retailers'}</Text>
          {/* Two lines, right-aligned: gold, silver and cash held together run
              past one line on a phone, and shrink-to-fit does nothing on web,
              which cut the cash off mid-figure. */}
          <Text style={[styles.heldStripValue, { textAlign: 'right' }, tabularNums]} numberOfLines={2}>
            {heldParts(t, heldGold, heldSilver, heldCash).join('  ·  ')}
          </Text>
        </View>
        <View style={styles.heldTop}>
          <Text style={styles.heldHint}>
            {t('khata.heldExplain') || 'Their advances with you. Not owed to you.'}
          </Text>
          <Text style={styles.heldLink}>{t('khata.heldWhose') || 'See whose'} ›</Text>
        </View>
      </Pressable>
    )}
    <View style={styles.owedFooter}>
      <Text style={styles.owedFooterText}>
        {owingCount} {t('khata.retailersOwing') || 'retailers with a balance'}
      </Text>
      <ChevronRight size={16} color={Brand.inkFaint} />
    </View>
  </Pressable>
);

/** Text tabs with a gold underline, for the balances table. */
const FilterTabs = ({
  value,
  onChange,
  labels,
  showSilver = false,
}: {
  value: DuesFilter;
  onChange: (next: DuesFilter) => void;
  labels: Record<DuesFilter, string>;
  /** Only once some retailer owes silver: a gold-only book keeps its three
   *  tabs, and a fourth that always filtered to nothing would be noise. */
  showSilver?: boolean;
}) => (
  <View style={styles.filterRow}>
    {((showSilver ? ['all', 'gold', 'silver', 'cash'] : ['all', 'gold', 'cash']) as DuesFilter[]).map(key => {
      const active = value === key;
      return (
        <Pressable
          key={key}
          onPress={() => onChange(key)}
          accessibilityRole="button"
          accessibilityState={{ selected: active }}
          style={styles.filterTab}
        >
          <Text style={[styles.filterText, active && styles.filterTextActive]}>{labels[key]}</Text>
          <View style={[styles.filterLine, active && styles.filterLineActive]} />
        </Pressable>
      );
    })}
  </View>
);

/**
 * One retailer's balance as a ledger row, shaped by the tab above it.
 *
 * The tab says what is being looked at, and the figure column shows exactly
 * that. It used to show Gold and Cash columns under every tab, so "Cash"
 * listed a gold column and "Silver" hid the silver in small print under the
 * name; the owner could not tell how the tabs and the columns were related
 * (2026-10-17).
 *
 *   Gold / Silver / Cash  one column: that due, biggest first
 *   All                   each due this retailer has, one labelled line each
 *
 * Every figure stays its own: gold and silver in grams, cash in rupees.
 * Converting grams to rupees needs a rate, and the rate on the day the metal
 * comes back is not today's. Nothing owed reads as an em dash, never "0.000 gm".
 */
const BalanceRow = ({
  id,
  name,
  mode,
  gold,
  cash,
  silver = 0,
  labels,
  heldGold = 0,
  heldCash = 0,
  heldSilver = 0,
  heldLabel,
  gramShort,
  onPress,
}: {
  id: string;
  name: string;
  /** The tab: which figure the row shows. */
  mode: DuesFilter;
  gold: number;
  cash: number;
  /** Silver owed, grams of silver. */
  silver?: number;
  /** The words for each line of the All view. */
  labels: { gold: string; silver: string; cash: string };
  /** Held for this retailer: cash not yet converted, gold and silver held. */
  heldGold?: number;
  heldCash?: number;
  heldSilver?: number;
  heldLabel: string;
  gramShort: string;
  onPress: () => void;
}) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.balanceRow, pressed && { opacity: 0.6 }]}>
    <View style={styles.colName}>
      {/* Two lines, not an ellipsis: shop names in this trade run long
          ("Shree Ganesh Jewellers"), and a cut name is a guess at who owes. */}
      <Text style={styles.rowName} numberOfLines={2}>{name}</Text>
      {/* A retailer who owes gold but has paid cash to be converted at a rate
          they will name later: the debt stands until they do, and this is
          the reminder that the cash is already here. */}
      {(heldCash >= CASH_SETTLED_EPSILON || heldGold >= WEIGHT_SETTLED_EPSILON_GM || heldSilver >= WEIGHT_SETTLED_EPSILON_GM) && (
        <Text style={[styles.rowHeld, tabularNums]} numberOfLines={1}>
          {heldLabel}{' '}
          {[
            heldCash >= CASH_SETTLED_EPSILON ? inr(heldCash) : null,
            heldGold >= WEIGHT_SETTLED_EPSILON_GM ? formatGrams(heldGold, gramShort) : null,
            heldSilver >= WEIGHT_SETTLED_EPSILON_GM ? `${formatGrams(heldSilver, gramShort)} ${labels.silver.toLowerCase()}` : null,
          ].filter(Boolean).join(' · ')}
        </Text>
      )}
    </View>
    {mode === 'all' ? (
      <View style={styles.colOwes}>
        {gold > 0 && (
          <Text style={[styles.owesLine, tabularNums]} numberOfLines={1}>
            <Text style={styles.owesLabel}>{labels.gold} </Text>
            <Text style={[styles.rowFigure, { color: Brand.gold }]}>{formatGrams(gold, gramShort)}</Text>
          </Text>
        )}
        {silver >= WEIGHT_SETTLED_EPSILON_GM && (
          <Text style={[styles.owesLine, tabularNums]} numberOfLines={1}>
            <Text style={styles.owesLabel}>{labels.silver} </Text>
            <Text style={[styles.rowFigure, { color: Brand.silver }]}>{formatGrams(silver, gramShort)}</Text>
          </Text>
        )}
        {cash > 0 && (
          <Text style={[styles.owesLine, tabularNums]} numberOfLines={1}>
            <Text style={styles.owesLabel}>{labels.cash} </Text>
            <Text style={[styles.rowFigure, { color: Brand.ink }]}>{inr(cash)}</Text>
          </Text>
        )}
      </View>
    ) : (() => {
      const value = mode === 'gold' ? gold : mode === 'silver' ? silver : cash;
      const owes = mode === 'silver' ? value >= WEIGHT_SETTLED_EPSILON_GM : value > 0;
      const color = mode === 'gold' ? Brand.gold : mode === 'silver' ? Brand.silver : Brand.ink;
      return (
        <Text style={[styles.colOne, styles.rowFigure, { color: owes ? color : Brand.inkFaint }, tabularNums]} numberOfLines={1}>
          {!owes ? '—' : mode === 'cash' ? inr(value) : formatGrams(value, gramShort)}
        </Text>
      );
    })()}
    {/* Chasing a balance is the next thing anyone does with this list, so the
        reminder sits on the row rather than two taps away. */}
    <View style={styles.colRemind}>
      <RemindButton customerId={id} compact />
    </View>
  </Pressable>
);

/* ---------------- SCREEN ---------------- */

const DashboardScreen = () => {
  const navigation: any = useNavigation<NavProp>();
  const dispatch = useAppDispatch();
  // Centres and caps content on iPad; no-op on phones.
  const contentStyle = useContentContainerStyle();

  const customers = useAppSelector(state => state.data.customers);
  const orders = useAppSelector(state => state.data.orders);
  const accountsById = useAppSelector(state => state.data.retailerAccounts);
  const accounts = React.useMemo(() => Object.values(accountsById || {}), [accountsById]);
  const shopName = useAppSelector(state => (state.data.shopDetails as any)?.shopName);

  const { t, language } = useTranslation();
  const meltEnabled = useOldGoldMelt();
  const insets = useSafeAreaInsets();

  const [duesFilter, setDuesFilter] = React.useState<DuesFilter>('all');

  /**
   * The rate the shop is dealing at today, and how it got there. Every price
   * here and in the order flow reads through this, so they cannot disagree.
   */
  const shopRate = useShopRate();
  const dailyPrompt = useDailyRatePrompt();
  const [rateModalOpen, setRateModalOpen] = React.useState(false);

  /** Lots weighed into the pot but not yet tested: work still owed today. */
  const openLotCount = useAppSelector(
    s => s.data.meltLots.filter(l => l.status !== 'tested').length,
  );
  const [refreshing, setRefreshing] = React.useState(false);
  const [exitModalVisible, setExitModalVisible] = React.useState(false);
  const [languageSheetOpen, setLanguageSheetOpen] = React.useState(false);
  const [languageAnchor, setLanguageAnchor] = React.useState<PopoverAnchor | null>(null);
  const languageRef = React.useRef<any>(null);

  useFocusEffect(
    React.useCallback(() => {
      if (LAYOUT.isWeb) return;

      const onBackPress = () => {
        setExitModalVisible(true);
        return true;
      };

      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [])
  );

  const handleExitConfirm = React.useCallback(() => {
    setExitModalVisible(false);
    BackHandler.exitApp();
  }, []);

  const handleExitCancel = React.useCallback(() => setExitModalVisible(false), []);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      dispatch(fetchCustomers({ force: true })),
      dispatch(fetchOrders({ force: true })),
      dispatch(fetchMetalRates({ force: true })),
      dispatch(fetchRetailerAccounts()),
    ]);
    setRefreshing(false);
  }, [dispatch]);

  React.useEffect(() => {
    dispatch(fetchCustomers());
    dispatch(fetchOrders());
    dispatch(fetchMetalRates());
    dispatch(fetchRetailerAccounts());
    // Only the open ones: the row below is about what is still in the pot.
    dispatch(fetchMeltLots({ status: 'open' }));
  }, [dispatch]);

  /** The "whose is it" list behind Held for retailers. */
  const [heldOpen, setHeldOpen] = React.useState(false);
  const heldByRetailer = React.useMemo(
    () => accounts
      .filter(a => (a.meltCredit || 0) >= WEIGHT_SETTLED_EPSILON_GM
        || (a.silverHeld || 0) >= WEIGHT_SETTLED_EPSILON_GM
        || (a.heldCash || 0) >= CASH_SETTLED_EPSILON)
      // Biggest cash first, then metal: the order a shopkeeper asks about it.
      .sort((a, b) => (b.heldCash || 0) - (a.heldCash || 0)
        || (b.meltCredit || 0) - (a.meltCredit || 0)
        || (b.silverHeld || 0) - (a.silverHeld || 0)),
    [accounts],
  );

  const customerById = React.useMemo(
    () => new Map<string, any>(customers.map((c: any) => [String(c.id), c])),
    [customers],
  );

  /**
   * What every retailer still owes, through utils/dues.ts, the one definition
   * the Retailers list and the retailer screen also use. Never
   * `estimatedBalance`, which prices the metal into rupees and so counts the
   * same debt twice beside the weight (see AGENTS.md).
   *
   * Trashed orders are left out, as the Retailers list and the retailer screen
   * already did. The SoneBill-era dashboard counted them, so a trashed pending
   * sale inflated the totals here and nowhere else.
   */
  const dues = React.useMemo(() => {
    const byRetailer = new Map<string, { id: string; name: string; cash: number; gold: number; silver: number }>();
    let totalCash = 0;
    let totalGold = 0;
    let totalSilver = 0;

    orders.forEach((o: any) => {
      if (o.deletedAt) return;
      const due = orderOutstanding(o);
      if (!hasOutstanding(due)) return;

      totalCash += due.cash;
      totalGold += due.gold;
      totalSilver += due.silver;

      const id = String(o.customerId || '');
      const existing = byRetailer.get(id);
      if (existing) {
        existing.cash += due.cash;
        existing.gold += due.gold;
        existing.silver += due.silver;
        return;
      }

      const customer = customerById.get(id);
      byRetailer.set(id, {
        id,
        // Same fallback the orders list uses for an order whose customer record
        // is missing or has not loaded yet.
        name: customer?.name || 'Unknown',
        cash: due.cash,
        gold: due.gold,
        silver: due.silver,
      });
    });

    return { totalCash, totalGold, totalSilver, list: [...byRetailer.values()] };
  }, [orders, customerById]);

  /**
   * The balances under the active filter, biggest first by the column being
   * looked at, so the order of the rows matches the figures on show.
   */
  const visibleDues = React.useMemo(() => {
    const rows = dues.list.filter(r =>
      duesFilter === 'cash' ? r.cash > 0
        : duesFilter === 'gold' ? r.gold > 0
          : duesFilter === 'silver' ? r.silver > 0
            : true,
    );
    return rows.sort((a, b) =>
      duesFilter === 'cash'
        ? b.cash - a.cash || b.gold - a.gold
        : duesFilter === 'silver'
          ? b.silver - a.silver || b.cash - a.cash
          : b.gold - a.gold || b.cash - a.cash,
    );
  }, [dues.list, duesFilter]);

  const recent = React.useMemo(
    () => buildDayBook(orders, accounts).slice(0, RECENT_LIMIT),
    [orders, accounts],
  );

  /** What the shop holds for retailers, across all of them. Server balances,
   *  only added up; see OwedSummary for why it is never netted off a due. */
  const held = React.useMemo(
    () => accounts.reduce(
      (sum, a) => ({
        gold: sum.gold + (a.meltCredit || 0),
        cash: sum.cash + (a.heldCash || 0),
        silver: sum.silver + (a.silverHeld || 0),
      }),
      { gold: 0, cash: 0, silver: 0 },
    ),
    [accounts],
  );

  const gramShort = t('common.gramShort') || 'gm';

  return (
    <View style={styles.screen}>
      <LedgerHeader
        title={shopName || t('appName') || 'Gold Khata Book'}
        subtitle={longDate(new Date(), language)}
        right={
          <LedgerHeaderAction
            ref={languageRef}
            icon={Globe}
            label={String(language || 'en').toUpperCase()}
            accessibilityLabel={t('language.title')}
            onPress={() => {
              // Measured rather than derived: the header's height depends on
              // the safe-area inset and the impersonation banner, and the
              // popover's horizontal placement needs the real rect too.
              languageRef.current?.measureInWindow?.(
                (x: number, y: number, width: number, height: number) => {
                  setLanguageAnchor({ x, y, width, height });
                  setLanguageSheetOpen(true);
                },
              );
            }}
          />
        }
      />

      <RateStrip
        t={t}
        rate={shopRate.rate}
        isOverride={shopRate.isOverride}
        liveRate={shopRate.liveRate}
        onPress={() => setRateModalOpen(true)}
      />

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Brand.primary]} />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 32, ...contentStyle }}
      >
        <View style={styles.body}>
          <OwedSummary
            t={t}
            gold={dues.totalGold}
            cash={dues.totalCash}
            silver={dues.totalSilver}
            owingCount={dues.list.length}
            heldGold={held.gold}
            heldCash={held.cash}
            heldSilver={held.silver}
            onHeldPress={() => setHeldOpen(true)}
            onPress={() => navigation.navigate('Customers')}
          />

          {/* Lots still waiting on a reading. Above the balances because it is
              work in the shop today, with metal physically in the pot.
              Hidden at zero, and for shops that do not melt. */}
          {meltEnabled && openLotCount > 0 && (
            <Pressable onPress={() => navigation.navigate('MeltLots')} style={[styles.card, styles.meltRow]}>
              <View style={[styles.entryIcon, { backgroundColor: Brand.goldSoft }]}>
                <Flame size={16} color={Brand.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{t('melt.openLotsTitle') || 'Old gold in the pot'}</Text>
                <Text style={styles.rowCode}>{openLotCount} {t('melt.openLots') || 'lots open'}</Text>
              </View>
              <ChevronRight size={16} color={Brand.inkFaint} />
            </Pressable>
          )}

          {/* Renders nothing unless the review SDK says it is due. Below the
              balances' summary so it never displaces what people came to read. */}
          <RateAppCard />

          <View style={styles.card}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{t('khata.balances') || 'Retailer balances'}</Text>
              <FilterTabs
                value={duesFilter}
                onChange={setDuesFilter}
                showSilver={dues.totalSilver > 0}
                labels={{
                  all: t('dashboard.dues.all') || 'All',
                  gold: t('dashboard.dues.gold') || 'Gold',
                  silver: t('dashboard.dues.silver') || 'Silver',
                  cash: t('dashboard.dues.cash') || 'Cash',
                }}
              />
            </View>

            {/* The column says what the tab picked: what each retailer owes
                in that, or under All, everything they owe. */}
            <View style={styles.tableHead}>
              <Text style={[styles.colName, styles.th]}>{t('khata.colRetailer') || 'Retailer'}</Text>
              <Text style={[duesFilter === 'all' ? styles.colOwesHead : styles.colOne, styles.th]}>
                {duesFilter === 'gold'
                  ? (t('khata.colGoldOwed') || 'Gold owed')
                  : duesFilter === 'silver'
                    ? (t('khata.colSilverOwed') || 'Silver owed')
                    : duesFilter === 'cash'
                      ? (t('khata.colCashOwed') || 'Cash owed')
                      : (t('khata.colOwes') || 'Owes')}
              </Text>
              <View style={styles.colRemind} />
            </View>

            {visibleDues.length === 0 ? (
              <Text style={styles.empty}>
                {dues.list.length === 0
                  ? (t('khata.allSettled') || 'Every retailer is settled.')
                  : (t('dashboard.dues.empty') || 'No outstanding dues found.')}
              </Text>
            ) : (
              visibleDues.map(r => (
                <BalanceRow
                  key={r.id}
                  id={r.id}
                  name={r.name}
                  mode={duesFilter}
                  gold={r.gold}
                  cash={r.cash}
                  silver={r.silver}
                  labels={{
                    gold: t('dashboard.dues.gold') || 'Gold',
                    silver: t('dashboard.dues.silver') || 'Silver',
                    cash: t('dashboard.dues.cash') || 'Cash',
                  }}
                  heldGold={accountsById?.[r.id]?.meltCredit || 0}
                  heldSilver={accountsById?.[r.id]?.silverHeld || 0}
                  heldCash={accountsById?.[r.id]?.heldCash || 0}
                  heldLabel={t('khata.holds') || 'Holds'}
                  gramShort={gramShort}
                  onPress={() => navigation.navigate('CustomerDetails', { customerId: r.id })}
                />
              ))
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{t('khata.recent') || 'Recent entries'}</Text>
              <Pressable onPress={() => navigation.navigate('Orders')} hitSlop={8} style={styles.linkRow}>
                <Text style={styles.link}>{t('khata.openDayBook') || 'Open day book'}</Text>
                <ChevronRight size={14} color={Brand.primary} />
              </Pressable>
            </View>
            {recent.length === 0 ? (
              <Text style={styles.empty}>{t('khata.noEntries') || 'No entries yet. Tap + to record a sale.'}</Text>
            ) : (
              recent.map(e => (
                <EntryRow
                  key={e.id}
                  entry={e}
                  name={customerById.get(e.customerId)?.name || 'Unknown'}
                  t={t}
                  language={language}
                  onPress={() => (e.orderId
                    ? navigation.navigate('OrderDetails', { orderId: e.orderId })
                    : navigation.navigate('CustomerDetails', { customerId: e.customerId }))}
                />
              ))
            )}
          </View>
        </View>
      </ScrollView>

      <LanguagePopover
        isOpen={languageSheetOpen}
        onClose={() => setLanguageSheetOpen(false)}
        anchor={languageAnchor}
      />

      {/* Whose is it: each retailer with something left with the shop, and
          what. A tap opens their account, where it is used or handed back. */}
      <LedgerSheet
        visible={heldOpen}
        onClose={() => setHeldOpen(false)}
        title={t('khata.heldForRetailers') || 'Held for retailers'}
        subtitle={t('khata.heldSheetSub') || 'Advances they left with you, and cash waiting for a rate. Used on their dues, or handed back.'}
        closeLabel={t('common.close') || 'Close'}
      >
        {heldByRetailer.map(a => (
          <Pressable
            key={a.customerId}
            accessibilityRole="button"
            onPress={() => {
              setHeldOpen(false);
              navigation.navigate('CustomerDetails', { customerId: a.customerId });
            }}
            style={({ pressed }) => [styles.heldRow, pressed && { opacity: 0.6 }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.rowName} numberOfLines={2}>
                {customerById.get(String(a.customerId))?.name || 'Unknown'}
              </Text>
              <Text style={[styles.heldRowFigures, tabularNums]}>
                {heldParts(t, a.meltCredit || 0, a.silverHeld || 0, a.heldCash || 0).join('  ·  ')}
              </Text>
            </View>
            <ChevronRight size={16} color={Brand.inkFaint} />
          </Pressable>
        ))}
      </LedgerSheet>
      {/* One modal, two ways in: the once-a-day prompt and the rate strip.
          Closing the prompt records that today's question was asked, so it
          does not return this evening (see useDailyRatePrompt). */}
      <SetRateModal
        isOpen={rateModalOpen || dailyPrompt.visible}
        onClose={() => {
          setRateModalOpen(false);
          if (dailyPrompt.visible) dailyPrompt.dismiss();
        }}
        liveRate={shopRate.liveRate}
        currentOverride={shopRate.isOverride ? shopRate.rate : undefined}
      />

      <ExitAppModal
        visible={exitModalVisible}
        onConfirm={handleExitConfirm}
        onCancel={handleExitCancel}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Brand.paper,
  },
  body: {
    padding: 16,
    gap: 14,
  },

  rateStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.card,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.lineStrong,
    gap: 10,
  },
  rateLabel: {
    fontSize: 12,
    color: Brand.inkMuted,
  },
  rateValue: {
    fontSize: 19,
    fontWeight: '700',
    color: Brand.ink,
    marginTop: 1,
  },
  rateUnit: {
    fontSize: 13,
    fontWeight: '500',
    color: Brand.inkMuted,
  },
  rateSub: {
    fontSize: 11,
    color: Brand.inkMuted,
    marginTop: 1,
  },
  rateTag: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  rateTagLive: {
    backgroundColor: Brand.primarySoft,
  },
  rateTagYours: {
    backgroundColor: Brand.goldSoft,
  },
  rateTagText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rateChange: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.primary,
  },

  card: {
    backgroundColor: Brand.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Brand.line,
    padding: 16,
  },
  heroCard: {
    padding: 18,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  cardKicker: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  owedRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: 12,
  },
  owedCol: {
    flex: 1,
  },
  owedDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: Brand.lineStrong,
    marginHorizontal: 14,
  },
  owedLabel: {
    fontSize: 13,
    color: Brand.inkMuted,
  },
  owedValue: {
    fontSize: 26,
    fontWeight: '700',
    marginTop: 4,
  },
  owedFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Brand.line,
  },
  owedFooterText: {
    fontSize: 13,
    color: Brand.inkMuted,
  },
  heldBox: {
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Brand.receivedSoft,
    gap: 4,
  },
  heldTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heldHint: {
    flexShrink: 1,
    fontSize: 11,
    color: Brand.received,
    marginRight: 10,
  },
  heldLink: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.received,
  },
  heldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.line,
  },
  heldRowFigures: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: '700',
    color: Brand.received,
  },
  heldStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Brand.receivedSoft,
  },
  heldStripLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.received,
    marginRight: 10,
  },
  heldStripValue: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
    color: Brand.received,
  },
  rowHeld: {
    fontSize: 11,
    fontWeight: '600',
    color: Brand.received,
    marginTop: 2,
  },

  meltRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Brand.ink,
    flexShrink: 1,
    marginRight: 8,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 14,
  },
  filterTab: {
    alignItems: 'center',
    paddingTop: 4,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
    color: Brand.inkMuted,
  },
  filterTextActive: {
    color: Brand.primary,
    fontWeight: '700',
  },
  filterLine: {
    height: 2,
    alignSelf: 'stretch',
    marginTop: 4,
    backgroundColor: 'transparent',
  },
  filterLineActive: {
    backgroundColor: Brand.goldFill,
  },

  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Brand.line,
  },
  th: {
    fontSize: 11,
    fontWeight: '700',
    color: Brand.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  colName: {
    flex: 1,
    paddingRight: 8,
  },
  // One due under the Gold, Silver or Cash tab.
  colOne: {
    width: 120,
    textAlign: 'right',
  },
  // Every due under All, one labelled line each.
  colOwes: {
    width: 156,
    alignItems: 'flex-end',
    gap: 2,
  },
  colOwesHead: {
    width: 156,
    textAlign: 'right',
  },
  owesLine: {
    textAlign: 'right',
  },
  owesLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Brand.inkMuted,
  },
  colRemind: {
    width: 40,
    alignItems: 'flex-end',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.line,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '600',
    color: Brand.ink,
  },
  // Small muted line under a title: the melt lots count.
  rowCode: {
    fontSize: 12,
    color: Brand.inkMuted,
    marginTop: 1,
  },
  rowFigure: {
    fontSize: 14,
    fontWeight: '700',
  },

  entryIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  link: {
    fontSize: 13,
    fontWeight: '700',
    color: Brand.primary,
  },
  empty: {
    fontSize: 14,
    color: Brand.inkMuted,
    textAlign: 'center',
    paddingVertical: 20,
  },
});

export default DashboardScreen;

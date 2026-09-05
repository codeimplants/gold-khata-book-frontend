// src/screens/dashboard/DashboardScreen.tsx
import React from 'react';
import { StyleSheet, RefreshControl, Image, BackHandler } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Box,
  HStack,
  VStack,
  Text,
  Pressable,
  ScrollView,
  Icon,
  Center,
} from '@gluestack-ui/themed';
import {
  TrendingUp,
  Plus,
  Users,
  ChevronRight,
  FileText,
  Globe,
  Wallet,
  Coins,
} from 'lucide-react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../navigation/types';

import { useTranslation } from '../../hooks/useTranslation';
import { useOldGoldMelt } from '../../hooks/useOldGoldMelt';
import RemindButton from '../../components/customers/RemindButton';
import SetRateModal from '../../components/common/SetRateModal';
import { useShopRate } from '../../hooks/useShopRate';
import { useDailyRatePrompt } from '../../hooks/useDailyRatePrompt';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  fetchCustomers,
  fetchOrders,
  fetchMetalRates,
  fetchMeltLots,
} from '../../store/data/dataSlice';
import AddCustomerModal from '../../components/AddCustomerModal';
import ExitAppModal from '../../components/ExitAppModal';
import GradientSurface from '../../components/common/GradientSurface';
import RateAppCard from '../../components/common/RateAppCard';
import LanguagePopover, { type PopoverAnchor } from '../../components/common/LanguagePopover';
import { LAYOUT, useContentContainerStyle } from '../../constants/layout';
import { BannerHeightContext } from '../../navigation/MainTabs';
import { orderOutstanding, hasOutstanding, formatGrams } from '../../utils/dues';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

/* ---------------- HELPER COMPONENTS ---------------- */

function Header({
  t,
  languageCode,
  onPressLanguage,
}: {
  t: any;
  languageCode: string;
  /** Receives the measured window rect of the globe the popover hangs off. */
  onPressLanguage: (anchor: PopoverAnchor) => void;
}) {
  const anchorRef = React.useRef<any>(null);
  const insets = useSafeAreaInsets();
  const bannerHeight = React.useContext(BannerHeightContext);
  // Must match the scroll content below, or the header contents sit off-centre
  // from the body on iPad.
  const contentStyle = useContentContainerStyle();
  // When banner is active the spacer already pushed Tab.Navigator below it,
  // so the header needs no extra top padding. Without banner, clear the status bar.
  const topPad = LAYOUT.isWeb ? 0 : (bannerHeight > 0 ? 0 : insets.top);

  return (
    <Box height={84 + topPad} overflow="hidden">
      <GradientSurface colors={['#6366F1', '#D946EF', '#6366F1']} direction="horizontal" />

      <HStack
        px="$5"
        alignItems="center"
        justifyContent="space-between"
        flex={1}
        style={{
          ...contentStyle,
          paddingTop: topPad,
        }}
      >
        {/* Left — logo */}
        <Box w={42} h={42} rounded="$xl" overflow="hidden">
          <Image
            source={require('../../../assets/logo.png')}
            style={{ width: 42, height: 42, borderRadius: 12 }}
            resizeMode="cover"
            alt="Gold Khata Book"
          />
        </Box>

        {/* Center — app name */}
        <Text fontWeight="$bold" fontSize={20} color="$white">
          {t('appName')}
        </Text>

        {/* Right — app language. Replaced a bell that had no onPress and
            notified nothing; this is the shortcut to Settings → Language, which
            remains the full control. The code is shown so the current language
            is readable without opening anything. */}
        <Pressable
          ref={anchorRef}
          h={42}
          px="$3"
          flexDirection="row"
          alignItems="center"
          justifyContent="center"
          rounded="$full"
          bg="rgba(255,255,255,0.1)"
          onPress={() => {
            // Measured rather than derived: the header's height depends on the
            // safe-area inset and the impersonation banner, and recomputing that
            // inside the popover would drift the moment either changes. The
            // horizontal rect matters too — see LanguagePopover.
            anchorRef.current?.measureInWindow?.(
              (x: number, y: number, width: number, height: number) =>
                onPressLanguage({ x, y, width, height }),
            );
          }}
          accessibilityLabel={t('language.title')}
        >
          <Icon as={Globe} color="$white" size="md" />
          <Text color="$white" fontWeight="$bold" fontSize={13} ml="$1.5">
            {String(languageCode || 'en').toUpperCase()}
          </Text>
        </Pressable>
      </HStack>
    </Box>
  );
}

const RateCard = React.memo(({ colors, title, price, sub }: any) => {
  const gid = React.useMemo(() => `grad_${Math.random().toString(16).slice(2)}`, []);

  return (
    <Box flex={1} rounded="$2xl" overflow="hidden">
      <Svg width="100%" height={100}>
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors[0]} />
            <Stop offset="1" stopColor={colors[1]} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height={100} fill={`url(#${gid})`} rx="20" />
      </Svg>

      <Box position="absolute" p="$4">
        <Text color="$white" fontSize={13} opacity={0.9}>
          {title}
        </Text>
        <Text color="$white" fontWeight="$bold" fontSize={22}>
          {price}
        </Text>
        <Text color="$white" fontSize={12} opacity={0.75}>
          {sub}
        </Text>
      </Box>
    </Box>
  );
});

/** Indian-format currency, no decimals — matches web (₹2,76,581). */
const inr = (n: number) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

/**
 * Forces the label under each dues-tile icon to reserve two lines' height,
 * whether or not the translation needs them, so the figure below always
 * starts at the same y across a row of tiles. The Marathi, Hindi and Gujarati
 * labels here ("एकूण रोख बाकी") are longer than the English and wrap even where
 * English does not, so two lines is the normal case rather than the exception.
 * Without it, a tile whose label fits on one line sits visibly shorter than
 * its neighbour and the row's bottom edge steps.
 */
const LABEL_LINE_HEIGHT = 18;

/** One of the two totals above the dues list — cash owed, or gold owed. */
const DuesTile = ({
  icon,
  label,
  value,
  bg,
  borderColor,
  fg,
  iconColor,
}: {
  icon: any;
  label: string;
  value: string;
  bg: string;
  borderColor: string;
  fg: string;
  iconColor: string;
}) => (
  <Box
    flex={1}
    bg={bg}
    rounded="$2xl"
    p="$4"
    borderWidth={1}
    borderColor={borderColor}
    alignItems="center"
  >
    <Icon as={icon} color={iconColor} size="sm" />
    <Text
      color={fg}
      fontWeight="$medium"
      fontSize={13}
      lineHeight={LABEL_LINE_HEIGHT}
      numberOfLines={2}
      mt="$1"
      textAlign="center"
      style={{ minHeight: LABEL_LINE_HEIGHT * 2 }}
    >
      {label}
    </Text>
    {/* adjustsFontSizeToFit rather than wrapping: a lakh-plus figure in a
        half-width tile ("₹12,45,600") has nowhere to break that reads as a
        number, so it shrinks instead. */}
    <Text
      fontSize={22}
      fontWeight="$bold"
      mt="$2"
      color={fg}
      textAlign="center"
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {value}
    </Text>
  </Box>
);

/** All / Cash / Gold. Which dimension of the dues list is being looked at. */
type DuesFilter = 'all' | 'cash' | 'gold';

const DuesFilterTabs = ({
  value,
  onChange,
  labels,
}: {
  value: DuesFilter;
  onChange: (next: DuesFilter) => void;
  labels: Record<DuesFilter, string>;
}) => (
  <HStack bg="#F3F4F6" rounded="$full" p="$0.5">
    {(['all', 'cash', 'gold'] as DuesFilter[]).map(key => {
      const active = value === key;
      return (
        <Pressable
          key={key}
          onPress={() => onChange(key)}
          px="$3"
          py="$1.5"
          rounded="$full"
          bg={active ? '$white' : 'transparent'}
          style={active ? styles.card : undefined}
          accessibilityRole="button"
          accessibilityState={{ selected: active }}
        >
          <Text
            fontSize={13}
            fontWeight={active ? '$bold' : '$medium'}
            color={active ? '#4338CA' : '$coolGray500'}
          >
            {labels[key]}
          </Text>
        </Pressable>
      );
    })}
  </HStack>
);

/**
 * One retailer's outstanding position.
 *
 * Cash and gold are shown as separate figures rather than combined into a
 * rupee total: converting grams to rupees needs a rate, and the rate on the
 * day the metal is actually returned is not the rate today. Showing "owes
 * 3.250 gm" is a fact; showing its rupee equivalent would be a guess that
 * changes every time the rate does.
 */
const RetailerDuesRow = ({
  id,
  name,
  code,
  cash,
  gold,
  gramShort,
  onPress,
}: {
  /** Needed only by the Remind action — the row itself navigates by it too. */
  id?: string;
  name: string;
  code?: string;
  cash: number;
  gold: number;
  gramShort: string;
  onPress: () => void;
}) => (
  <Pressable onPress={onPress}>
    <HStack alignItems="center" justifyContent="space-between" py="$3">
      <VStack flex={1} pr="$3">
        <Text fontWeight="$medium" fontSize={15} color="#111827" numberOfLines={1}>
          {name}
        </Text>
        {!!code && (
          <Text fontSize={12} color="$coolGray500" numberOfLines={1}>
            {code}
          </Text>
        )}
      </VStack>

      {/* Only the dimensions actually owed are printed. A retailer who owes
          cash but no metal shows one figure, not a "0.000 gm" that reads as a
          debt of nothing. */}
      <VStack alignItems="flex-end">
        {cash > 0 && (
          <Text fontWeight="$bold" fontSize={15} color="#4338CA" numberOfLines={1}>
            {inr(cash)}
          </Text>
        )}
        {gold > 0 && (
          <Text fontWeight="$bold" fontSize={15} color="#B45309" numberOfLines={1}>
            {formatGrams(gold, gramShort)}
          </Text>
        )}
      </VStack>

      {/* This list exists to answer "who owes me"; chasing them is the next
          thing anyone does with that answer, so the action belongs on the row
          rather than two taps away inside the retailer. Icon only — the row
          already carries a name, two figures and a chevron. */}
      <Box ml="$3">
        <RemindButton customerId={id} compact />
      </Box>

      <Icon as={ChevronRight} size="sm" color="$coolGray400" ml="$1" />
    </HStack>
  </Pressable>
);

/* ---------------- MAIN SCREEN ---------------- */

const DashboardScreen = () => {
  const navigation: any = useNavigation<NavProp>();
  const dispatch = useAppDispatch();
  // Centres and caps content on iPad; no-op on phones.
  const contentStyle = useContentContainerStyle();

  // Granular Selectors for Performance
  const customers = useAppSelector(state => state.data.customers);
  const orders = useAppSelector(state => state.data.orders);

  const { t, language } = useTranslation();
  const meltEnabled = useOldGoldMelt();
  const insets = useSafeAreaInsets();

  const [fabOpen, setFabOpen] = React.useState(false);
  const [duesFilter, setDuesFilter] = React.useState<DuesFilter>('all');

  /**
   * The rate the shop is dealing at today, and how it got there.
   *
   * Every price on this screen and in the order flow reads through this so
   * they cannot disagree about what today's rate is. `isOverride` decides what
   * the card says, and it says it plainly: a shop trading on the live feed
   * should be able to see that at a glance, not infer it.
   */
  const shopRate = useShopRate();
  const dailyPrompt = useDailyRatePrompt();
  const [rateModalOpen, setRateModalOpen] = React.useState(false);

  /** Lots weighed into the pot but not yet tested — work still owed today. */
  const openLotCount = useAppSelector(
    s => s.data.meltLots.filter(l => l.status !== 'tested').length,
  );
  const [refreshing, setRefreshing] = React.useState(false);
  const [customerModalOpen, setCustomerModalOpen] = React.useState(false);
  const [exitModalVisible, setExitModalVisible] = React.useState(false);
  const [languageSheetOpen, setLanguageSheetOpen] = React.useState(false);
  const [languageAnchor, setLanguageAnchor] = React.useState<PopoverAnchor | null>(null);

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
    ]);
    setRefreshing(false);
  }, [dispatch]);

  React.useEffect(() => {
    dispatch(fetchCustomers());
    dispatch(fetchOrders());
    dispatch(fetchMetalRates());
    // Only the open ones — the card below is about what is still in the pot.
    dispatch(fetchMeltLots({ status: 'open' }));
  }, [dispatch]);

  /**
   * What every retailer still owes, from the orders already in the store.
   *
   * A retailer carries two independent balances, and they are read from the
   * server rather than recomputed here so "still owed" has one definition,
   * where the payment and old-gold arithmetic that produces it already lives:
   *
   *   - metal, as `remainingWeight` (grams)
   *   - cash,  as `outstandingCash` (making, other charges, GST)
   *
   * Deliberately NOT `estimatedBalance`. That field is both accounts priced as
   * a single rupee figure — `remainingWeight * rate + outstandingCash` — so
   * pairing it with the weight showed one debt twice: a retailer owing 5 gm
   * appeared as "5.000 gm" AND "Rs.75,000", which is the same 5 gm counted
   * again in rupees.
   *
   * Only `pending` advance orders count. A full-payment order is settled when
   * it is raised, and a cancelled one is not owed at all.
   */
  const dues = React.useMemo(() => {
    const customerById = new Map<string, any>(
      customers.map((c: any) => [String(c.id), c]),
    );

    const byRetailer = new Map<
      string,
      { id: string; name: string; code?: string; cash: number; gold: number }
    >();
    let totalCash = 0;
    let totalGold = 0;

    orders.forEach(o => {
      const due = orderOutstanding(o);
      if (!hasOutstanding(due)) return;

      totalCash += due.cash;
      totalGold += due.gold;

      const id = String(o.customerId || '');
      const existing = byRetailer.get(id);
      if (existing) {
        existing.cash += due.cash;
        existing.gold += due.gold;
        return;
      }

      const customer = customerById.get(id);
      byRetailer.set(id, {
        id,
        // Same fallback the orders list uses for an order whose customer record
        // is missing or has not loaded yet.
        name: customer?.name || 'Unknown',
        code: customer?.customerCode,
        cash: due.cash,
        gold: due.gold,
      });
    });

    return { totalCash, totalGold, list: [...byRetailer.values()] };
  }, [orders, customers]);

  /**
   * The dues list under the active filter, biggest exposure first.
   *
   * Sorted by whichever dimension is being filtered on, so the order of the
   * rows always matches the figures the filter is showing — sorting the Gold
   * tab by cash would put the largest gold debt anywhere in the list.
   */
  const visibleDues = React.useMemo(() => {
    const rows = dues.list.filter(r =>
      duesFilter === 'cash' ? r.cash > 0 : duesFilter === 'gold' ? r.gold > 0 : true,
    );

    return rows.sort((a, b) =>
      duesFilter === 'gold'
        ? b.gold - a.gold || b.cash - a.cash
        : b.cash - a.cash || b.gold - a.gold,
    );
  }, [dues.list, duesFilter]);

  return (
    <Box flex={1} bg="$coolGray50">
      <Header
        t={t}
        languageCode={language}
        onPressLanguage={anchor => {
          setLanguageAnchor(anchor);
          setLanguageSheetOpen(true);
        }}
      />

      <ScrollView
        flex={1}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#6366F1']}
          />
        }
        contentContainerStyle={{
          paddingBottom: insets.bottom + 100,
          ...contentStyle
        }}
      >
        <VStack space="lg" p="$4">
          {/* Rates */}
          <Box bg="$white" p="$4" rounded="$2xl" borderWidth={1} borderColor="#E5E7EB" style={styles.card}>
            <HStack alignItems="center" justifyContent="space-between" mb="$3">
              <HStack space="sm" alignItems="center">
                <Icon as={TrendingUp} size="sm" />
                <Text fontWeight="$bold"> {t('dashboard.todayRates')}</Text>
              </HStack>

              <Pressable onPress={() => navigation.navigate('MetalRates')} px="$3" py="$1.5">
                <HStack space="sm" alignItems="center">
                  <Text fontWeight="$medium" color="#6366F1">{t('dashboard.viewAll') || 'View All'}</Text>
                  <Icon as={ChevronRight} size="sm" color="#6366F1" />
                </HStack>
              </Pressable>
            </HStack>

            {/* One rate, because there is only one.
                
                Every position in this app is denominated in fine gold at
                99.50, and cash settles it at this rate — so a second card for
                silver, or for any other purity, would be quoting a price
                nothing here is ever struck at. The card is full width now that
                it is alone rather than left in a half-width slot with a gap
                beside it. */}
            <Pressable onPress={() => setRateModalOpen(true)}>
              <RateCard
                colors={['#FBBF24', '#F97316']}
                title={t('dashboard.gold24')}
                price={inr(shopRate.rate || 7850)}
                sub={t('dashboard.per1gm')}
              />
            </Pressable>

            {/* Which rate is in force, said out loud.
                A shop trading on the market feed and one trading at a rate the
                owner set look identical otherwise, and the difference is every
                bill raised today. Tapping either state opens the same sheet. */}
            <Pressable onPress={() => setRateModalOpen(true)} mt="$3">
              <HStack alignItems="center" justifyContent="space-between">
                {shopRate.isOverride ? (
                  <Text fontSize={12} color="#15803D" flex={1}>
                    {t('rate.usingYours') || 'Your rate for today'}
                    {shopRate.liveRate > 0 && (
                      `  ·  ${t('rate.liveIs') || 'Live rate'} ${inr(shopRate.liveRate)}`
                    )}
                  </Text>
                ) : (
                  <Text fontSize={12} color="$coolGray500" flex={1}>
                    {t('rate.usingLive') || 'Using the live rate — tap to set your own'}
                  </Text>
                )}
                <Text fontSize={12} fontWeight="$bold" color="#6366F1">
                  {shopRate.isOverride ? (t('rate.change') || 'Change') : (t('rate.set') || 'Set')}
                </Text>
              </HStack>
            </Pressable>
          </Box>

          {/* Sits below the rates rather than above them: it is dismissible and only
              appears occasionally, so it should never displace what people opened the
              dashboard to read. Renders nothing unless the SDK says it is due. */}
          <RateAppCard />

          {/* Totals. alignItems stretch (the default) only equalises the
              Pressables; each tile's Box carries flex={1} so it fills the one it
              sits in, which is what keeps the row's bottom edge straight. */}
          <HStack space="md" alignItems="stretch">
            <DuesTile
              icon={Wallet}
              label={t('dashboard.dues.totalCash')}
              value={inr(dues.totalCash)}
              bg="#EEF2FF"
              borderColor="#C7D2FE"
              fg="#4338CA"
              iconColor="#6366F1"
            />

            <DuesTile
              icon={Coins}
              label={t('dashboard.dues.totalGold')}
              value={formatGrams(dues.totalGold, t('common.gramShort') || 'gm')}
              bg="#FFFBEB"
              borderColor="#FDE68A"
              fg="#B45309"
              iconColor="#D97706"
            />
          </HStack>

          {/* Lots still waiting on a reading.
              Above the dues list because it is work in the shop TODAY — metal
              physically in the pot with a weighing outstanding — where dues are
              money to chase whenever there is time. Hidden at zero: a shop with
              nothing in the pot does not need a row saying so, and melt is off
              entirely for shops that do not do it. */}
          {meltEnabled && openLotCount > 0 && (
            <Pressable onPress={() => navigation.navigate('MeltLots')} mb="$4">
              <Box
                bg="#FFFBEB"
                p="$4"
                rounded="$2xl"
                borderWidth={1}
                borderColor="#FDE68A"
                style={styles.card}
              >
                <HStack alignItems="center" space="md">
                  <Box w={40} h={40} rounded="$full" bg="#FEF3C7" alignItems="center" justifyContent="center">
                    <Icon as={Coins} size="sm" color="#B45309" />
                  </Box>
                  <VStack flex={1}>
                    <Text fontWeight="$bold" color="#92400E">
                      {t('melt.openLotsTitle') || 'Old gold in the pot'}
                    </Text>
                    <Text fontSize={12} color="#B45309">
                      {openLotCount} {t('melt.openLots') || 'lots open'}
                    </Text>
                  </VStack>
                  <Icon as={ChevronRight} size="sm" color="#B45309" />
                </HStack>
              </Box>
            </Pressable>
          )}

          {/* Retailer dues */}
          <Box
            bg="$white"
            p="$4"
            rounded="$2xl"
            borderWidth={1}
            borderColor="#E5E7EB"
            style={styles.card}
          >
            <HStack alignItems="center" justifyContent="space-between" mb="$2">
              <HStack space="sm" alignItems="center" flexShrink={1}>
                <Icon as={Users} size="sm" />
                <Text fontWeight="$bold" numberOfLines={1}>
                  {t('dashboard.dues.listTitle')}
                </Text>
              </HStack>

              <DuesFilterTabs
                value={duesFilter}
                onChange={setDuesFilter}
                labels={{
                  all: t('dashboard.dues.all'),
                  cash: t('dashboard.dues.cash'),
                  gold: t('dashboard.dues.gold'),
                }}
              />
            </HStack>

            {visibleDues.length === 0 ? (
              <Center py="$6">
                <Text fontSize={14} color="$coolGray500" textAlign="center">
                  {t('dashboard.dues.empty')}
                </Text>
              </Center>
            ) : (
              <VStack>
                {visibleDues.map((r, index) => (
                  <Box
                    key={r.id || String(index)}
                    borderTopWidth={index === 0 ? 0 : 1}
                    borderColor="#F3F4F6"
                  >
                    <RetailerDuesRow
                      id={r.id}
                      name={r.name}
                      code={r.code}
                      cash={r.cash}
                      gold={r.gold}
                      gramShort={t('common.gramShort') || 'gm'}
                      onPress={() =>
                        navigation.navigate('CustomerDetails', { customerId: r.id })
                      }
                    />
                  </Box>
                ))}
              </VStack>
            )}
          </Box>
        </VStack>
      </ScrollView>

      {/* Backdrop — sibling of the FAB anchor (not nested inside it) so the
          0/0/0/0 insets resolve against the screen-filling root Box instead
          of the FAB's own shrink-to-fit corner box. The old approach anchored
          this inside the right-aligned FAB Box and faked full coverage with
          -1000 offsets, which only reaches ~1000px past the anchor — plenty
          for a phone screen but leaves the far side of a wide desktop window
          uncovered. */}
      {fabOpen && (
        <Pressable
          position="absolute"
          top={0} bottom={0} left={0} right={0}
          bg="rgba(0,0,0,0.25)"
          onPress={() => setFabOpen(false)}
        />
      )}

      {/* FAB SECTION */}
      <Box position="absolute" bottom={20} right={20} alignItems="flex-end">
        {fabOpen && (
          <VStack space="md" mb="$4">
            <Pressable onPress={() => { setFabOpen(false); setCustomerModalOpen(true); }}>
              <HStack bg="$white" px="$4" py="$3" rounded="$full" alignItems="center" space="md" style={{ elevation: 4 }}>
                <Text fontWeight="$medium">{t('dashboard.fab.newRetailer')}</Text>
                <Box w={40} h={40} rounded="$full" justifyContent="center" alignItems="center" bg="#14B8A6">
                  <Icon as={Users} color="$white" />
                </Box>
              </HStack>
            </Pressable>

            {/* Taking old gold in is its own action, not a mode of New Order.
                A retailer brings ornaments on a day when there is no bill to
                put them against; making him wait for one, or inventing an
                empty order to hang the lot off, is not how the counter works.
                Spending the credit lives on the order screen, where the bill
                it comes off is. */}
            {meltEnabled && (
              <Pressable onPress={() => { setFabOpen(false); navigation.navigate('MeltLots'); }}>
                <HStack bg="$white" px="$4" py="$3" rounded="$full" alignItems="center" space="md" style={{ elevation: 4 }}>
                  <Text fontWeight="$medium">{t('melt.fabTitle') || 'Take Old Gold'}</Text>
                  <Box w={40} h={40} rounded="$full" justifyContent="center" alignItems="center" bg="#F59E0B">
                    <Icon as={Coins} color="$white" />
                  </Box>
                </HStack>
              </Pressable>
            )}

            <Pressable onPress={() => { setFabOpen(false); navigation.navigate('NewOrder'); }}>
              <HStack bg="$white" px="$4" py="$3" rounded="$full" alignItems="center" justifyContent="space-between" space="md" style={{ elevation: 4 }}>
                <Text fontWeight="$medium">{t('dashboard.fab.newOrder')}</Text>
                <Box w={40} h={40} rounded="$full" justifyContent="center" alignItems="center">
                  <Svg width="40" height="40">
                    <Defs><LinearGradient id="miniFabGrad" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#A855F7" /><Stop offset="1" stopColor="#D946EF" /></LinearGradient></Defs>
                    <Rect width="40" height="40" rx="20" fill="url(#miniFabGrad)" />
                  </Svg>
                  <Box position="absolute"><Icon as={FileText} color="$white" size="sm" /></Box>
                </Box>
              </HStack>
            </Pressable>
          </VStack>
        )}

        <Pressable onPress={() => setFabOpen(!fabOpen)} style={{ width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', elevation: 6 }}>
          <Svg width="64" height="64">
            <Defs><LinearGradient id="fabGrad" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#6366F1" /><Stop offset="1" stopColor="#D946EF" /></LinearGradient></Defs>
            <Rect width="64" height="64" rx="32" fill="url(#fabGrad)" />
          </Svg>
          <Box position="absolute"><Icon as={Plus} color="$white" size="xl" /></Box>
        </Pressable>
      </Box>
      <AddCustomerModal isOpen={customerModalOpen} onClose={() => setCustomerModalOpen(false)} />
      <LanguagePopover
        isOpen={languageSheetOpen}
        onClose={() => setLanguageSheetOpen(false)}
        anchor={languageAnchor}
      />
      {/* One modal, two ways in: the once-a-day prompt and the card above.
          Closing the prompt records that today's question was asked, so it
          does not return this evening — see useDailyRatePrompt. */}
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
    </Box>
  );
};

const styles = StyleSheet.create({
  card: {
    elevation: 2,
    shadowOpacity: 0.08,
  },
});

export default DashboardScreen;

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
  Clock,
  CheckCircle,
  Plus,
  Users,
  ChevronRight,
  FileText,
  Globe,
  Scale,
} from 'lucide-react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../navigation/types';

import { useTranslation } from '../../hooks/useTranslation';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  fetchCustomers,
  fetchOrders,
  fetchMetalRates,
  fetchPurchaseOldGold,
} from '../../store/data/dataSlice';
import OrderTypeModal from '../../components/OrderTypeModal';
import AddCustomerModal from '../../components/AddCustomerModal';
import ExitAppModal from '../../components/ExitAppModal';
import GradientSurface from '../../components/common/GradientSurface';
import RateAppCard from '../../components/common/RateAppCard';
import LanguagePopover, { type PopoverAnchor } from '../../components/common/LanguagePopover';
import { LAYOUT, useContentContainerStyle } from '../../constants/layout';
import { BannerHeightContext } from '../../navigation/MainTabs';
import { standalonePurchases } from '../../utils/oldGoldPurchases';

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
 * One of the order tiles on the dashboard — Pending, Completed, Sold to Us.
 *
 * The three were separate copies of the same markup and had drifted into a row
 * that did not line up. Three things were wrong, and all three only show up at a
 * third of the screen width:
 *
 * - The label sat in an HStack with no width constraint, so instead of wrapping
 *   inside the tile it ran past the rounded border.
 * - The inner Box sized to its own content rather than filling the stretched
 *   Pressable, so a tile whose label fitted on one line ("Sold to Us") was
 *   visibly shorter than its neighbours and the row's bottom edge stepped.
 * - With the labels on different line counts, the figures below them sat at
 *   different heights, so the numbers did not line up across the row either.
 *
 * `labelMinHeight` is what keeps the figures aligned: the label block always
 * occupies two lines whether or not the translation needs them. Marathi, Hindi
 * and Gujarati labels are longer than the English ones and wrap here even when
 * English does not, so two lines is the normal case rather than the exception.
 */
const LABEL_LINE_HEIGHT = 18;

const OrderStatTile = ({
  icon,
  label,
  count,
  total,
  bg,
  borderColor,
  fg,
  iconColor,
  onPress,
}: {
  icon: any;
  label: string;
  count: number;
  total: number;
  bg: string;
  borderColor: string;
  fg: string;
  iconColor: string;
  onPress: () => void;
}) => (
  <Pressable flex={1} onPress={onPress}>
    <Box
      flex={1}
      bg={bg}
      rounded="$2xl"
      p="$4"
      borderWidth={1}
      borderColor={borderColor}
      alignItems="center"
    >
      {/* The icon sits above the label rather than beside it. Inline, it took
          enough of a third-width tile that "Completed Orders" had nowhere to
          break and split mid-word as "Complete / d Orders"; on its own row the
          label gets the full tile width and breaks between words. Longer
          Marathi and Gujarati labels need that width even more than English. */}
      <Icon as={icon} color={iconColor} size="sm" />
      {/* textAlign as well as the parent's alignItems: centring the box centres
          a wrapped label's two lines as a block, not the text within them. */}
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
      <Text fontSize={26} fontWeight="$bold" mt="$2" color={fg} textAlign="center">
        {count}
      </Text>
      <Text
        fontSize={12}
        color={fg}
        opacity={0.8}
        numberOfLines={1}
        textAlign="center"
      >
        {inr(total)}
      </Text>
    </Box>
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
  const metalRates = useAppSelector(state => state.data.metalRates);
  const purchaseOldGold = useAppSelector(state => state.data.purchaseOldGold);

  const { t, language } = useTranslation();
  const insets = useSafeAreaInsets();

  const [fabOpen, setFabOpen] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [orderModalOpen, setOrderModalOpen] = React.useState(false);
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
      dispatch(fetchPurchaseOldGold({ force: true })),
    ]);
    setRefreshing(false);
  }, [dispatch]);

  React.useEffect(() => {
    dispatch(fetchCustomers());
    dispatch(fetchOrders());
    dispatch(fetchMetalRates());
    // Only for the "Sold to Us" tile's count — cached, so a no-op once loaded.
    dispatch(fetchPurchaseOldGold());
  }, [dispatch]);

  const stats = React.useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const monthStr = now.toISOString().slice(0, 7);
    let pendingCountLocal = 0;
    let pendingTotalLocal = 0;
    let completedCountLocal = 0;
    let completedTotalLocal = 0;
    let todayTotalLocal = 0;
    let monthTotalLocal = 0;

    orders.forEach(o => {
      const amount = Number(o.amount || 0);
      if (o.status === 'pending') {
        pendingCountLocal += 1;
        pendingTotalLocal += amount;
      } else if (o.status === 'completed') {
        completedCountLocal += 1;
        completedTotalLocal += amount;
      }

      const dateStr = String(o.date || '');
      if (dateStr.startsWith(todayStr)) todayTotalLocal += amount;
      if (dateStr.startsWith(monthStr)) monthTotalLocal += amount;
    });

    // Old gold bought outright, counted separately from orders: it is money
    // going the other way, so folding it into either total above would misstate
    // sales.
    //
    // Standalone purchases only. An exchange declaration is not a second
    // transaction — its gold was already deducted inside the invoice it came
    // from, so counting it here added the same metal twice, once as a sale and
    // once as a purchase, and the tile's total was wrong by that amount for
    // every shop that took gold in against a bill.
    const standalone = standalonePurchases(purchaseOldGold);
    const soldToUsCount = standalone.length;
    const soldToUsTotal = standalone.reduce(
      (sum, d) => sum + (Number(d.totalAmount) || 0),
      0,
    );

    return {
      pendingCount: pendingCountLocal,
      pendingTotal: pendingTotalLocal,
      completedCount: completedCountLocal,
      completedTotal: completedTotalLocal,
      todayTotal: todayTotalLocal,
      monthTotal: monthTotalLocal,
      soldToUsCount,
      soldToUsTotal,
    };
  }, [orders, purchaseOldGold]);

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

            <HStack space="md">
              <RateCard
                colors={['#FBBF24', '#F97316']}
                title={t('dashboard.gold24')}
                price={inr(metalRates?.gold?.goldPrice24K995GW || 7850)}
                sub={t('dashboard.per1gm')}
              />

              <RateCard
                colors={['#94A3B8', '#475569']}
                title={t('dashboard.silver')}
                price={inr(metalRates?.silver?.silverPrice || 92)}
                sub={t('dashboard.per1gm')}
              />
            </HStack>
          </Box>

          {/* Sits below the rates rather than above them: it is dismissible and only
              appears occasionally, so it should never displace what people opened the
              dashboard to read. Renders nothing unless the SDK says it is due. */}
          <RateAppCard />

          {/* Pending + Completed. alignItems stretch (the default) only equalises
              the Pressables; each tile's Box carries flex={1} so it fills the one
              it sits in, which is what keeps the row's bottom edge straight. */}
          <HStack space="md" alignItems="stretch">
            <OrderStatTile
              icon={Clock}
              label={t('dashboard.pendingOrders')}
              count={stats.pendingCount}
              total={stats.pendingTotal}
              bg="#FFFBEB"
              borderColor="#FDE68A"
              fg="#B45309"
              iconColor="#D97706"
              onPress={() => navigation.navigate('Orders', { filter: 'pending' })}
            />

            <OrderStatTile
              icon={CheckCircle}
              label={t('dashboard.completedOrders')}
              count={stats.completedCount}
              total={stats.completedTotal}
              bg="#F0FDF4"
              borderColor="#BBF7D0"
              fg="#15803D"
              iconColor="#16A34A"
              onPress={() => navigation.navigate('Orders', { filter: 'completed' })}
            />

            {/* Old gold bought from customers. Hidden at zero rather than shown
                empty: most shops never buy old gold, and a permanent "0" would
                take a third of this row to say nothing.

                Indigo rather than a second green: it picks up the header
                gradient's #6366F1 and the Today Sales figure, so it reads as
                part of this page instead of a variant of Completed. */}
            {stats.soldToUsCount > 0 && (
              <OrderStatTile
                icon={Scale}
                label={t('dashboard.soldToUs')}
                count={stats.soldToUsCount}
                total={stats.soldToUsTotal}
                bg="#EEF2FF"
                borderColor="#C7D2FE"
                fg="#4338CA"
                iconColor="#6366F1"
                onPress={() => navigation.navigate('Customers', { filter: 'sellers' })}
              />
            )}
          </HStack>

          {/* Stats */}
          <HStack space="md" style={{ display: 'flex', flexDirection: 'column' }}>
            <Box flex={1} bg="$white" p="$3" rounded="$xl" alignItems="center" borderWidth={1} borderColor="#E5E7EB" style={styles.card}>
              <Text fontSize={12} color="$coolGray500">{t('dashboard.stats.todaySales')}</Text>
              <Text fontSize={18} fontWeight="$bold" color="#6366F1">{inr(stats.todayTotal)}</Text>
            </Box>
            <Box flex={1} bg="$white" p="$3" rounded="$xl" alignItems="center" borderWidth={1} borderColor="#E5E7EB" style={styles.card}>
              <Text fontSize={12} color="$coolGray500">{t('dashboard.stats.month')}</Text>
              <Text fontSize={18} fontWeight="$bold" color="#D946EF">{inr(stats.monthTotal)}</Text>
            </Box>
            <Box flex={1} bg="$white" p="$3" rounded="$xl" alignItems="center" borderWidth={1} borderColor="#E5E7EB" style={styles.card}>
              <Text fontSize={12} color="$coolGray500">{t('dashboard.stats.totalBills')}</Text>
              <Text fontSize={18} fontWeight="$bold" color="#111827">{orders.length}</Text>
            </Box>
          </HStack>
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
                <Text fontWeight="$medium">{t('dashboard.fab.newCustomer')}</Text>
                <Box w={40} h={40} rounded="$full" justifyContent="center" alignItems="center" bg="#14B8A6">
                  <Icon as={Users} color="$white" />
                </Box>
              </HStack>
            </Pressable>

            <Pressable onPress={() => { setFabOpen(false); setOrderModalOpen(true); }}>
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

      <OrderTypeModal isOpen={orderModalOpen} onClose={() => setOrderModalOpen(false)} />
      <AddCustomerModal isOpen={customerModalOpen} onClose={() => setCustomerModalOpen(false)} />
      <LanguagePopover
        isOpen={languageSheetOpen}
        onClose={() => setLanguageSheetOpen(false)}
        anchor={languageAnchor}
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

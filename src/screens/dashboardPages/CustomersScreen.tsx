import React, { useState, useEffect, useCallback, useMemo } from "react";
import { StyleSheet, RefreshControl, FlatList, Modal, ScrollView, Image } from "react-native";
import { useSheetBottomInset } from "../../hooks/useSheetBottomInset";
import {
  Box,
  Text,
  HStack,
  VStack,
  Pressable,
  Input,
  InputField,
  Icon,
  Center,
} from "@gluestack-ui/themed";
import {
  Plus,
  ChevronRight,
  Search,
  User,
  ArrowUpDown,
  Check,
  CheckCircle,
  Clock,
  Scale,
  ShoppingBag,
  Trash2,
} from "lucide-react-native";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { useNavigation, useFocusEffect, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { MainTabParamList } from "../../navigation/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "../../hooks/useTranslation";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  fetchCustomers,
  fetchOrders,
  fetchPurchaseOldGold,
  deleteCustomer,
  clearUserData,
} from "../../store/data/dataSlice";
import { endImpersonation } from "../../store/auth/authSlice";
import ConfirmModal from "../../components/ConfirmModal";
import ImpersonationBlockModal from "../../components/ImpersonationBlockModal";
import { toast } from "../../components/common/Toast";
import { formatCurrencyValue } from "../../utils/formatter";
import CustomerCodeBadge from '../../components/customers/CustomerCodeBadge';
import { getFullImageUrl } from "../../utils/imageUtils";
import AddCustomerModal from "../../components/AddCustomerModal";
import GradientSurface from "../../components/common/GradientSurface";
import { LAYOUT, useContentContainerStyle } from "../../constants/layout";
import WatchTutorialLink from "../../components/common/WatchTutorialLink";
import { HELP_TOPICS } from "../../tutorials/catalog";
import { INPUT_LIMITS } from "../../constants/inputLimits";
import { BannerHeightContext } from "../../navigation/MainTabs";
import { isStandalonePurchase } from '../../utils/oldGoldPurchases';

/* ---------------- SUB-COMPONENTS ---------------- */
const Header = React.memo(({ t, count, onAdd }: any) => {
  const insets = useSafeAreaInsets();
  const bannerHeight = React.useContext(BannerHeightContext);
  // Must match the list below, or the header sits off-centre from it on iPad.
  const contentStyle = useContentContainerStyle();
  // Same formula as the Dashboard header: clear the status bar dynamically
  // instead of a hardcoded height, so all tab headers stay the same size
  // relative to each other regardless of device/status-bar height.
  const topPad = LAYOUT.isWeb ? 0 : (bannerHeight > 0 ? 0 : insets.top);

  return (
  <Box height={84 + topPad} overflow="hidden">
    <GradientSurface colors={["#F97316", "#F59E0B"]} direction="horizontal" />

    <HStack
      px="$5"
      justifyContent="space-between"
      alignItems="center"
      flex={1}
      style={{
        ...contentStyle,
        paddingTop: topPad,
      }}
    >
      <VStack>
        <Text color="$white" fontSize={22} fontWeight="$bold">
          {t("customers.title")}
        </Text>

        <Text color="$white" fontSize={13}>
          {count} {t("customers.count")}
        </Text>
      </VStack>

      <Pressable onPress={onAdd}>
        <Box
          bg="rgba(255,255,255,0.2)"
          px="$4"
          py="$2"
          rounded="$xl"
          flexDirection="row"
          alignItems="center"
        >
          <Icon as={Plus} color="$white" size="sm" />
          <Text color="$white" ml="$2" fontWeight="$bold">
            {t("customers.add")}
          </Text>
        </Box>
      </Pressable>
    </HStack>
  </Box>
  );
});

/** Accent for this tab — matches the Customers header gradient, where Orders uses purple. */
const ACCENT = "#F97316";

// `sold` counts standalone old-gold purchases - what "Sold to us" means.
// `declarations` counts every declaration including exchanges, and exists only
// for the delete warning, which is about what gets orphaned rather than about
// what the customer sold us.
const EMPTY_STATS = { orders: 0, pending: 0, completed: 0, sold: 0, declarations: 0, total: 0, lastDate: 0 };

/** One stat column: label, its number centred under it, and an optional
    breakdown of that number below. Anything passed as children belongs to this
    column and stays inside its width — it must not run on under the next one. */
const MiniStat = ({ icon, label, value, color, flex = 1, children }: any) => (
  <VStack flex={flex} space="xs" alignItems="center">
    <HStack alignItems="center" space="xs">
      <Icon as={icon} size="xs" color={color} />
      <Text fontSize={11} color="$coolGray500">
        {label}
      </Text>
    </HStack>
    <Text fontSize={15} fontWeight="$bold" color="$coolGray900">
      {value}
    </Text>
    {children}
  </VStack>
);

const CustomerCard = React.memo(({ customer, stats, onPress, onDelete, t }: any) => {
  const gid = useMemo(() => `cgrad_${customer.id || Math.random()}`, [customer.id]);
  const s = stats || EMPTY_STATS;

  return (
    <Pressable onPress={onPress}>
      <Box
        bg="$white"
        p="$4"
        rounded="$2xl"
        mb="$3"
        style={styles.card}
      >
        <HStack alignItems="center" justifyContent="space-between">
          <HStack alignItems="center" space="md" flex={1}>
            {/* Their photo when they have one, the gradient initial otherwise. */}
            <Box width={50} height={50} rounded="$full" overflow="hidden">
              {customer.profilePhoto?.url ? (
                <Image
                  source={{ uri: getFullImageUrl(customer.profilePhoto.url) || undefined }}
                  style={{ width: '100%', height: '100%' }}
                />
              ) : (
                <>
                  <Svg width="100%" height="100%">
                    <Defs>
                      <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
                        <Stop offset="0%" stopColor="#6366F1" />
                        <Stop offset="100%" stopColor="#D946EF" />
                      </LinearGradient>
                    </Defs>
                    <Rect width="100%" height="100%" rx="25" fill={`url(#${gid})`} />
                  </Svg>
                  <Box position="absolute" top={0} left={0} right={0} bottom={0} justifyContent="center" alignItems="center">
                    <Text color="$white" fontWeight="$bold" fontSize={18}>
                      {customer.name?.charAt(0).toUpperCase()}
                    </Text>
                  </Box>
                </>
              )}
            </Box>

            <VStack flex={1} mr="$2">
              {/* The code sits on the name line, not under it: the pair is one
                  identity, and a shopkeeper scanning a list of six Rameshes is
                  reading across, not down. */}
              <HStack alignItems="center" space="xs">
                <Text fontWeight="$bold" fontSize={16} color="$coolGray900" numberOfLines={1} flexShrink={1}>
                  {customer.name}
                </Text>
                <CustomerCodeBadge code={customer.customerCode} />
              </HStack>
              {customer.phone ? (
                <Text color="$coolGray500" fontSize={14}>{customer.phone}</Text>
              ) : (
                // Placeholder rather than an empty line, so a row for a
                // customer added without a number does not read as a
                // half-rendered one.
                <Text color="$coolGray400" fontSize={14} fontStyle="italic">
                  {t('customers.noPhone') || 'No phone number'}
                </Text>
              )}
            </VStack>
          </HStack>

          <HStack alignItems="center" space="sm">
            <Icon as={ChevronRight} color="$coolGray400" size="sm" />
            {/* Matches the Orders list: stopPropagation so the tap deletes
                rather than opening the customer behind it. */}
            <Pressable
              onPress={(e: any) => { e.stopPropagation?.(); onDelete?.(); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              p="$1"
            >
              <Trash2 size={16} color="#EF4444" />
            </Pressable>
          </HStack>
        </HStack>

        {/* Counts and lifetime value. Rendered for everyone, including customers
            with nothing yet — a row of zeros is the answer to "have they ever
            bought from me", and hiding it would make the cards uneven. */}
        <Box borderTopWidth={1} borderTopColor="$coolGray100" mt="$3" pt="$3">
          <HStack alignItems="flex-start">
            {/* Pending and Complete are the two halves of Orders, not stats of
                their own — an advance order still owing money, and one settled
                in full. They live inside the Orders column so they are read as
                its breakdown; on a full-width line under the row, "Complete"
                sat beneath "Sold to us" and read as that column's number.
                Stacked rather than inline because one column is too narrow for
                both on a line. Matches the customer details screen. */}
            <MiniStat
              icon={ShoppingBag}
              label={t("customers.stats.orders") || "Orders"}
              value={s.orders}
              color="#6366F1"
              flex={1.25}
            >
              {s.orders > 0 && (
                <VStack space="xs" alignItems="center">
                  <HStack alignItems="center" space="xs">
                    <Icon as={Clock} size="xs" color={s.pending > 0 ? "#F59E0B" : "#9CA3AF"} />
                    <Text fontSize={11} color="$coolGray500">
                      {s.pending} {t("customers.stats.pending") || "Pending"}
                    </Text>
                  </HStack>
                  <HStack alignItems="center" space="xs">
                    <Icon as={CheckCircle} size="xs" color={s.completed > 0 ? "#10B981" : "#9CA3AF"} />
                    <Text fontSize={11} color="$coolGray500">
                      {s.completed} {t("customers.stats.completed") || "Complete"}
                    </Text>
                  </HStack>
                </VStack>
              )}
            </MiniStat>
            <MiniStat
              icon={Scale}
              label={t("customers.stats.soldToUs") || "Sold to us"}
              value={s.sold}
              color="#10B981"
            />
            {/* Money stays flush with the card edge rather than centred — the
                amount is the widest thing in the row and a ragged right edge
                reads worse than the mismatch with the two columns beside it. */}
            <VStack flex={1.3} space="xs" alignItems="flex-end">
              <Text fontSize={11} color="$coolGray500">
                {t("customers.stats.totalPurchase") || "Total purchase"}
              </Text>
              <Text fontSize={15} fontWeight="$bold" color={ACCENT} numberOfLines={1}>
                {formatCurrencyValue(s.total)}
              </Text>
            </VStack>
          </HStack>
        </Box>
      </Box>
    </Pressable>
  );
});

const SortModal = ({ isOpen, onClose, sortBy, onSelect, t }: any) => {
  const bottomInset = useSheetBottomInset(16);
  const options = [
    { key: 'nameAsc', label: t('customers.sort.nameAsc') || 'Name: A to Z' },
    { key: 'nameDesc', label: t('customers.sort.nameDesc') || 'Name: Z to A' },
    { key: 'saleHigh', label: t('customers.sort.saleHigh') || 'Purchase: High to Low' },
    { key: 'saleLow', label: t('customers.sort.saleLow') || 'Purchase: Low to High' },
    { key: 'ordersHigh', label: t('customers.sort.ordersHigh') || 'Most Orders' },
    { key: 'recent', label: t('customers.sort.recent') || 'Recent Purchase' },
  ];

  return (
    <Modal visible={isOpen} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable flex={1} bg="rgba(0,0,0,0.4)" onPress={onClose}>
        <Box flex={1} justifyContent={LAYOUT.isWeb ? "center" : "flex-end"}>
          <Box
            bg="$white"
            p="$6"
            pb="$4"
            style={[
              { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: bottomInset },
              LAYOUT.isWeb && { alignSelf: 'center', width: '100%', maxWidth: 450, borderRadius: 24 }
            ]}
          >
            <Text fontSize={18} fontWeight="$bold" mb="$5">
              {t('customers.sort.title') || 'Sort By'}
            </Text>
            <VStack space="sm">
              {options.map((opt) => (
                <Pressable
                  key={opt.key}
                  onPress={() => {
                    onSelect(opt.key);
                    onClose();
                  }}
                  p="$4"
                  bg={sortBy === opt.key ? "$coolGray50" : "transparent"}
                  rounded="$xl"
                >
                  <HStack justifyContent="space-between" alignItems="center">
                    <Text
                      fontWeight={sortBy === opt.key ? "$bold" : "$medium"}
                      color={sortBy === opt.key ? ACCENT : "$coolGray700"}
                    >
                      {opt.label}
                    </Text>
                    {sortBy === opt.key && <Icon as={Check} color={ACCENT} size="sm" />}
                  </HStack>
                </Pressable>
              ))}
            </VStack>
          </Box>
        </Box>
      </Pressable>
    </Modal>
  );
};

type FilterType = 'all' | 'pending' | 'completed' | 'sellers' | 'noOrders';

export default function CustomersScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<MainTabParamList, 'Customers'>>();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  // Centres and caps content on iPad; no-op on phones.
  const contentStyle = useContentContainerStyle();
  const { customers, orders, purchaseOldGold } = useAppSelector((state) => state.data);
  const { impersonateUserId, impersonatePhone } = useAppSelector((state) => state.auth);

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState('nameAsc');
  const [isSortModalOpen, setIsSortModalOpen] = useState(false);
  /** The customer the delete confirmation is about, null when it is closed. */
  const [pendingDelete, setPendingDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [blockModalVisible, setBlockModalVisible] = useState(false);

  useEffect(() => {
    dispatch(fetchCustomers());
    // The per-customer counts below are derived on the client, so this tab
    // needs orders and declarations even though it never lists them. Both
    // thunks are cached — this is a no-op when the dashboard already loaded them.
    dispatch(fetchOrders());
    dispatch(fetchPurchaseOldGold());
  }, [dispatch]);

  // Arrived from the dashboard's "Sold to Us" tile. The param is consumed
  // immediately so it cannot re-apply on a later visit.
  //
  // Deliberately NOT inside the focus effect below: consuming the param changes
  // route.params, which would change that effect's identity, run its cleanup,
  // and reset the filter this just applied.
  useEffect(() => {
    const incoming = route.params?.filter;
    if (!incoming) return;
    setActiveFilter(incoming);
    navigation.setParams({ filter: undefined });
  }, [route.params?.filter, navigation]);

  // Leaving the tab clears the view, filter included. Tab screens stay mounted,
  // so without this a filter — often one the shopkeeper never chose, having
  // arrived by tapping a dashboard tile — silently survives until they notice
  // the list is short. Empty deps so only focus and blur drive it.
  useFocusEffect(
    useCallback(() => {
      return () => {
        setQ("");
        setActiveFilter('all');
      };
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      dispatch(fetchCustomers({ force: true })),
      dispatch(fetchOrders({ force: true })),
      dispatch(fetchPurchaseOldGold({ force: true })),
    ]);
    setRefreshing(false);
  }, [dispatch]);

  /**
   * Counts and lifetime value per customer, in one pass over each list rather
   * than a filter per card — with a few hundred customers the per-card version
   * is O(customers × orders) on every keystroke in the search box.
   *
   * Soft-deleted orders are excluded so a deleted bill stops counting towards
   * a customer's total, exactly as it does on the Orders tab.
   */
  const statsByCustomer = useMemo(() => {
    const map = new Map<string, { orders: number; pending: number; completed: number; sold: number; declarations: number; total: number; lastDate: number }>();
    const entry = (id: string) => {
      let e = map.get(id);
      if (!e) {
        e = { orders: 0, pending: 0, completed: 0, sold: 0, declarations: 0, total: 0, lastDate: 0 };
        map.set(id, e);
      }
      return e;
    };

    (orders || []).forEach((o: any) => {
      if (!o?.customerId || o.deletedAt) return;
      const e = entry(o.customerId);
      e.orders += 1;
      // Full-payment invoices are normalised to 'completed' in dataSlice, so
      // this covers both a straight bill and an advance order that has been
      // settled — the two things a customer can have "completed".
      if (o.status === 'pending') e.pending += 1;
      else if (o.status === 'completed') e.completed += 1;
      e.total += Number(o.amount) || 0;
      const ts = o.date ? new Date(o.date).getTime() : 0;
      if (ts > e.lastDate) e.lastDate = ts;
    });

    // Two counts from one pass, because they answer different questions.
    // `sold` drives the "Sold to us" column and the sellers filter, which mean
    // "customers we bought old gold from outright" — so exchanges are excluded,
    // as they belong to their bill. `declarations` counts everything, and feeds
    // only the delete confirmation: an exchange declaration is orphaned by a
    // customer delete just the same, and a warning that undercounts what is
    // about to be stranded is worse than no warning.
    (purchaseOldGold || []).forEach((d: any) => {
      if (!d?.customerId) return;
      const e = entry(d.customerId);
      e.declarations += 1;
      if (isStandalonePurchase(d)) e.sold += 1;
    });

    return map;
  }, [orders, purchaseOldGold]);

  const baseList = useMemo(
    () => (customers || []).filter(c => c && (c.id || c._id) && c.name),
    [customers],
  );

  const filterCounts = useMemo(() => {
    let pending = 0, completed = 0, sellers = 0, noOrders = 0;
    baseList.forEach((c: any) => {
      const s = statsByCustomer.get(c.id) || EMPTY_STATS;
      if (s.pending > 0) pending += 1;
      if (s.completed > 0) completed += 1;
      if (s.orders === 0) noOrders += 1;
      if (s.sold > 0) sellers += 1;
    });
    return { all: baseList.length, pending, completed, sellers, noOrders };
  }, [baseList, statsByCustomer]);

  const filteredCustomers = useMemo(() => {
    let list = baseList;

    if (activeFilter !== 'all') {
      list = list.filter((c: any) => {
        const s = statsByCustomer.get(c.id) || EMPTY_STATS;
        if (activeFilter === 'pending') return s.pending > 0;
        if (activeFilter === 'completed') return s.completed > 0;
        if (activeFilter === 'sellers') return s.sold > 0;
        return s.orders === 0;
      });
    }

    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter(
        (c: any) =>
          c.name.toLowerCase().includes(s) ||
          (c.phone && c.phone.includes(s)) ||
          (c.customerCode && c.customerCode.toLowerCase().includes(s))
      );
    }

    const stat = (c: any) => statsByCustomer.get(c.id) || EMPTY_STATS;
    return [...list].sort((a: any, b: any) => {
      switch (sortBy) {
        case 'nameDesc':
          return String(b.name).localeCompare(String(a.name));
        case 'saleHigh':
          return (stat(b).total || 0) - (stat(a).total || 0);
        case 'saleLow':
          return (stat(a).total || 0) - (stat(b).total || 0);
        case 'ordersHigh':
          return (stat(b).orders || 0) - (stat(a).orders || 0);
        case 'recent':
          // Never-bought customers have no date to rank by, so they sort last
          // rather than sharing the top with the most recent buyer.
          return (stat(b).lastDate || 0) - (stat(a).lastDate || 0);
        default:
          return String(a.name).localeCompare(String(b.name));
      }
    });
  }, [baseList, statsByCustomer, activeFilter, q, sortBy]);

  const filterTabsData = useMemo(() => ([
    { key: 'all', label: t('customers.filters.all') || 'All', count: filterCounts.all },
    { key: 'pending', label: t('customers.filters.pending') || 'Pending', count: filterCounts.pending },
    { key: 'completed', label: t('customers.filters.completed') || 'Complete', count: filterCounts.completed },
    { key: 'sellers', label: t('customers.filters.sellers') || 'Sold to us', count: filterCounts.sellers },
    { key: 'noOrders', label: t('customers.filters.noOrders') || 'No orders', count: filterCounts.noOrders },
  ]), [t, filterCounts]);

  /** Only filters that would return something, plus All — matches the Orders tab. */
  const visibleFilterTabs = useMemo(
    () => filterTabsData.filter(f => f.key === 'all' || f.count > 0),
    [filterTabsData],
  );

  // The active filter's chip can vanish under you — delete the last customer
  // who sold you gold while looking at "Sold to us". Fall back to All rather
  // than stranding them on an empty list with no chip selected.
  useEffect(() => {
    if (!visibleFilterTabs.some(f => f.key === activeFilter)) {
      setActiveFilter('all');
    }
  }, [visibleFilterTabs, activeFilter]);

  const handleRequestDelete = useCallback((customer: any) => {
    if (impersonateUserId) { setBlockModalVisible(true); return; }
    setPendingDelete(customer);
  }, [impersonateUserId]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await dispatch(deleteCustomer(pendingDelete.id)).unwrap();
      setPendingDelete(null);
      toast.success('Retailer deleted');
    } catch (error: any) {
      toast.error(error || 'Failed to delete retailer');
    } finally {
      setDeleting(false);
    }
  }, [dispatch, pendingDelete]);

  const handleEndSession = useCallback(() => {
    dispatch(endImpersonation());
    dispatch(clearUserData());
    navigation.navigate('AdminDashboard');
  }, [dispatch, navigation]);

  const renderItem = useCallback(({ item }: any) => (
    <CustomerCard
      customer={item}
      stats={statsByCustomer.get(item.id)}
      t={t}
      onPress={() => navigation.navigate("CustomerDetails", { customerId: item.id })}
      onDelete={() => handleRequestDelete(item)}
    />
  ), [navigation, statsByCustomer, t, handleRequestDelete]);

  /** Counts for the confirmation's "this would orphan…" list. */
  const pendingDeleteStats = pendingDelete
    ? statsByCustomer.get(pendingDelete.id) || EMPTY_STATS
    : EMPTY_STATS;
  const pendingHasRecords =
    pendingDeleteStats.orders > 0 || pendingDeleteStats.declarations > 0;

  const keyExtractor = useCallback((item: any, index: number) => item.id || item._id || index.toString(), []);

  return (
    <Box flex={1} bg="#F9FAFB">
      <Header t={t} count={customers.length} onAdd={() => setOpen(true)} />

      <FlatList
        data={filteredCustomers}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        // The search box lives in ListHeaderComponent, so without this the first
        // tap on a customer row while typing only dismisses the keyboard.
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 100,
          ...contentStyle
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <>
            <Box bg="$white" rounded="$2xl" px="$4" py="$1" style={styles.card}>
              <HStack alignItems="center">
                <Icon as={Search} color="#9CA3AF" size="sm" />
                <Input variant="outline" flex={1} ml="$1" borderWidth={0}>
                  <InputField
                    placeholder={t("customers.searchWithCode") || t("customers.search")}
                    value={q}
                    onChangeText={setQ}
                    maxLength={INPUT_LIMITS.searchQuery}
                    fontSize={14}
                  />
                </Input>
                <Box h={20} w={1} bg="$coolGray200" mx="$2" />
                <Pressable p="$2" onPress={() => setIsSortModalOpen(true)}>
                  <Icon as={ArrowUpDown} color={sortBy !== 'nameAsc' ? ACCENT : "#9CA3AF"} size="sm" />
                </Pressable>
              </HStack>
            </Box>

            <Box>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: 16 }}
              >
                {visibleFilterTabs.map((item) => (
                  <Pressable key={item.key} onPress={() => setActiveFilter(item.key as FilterType)}>
                    <Box
                      style={[styles.filter, activeFilter === item.key && styles.activeFilter]}
                      mr="$3"
                    >
                      {item.key === 'pending' && (
                        <Icon as={Clock} size="xs" color={activeFilter === item.key ? '#fff' : '#4B5563'} mr="$1.5" />
                      )}
                      {item.key === 'sellers' && (
                        <Icon as={Scale} size="xs" color={activeFilter === item.key ? '#fff' : '#4B5563'} mr="$1.5" />
                      )}
                      {item.key === 'completed' && (
                        <Icon as={CheckCircle} size="xs" color={activeFilter === item.key ? '#fff' : '#4B5563'} mr="$1.5" />
                      )}
                      <Text
                        style={{
                          color: activeFilter === item.key ? '#fff' : '#1F2937',
                          fontWeight: '600',
                          fontSize: 13,
                        }}
                      >
                        {item.label} ({item.count})
                      </Text>
                    </Box>
                  </Pressable>
                ))}
              </ScrollView>
            </Box>
          </>
        }
        ListEmptyComponent={
          <Center mt="$20">
            <VStack space="md" alignItems="center">
              <Box p="$5" bg="$coolGray100" rounded="$full">
                <Icon as={User} size="xl" color="$coolGray400" />
              </Box>
              <Text color="$coolGray400" fontWeight="$medium">
                <Text style={{ fontSize: 16 }}>
                  {q.trim() || activeFilter !== 'all'
                    ? t("customers.noResults") || "No retailers match your search"
                    : t("customers.noCustomers") || "No retailers found"}
                </Text>
              </Text>
              {!q.trim() && activeFilter === 'all' && (
                <>
                  <Text color="$coolGray400" fontWeight="$medium" style={{ marginTop: -4 }}>
                    <Text style={{ fontSize: 14 }}>{t("customers.emptySubHead") || "Add retailers manually or they're created when making invoices"}</Text>
                  </Text>
                  <Pressable
                    px="$4"
                    py="$2"
                    mt="$2"
                    rounded="$xl"
                    flexDirection="row"
                    alignItems="center"
                    style={{ backgroundColor: '#F97316' }}
                    onPress={() => setOpen(true)}
                  >
                    <Icon as={Plus} color="$white" size="sm" />
                    <Text color="$white" ml="$2" fontWeight="$bold">
                      {t("customers.addNew") || "Add New Retailer"}
                    </Text>
                  </Pressable>
                  <WatchTutorialLink topic={HELP_TOPICS.customers} />
                </>
              )}
            </VStack>
          </Center>
        }
        initialNumToRender={15}
        windowSize={5}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
      />

      <AddCustomerModal
        isOpen={open}
        onClose={() => setOpen(false)}
      />

      <SortModal
        isOpen={isSortModalOpen}
        onClose={() => setIsSortModalOpen(false)}
        sortBy={sortBy}
        onSelect={setSortBy}
        t={t}
      />

      {/* Same warning as the customer details screen: the backend removes only
          the customer row, so bills and declarations are left without one. */}
      <ConfirmModal
        visible={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        tone="destructive"
        icon="trash"
        title={t('customers.delete.title')}
        loading={deleting}
        confirmLabel={t('customers.delete.confirm')}
        cancelLabel={t('common.cancel')}
        onConfirm={confirmDelete}
        description={
          pendingHasRecords ? (
            <VStack space="sm">
              <Text fontSize={14} color="$coolGray500" textAlign="center" lineHeight={20}>
                {t('customers.delete.hasRecords')}
              </Text>
              <VStack space="xs" bg="#FEF2F2" rounded="$xl" px="$4" py="$3">
                {pendingDeleteStats.orders > 0 && (
                  <Text fontSize={13} fontWeight="$bold" color="#B91C1C" textAlign="center">
                    {pendingDeleteStats.orders} {t('customers.delete.records.orders')}
                  </Text>
                )}
                {pendingDeleteStats.pending > 0 && (
                  <Text fontSize={13} fontWeight="$bold" color="#B91C1C" textAlign="center">
                    {pendingDeleteStats.pending} {t('customers.delete.records.pending')}
                  </Text>
                )}
                {pendingDeleteStats.declarations > 0 && (
                  <Text fontSize={13} fontWeight="$bold" color="#B91C1C" textAlign="center">
                    {pendingDeleteStats.declarations} {t('customers.delete.records.sold')}
                  </Text>
                )}
              </VStack>
              <Text fontSize={13} color="$coolGray500" textAlign="center" lineHeight={18}>
                {t('customers.delete.recordsNote')}
              </Text>
            </VStack>
          ) : (
            t('customers.delete.plain')
          )
        }
      />

      <ImpersonationBlockModal
        isOpen={blockModalVisible}
        phone={impersonatePhone || ''}
        onEndSession={handleEndSession}
        onClose={() => setBlockModalVisible(false)}
      />
    </Box>
  );
}

const styles = StyleSheet.create({
  card: {
    elevation: 2,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  activeFilter: {
    backgroundColor: ACCENT,
  },
  filter: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 1,
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
});

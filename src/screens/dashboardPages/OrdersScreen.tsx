import React, { useMemo, useCallback, useEffect, useState, memo } from 'react';
import { StyleSheet, RefreshControl, FlatList, Modal } from 'react-native';
import { useSheetBottomInset } from '../../hooks/useSheetBottomInset';
import {
  Box,
  HStack,
  VStack,
  Text,
  Pressable,
  Icon,
  Input,
  InputField,
  Center,
  ScrollView,
} from '@gluestack-ui/themed';
import {
  Search,
  ArrowUpDown,
  Plus,
  FileText,
  Check,
  Trash2,
  RotateCcw,
  Trash,
} from 'lucide-react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  fetchOrders,
  fetchTrashedOrders,
  softDeleteOrder,
  restoreOrder,
  purgeExpiredDeleted,
  permanentDeleteAdvanceOrder,
  deleteInvoice,
  loadDeletedOrderIds,
} from '../../store/data/dataSlice';
import ConfirmModal from '../../components/ConfirmModal';
import RemindButton from '../../components/customers/RemindButton';
import { calculateItemMakingCharge } from '../../utils/calculations';
import { formatOrderDateTime } from '../../utils/formatter';
import LedgerHeader, { LedgerHeaderAction } from '../../components/ledger/LedgerHeader';
import { orderOutstanding, hasOutstanding, formatGrams } from '../../utils/dues';
import { formatCurrencyValue } from '../../utils/formatter';
import { Brand, tabularNums } from '../../theme/brand';
import { LAYOUT, useContentContainerStyle } from '../../constants/layout';
import WatchTutorialLink from '../../components/common/WatchTutorialLink';
import { HELP_TOPICS } from '../../tutorials/catalog';
import { INPUT_LIMITS } from '../../constants/inputLimits';

const getOrderGrandTotal = (order: any, shopDetails?: any) => {
  const typeStr = String(order.type || '').toLowerCase();
  if (typeStr === 'full' || typeStr === 'full payment') {
    let totalBaseAmount = 0;
    let totalMakingCharges = 0;
    let totalOtherCharges = 0;
    let totalDiscount = 0;

    (order.items || []).forEach((item: any) => {
      const netWeight = Number(item.netWeight || item.netWt || item.weight || item.netWeight || 0);
      const rateValue = Number(item.rate || item.ratePerGm || 0);
      totalBaseAmount += netWeight * rateValue;
      totalMakingCharges += calculateItemMakingCharge(item, rateValue);
      totalOtherCharges += Number(item.chargeAmount || item.otherChargesAmount || 0);
      totalDiscount += Number(item.discount || 0);
    });

    const goldExchanges = (order.exchanges || []).filter((ex: any) => ex.type === 'Gold');
    const silverExchanges = (order.exchanges || []).filter((ex: any) => ex.type === 'Silver');

    const goldExchangeTotal = goldExchanges.reduce((sum: number, ex: any) => sum + Number(ex.amount || 0), 0);
    const silverExchangeTotal = silverExchanges.reduce((sum: number, ex: any) => sum + Number(ex.amount || 0), 0);

    const subtotalVal = totalBaseAmount + totalMakingCharges + totalOtherCharges - totalDiscount - goldExchangeTotal - silverExchangeTotal;

    let gstVal = 0;
    if (order.gstAmount !== undefined && order.gstAmount !== null) {
      gstVal = Number(order.gstAmount);
    } else {
      const shouldIncludeGst = order.includeGST ?? true;
      const gstPercentage = shopDetails?.gstPercentage || 3;
      gstVal = shouldIncludeGst ? subtotalVal * (gstPercentage / 100) : 0;
    }

    return subtotalVal + gstVal;
  }
  return Number(order.amount || order.totalPaid || 0);
};

const daysLeft = (deletedAt?: string) => {
  if (!deletedAt) return 30;
  const elapsed = Math.floor((Date.now() - new Date(deletedAt).getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(0, 30 - elapsed);
};

const SortModal = ({ isOpen, onClose, sortBy, onSelect, t }: any) => {
  const bottomInset = useSheetBottomInset(16);
  const options = [
    { key: 'newest', label: t('orders.sort.newest') || 'Newest First' },
    { key: 'oldest', label: t('orders.sort.oldest') || 'Oldest First' },
    { key: 'amountLow', label: t('orders.sort.amountLow') || 'Amount: Low to High' },
    { key: 'amountHigh', label: t('orders.sort.amountHigh') || 'Amount: High to Low' },
  ];

  return (
    <Modal visible={isOpen} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable flex={1} bg="rgba(0,0,0,0.4)" onPress={onClose}>
        <Box
          flex={1}
          justifyContent={LAYOUT.isWeb ? "center" : "flex-end"}
        >
          <Box
            bg="$white"
            p="$6"
            pb="$4"
            style={[
              { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: bottomInset },
              LAYOUT.isWeb && { alignSelf: 'center', width: '100%', maxWidth: 450, borderRadius: 24 }
            ]}
          >
            <Text fontSize={18} fontWeight="$bold" mb="$5">{t('orders.sort.title') || 'Sort By'}</Text>
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
                      color={sortBy === opt.key ? "#145F4A" : "$coolGray700"}
                    >
                      {opt.label}
                    </Text>
                    {sortBy === opt.key && <Icon as={Check} color="#145F4A" size="sm" />}
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

// Single source of truth for "is this a GST bill" — model default is false
// but Zod/mobile default is true, so only an explicit false counts as non-GST.
const isGstBill = (order: any) =>
  order?.type === 'full' && order?.includeGST !== false && (order?.gstAmount ?? 0) > 0;

/**
 * One sale in the Sales list, as a ledger row.
 *
 * It was SoneBill's order card: shadowed, with status pills, an exchange
 * badge, a gradient progress bar and "₹… due" read off `estimatedBalance`.
 * That figure is both accounts priced into rupees at today's rate, which
 * AGENTS.md forbids for a due: shown beside the weight it counts the metal
 * twice. What is owed now reads through utils/dues.ts, the same definition
 * the Khata tab, Retailers and the statement use: gold and cash, each only
 * when it has something on it. Restyled in the 4.3(a) rework
 * (APP_STORE_4.3_REWORK.md).
 */
const OrderItemCard = memo(({ order, customerName, onPress, onDelete, t }: any) => {
  const isPending = order.status === 'pending';
  const due = orderOutstanding(order);
  const owes = hasOutstanding(due);
  const gm = t('common.gramShort') || 'gm';

  const totalWeight = Number(order.totalWeight) || 0;
  const weightPaid = Number(order.weightPaid) || 0;
  const progress = totalWeight > 0 ? Math.min(100, (weightPaid / totalWeight) * 100) : 0;
  // Sale date, plus the creation time when it was raised the same day; see
  // formatOrderDateTime for why the time cannot come from `date` itself.
  const dateStr = formatOrderDateTime(order.date || order.orderDate, order.createdAt);

  return (
    <Pressable onPress={onPress}>
      <Box bg={Brand.card} rounded="$lg" px="$4" py="$3" mb="$2.5" borderWidth={1} borderColor={Brand.line}>
        <HStack alignItems="center">
          <VStack flex={1} pr="$2">
            <HStack alignItems="center" space="sm">
              <Text fontWeight="$bold" fontSize={15} color={Brand.ink} numberOfLines={1} style={{ flexShrink: 1 }}>
                {order.invoiceNumber || order.orderNumber || '---'}
              </Text>
              {!isPending && (
                <Text fontSize={10} fontWeight="$bold" color={Brand.received} textTransform="uppercase" letterSpacing={0.6}>
                  {t('retailer.settled') || 'Settled'}
                </Text>
              )}
            </HStack>
            <Text fontSize={13} color={Brand.inkSoft} numberOfLines={1} mt="$0.5">
              {customerName}
            </Text>
            <Text fontSize={12} color={Brand.inkMuted} mt="$0.5">
              {dateStr}
            </Text>
          </VStack>

          <VStack alignItems="flex-end" mr="$2">
            {owes ? (
              <>
                {due.gold > 0 && (
                  <Text fontSize={14} fontWeight="$bold" color={Brand.gold} style={tabularNums}>
                    {formatGrams(due.gold, gm)}
                  </Text>
                )}
                {due.cash > 0 && (
                  <Text fontSize={13} fontWeight="$semibold" color={Brand.ink} style={tabularNums}>
                    {formatCurrencyValue(due.cash)}
                  </Text>
                )}
              </>
            ) : (
              <Text fontSize={13} fontWeight="$semibold" color={Brand.inkMuted} style={tabularNums}>
                {formatGrams(totalWeight, gm)}
              </Text>
            )}
          </VStack>

          <HStack alignItems="center" space="xs">
            {/* Pending only. A settled sale has nothing to chase, and the
                action sends the RETAILER's whole statement rather than this one
                line. See useRetailerReminder. */}
            {isPending && <RemindButton customerId={order.customerId} compact />}
            <Pressable
              onPress={onDelete}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              p="$1"
              accessibilityLabel={t('orders.delete') || 'Delete'}
            >
              <Trash2 size={15} color={Brand.inkFaint} />
            </Pressable>
          </HStack>
        </HStack>

        {/* How much of the sale's metal has come back. Flat, like every bar in
            the Ledger design; SoneBill's was a gradient. */}
        {isPending && totalWeight > 0 && (
          <Box mt="$2.5" h={4} rounded="$full" bg={Brand.sunken} overflow="hidden">
            <Box h="100%" w={`${progress}%`} bg={Brand.primaryMid} />
          </Box>
        )}
      </Box>
    </Pressable>
  );
});

const DeletedOrderCard = memo(({ entry, customerName, onRestore, onDeleteForever }: any) => {
  const order = entry;
  const days = daysLeft(order.deletedAt);
  const label = order.type === 'full'
    ? (order.invoiceNumber || 'Invoice')
    : (order.itemName || order.orderNumber || 'Order');
  const badge = order.type === 'full' ? 'Invoice' : order.status === 'pending' ? 'Pending' : 'Completed';
  const amount = order.type === 'full'
    ? `₹${(order.amount || 0).toLocaleString()}`
    : `₹${(order.totalPaid || 0).toLocaleString()}`;

  return (
    <Box bg="$white" rounded="$2xl" p="$4" style={[styles.card, { opacity: 0.9 }]} mb="$4" borderWidth={1} borderColor="$coolGray100">
      <HStack justifyContent="space-between" alignItems="flex-start" mb="$2">
        <VStack space="xs" flex={1}>
          <HStack alignItems="center" space="sm">
            <Text fontWeight="$bold" fontSize={15} color="$coolGray900" numberOfLines={1} style={{ flexShrink: 1 }}>
              {label}
            </Text>
            <Box bg="#E8ECE5" px="$2" py="$0.5" rounded="$full">
              <Text color="$coolGray600" fontSize={10}>{badge.toUpperCase()}</Text>
            </Box>
          </HStack>
          <Text fontSize={12} color="$coolGray500">{customerName} • {amount}</Text>
        </VStack>
        <Box
          bg="#FBF6EA"
          px="$2"
          py="$1"
          rounded="$lg"
        >
          <Text fontSize={11} color="#9A7425" fontWeight="$medium">
            {days}d left
          </Text>
        </Box>
      </HStack>

      <HStack space="sm" mt="$2">
        <Pressable flex={1} onPress={onRestore}>
          <Box
            rounded="$xl"
            borderWidth={1}
            borderColor="$coolGray200"
            py="$2.5"
            alignItems="center"
            flexDirection="row"
            justifyContent="center"
            bg="$white"
          >
            <RotateCcw size={13} color="#545047" />
            <Text fontSize={13} fontWeight="$medium" color="$coolGray700" ml="$1">
              Restore
            </Text>
          </Box>
        </Pressable>
        <Pressable flex={1} onPress={onDeleteForever}>
          <Box
            rounded="$xl"
            borderWidth={1}
            borderColor="#FCA5A5"
            py="$2.5"
            alignItems="center"
            flexDirection="row"
            justifyContent="center"
            bg="#FFF5F5"
          >
            <Trash size={13} color="#DC2626" />
            <Text fontSize={13} fontWeight="$medium" color="#DC2626" ml="$1">
              Delete forever
            </Text>
          </Box>
        </Pressable>
      </HStack>
    </Box>
  );
});

type FilterType = 'all' | 'pending' | 'completed' | 'gst' | 'nongst' | 'deleted';

const OrdersScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  // Centres and caps content on iPad; no-op on phones.
  const contentStyle = useContentContainerStyle();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const orders = useAppSelector(state => state.data.orders);
  const customers = useAppSelector(state => state.data.customers);
  const shopDetails = useAppSelector(state => state.data.shopDetails);
  const purchaseOldGold = useAppSelector(state => state.data.purchaseOldGold);

  /**
   * Orders that have a declaration written against them.
   *
   * A set rather than a `find` per row: the list renders every order, and
   * scanning the declarations for each would be quadratic on a shop with a long
   * history.
   */
  const declaredOrderIds = useMemo(
    () => new Set((purchaseOldGold || []).map(d => d.orderId).filter(Boolean) as string[]),
    [purchaseOldGold],
  );

  const [q, setQ] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState('newest');
  const [isSortModalOpen, setIsSortModalOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [softDeleteTarget, setSoftDeleteTarget] = useState<{ id: string; type: 'full' | 'advance' } | null>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<{ id: string; type: 'full' | 'advance' } | null>(null);
  const [emptyAllVisible, setEmptyAllVisible] = useState(false);
  const [emptyAllLoading, setEmptyAllLoading] = useState(false);
  /**
   * Frozen when the dialog opens rather than read live from deletedOrders,
   * which shrinks as each delete lands — otherwise the confirmation counts
   * itself down to "Delete all 0?" while the shopkeeper watches it work.
   */
  const [emptyAllCount, setEmptyAllCount] = useState(0);
  const [permanentLoading, setPermanentLoading] = useState(false);

  useEffect(() => {
    dispatch(loadDeletedOrderIds());
    dispatch(fetchOrders());
    // Feeds the declaration marker on exchange rows. Cheap: the thunk has a
    // stale-time condition, so this is a no-op when the dashboard already
    // fetched - but Orders is reachable directly and cannot assume it did.
    dispatch(fetchTrashedOrders());
    dispatch(purgeExpiredDeleted());
  }, [dispatch]);

  useFocusEffect(
    useCallback(() => {
      if (route.params?.filter) {
        setActiveFilter(route.params.filter);
        navigation.setParams({ filter: undefined });
      }
      return () => setQ('');
    }, [route.params?.filter, navigation])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await dispatch(fetchOrders({ force: true }));
    setRefreshing(false);
  }, [dispatch]);

  const customerNameById = useMemo(() => {
    const map = new Map<string, string>();
    customers.forEach(c => {
      if (c?.id) map.set(c.id, c.name);
    });
    return map;
  }, [customers]);

  const getCustomerName = useCallback(
    (id: string) => customerNameById.get(id) || 'Unknown',
    [customerNameById],
  );

  // Split into active and deleted
  const activeOrders = useMemo(() => orders.filter(o => !o.deletedAt), [orders]);
  const deletedOrders = useMemo(
    () => [...orders.filter(o => !!o.deletedAt)].sort(
      (a, b) => new Date(b.deletedAt || 0).getTime() - new Date(a.deletedAt || 0).getTime()
    ),
    [orders],
  );

  const orderCounts = useMemo(() => {
    let pending = 0;
    let completed = 0;
    let gst = 0;
    let nongst = 0;
    activeOrders.forEach(o => {
      if (o.status === 'pending') pending += 1;
      else if (o.status === 'completed') completed += 1;
      if (o.type === 'full') {
        if (isGstBill(o)) gst += 1;
        else nongst += 1;
      }
    });
    return { pending, completed, gst, nongst };
  }, [activeOrders]);

  const filteredOrders = useMemo(() => {
    if (activeFilter === 'deleted') return [];
    let list = [...activeOrders];
    if (activeFilter === 'gst') {
      list = list.filter(o => o.type === 'full' && isGstBill(o));
    } else if (activeFilter === 'nongst') {
      list = list.filter(o => o.type === 'full' && !isGstBill(o));
    } else if (activeFilter !== 'all') {
      list = list.filter(o => o.status === activeFilter);
    }
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter(o => {
        const cName = getCustomerName(o.customerId).toLowerCase();
        return (
          String(o.id || '').toLowerCase().includes(s) ||
          String(o.invoiceNumber || '').toLowerCase().includes(s) ||
          String(o.orderNumber || '').toLowerCase().includes(s) ||
          cName.includes(s)
        );
      });
    }
    list.sort((a, b) => {
      if (sortBy === 'newest' || sortBy === 'oldest') {
        const da = new Date(a.createdAt || a.date || 0).getTime();
        const db = new Date(b.createdAt || b.date || 0).getTime();
        return sortBy === 'newest' ? db - da : da - db;
      }
      const valA = getOrderGrandTotal(a, shopDetails);
      const valB = getOrderGrandTotal(b, shopDetails);
      return sortBy === 'amountLow' ? valA - valB : valB - valA;
    });
    return list;
  }, [activeOrders, q, activeFilter, sortBy, getCustomerName, shopDetails]);

  /**
   * Straight to the order screen, no chooser in between.
   *
   * This used to open the Full/Advance popup, and when that was removed the
   * `setOpen(true)` it called was left behind pointing at state nothing read —
   * so both New Order buttons on this tab silently did nothing, while the
   * dashboard FAB (which navigates directly) kept working. NewOrder infers
   * full vs part payment from what is actually paid, so there is nothing left
   * to ask before opening it.
   */
  const handleNewOrder = useCallback(() => navigation.navigate('NewOrder'), [navigation]);

  const handleSoftDelete = useCallback((id: string, type: 'full' | 'advance') => {
    setSoftDeleteTarget({ id, type });
  }, []);

  const confirmSoftDelete = useCallback(async () => {
    if (!softDeleteTarget) return;
    await dispatch(softDeleteOrder(softDeleteTarget));
    setSoftDeleteTarget(null);
  }, [softDeleteTarget, dispatch]);

  const handleRestore = useCallback(async (id: string, type: 'full' | 'advance') => {
    await dispatch(restoreOrder({ id, type }));
  }, [dispatch]);

  const handlePermanentDelete = useCallback((id: string, type: 'full' | 'advance') => {
    setPermanentDeleteTarget({ id, type });
  }, []);

  const confirmPermanentDelete = useCallback(async () => {
    if (!permanentDeleteTarget) return;
    setPermanentLoading(true);
    const { id, type } = permanentDeleteTarget;
    if (type === 'full') {
      await dispatch(deleteInvoice(id));
    } else {
      await dispatch(permanentDeleteAdvanceOrder(id));
    }
    setPermanentLoading(false);
    setPermanentDeleteTarget(null);
  }, [permanentDeleteTarget, dispatch]);

  const confirmEmptyAll = useCallback(async () => {
    setEmptyAllLoading(true);
    // Iterated over a copy because the store shrinks as each delete lands, and
    // sequentially rather than in parallel: these are individual API calls, and
    // firing the whole bin at once is how a slow connection ends up half
    // emptied with nothing to say which half went.
    for (const order of [...deletedOrders]) {
      if (order.type === 'full') {
        await dispatch(deleteInvoice(order.id));
      } else {
        await dispatch(permanentDeleteAdvanceOrder(order.id));
      }
    }
    setEmptyAllLoading(false);
    setEmptyAllVisible(false);
  }, [deletedOrders, dispatch]);

  const renderItem = useCallback(({ item }: { item: any }) => (
    <OrderItemCard
      order={item}
      customerName={getCustomerName(item.customerId)}
      shopDetails={shopDetails}
      hasDeclaration={declaredOrderIds.has(item.id)}
      onPress={() => navigation.navigate('OrderDetails', { orderId: item.id })}
      onDelete={() => handleSoftDelete(item.id, item.type as 'full' | 'advance')}
      t={t}
    />
  ), [getCustomerName, navigation, t, shopDetails, declaredOrderIds, handleSoftDelete]);

  const keyExtractor = useCallback((item: any) => String(item.id), []);

  const filterTabsData = useMemo(() => ([
    { key: 'all', label: t('orders.filters.all'), count: activeOrders.length },
    { key: 'pending', label: t('orders.filters.pending'), count: orderCounts.pending },
    { key: 'completed', label: t('orders.filters.complete'), count: orderCounts.completed },
    { key: 'gst', label: t('orders.filters.gst') || 'GST', count: orderCounts.gst },
    { key: 'nongst', label: t('orders.filters.nonGst') || 'Non-GST', count: orderCounts.nongst },
    { key: 'deleted', label: 'Deleted', count: deletedOrders.length },
  ]), [t, activeOrders.length, orderCounts, deletedOrders.length]);

  /**
   * Only filters that would actually return something, plus All.
   *
   * A row of "(0)" chips is six taps that each lead to the same empty screen —
   * on a new shop it was the whole strip. All stays regardless so the row never
   * disappears entirely and there is always something showing which view you
   * are on.
   */
  const visibleFilterTabs = useMemo(
    () => filterTabsData.filter(f => f.key === 'all' || f.count > 0),
    [filterTabsData],
  );

  // The active filter's chip can vanish under you — complete the last pending
  // order while looking at Pending and its count hits zero. Fall back to All
  // rather than stranding the shopkeeper on an empty list with no chip selected.
  useEffect(() => {
    if (!visibleFilterTabs.some(f => f.key === activeFilter)) {
      setActiveFilter('all');
    }
  }, [visibleFilterTabs, activeFilter]);

  return (
    <Box flex={1} bg="#F2F4EF">
      {/* Pushed from the Day Book header since the Day Book took this list's
          tab. Back when there is somewhere to go back to. */}
      <LedgerHeader
        title={t('dayBook.salesTitle') || 'Sales'}
        subtitle={`${activeOrders.length} ${t('orders.total') || 'total orders'}`}
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
        right={<LedgerHeaderAction icon={Plus} label={t('newEntry.sale') || 'New sale'} onPress={handleNewOrder} />}
      />

      <FlatList
        data={activeFilter === 'deleted' ? [] : filteredOrders}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        // Keeps order rows and filter chips tappable while the search keyboard
        // is open, instead of the first tap being spent dismissing it.
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 100,
          ...contentStyle
        }}
        ListHeaderComponent={
          <>
            {/* Flat search and underlined text filters, as on the Retailers
                tab. These were SoneBill's shadowed search card and filled
                pill chips. */}
            <HStack
              bg={Brand.card}
              rounded="$md"
              px="$3"
              h={44}
              mt="$4"
              alignItems="center"
              borderWidth={1}
              borderColor={Brand.line}
            >
              <Icon as={Search} color={Brand.inkFaint} size="sm" />
              <Input variant="outline" flex={1} ml="$1" borderWidth={0}>
                <InputField
                  placeholder={t('orders.search')}
                  placeholderTextColor={Brand.inkFaint}
                  value={q}
                  onChangeText={setQ}
                  maxLength={INPUT_LIMITS.searchQuery}
                  fontSize={15}
                  color={Brand.ink}
                />
              </Input>
              <Pressable p="$2" onPress={() => setIsSortModalOpen(true)}>
                <Icon as={ArrowUpDown} color={sortBy !== 'newest' ? Brand.primary : Brand.inkFaint} size="sm" />
              </Pressable>
            </HStack>

            <Box>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingTop: 12, paddingBottom: 12, gap: 18 }}
              >
                {visibleFilterTabs.map((item) => {
                  const active = activeFilter === item.key;
                  const isTrash = item.key === 'deleted';
                  return (
                    <Pressable
                      key={item.key}
                      onPress={() => setActiveFilter(item.key as FilterType)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      alignItems="center"
                    >
                      <Text
                        fontSize={14}
                        fontWeight={active ? '$bold' : '$medium'}
                        color={active ? (isTrash ? Brand.due : Brand.primary) : Brand.inkMuted}
                      >
                        {item.label} <Text fontSize={12} color={Brand.inkFaint}>{item.count}</Text>
                      </Text>
                      <Box
                        h={2}
                        alignSelf="stretch"
                        mt="$1.5"
                        bg={active ? (isTrash ? Brand.due : Brand.goldFill) : 'transparent'}
                      />
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Box>

            {/* Deleted tab content */}
            {activeFilter === 'deleted' && (
              <Box>
                {deletedOrders.length === 0 ? (
                  <Center mt="$20">
                    <VStack space="md" alignItems="center">
                      <Box p="$5" bg="$coolGray100" rounded="$full">
                        <Trash2 size={32} color="#A39E92" />
                      </Box>
                      <Text color="$coolGray500" fontSize={16} fontWeight="$medium">
                        Deleted is empty
                      </Text>
                      <Text color="$coolGray400" fontSize={14} textAlign="center">
                        Items here auto-remove after 30 days.
                      </Text>
                    </VStack>
                  </Center>
                ) : (
                  <VStack space="sm">
                    <HStack alignItems="center" px="$1" mb="$1" space="sm">
                      <Text fontSize={12} color="$coolGray400" flex={1}>
                        Items are automatically removed 30 days after deletion.
                      </Text>
                      {/* Deliberately understated next to each card's own
                          "Delete forever": this wipes the whole bin, so it
                          should not compete for attention with the per-item
                          action a shopkeeper actually reaches for. */}
                      <Pressable
                        onPress={() => {
                          setEmptyAllCount(deletedOrders.length);
                          setEmptyAllVisible(true);
                        }}
                        hitSlop={8}
                      >
                        <HStack alignItems="center" space="xs">
                          <Trash2 size={13} color="#DC2626" />
                          <Text fontSize={12} fontWeight="$bold" color="#DC2626">
                            Delete all ({deletedOrders.length})
                          </Text>
                        </HStack>
                      </Pressable>
                    </HStack>
                    {deletedOrders.map((order) => (
                      <DeletedOrderCard
                        key={order.id}
                        entry={order}
                        customerName={getCustomerName(order.customerId)}
                        onRestore={() => handleRestore(order.id, order.type as 'full' | 'advance')}
                        onDeleteForever={() => handlePermanentDelete(order.id, order.type as 'full' | 'advance')}
                      />
                    ))}
                  </VStack>
                )}
              </Box>
            )}
          </>
        }
        ListEmptyComponent={
          activeFilter === 'deleted' ? null : (
            <Center mt="$20">
              <VStack space="md" alignItems="center">
                <Box p="$5" bg="$coolGray100" rounded="$full">
                  <Icon as={FileText} size="xl" color="$coolGray400" />
                </Box>
                <Text color="$coolGray400" fontWeight="$medium">
                  <Text style={{ fontSize: 16 }}>{t('orders.noOrdersHead') || 'No orders found'}</Text>
                </Text>
                <Text color="$coolGray400" fontWeight="$medium" style={{ marginTop: -4 }}>
                  <Text style={{ fontSize: 14 }}>{t('orders.noOrdersSubHead') || 'No orders found'}</Text>
                </Text>
                <Pressable
                  px="$4"
                  py="$2"
                  mt="$2"
                  rounded="$xl"
                  flexDirection="row"
                  alignItems="center"
                  style={{ backgroundColor: '#0E4D3C' }}
                  onPress={handleNewOrder}
                >
                  <Icon as={Plus} color="$white" size="sm" />
                  <Text color="$white" ml="$2" fontWeight="$bold">
                    {t('orders.newOrder')}
                  </Text>
                </Pressable>
                {/* An empty list is the app's clearest signal that someone is new
                    and has not managed this yet — the best place to offer help. */}
                <WatchTutorialLink topic={HELP_TOPICS.orders} />
              </VStack>
            </Center>
          )
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
      />

      <SortModal
        isOpen={isSortModalOpen}
        onClose={() => setIsSortModalOpen(false)}
        sortBy={sortBy}
        onSelect={setSortBy}
        t={t}
      />

      {/* Soft delete confirmation */}
      <ConfirmModal
        visible={softDeleteTarget !== null}
        onClose={() => setSoftDeleteTarget(null)}
        tone="warning"
        icon="clock"
        title="Move to Deleted?"
        description={
          <Text fontSize={14} color="$coolGray500" textAlign="center" lineHeight={20}>
            It will be kept in{' '}
            <Text fontWeight="$bold" color="$coolGray800">Deleted</Text>
            {' '}for{' '}
            <Text fontWeight="$bold" color="$coolGray800">30 days</Text>
            {' '}before being removed automatically. You can restore it any time before then.
          </Text>
        }
        confirmLabel="Move to Deleted"
        onConfirm={confirmSoftDelete}
      />

      {/* Permanent delete confirmation */}
      <ConfirmModal
        visible={!!permanentDeleteTarget}
        onClose={() => setPermanentDeleteTarget(null)}
        tone="destructive"
        icon="trash"
        title="Permanently delete?"
        description={
          <Text fontSize={14} color="$coolGray500" textAlign="center" lineHeight={20}>
            This will be removed for good and{' '}
            <Text fontWeight="$bold" color="$coolGray800">cannot be undone</Text>.
          </Text>
        }
        confirmLabel="Delete forever"
        loading={permanentLoading}
        onConfirm={confirmPermanentDelete}
      />

      {/* Empty the whole bin. Names the count rather than saying "all", so the
          shopkeeper is agreeing to a number they can check against the list
          behind the dialog. */}
      <ConfirmModal
        visible={emptyAllVisible}
        onClose={() => setEmptyAllVisible(false)}
        tone="destructive"
        icon="trash"
        title={`Delete all ${emptyAllCount}?`}
        description={
          <Text fontSize={14} color="$coolGray500" textAlign="center" lineHeight={20}>
            All{' '}
            <Text fontWeight="$bold" color="$coolGray800">
              {emptyAllCount}
            </Text>{' '}
            deleted {emptyAllCount === 1 ? 'item' : 'items'} will be removed for good
            and{' '}
            <Text fontWeight="$bold" color="$coolGray800">cannot be restored</Text>.
          </Text>
        }
        confirmLabel="Delete all forever"
        loading={emptyAllLoading}
        onConfirm={confirmEmptyAll}
      />
    </Box>
  );
};

const styles = StyleSheet.create({
  card: {
    elevation: 2,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  activeFilter: {
    backgroundColor: '#145F4A',
  },
  deletedFilter: {
    backgroundColor: '#6B665B',
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

export default OrdersScreen;

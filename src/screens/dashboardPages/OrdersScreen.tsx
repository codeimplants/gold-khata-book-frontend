import React, { useMemo, useCallback, useEffect, useState, memo } from 'react';
import { StyleSheet, RefreshControl, FlatList, Modal, Text as RNText } from 'react-native';
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
  Clock,
  CheckCircle,
  Plus,
  Calendar,
  User,
  ChevronRight,
  FileText,
  Check,
  Trash2,
  RotateCcw,
  Trash,
  FileSignature,
} from 'lucide-react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { BannerHeightContext } from '../../navigation/MainTabs';
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
import { calcItemTotal, calculateItemMakingCharge } from '../../utils/calculations';
import { formatNumber, formatOrderDateTime } from '../../utils/formatter';
import GradientSurface from '../../components/common/GradientSurface';
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

const Header = memo(({ t, totalOrders, onNewOrder }: any) => {
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
    <GradientSurface colors={['#34D399', '#14B8A6']} />

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
          {t('orders.title')}
        </Text>
        <Text color="$white" fontSize={13}>
          {totalOrders} {t('orders.total') || 'total orders'}
        </Text>
      </VStack>

      <Pressable
        bg="rgba(255,255,255,0.2)"
        px="$4"
        py="$2"
        rounded="$xl"
        flexDirection="row"
        alignItems="center"
        onPress={onNewOrder}
      >
        <Icon as={Plus} color="$white" size="sm" />
        <Text color="$white" ml="$2" fontWeight="$bold">
          {t('orders.newOrder')}
        </Text>
      </Pressable>
    </HStack>
  </Box>
  );
});

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
                      color={sortBy === opt.key ? "#8B5CF6" : "$coolGray700"}
                    >
                      {opt.label}
                    </Text>
                    {sortBy === opt.key && <Icon as={Check} color="#8B5CF6" size="sm" />}
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

const OrderItemCard = memo(({ order, customerName, shopDetails, hasDeclaration, onPress, onDelete, t }: any) => {
  const isPending = order.status === 'pending';
  const isAdvance = order.type === 'advance' || order.type === 'Advance';

  const totalWeight = Number(order.totalWeight) || 0;
  const weightPaid = Number(order.weightPaid) || 0;
  const progress = totalWeight > 0 ? (weightPaid / totalWeight) * 100 : 0;

  const displayAmount = getOrderGrandTotal(order, shopDetails);
  const amountStr = displayAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  // Invoice date, plus the creation time when the bill was made the same day —
  // see formatOrderDateTime for why the time cannot come from `date` itself.
  const dateStr = formatOrderDateTime(order.date || order.orderDate, order.createdAt);

  return (
    <Pressable onPress={onPress}>
      <Box bg="$white" rounded="$2xl" p="$4" style={styles.card} mb="$4" borderWidth={1} borderColor="$coolGray100">
        <HStack justifyContent="space-between" alignItems="center" mb="$3">
          <VStack space="xs" flex={1}>
            {/* Wraps, and the number does not shrink below something readable.

                The badges carry no flexShrink, so they held their width and the
                title absorbed the entire deficit: a bill with three of them
                (COMPLETED + GST + Exchange) crushed its own invoice number to a
                single ellipsis, while an advance order with one badge showed
                fine. The identifier is the last thing on the row that should
                give way, so the badges wrap to a second line instead. */}
            <HStack alignItems="center" space="sm" style={{ flexWrap: 'wrap', rowGap: 4 }}>
              <Text
                fontWeight="$bold"
                fontSize={16}
                color="$coolGray900"
                numberOfLines={1}
                style={{ flexShrink: 1, minWidth: 64 }}
              >
                {order.itemName || order.invoiceNumber || order.orderNumber || '---'}
              </Text>
              <Box
                bg={order.status === 'completed' ? '#DCFCE7' : (isPending ? '#FEF3C7' : '#F3F4F6')}
                px="$2"
                py="$0.5"
                rounded="$full"
              >
                <Text
                  color={order.status === 'completed' ? '#166534' : (isPending ? '#92400E' : '$coolGray600')}
                  fontSize={10}
                >
                  {(order.status || '---').toUpperCase()}
                </Text>
              </Box>
              {isGstBill(order) && (
                <Box bg="#EEF2FF" px="$2" py="$0.5" rounded="$full">
                  <Text color="#4F46E5" fontSize={10} fontWeight="$bold">
                    {order.customerGstin ? 'GST • B2B' : 'GST'}
                  </Text>
                </Box>
              )}
              {order.isOrnamentExchanges && (order.exchanges?.length ?? 0) > 0 && (
                <Box bg="#F5F3FF" px="$2" py="$0.5" rounded="$full">
                  <Text color="#7C3AED" fontSize={10} fontWeight="$bold">
                    {t('invoice.exchange.exchange_short') || 'Exchange'}
                  </Text>
                </Box>
              )}
              {/* The signed declaration for that exchange, when one exists.
                  Needed because exchange declarations are no longer listed
                  under the customer's "Sold to us" tab — the order is now the
                  only way to reach one, and without this nothing on the row
                  says whether there is one to reach. An icon rather than a
                  third worded chip: this line already carries up to two, and
                  the labels are longer in Marathi and Hindi than in English. */}
              {hasDeclaration && (
                <Box
                  bg="#F5F3FF"
                  px="$1.5"
                  py="$0.5"
                  rounded="$full"
                  accessibilityLabel={t('declaration.title') || 'Declaration'}
                >
                  <Icon as={FileSignature} size="xs" color="#7C3AED" />
                </Box>
              )}
            </HStack>

            <HStack alignItems="center" space="xs">
              <Icon as={Calendar} size="xs" color="#6B7280" />
              <Text color="$coolGray500" fontSize={12}>
                {dateStr}
              </Text>
            </HStack>
          </VStack>

          <HStack alignItems="center" space="sm">
            {/* Pending only. A settled bill has nothing to chase, and the
                action sends the RETAILER's whole statement rather than this one
                line — an order row is where the question gets asked, not what
                the message is about. See useRetailerReminder. */}
            {isPending && <RemindButton customerId={order.customerId} compact />}

            {order.status === 'completed' || order.type === 'full' ? (
              <Text color="#059669" fontWeight="$black" fontSize={18}>
                ₹{amountStr}
              </Text>
            ) : (
              <Icon as={ChevronRight} color="#9CA3AF" size="sm" />
            )}
            <Pressable
              onPress={(e) => { e.stopPropagation?.(); onDelete?.(); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              p="$1"
            >
              <Trash2 size={16} color="#EF4444" />
            </Pressable>
          </HStack>
        </HStack>

        <HStack alignItems="center" space="xs" mb={isAdvance && isPending ? "$3" : 0}>
          <Icon as={User} size="xs" color="#6B7280" />
          <Text color="$coolGray600" fontSize={13}>
            {customerName}
          </Text>
        </HStack>

        {isAdvance && isPending && (
          <VStack space="xs">
            <Box width="100%" height={8} bg="$coolGray100" rounded="$full" overflow="hidden">
              <Svg height="100%" width="100%">
                <Defs>
                  <LinearGradient id={`progressGrad-${order.id}`} x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor="#8B5CF6" />
                    <Stop offset="1" stopColor="#6D5EF7" />
                  </LinearGradient>
                </Defs>
                <Rect
                  x="0"
                  y="0"
                  width={`${Math.min(progress, 100)}%`}
                  height="100%"
                  fill={`url(#progressGrad-${order.id})`}
                />
              </Svg>
            </Box>

            <HStack justifyContent="space-between" alignItems="center">
              <HStack space="xs" alignItems="center">
                <Text fontSize={12} color="$coolGray500">
                  {formatNumber(weightPaid, 3)}/{formatNumber(totalWeight, 3)} gm
                </Text>
                <Text color="$coolGray300" fontSize={12}>•</Text>
                <Text fontSize={12} color="$coolGray700">
                  ₹{(order.totalPaid || 0).toLocaleString()} paid
                </Text>
              </HStack>
              <Text fontSize={12} color="#d97706">
                ₹{(order.estimatedBalance || 0).toLocaleString()} due
              </Text>
            </HStack>
          </VStack>
        )}

        {(order.status === 'completed' || order.type === 'full') && (
          <HStack mt="$3" pt="$3" borderTopWidth={1} borderColor="$coolGray100" justifyContent="space-between">
            <Text color="$coolGray500" fontSize={12}>
              {order.type === 'full' ? t('orders.fullPayment.title') : t('orders.advancePayment.title')}
            </Text>
            <Text color="$coolGray500" fontSize={12}>
              {order.items?.length || 0} {t('orders.items')}
            </Text>
          </HStack>
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
            <Box bg="#F3F4F6" px="$2" py="$0.5" rounded="$full">
              <Text color="$coolGray600" fontSize={10}>{badge.toUpperCase()}</Text>
            </Box>
          </HStack>
          <Text fontSize={12} color="$coolGray500">{customerName} • {amount}</Text>
        </VStack>
        <Box
          bg="#FFFBEB"
          px="$2"
          py="$1"
          rounded="$lg"
        >
          <Text fontSize={11} color="#D97706" fontWeight="$medium">
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
            <RotateCcw size={13} color="#4B5563" />
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
    <Box flex={1} bg="#F9FAFB">
      <Header t={t} totalOrders={activeOrders.length} onNewOrder={handleNewOrder} />

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
            <HStack
              bg="$white"
              rounded="$2xl"
              px="$4"
              py="$1"
              mt="$4"
              alignItems="center"
              style={styles.card}
            >
              <Icon as={Search} color="#9CA3AF" size="sm" />
              <Input variant="outline" flex={1} ml="$1" borderWidth={0}>
                <InputField
                  placeholder={t('orders.search')}
                  value={q}
                  onChangeText={setQ}
                  maxLength={INPUT_LIMITS.searchQuery}
                  fontSize={14}
                />
              </Input>
              <Box h={20} w={1} bg="$coolGray200" mx="$2" />
              <Pressable p="$2" onPress={() => setIsSortModalOpen(true)}>
                <Icon as={ArrowUpDown} color={sortBy !== 'newest' ? "#8B5CF6" : "#9CA3AF"} size="sm" />
              </Pressable>
            </HStack>

            <Box>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: 16 }}
              >
                {visibleFilterTabs.map((item) => (
                  <Pressable key={item.key} onPress={() => setActiveFilter(item.key as FilterType)}>
                    <Box
                      style={[
                        styles.filter,
                        activeFilter === item.key && (item.key === 'deleted' ? styles.deletedFilter : styles.activeFilter)
                      ]}
                      mr="$3"
                    >
                      {item.key === 'pending' && (
                        <Icon as={Clock} size="xs" color={activeFilter === item.key ? '#fff' : '#4B5563'} mr="$1.5" />
                      )}
                      {item.key === 'completed' && (
                        <Icon as={CheckCircle} size="xs" color={activeFilter === item.key ? '#fff' : '#4B5563'} mr="$1.5" />
                      )}
                      {item.key === 'deleted' && (
                        <Trash2 size={12} color={activeFilter === item.key ? '#fff' : '#4B5563'} style={{ marginRight: 6 }} />
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

            {/* Deleted tab content */}
            {activeFilter === 'deleted' && (
              <Box>
                {deletedOrders.length === 0 ? (
                  <Center mt="$20">
                    <VStack space="md" alignItems="center">
                      <Box p="$5" bg="$coolGray100" rounded="$full">
                        <Trash2 size={32} color="#9CA3AF" />
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
                  style={{ backgroundColor: '#7857ff' }}
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
    backgroundColor: '#8B5CF6',
  },
  deletedFilter: {
    backgroundColor: '#6B7280',
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

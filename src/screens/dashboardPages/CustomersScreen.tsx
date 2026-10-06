// The Retailers tab: every jewellery shop the wholesaler supplies, with what
// each owes in fine gold and in cash.
//
// Presentation follows the Ledger design (src/theme/brand.ts). It used to be
// SoneBill's customer list, under an orange gradient header, with avatar cards
// and shadowed pill filters. App Review rejected this app as a SoneBill copy
// under guideline 4.3(a) (APP_STORE_4.3_REWORK.md). The logic below is
// unchanged: per-retailer dues through utils/dues.ts, trashed orders left out,
// search, filters, sort and the guarded delete.
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  StyleSheet,
  RefreshControl,
  FlatList,
  Modal,
  ScrollView,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSheetBottomInset } from "../../hooks/useSheetBottomInset";
import { VStack, Text as GText } from "@gluestack-ui/themed";
import {
  Plus,
  Search,
  Store,
  ArrowUpDown,
  Check,
  Trash2,
} from "lucide-react-native";
import { useNavigation, useFocusEffect, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { MainTabParamList } from "../../navigation/types";
import { useTranslation } from "../../hooks/useTranslation";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  fetchCustomers,
  fetchOrders,
  deleteCustomer,
  clearUserData,
  fetchRetailerAccounts,
} from "../../store/data/dataSlice";
import { endImpersonation } from "../../store/auth/authSlice";
import ConfirmModal from "../../components/ConfirmModal";
import ImpersonationBlockModal from "../../components/ImpersonationBlockModal";
import { toast } from "../../components/common/Toast";
import { formatCurrencyValue } from "../../utils/formatter";
import { getFullImageUrl } from "../../utils/imageUtils";
import AddCustomerModal from "../../components/AddCustomerModal";
import { LAYOUT, useContentContainerStyle } from "../../constants/layout";
import WatchTutorialLink from "../../components/common/WatchTutorialLink";
import { HELP_TOPICS } from "../../tutorials/catalog";
import { INPUT_LIMITS } from "../../constants/inputLimits";
import { orderOutstanding, formatGrams, CASH_SETTLED_EPSILON, WEIGHT_SETTLED_EPSILON_GM } from '../../utils/dues';
import RemindButton from '../../components/customers/RemindButton';
import LedgerHeader, { LedgerHeaderAction } from "../../components/ledger/LedgerHeader";
import { Brand, tabularNums } from "../../theme/brand";

/* ---------------- SUB-COMPONENTS ---------------- */

// `goldDue`/`cashDue` are this retailer's two outstanding positions summed
// across their orders — the pair a wholesaler actually needs from a list.
const EMPTY_STATS = { orders: 0, pending: 0, completed: 0, goldDue: 0, cashDue: 0, total: 0, lastDate: 0 };

/**
 * One retailer as a ledger row. Name, code and phone on the left; what they
 * owe in fine gold and in cash in two aligned columns on the right.
 *
 * Only what the retailer owes is shown, which is the one thing a wholesaler
 * scans this list for. Dashes rather than zeroes when an account is clear, so
 * the eye lands only on the rows that owe.
 */
const RetailerRow = React.memo(({ customer, stats, held, onPress, onDelete, t }: any) => {
  const s = stats || EMPTY_STATS;
  const gramShort = t('common.gramShort') || 'gm';
  const owes = s.goldDue > 0 || s.cashDue > 0;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
      {/* Their photo when they have one, a monogram otherwise. */}
      {customer.profilePhoto?.url ? (
        <Image
          source={{ uri: getFullImageUrl(customer.profilePhoto.url) || undefined }}
          style={styles.photo}
        />
      ) : (
        <View style={styles.monogram}>
          <Text style={styles.monogramText}>{customer.name?.charAt(0).toUpperCase()}</Text>
        </View>
      )}

      <View style={styles.colName}>
        {/* The code sits on the name line, not under it: the pair is one
            identity, and a wholesaler scanning a list of six Rameshes is
            reading across, not down. */}
        <Text style={styles.name} numberOfLines={1}>
          {customer.name}
          {customer.customerCode ? <Text style={styles.code}>{`  ${customer.customerCode}`}</Text> : null}
        </Text>
        {customer.phone ? (
          <Text style={styles.sub}>{customer.phone}</Text>
        ) : (
          // Placeholder rather than an empty line, so a row for a retailer
          // added without a number does not read as half-rendered.
          <Text style={[styles.sub, { fontStyle: 'italic', color: Brand.inkFaint }]}>
            {t('customers.noPhone') || 'No phone number'}
          </Text>
        )}
      </View>

      <View style={styles.colFigures}>
        <Text style={[styles.figure, { color: s.goldDue > 0 ? Brand.gold : Brand.inkFaint }, tabularNums]} numberOfLines={1}>
          {s.goldDue > 0 ? formatGrams(s.goldDue, gramShort) : '—'}
        </Text>
        <Text style={[styles.figureSmall, { color: s.cashDue > 0 ? Brand.ink : Brand.inkFaint }, tabularNums]} numberOfLines={1}>
          {s.cashDue > 0 ? formatCurrencyValue(s.cashDue) : '—'}
        </Text>
        {/* What the shop holds for them: cash with the rate not fixed, an
            advance, gold held. Beside the dues, never netted off them. */}
        {(held?.cash >= CASH_SETTLED_EPSILON || held?.gold >= WEIGHT_SETTLED_EPSILON_GM) && (
          <Text style={[styles.held, tabularNums]} numberOfLines={1}>
            {t('khata.holds') || 'Holds'}{' '}
            {[
              held.cash >= CASH_SETTLED_EPSILON ? formatCurrencyValue(held.cash) : null,
              held.gold >= WEIGHT_SETTLED_EPSILON_GM ? formatGrams(held.gold, gramShort) : null,
            ].filter(Boolean).join(' · ')}
          </Text>
        )}
      </View>

      <View style={styles.colActions}>
        {/* Only for a retailer with something on their account. A Remind on a
            settled retailer sends "Nothing due", which nobody wants. */}
        {owes ? <RemindButton customerId={customer.id} compact /> : <View style={{ width: 32 }} />}
        {/* stopPropagation would be a DOM API; a nested Pressable claims the
            touch itself, so the tap deletes rather than opening the row. */}
        <Pressable
          onPress={onDelete}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={t('customers.delete.title') || 'Delete retailer'}
          style={styles.delete}
        >
          <Trash2 size={15} color={Brand.inkFaint} />
        </Pressable>
      </View>
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
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={[styles.sheetWrap, LAYOUT.isWeb && { justifyContent: 'center' }]}>
          <Pressable
            onPress={() => {}}
            style={[
              styles.sheet,
              { paddingBottom: bottomInset },
              LAYOUT.isWeb && { alignSelf: 'center', maxWidth: 450, borderRadius: 16 },
            ]}
          >
            <Text style={styles.sheetTitle}>{t('customers.sort.title') || 'Sort By'}</Text>
            {options.map((opt, i) => {
              const active = sortBy === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => {
                    onSelect(opt.key);
                    onClose();
                  }}
                  style={[styles.sortRow, i < options.length - 1 && styles.rowDivider]}
                >
                  <Text style={[styles.sortText, active && { color: Brand.primary, fontWeight: '700' }]}>
                    {opt.label}
                  </Text>
                  {active && <Check size={18} color={Brand.primary} />}
                </Pressable>
              );
            })}
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
};

type FilterType = 'all' | 'pending' | 'completed' | 'owing' | 'noOrders';

export default function CustomersScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<MainTabParamList, 'Customers'>>();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  // Centres and caps content on iPad; no-op on phones.
  const contentStyle = useContentContainerStyle();
  const { customers, orders } = useAppSelector((state) => state.data);
  const accountsById = useAppSelector((state) => state.data.retailerAccounts);
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
    dispatch(fetchRetailerAccounts());
    // The per-retailer figures below are derived on the client, so this tab
    // needs orders even though it never lists them. Cached — a no-op when the
    // Khata tab already loaded them.
    dispatch(fetchOrders());
  }, [dispatch]);

  // Arrived with a filter param. Consumed immediately so it cannot re-apply on
  // a later visit.
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
  // so without this a filter the wholesaler never chose silently survives
  // until they notice the list is short. Empty deps so only focus and blur
  // drive it.
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
    ]);
    setRefreshing(false);
  }, [dispatch]);

  /**
   * Counts and dues per retailer, in one pass over the orders rather than a
   * filter per row: with a few hundred retailers the per-row version is
   * O(retailers × orders) on every keystroke in the search box.
   *
   * Soft-deleted orders are excluded so a trashed sale stops counting towards
   * a retailer, exactly as it does everywhere else.
   */
  const statsByCustomer = useMemo(() => {
    const map = new Map<string, { orders: number; pending: number; completed: number; goldDue: number; cashDue: number; total: number; lastDate: number }>();
    const entry = (id: string) => {
      let e = map.get(id);
      if (!e) {
        e = { orders: 0, pending: 0, completed: 0, goldDue: 0, cashDue: 0, total: 0, lastDate: 0 };
        map.set(id, e);
      }
      return e;
    };

    (orders || []).forEach((o: any) => {
      if (!o?.customerId || o.deletedAt) return;
      const e = entry(o.customerId);
      e.orders += 1;
      if (o.status === 'pending') e.pending += 1;
      else if (o.status === 'completed') e.completed += 1;
      e.total += Number(o.amount) || 0;

      // Read through the same helper the Khata tab and the retailer screen
      // use, so a retailer's dues read identically wherever they appear.
      const due = orderOutstanding(o);
      e.goldDue += due.gold;
      e.cashDue += due.cash;

      const ts = o.date ? new Date(o.date).getTime() : 0;
      if (ts > e.lastDate) e.lastDate = ts;
    });

    return map;
  }, [orders]);

  const baseList = useMemo(
    () => (customers || []).filter(c => c && (c.id || c._id) && c.name),
    [customers],
  );

  const filterCounts = useMemo(() => {
    let pending = 0, completed = 0, owing = 0, noOrders = 0;
    baseList.forEach((c: any) => {
      const s = statsByCustomer.get(c.id) || EMPTY_STATS;
      if (s.pending > 0) pending += 1;
      if (s.completed > 0) completed += 1;
      if (s.orders === 0) noOrders += 1;
      if (s.goldDue > 0 || s.cashDue > 0) owing += 1;
    });
    return { all: baseList.length, pending, completed, owing, noOrders };
  }, [baseList, statsByCustomer]);

  const filteredCustomers = useMemo(() => {
    let list = baseList;

    if (activeFilter !== 'all') {
      list = list.filter((c: any) => {
        const s = statsByCustomer.get(c.id) || EMPTY_STATS;
        if (activeFilter === 'pending') return s.pending > 0;
        if (activeFilter === 'completed') return s.completed > 0;
        if (activeFilter === 'owing') return s.goldDue > 0 || s.cashDue > 0;
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
          // Retailers with no sales have no date to rank by, so they sort last
          // rather than sharing the top with the most recent buyer.
          return (stat(b).lastDate || 0) - (stat(a).lastDate || 0);
        default:
          return String(a.name).localeCompare(String(b.name));
      }
    });
  }, [baseList, statsByCustomer, activeFilter, q, sortBy]);

  // "Owing" comes first after All: who owes is the question this tab answers.
  const filterTabsData = useMemo(() => ([
    { key: 'all', label: t('customers.filters.all') || 'All', count: filterCounts.all },
    { key: 'owing', label: t('customers.filters.owing') || 'Owing', count: filterCounts.owing },
    { key: 'pending', label: t('customers.filters.pending') || 'Pending', count: filterCounts.pending },
    { key: 'completed', label: t('customers.filters.completed') || 'Complete', count: filterCounts.completed },
    { key: 'noOrders', label: t('customers.filters.noOrders') || 'No orders', count: filterCounts.noOrders },
  ]), [t, filterCounts]);

  /** Only filters that would return something, plus All. */
  const visibleFilterTabs = useMemo(
    () => filterTabsData.filter(f => f.key === 'all' || f.count > 0),
    [filterTabsData],
  );

  // The active filter's tab can vanish under you, e.g. delete the last
  // retailer that matched it. Fall back to All rather than stranding the user
  // on an empty list with nothing selected.
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
    <RetailerRow
      customer={item}
      stats={statsByCustomer.get(item.id)}
      held={accountsById?.[item.id]
        ? { cash: accountsById[item.id].heldCash || 0, gold: accountsById[item.id].meltCredit || 0 }
        : undefined}
      t={t}
      onPress={() => navigation.navigate("CustomerDetails", { customerId: item.id })}
      onDelete={() => handleRequestDelete(item)}
    />
  ), [navigation, statsByCustomer, accountsById, t, handleRequestDelete]);

  /** Counts for the confirmation's "this would orphan…" list. */
  const pendingDeleteStats = pendingDelete
    ? statsByCustomer.get(pendingDelete.id) || EMPTY_STATS
    : EMPTY_STATS;
  const pendingHasRecords = pendingDeleteStats.orders > 0;

  const keyExtractor = useCallback((item: any, index: number) => item.id || item._id || index.toString(), []);

  return (
    <View style={styles.screen}>
      <LedgerHeader
        title={t("customers.title") || "Retailers"}
        subtitle={`${customers.length} ${t("customers.count") || "retailers"}`}
        right={
          <LedgerHeaderAction icon={Plus} label={t("customers.add") || "Add"} onPress={() => setOpen(true)} />
        }
      />

      <FlatList
        data={filteredCustomers}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        // The search box lives in ListHeaderComponent, so without this the first
        // tap on a row while typing only dismisses the keyboard.
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[{ paddingBottom: 40 }, contentStyle]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Brand.primary]} />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.searchWrap}>
              <View style={styles.search}>
                <Search size={18} color={Brand.inkFaint} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={t("customers.searchWithCode") || t("customers.search") || "Search"}
                  placeholderTextColor={Brand.inkFaint}
                  value={q}
                  onChangeText={setQ}
                  maxLength={INPUT_LIMITS.searchQuery}
                />
                <Pressable onPress={() => setIsSortModalOpen(true)} hitSlop={8} accessibilityLabel={t('customers.sort.title') || 'Sort By'}>
                  <ArrowUpDown size={18} color={sortBy !== 'nameAsc' ? Brand.primary : Brand.inkFaint} />
                </Pressable>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filters}
            >
              {visibleFilterTabs.map((item) => {
                const active = activeFilter === item.key;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => setActiveFilter(item.key as FilterType)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={styles.filterTab}
                  >
                    <Text style={[styles.filterText, active && styles.filterTextActive]}>
                      {item.label} <Text style={styles.filterCount}>{item.count}</Text>
                    </Text>
                    <View style={[styles.filterLine, active && styles.filterLineActive]} />
                  </Pressable>
                );
              })}
            </ScrollView>

            {filteredCustomers.length > 0 && (
              <View style={styles.tableHead}>
                <View style={{ width: 52 }} />
                <Text style={[styles.th, { flex: 1 }]}>{t('khata.colRetailer') || 'Retailer'}</Text>
                <Text style={[styles.th, styles.colFigures]}>
                  {t('khata.colGold') || 'Gold'} / {t('khata.colCash') || 'Cash'}
                </Text>
                <View style={styles.colActions} />
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Store size={28} color={Brand.primary} />
            </View>
            <Text style={styles.emptyTitle}>
              {q.trim() || activeFilter !== 'all'
                ? t("customers.noResults") || "No retailers match your search"
                : t("customers.noCustomers") || "No retailers found"}
            </Text>
            {!q.trim() && activeFilter === 'all' && (
              <VStack space="sm" alignItems="center">
                <GText fontSize={14} color={Brand.inkMuted} textAlign="center">
                  {t("customers.emptySubHead") || "Add the jewellery shops you supply"}
                </GText>
                <Pressable style={styles.emptyButton} onPress={() => setOpen(true)}>
                  <Plus size={16} color="#FFFFFF" />
                  <Text style={styles.emptyButtonText}>{t("customers.addNew") || "Add New Retailer"}</Text>
                </Pressable>
                <WatchTutorialLink topic={HELP_TOPICS.customers} />
              </VStack>
            )}
          </View>
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

      {/* Same warning as the retailer screen: the backend removes only the
          retailer row, so their sales are left without one. */}
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
              <GText fontSize={14} color={Brand.inkMuted} textAlign="center" lineHeight={20}>
                {t('customers.delete.hasRecords')}
              </GText>
              <VStack space="xs" bg={Brand.dueSoft} rounded="$lg" px="$4" py="$3">
                {pendingDeleteStats.orders > 0 && (
                  <GText fontSize={13} fontWeight="$bold" color={Brand.due} textAlign="center">
                    {pendingDeleteStats.orders} {t('customers.delete.records.orders')}
                  </GText>
                )}
                {pendingDeleteStats.pending > 0 && (
                  <GText fontSize={13} fontWeight="$bold" color={Brand.due} textAlign="center">
                    {pendingDeleteStats.pending} {t('customers.delete.records.pending')}
                  </GText>
                )}
              </VStack>
              <GText fontSize={13} color={Brand.inkMuted} textAlign="center" lineHeight={18}>
                {t('customers.delete.recordsNote')}
              </GText>
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Brand.paper,
  },

  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 44,
    paddingHorizontal: 12,
    backgroundColor: Brand.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Brand.line,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Brand.ink,
    paddingVertical: 0,
  },

  filters: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 18,
  },
  filterTab: {
    alignItems: 'center',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: Brand.inkMuted,
  },
  filterTextActive: {
    color: Brand.primary,
    fontWeight: '700',
  },
  filterCount: {
    fontSize: 12,
    color: Brand.inkFaint,
  },
  filterLine: {
    height: 2,
    alignSelf: 'stretch',
    marginTop: 6,
    backgroundColor: 'transparent',
  },
  filterLineActive: {
    backgroundColor: Brand.goldFill,
  },

  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
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

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Brand.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.line,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.line,
  },
  photo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  monogram: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: {
    color: Brand.primary,
    fontWeight: '700',
    fontSize: 17,
  },
  colName: {
    flex: 1,
    paddingRight: 8,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: Brand.ink,
  },
  code: {
    fontSize: 12,
    fontWeight: '600',
    color: Brand.inkFaint,
  },
  sub: {
    fontSize: 13,
    color: Brand.inkMuted,
    marginTop: 2,
  },
  colFigures: {
    width: 104,
    alignItems: 'flex-end',
    textAlign: 'right',
  },
  figure: {
    fontSize: 14,
    fontWeight: '700',
  },
  figureSmall: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  held: {
    fontSize: 11,
    fontWeight: '600',
    color: Brand.received,
    marginTop: 2,
  },
  colActions: {
    width: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  delete: {
    padding: 4,
  },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(29, 27, 22, 0.45)',
  },
  sheetWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    backgroundColor: Brand.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Brand.ink,
    marginBottom: 8,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  sortText: {
    fontSize: 15,
    color: Brand.inkSoft,
  },

  empty: {
    alignItems: 'center',
    marginTop: 64,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Brand.inkSoft,
    textAlign: 'center',
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Brand.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    height: 42,
    marginTop: 6,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});

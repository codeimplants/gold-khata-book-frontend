import React from 'react';
import { StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import {
  Box, HStack, VStack, Text, Pressable, Icon,
} from '@gluestack-ui/themed';
import { ArrowLeft, Plus, Trash2, Check, Calendar, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { LAYOUT } from '../../constants/layout';
import CustomerInfoCard from '../../components/common/CustomerInfoCard';
import GradientSurface from '../../components/common/GradientSurface';
import SelectField from '../../components/common/SelectField';
import DatePickerModal from '../../components/common/DatePickerModal';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  createWholesaleOrder, fetchCustomers, fetchMetalRates, fetchCatalogProducts,
  fetchRetailerAccount, applyMeltCredit, addMetalPaymentToOrder,
} from '../../store/data/dataSlice';
import { useOldGoldMelt } from '../../hooks/useOldGoldMelt';
import { useShopRate } from '../../hooks/useShopRate';
import FloatingLabelInput from '../../components/common/FloatingLabelInput';
import { toast, ToastViewport } from '../../components/common/Toast';
import { priceLine, totalFine995, cashValueOfFine995, isLinePriceable } from '../../utils/goldPricing';
import { formatCurrencyValue } from '../../utils/formatter';
import { formatGrams } from '../../utils/dues';

const PURPLE = '#6366F1';
const AMBER = '#B45309';

/** A line as it is being typed — strings, because a half-typed "9." is not a number. */
interface DraftItem {
  key: string;
  itemName: string;
  weight: string;
  purity: string;
  wastage: string;
  rate: string;
  /** Follows the live rate until the user types over it. */
  useLiveRate: boolean;
}

/**
 * `rate` is pre-filled ONLY from a rate the shopkeeper set themselves.
 *
 * The market feed is deliberately not seeded: a field that arrives holding
 * today's live price is one nobody reads, and a wholesale line is often agreed
 * at a rate that is not the market's. A rate the shop set this morning is a
 * different thing — it IS their answer for today, so making them retype it on
 * every line would be asking a question they have already answered.
 */
const blankItem = (shopRate?: number): DraftItem => ({
  key: Math.random().toString(36).slice(2),
  itemName: '',
  weight: '',
  purity: '',
  wastage: '',
  rate: shopRate && shopRate > 0 ? String(shopRate) : '',
  // Off either way. Ticking it makes the line follow the rate as it moves;
  // until then nothing writes to the field but the user.
  useLiveRate: false,
});

const num = (v: string) => Number(String(v ?? '').trim()) || 0;

const NewOrderScreen = () => {
  const navigation: any = useNavigation();
  const route: any = useRoute();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const customers = useAppSelector(s => s.data.customers);
  const catalogProducts = useAppSelector(s => s.data.catalogProducts);
  const gramShort = t('common.gramShort') || 'gm';

  const meltEnabled = useOldGoldMelt();

  /**
   * The rate this order is priced at: the shop's own for today when they have
   * set one, the live feed when they have not.
   *
   * Read through `useShopRate` rather than off metalRates directly, so an order
   * cannot be raised at the market rate on a day the shop decided to deal at a
   * different one — which was the whole point of letting them set it.
   */
  const shopRate = useShopRate();
  const liveRate = shopRate.rate;

  const [customerId, setCustomerId] = React.useState<string | undefined>(route.params?.customerId);
  const [items, setItems] = React.useState<DraftItem[]>(() => [blankItem()]);
  const [payCash, setPayCash] = React.useState('');
  const [payGold, setPayGold] = React.useState('');
  /** Grams of 99.50 drawn from melt credit this retailer already has here. */
  const [payMelt, setPayMelt] = React.useState('');
  const [includeGST, setIncludeGST] = React.useState(false);
  // YYYY-MM-DD, the shape DatePickerModal reads and writes.
  const [orderDate, setOrderDate] = React.useState(() => new Date().toISOString().split('T')[0]);
  const [datePickerOpen, setDatePickerOpen] = React.useState(false);
  /** Only one row is open at a time; a finished row collapses to its summary. */
  const [expandedKey, setExpandedKey] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    dispatch(fetchCustomers());
    dispatch(fetchMetalRates());
    dispatch(fetchCatalogProducts());
  }, [dispatch]);

  // SelectCustomer navigates back to this route with the choice on params, so
  // the picker's answer arrives as a param change rather than a return value.
  React.useEffect(() => {
    const chosen = route.params?.customerId;
    if (chosen && chosen !== customerId) setCustomerId(chosen);
  }, [route.params?.customerId, customerId]);

  // Retailer first, then the items — the order the old flow asked in, and the
  // order the counter works in: you know who you are billing before you start
  // weighing. Arriving here with nobody chosen hands straight over to the
  // picker rather than showing a form with an empty slot at the top of it.
  // `replace` so Back from the picker leaves the order, not bounces into it.
  React.useEffect(() => {
    if (!customerId) {
      navigation.replace('SelectCustomer', { next: 'NewOrder' });
    }
    // Only on arrival; re-running on every customerId change would re-enter
    // the picker the moment the user cleared it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Fills empty lines from the shop's OWN rate, and keeps ticked lines
   * following whatever rate is in force.
   *
   * The shop rate is not known on the first render — it is fetched — so the
   * first row cannot be seeded by `blankItem` alone. Only an empty rate is
   * filled: a line the shopkeeper has typed into is theirs, and a rate that
   * changed under them mid-order would be worse than one they have to enter.
   *
   * Still nothing seeded from the live feed. That distinction is the whole
   * point — the market is a fallback for pricing, not an answer to put in
   * their field.
   */
  React.useEffect(() => {
    if (!liveRate) return;
    setItems(prev => prev.map(i => {
      if (i.useLiveRate) return { ...i, rate: String(liveRate) };
      if (shopRate.isOverride && !i.rate.trim()) return { ...i, rate: String(shopRate.rate) };
      return i;
    }));
  }, [liveRate, shopRate.isOverride, shopRate.rate]);

  // Open the row that is being filled. Without this the screen loads with
  // everything collapsed and nothing to type into.
  React.useEffect(() => {
    setExpandedKey(prev => prev ?? items[0]?.key ?? null);
  }, [items]);

  const retailer = customers.find((c: any) => c.id === customerId);

  /**
   * Melt credit this retailer already has with the shop.
   *
   * Fetched per retailer, and re-fetched whenever the chosen one changes,
   * because the balance is what the Melt field is allowed to spend. It is
   * deliberately only a display: the server checks the weight against the
   * credit again on apply, so another device drawing the same credit down
   * first is refused rather than double-spent.
   */
  const meltCredit = useAppSelector(
    s => (customerId ? s.data.retailerAccounts[customerId]?.meltCredit : 0) || 0,
  );

  React.useEffect(() => {
    if (!meltEnabled || !customerId) return;
    dispatch(fetchRetailerAccount({ customerId }));
  }, [dispatch, meltEnabled, customerId]);

  // A retailer swap must not carry the previous one's credit draw across —
  // that weight belongs to an account this order is no longer against.
  React.useEffect(() => { setPayMelt(''); }, [customerId]);

  const meltAvailable = meltEnabled ? meltCredit : 0;
  /** Clamped for the maths, so an over-typed figure cannot show the order as
   *  settled by credit that is not there. The field itself keeps what was
   *  typed, and the hint below it says what the ceiling is. */
  const meltApplied = Math.min(num(payMelt), meltAvailable);
  const meltOverdrawn = num(payMelt) > meltAvailable + 0.0005;

  const addItem = () => {
    const next = blankItem(shopRate.isOverride ? shopRate.rate : undefined);
    setItems(prev => [...prev, next]);
    setExpandedKey(next.key);
  };

  /** Pulls name and purity across from a saved product. */
  const fillFromCatalog = (key: string, productId: string) => {
    const saved: any = catalogProducts.find((p: any) => p.id === productId);
    if (!saved) return;
    setItems(prev => prev.map(i => i.key === key ? {
      ...i,
      itemName: saved.name || i.itemName,
      // Catalog purity is a karat label on older rows ("22K"); take the number
      // out of it rather than dropping a string into a numeric field.
      purity: (() => {
        const raw = String(saved.purity ?? '');
        const n = parseFloat(raw.replace(/[^0-9.]/g, ''));
        return Number.isFinite(n) && n > 0 ? String(n) : i.purity;
      })(),
      weight: saved.grossWt ? String(saved.grossWt) : i.weight,
    } : i));
  };

  const patch = (key: string, field: keyof DraftItem, value: any) =>
    setItems(prev => prev.map(i => (i.key === key ? { ...i, [field]: value } : i)));

  const priced = React.useMemo(
    () => items.map(i => ({
      key: i.key,
      priceable: isLinePriceable({ weight: i.weight, purity: i.purity }),
      ...priceLine({ weight: num(i.weight), purity: num(i.purity), wastage: num(i.wastage) }),
      // `|| liveRate` mirrors what onSave sends for a line with no rate typed.
      // Without it a blank rate showed VALUE Rs.0 on screen while the order
      // saved at the live rate — the screen and the stored bill disagreeing
      // about the same order.
      value: cashValueOfFine995(
        priceLine({ weight: num(i.weight), purity: num(i.purity), wastage: num(i.wastage) }).fine995,
        num(i.rate) || liveRate,
      ),
    })),
    [items, liveRate],
  );

  const totals = React.useMemo(() => {
    const fine = totalFine995(items.map(i => ({
      weight: num(i.weight), purity: num(i.purity), wastage: num(i.wastage),
    })));
    const value = priced.reduce((sum, p) => sum + p.value, 0);
    const gst = includeGST ? value * 0.03 : 0;
    return { fine, value, gst, grand: value + gst };
  }, [items, priced, includeGST]);

  /**
   * The order type, inferred rather than chosen.
   *
   * There is no Full/Part toggle: pay the whole thing and it is a full payment,
   * pay less and it is part. The number the user already has to enter decides
   * it, so the extra question the old popup asked answers itself.
   */
  /**
   * The rate a shortfall or an excess is priced at.
   *
   * The effective rate across the lines actually entered — Σvalue / Σfine —
   * which is what the shopkeeper typed, per line, weighted by how much metal
   * each line carries. Falls back to the live rate before any line is priceable,
   * because a due of "X gm" with no rupee figure beside it is exactly the
   * conversion the shopkeeper would otherwise do in their head.
   */
  const settlementRate = React.useMemo(
    () => (totals.fine > 0 && totals.value > 0 ? totals.value / totals.fine : liveRate),
    [totals.fine, totals.value, liveRate],
  );

  const settling = React.useMemo(() => {
    const cashBuys = num(payCash) > 0 && settlementRate > 0 ? num(payCash) / settlementRate : 0;
    // Melt credit is already grams of 99.50 — it was converted when the lot was
    // tested, so it lands beside the gold leg rather than being converted again.
    const covered = cashBuys + num(payGold) + meltApplied;

    /**
     * SIGNED, unlike the clamped `remaining` below it.
     *
     * Positive means the retailer still owes; negative means they have handed
     * over more than the order comes to. The screen used to keep only the
     * clamped figure, so a ₹7.5 lakh payment against a ₹1.55 lakh order read
     * "Full payment" with nothing to say ₹6 lakh had been overpaid.
     */
    const difference = totals.fine - covered;
    const settled = Math.abs(difference) <= 0.0005;

    return {
      covered,
      difference,
      remaining: Math.max(0, difference),
      excess: Math.max(0, -difference),
      isFull: totals.fine > 0 && difference <= 0.0005,
      isOver: totals.fine > 0 && difference < -0.0005,
      isExact: totals.fine > 0 && settled,
    };
  }, [payCash, payGold, meltApplied, settlementRate, totals.fine]);

  /** Every row has to be priceable before another can be opened. */
  const canAddItem = items.length > 0 && items.every(i =>
    isLinePriceable({ weight: i.weight, purity: i.purity }) && i.itemName.trim().length > 0,
  );

  const canSave = !!customerId && priced.some(p => p.priceable) && !saving && !meltOverdrawn;

  const onSave = async () => {
    if (!customerId) { toast.error(t('orders.selectRetailerFirst') || 'Choose a retailer first'); return; }
    const usable = items.filter(i => isLinePriceable({ weight: i.weight, purity: i.purity }));
    if (usable.length === 0) { toast.error(t('orders.addOneItem') || 'Add at least one item with a weight and purity'); return; }

    if (meltOverdrawn) {
      toast.error(
        `${t('orders.meltOverdrawn') || 'That is more melt credit than this retailer has'} (${formatGrams(meltAvailable, gramShort)})`,
      );
      return;
    }

    setSaving(true);
    const action = await dispatch(createWholesaleOrder({
      customerId,
      orderDate,
      items: usable.map(i => ({
        itemName: i.itemName?.trim() || t('orders.itemsFallback') || 'Item',
        weight: num(i.weight),
        purity: num(i.purity),
        wastage: num(i.wastage),
        rate: num(i.rate) || liveRate,
      })),
      /**
       * The SAME rate the screen priced the payment at, not the live one.
       *
       * The server turns the cash leg into grams with `amount / goldRate`, so
       * sending a different rate than the one the Settles/Remaining figures
       * were computed with makes the saved order disagree with the screen that
       * created it — the exact class of divergence that put a bill and an order
       * screen Rs.4,500 apart before (see CLAUDE.md, testing policy).
       *
       * `settlementRate` is the lines' own weighted rate, falling back to live
       * only when nothing is priceable yet, so an order taken at a rate the
       * shop agreed earlier settles at that rate rather than today's.
       */
      bookingRate: settlementRate,
      includeGST,
      ...(includeGST ? { gstRate: 3 } : {}),
      ...(num(payCash) > 0
        ? { initialPayment: { amount: num(payCash), goldRate: settlementRate } }
        : {}),
    }) as any);

    if (!createWholesaleOrder.fulfilled.match(action)) {
      setSaving(false);
      toast.error(String(action.payload || 'Could not save the order'));
      return;
    }

    /**
     * The metal legs, posted after the order exists.
     *
     * `initialPayment` on order-create carries only cash and a rate, so gold
     * handed over at the counter cannot ride along with the order it pays for —
     * it used to be typed into the Gold field, counted towards Remaining on
     * screen, and then silently dropped at save. Both legs go on as payments
     * against the saved order instead.
     *
     * Sequential, not parallel: they hit the same order document, and two
     * concurrent payment writes race to overwrite each other's balance.
     *
     * A failure here leaves a SAVED order with a payment missing, which is
     * recoverable (add the payment from the order screen) but must not be
     * reported as success — so the order id is kept and the specific leg that
     * failed is named, rather than showing "Order created" over a lost payment.
     */
    const orderId = String((action.payload as any)?.id || '');
    const failures: string[] = [];

    if (orderId && num(payGold) > 0) {
      const goldLeg = await dispatch(addMetalPaymentToOrder({
        orderId,
        goldWeight: num(payGold),
        date: orderDate,
      }) as any);
      if (!addMetalPaymentToOrder.fulfilled.match(goldLeg)) {
        failures.push(String(goldLeg.payload || t('orders.goldWeight') || 'Gold'));
      }
    }

    if (orderId && meltApplied > 0) {
      const meltLeg = await dispatch(applyMeltCredit({
        customerId,
        orderId,
        weight: meltApplied,
        date: orderDate,
      }) as any);
      if (!applyMeltCredit.fulfilled.match(meltLeg)) {
        failures.push(String(meltLeg.payload || t('orders.meltCredit') || 'Melt credit'));
      }
    }

    setSaving(false);

    if (failures.length > 0) {
      toast.error(
        `${t('orders.savedPaymentFailed') || 'Order saved, but a payment did not go on it'}: ${failures.join(' · ')}`,
      );
    } else {
      toast.success(t('orders.created') || 'Order created');
    }

    /**
     * Out to the Orders tab, not `goBack()`.
     *
     * Back does not lead anywhere useful from here. Arriving with no retailer
     * REPLACES this screen with the picker, which then navigates to a fresh
     * NewOrder — so the screen underneath a saved order is SelectCustomer, and
     * going back landed the shopkeeper on "choose a retailer" immediately after
     * finishing an order, as if nothing had been saved.
     *
     * `reset` rather than `navigate` so the half-finished picker and the
     * completed order screen both leave the stack: the order is saved, and Back
     * from the tabs must not walk into it again.
     */
    navigation.reset({
      index: 0,
      routes: [{ name: 'MainTabs', params: { screen: 'Orders' } }],
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['top']}>
      <ToastViewport />

      <HStack
        alignItems="center" px="$4" py="$3" bg="$white"
        borderBottomWidth={1} borderColor="#F3F4F6"
        style={LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}}
      >
        <Pressable onPress={() => navigation.goBack()} p="$2" mr="$1">
          <Icon as={ArrowLeft} size="lg" color="#111827" />
        </Pressable>
        <VStack flex={1}>
          <Text fontWeight="$bold" fontSize={20} color="#111827">
            {t('orders.newOrder') || 'New Order'}
          </Text>
          <Text fontSize={12} color="$coolGray500">
            {priced.filter(p => p.priceable).length} {t('orders.itemsCount') || 'items'}
          </Text>
        </VStack>
      </HStack>

      {/* `height` on Android, never undefined: gradle.properties sets
          edgeToEdgeEnabled=true, so Android stops honouring the manifest's
          adjustResize as a native resize and the keyboard covers the field
          being typed into — which reads as a dead input. See CLAUDE.md. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + 140,
            // Without this the form stretches the full width of a desktop
            // window and the fields become unreadable ribbons.
            ...(LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}),
          }}
        >

          {/* The same card every other document screen puts the retailer in,
              so this reads as the app rather than as a new screen. */}
          <Box mb="$4">
            <CustomerInfoCard
              customer={retailer as any}
              onChangeCustomer={() =>
                navigation.navigate('SelectCustomer', { next: 'NewOrder' })
              }
            />
          </Box>

          {/* Order date. Back-dating a bill is a real need — goods leave on
              one day and the paperwork catches up on another. */}
          <Pressable onPress={() => setDatePickerOpen(true)} mb="$4">
            <HStack alignItems="center" justifyContent="space-between" px="$1">
              <Text fontSize={12} color="$coolGray500" fontWeight="$semibold">
                {t('orders.orderDate') || 'Order Date'}
              </Text>
              <HStack alignItems="center" space="xs">
                <Icon as={Calendar} size="xs" color="$coolGray600" />
                <Text fontSize={14} fontWeight="$bold" color="#111827">
                  {orderDate === new Date().toISOString().split('T')[0]
                    ? (t('common.today') || 'Today')
                    : new Date(orderDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </Text>
              </HStack>
            </HStack>
          </Pressable>

          {/* Items live in one card with a count and their own Add action, so
              a long order reads as a list rather than a stack of loose cards. */}
          <Box bg="$white" rounded="$2xl" p="$4" mb="$4" borderWidth={1} borderColor="#E5E7EB" style={styles.card}>
            <HStack alignItems="center" justifyContent="space-between" mb="$1">
              <Text fontWeight="$bold" fontSize={16}>
                {t('orders.items') || 'Items'} ({items.length})
              </Text>
              {/* Held shut until the open row is priceable. Letting a second
                  row open over an unfinished one is how you end up with a
                  half-typed line nobody notices until the total is wrong. */}
              <Pressable onPress={canAddItem ? addItem : undefined} disabled={!canAddItem}>
                <Box
                  px="$4" py="$2.5" rounded="$lg"
                  overflow="hidden"
                  bg={canAddItem ? 'transparent' : '#E3D7F5'}
                >
                  {/* Live, it carries the app's violet-to-pink action gradient;
                      spent, a flat tint — a dimmed gradient still reads as
                      pressable, which is the thing the gate is trying to say. */}
                  {canAddItem && (
                    <GradientSurface colors={['#A855F7', '#EC4899']} borderRadius={8} />
                  )}
                  <HStack alignItems="center" space="xs">
                    <Icon as={Plus} size="xs" color={canAddItem ? '$white' : '#FFFFFF'} />
                    <Text color="$white" fontWeight="$bold" fontSize={13}>
                      {t('orders.addItem') || 'Add Item'}
                    </Text>
                  </HStack>
                </Box>
              </Pressable>
            </HStack>

            <Text fontSize={12} color="$coolGray400" mb="$3">
              {canAddItem
                ? (t('orders.addAnotherHint') || 'Add another item to this order.')
                : (t('orders.finishItemHint') || 'Finish this item to add another.')}
            </Text>

            {items.length === 0 && (
              <Box borderWidth={1} borderColor="#E5E7EB" borderStyle="dashed" rounded="$xl" py="$8" alignItems="center">
                <Text color="$coolGray500" fontWeight="$medium">
                  {t('orders.noItemsYet') || 'No items added yet'}
                </Text>
                <Text color="$coolGray400" fontSize={13} mt="$1">
                  {t('orders.noItemsHint') || 'Tap "Add Item" to start'}
                </Text>
              </Box>
            )}

          {items.map((item, index) => {
            const p = priced[index];
            const expanded = expandedKey === item.key;
            const done = p?.priceable && item.itemName.trim().length > 0;

            return (
              <Box
                key={item.key}
                bg="#FAFAFB"
                p="$3.5"
                rounded="$xl"
                mb={index === items.length - 1 ? '$0' : '$3'}
                borderWidth={1}
                borderColor="#EEF0F3"
              >
                {/* Header doubles as the collapse control. A finished row shows
                    its name and figures on one line, so a five-item order stays
                    readable instead of becoming five identical open forms. */}
                <Pressable onPress={() => setExpandedKey(expanded ? null : item.key)}>
                  <HStack alignItems="center" justifyContent="space-between" mb={expanded ? '$3' : '$0'}>
                    <HStack alignItems="center" space="xs" flex={1}>
                      <Text fontWeight="$bold" color={done && !expanded ? '#111827' : PURPLE}>
                        {done && !expanded
                          ? item.itemName.trim()
                          : `${t('orders.item') || 'Item'} ${index + 1}`}
                      </Text>
                      <Icon as={expanded ? ChevronUp : ChevronDown} size="xs" color="$coolGray500" />
                    </HStack>
                    {items.length > 1 && (
                      <Pressable
                        onPress={() => {
                          setItems(prev => prev.filter(i => i.key !== item.key));
                          if (expanded) setExpandedKey(null);
                        }}
                        p="$1"
                      >
                        <Icon as={Trash2} size="sm" color="#DC2626" />
                      </Pressable>
                    )}
                  </HStack>

                  {/* The summary line the collapsed row is worth having. */}
                  {done && !expanded && (
                    <Text fontSize={12} color="$coolGray500" mt="$1">
                      {num(item.weight)} {gramShort} · {num(item.purity)}% {t('orders.purityWord') || 'purity'} · {num(item.wastage)}% {t('orders.wastageWord') || 'wastage'} · {formatCurrencyValue(num(item.rate))}/{gramShort}
                    </Text>
                  )}
                </Pressable>

                {expanded && (
                <VStack space="md">
                  {/* Saved items, so a line the shop bills often is one tap. */}
                  {catalogProducts.length > 0 && (
                    <Box>
                      <Text fontSize={12} fontWeight="$bold" color={PURPLE} mb="$1.5">
                        {t('items.selectSaved') || 'Select Saved Items'}
                      </Text>
                      <SelectField
                        value=""
                        onValueChange={(val: string) => fillFromCatalog(item.key, val)}
                        items={catalogProducts.map((c: any) => ({ label: c.name, value: c.id }))}
                        placeholder={t('orders.chooseFromCatalog') || 'Choose from catalog...'}
                      />
                    </Box>
                  )}

                  <FloatingLabelInput
                    label={t('orders.itemName') || 'Item Name'}
                    required
                    value={item.itemName}
                    onChangeText={v => patch(item.key, 'itemName', v)}
                    maxLength={60}
                  />

                  <HStack space="md">
                    <FloatingLabelInput
                      label={t('orders.weightGrams') || 'Weight (grams)'}
                      required
                      keyboardType="decimal-pad"
                      value={item.weight}
                      onChangeText={v => patch(item.key, 'weight', v)}
                    />
                    <FloatingLabelInput
                      label={t('orders.purityPct') || 'Purity (%)'}
                      required
                      keyboardType="decimal-pad"
                      value={item.purity}
                      onChangeText={v => patch(item.key, 'purity', v)}
                    />
                  </HStack>

                  <HStack space="md" alignItems="flex-start">
                    <FloatingLabelInput
                      label={t('orders.wastagePct') || 'Wastage (%)'}
                      required
                      keyboardType="decimal-pad"
                      value={item.wastage}
                      onChangeText={v => patch(item.key, 'wastage', v)}
                    />
                    {/* The rate and its live-rate toggle, stacked — the toggle
                        is about THIS field, and sitting full-width underneath
                        both columns it read as if it applied to the whole row. */}
                    <VStack flex={1} space="xs">
                      <FloatingLabelInput
                        label={t('orders.goldRate') || 'Gold Rate (₹/gram)'}
                        keyboardType="decimal-pad"
                        value={item.rate}
                        // Typing a rate stops it following the live one; there is
                        // no way back except the checkbox, which is the point.
                        onChangeText={v => setItems(prev => prev.map(i =>
                          i.key === item.key ? { ...i, rate: v, useLiveRate: false } : i))}
                      />

                      {/* Live rate opt-in, so a line can be pinned to a rate the
                          shop agreed earlier without it moving under them. */}
                      {liveRate > 0 && (
                        <Pressable
                          onPress={() => setItems(prev => prev.map(i =>
                            i.key === item.key
                              ? { ...i, useLiveRate: !i.useLiveRate, rate: !i.useLiveRate ? String(liveRate) : i.rate }
                              : i))}
                        >
                          <HStack alignItems="center" space="sm">
                            <Box
                              w={18} h={18} rounded="$sm" borderWidth={1.5}
                              borderColor={item.useLiveRate ? PURPLE : '#D1D5DB'}
                              bg={item.useLiveRate ? PURPLE : 'transparent'}
                              alignItems="center" justifyContent="center"
                            >
                              {item.useLiveRate && <Icon as={Check} size="xs" color="$white" />}
                            </Box>
                            <Text fontSize={13} color="$coolGray600">
                              {(shopRate.isOverride
                                ? (t('rate.shopRateShort') || 'Shop')
                                : (t('orders.liveRate') || 'Live'))} {formatCurrencyValue(liveRate)}
                            </Text>
                          </HStack>
                        </Pressable>
                      )}
                    </VStack>
                  </HStack>

                  {/* What this line actually costs, the moment it can be priced.
                      Purity is shown as charged, not as entered, because the
                      uplift is the first thing a retailer queries. */}
                  {p?.priceable && (
                    <Box bg="#FFFBEB" p="$3" rounded="$xl" borderWidth={1} borderColor="#FDE68A">
                      <HStack justifyContent="space-between">
                        <Text fontSize={12} color={AMBER}>
                          {p.chargedPurity} + {num(item.wastage)} = {p.effectivePercent}%
                        </Text>
                        <Text fontSize={13} fontWeight="$bold" color={AMBER}>
                          {formatGrams(p.fine995, gramShort)}
                        </Text>
                      </HStack>
                      <HStack justifyContent="space-between" mt="$1">
                        <Text fontSize={11} color="$coolGray500">
                          {t('orders.fineAt995') || 'fine 99.50'}
                        </Text>
                        <Text fontSize={12} color="$coolGray600">
                          {formatCurrencyValue(p.value)}
                        </Text>
                      </HStack>
                    </Box>
                  )}
                </VStack>
                )}
              </Box>
            );
          })}
          </Box>

          {/* Payment — and the thing that decides the order type */}
          <Box bg="$white" p="$4" rounded="$2xl" borderWidth={1} borderColor="#E5E7EB" style={styles.card}>
            <Text fontWeight="$bold" mb="$3">{t('orders.paymentNow') || 'Paying now'}</Text>
            <HStack space="md">
              <FloatingLabelInput
                label={t('orders.cashAmount') || 'Cash (₹)'}
                keyboardType="decimal-pad"
                value={payCash}
                onChangeText={setPayCash}
              />
              <FloatingLabelInput
                label={`${t('orders.goldWeight') || 'Gold'} (${gramShort})`}
                keyboardType="decimal-pad"
                value={payGold}
                onChangeText={setPayGold}
              />
            </HStack>

            {/* Melt credit — old ornaments this retailer already left here.
                Shown only when the shop does melt AND this retailer actually
                has credit: an empty "0.000 gm available" row on every other
                order is a control that can never be used, and the shopkeeper
                learns to look past exactly the row that matters when it is
                finally not empty. */}
            {meltEnabled && meltAvailable > 0 && (
              <Box mt="$3">
                <FloatingLabelInput
                  label={`${t('orders.meltCredit') || 'Melt credit'} (${gramShort})`}
                  keyboardType="decimal-pad"
                  value={payMelt}
                  onChangeText={setPayMelt}
                />
                <HStack justifyContent="space-between" alignItems="center" mt="$1">
                  <Text fontSize={11} color={meltOverdrawn ? '#B91C1C' : '$coolGray500'}>
                    {meltOverdrawn
                      ? (t('orders.meltOverdrawn') || 'That is more melt credit than this retailer has')
                      : `${t('orders.meltAvailable') || 'Available'} ${formatGrams(meltAvailable, gramShort)}`}
                  </Text>
                  {/* Spending the lot is the common case — the retailer brought
                      the ornaments in so they would come off a bill. */}
                  <Pressable onPress={() => setPayMelt(String(meltAvailable))}>
                    <Text fontSize={11} fontWeight="$bold" color={PURPLE}>
                      {t('orders.meltUseAll') || 'Use all'}
                    </Text>
                  </Pressable>
                </HStack>
              </Box>
            )}

            {/* The only thing that lands on the cash account — a wholesale
                line is metal, and wastage is already inside the fine weight. */}
            <Pressable onPress={() => setIncludeGST(v => !v)} mt="$3">
              <HStack alignItems="center" space="sm">
                <Box
                  w={18} h={18} rounded="$sm" borderWidth={1.5}
                  borderColor={includeGST ? PURPLE : '#D1D5DB'}
                  bg={includeGST ? PURPLE : 'transparent'}
                  alignItems="center" justifyContent="center"
                >
                  {includeGST && <Icon as={Check} size="xs" color="$white" />}
                </Box>
                <Text fontSize={13} color="$coolGray600">
                  {t('orders.addGst') || 'Add GST (3%)'}
                </Text>
              </HStack>
            </Pressable>

            {totals.fine > 0 && (
              <Box mt="$3" pt="$3" borderTopWidth={1} borderColor="#F3F4F6">
                <HStack justifyContent="space-between">
                  <Text fontSize={13} color="$coolGray600">{t('orders.settles') || 'Settles'}</Text>
                  <Text fontSize={13} fontWeight="$bold" color="#111827">
                    {formatGrams(settling.covered, gramShort)} / {formatGrams(totals.fine, gramShort)}
                  </Text>
                </HStack>
                {/* Short, exact, or over — and never silently rounded to
                    "Full payment", which is what hid a six-lakh overpayment.
                    The rupee figure beside the weight is the same conversion
                    the shopkeeper would do in their head, at the rate the
                    lines were actually priced at. */}
                <HStack justifyContent="space-between" mt="$1">
                  <Text fontSize={13} color="$coolGray600">
                    {settling.isOver
                      ? (t('orders.excess') || 'Paid extra')
                      : (t('orders.remaining') || 'Remaining')}
                  </Text>
                  <Text
                    fontSize={13}
                    fontWeight="$bold"
                    color={settling.isOver ? '#B91C1C' : settling.isExact ? '#15803D' : AMBER}
                  >
                    {settling.isExact
                      ? (t('orders.paidInFull') || 'Full payment')
                      : (() => {
                        const grams = settling.isOver ? settling.excess : settling.remaining;
                        const cash = settlementRate > 0 ? grams * settlementRate : 0;
                        return cash > 0
                          ? `${formatGrams(grams, gramShort)} · ${formatCurrencyValue(cash)}`
                          : formatGrams(grams, gramShort);
                      })()}
                  </Text>
                </HStack>
              </Box>
            )}
          </Box>
        </ScrollView>

        {/* Total + save, pinned so the figure is visible while typing above it */}
        <Box
          bg="$white" px="$4" pt="$3" borderTopWidth={1} borderColor="#E5E7EB"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          {/* One capped wrapper around BOTH the totals and the button. Capping
              only the totals row left the button spanning the whole window. */}
          <Box style={LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}}>
          <HStack justifyContent="space-between" alignItems="center" mb="$3">
            <VStack>
              <Text fontSize={11} color="$coolGray500">{t('orders.totalFine') || 'TOTAL FINE 99.50'}</Text>
              <Text fontSize={19} fontWeight="$black" color={AMBER}>
                {formatGrams(totals.fine, gramShort)}
              </Text>
            </VStack>
            <VStack alignItems="flex-end">
              <Text fontSize={11} color="$coolGray500">{t('orders.value') || 'VALUE'}</Text>
              <Text fontSize={19} fontWeight="$black" color="#15803D">
                {formatCurrencyValue(totals.grand)}
              </Text>
            </VStack>
          </HStack>

          {/* The same gradient the app's other primary actions use, so this
              reads as the confirm step rather than as a new control. Flat grey
              when it cannot run, because a disabled gradient still looks live. */}
          <Pressable onPress={onSave} disabled={!canSave}>
            <Box height={54} rounded="$2xl" overflow="hidden" justifyContent="center" alignItems="center">
              {canSave
                ? <GradientSurface colors={['#6366F1', '#D946EF']} borderRadius={16} />
                : <Box position="absolute" top={0} left={0} right={0} bottom={0} bg="#E5E7EB" />}
              <Text color={canSave ? '$white' : '$coolGray400'} fontWeight="$bold" fontSize={16}>
                {saving
                  ? (t('common.saving') || 'Saving…')
                  : (t('orders.createOrder') || 'Create Order')}
              </Text>
            </Box>
          </Pressable>
          </Box>
        </Box>
      </KeyboardAvoidingView>

      <DatePickerModal
        isOpen={datePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        date={orderDate}
        onSelect={(d: string) => { setOrderDate(d); setDatePickerOpen(false); }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  card: { elevation: 2, shadowOpacity: 0.06 },
});

export default NewOrderScreen;

import React from 'react';
import { StyleSheet, ScrollView, KeyboardAvoidingView, Platform, View } from 'react-native';
import {
  Box, HStack, VStack, Text, Pressable, Icon,
} from '@gluestack-ui/themed';
import { Plus, Trash2, Check, Calendar, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LedgerHeader from '../../components/ledger/LedgerHeader';
import { Brand } from '../../theme/brand';

import { LAYOUT } from '../../constants/layout';
import CustomerInfoCard from '../../components/common/CustomerInfoCard';
import GradientSurface from '../../components/common/GradientSurface';
import DatePickerModal from '../../components/common/DatePickerModal';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  createWholesaleOrder, fetchCustomers, fetchMetalRates, fetchCatalogProducts,
  fetchRetailerAccount, applyMeltCredit, addMetalPaymentToOrder, allocateCash,
  addSilverPaymentToOrder, fetchShopDetails,
} from '../../store/data/dataSlice';
import { useShopRate, useSilverRate } from '../../hooks/useShopRate';
import { silverNetWeight, silverLineValue } from '../../utils/silverPricing';
import FloatingLabelInput from '../../components/common/FloatingLabelInput';
import ItemPicker, { type ItemPick } from '../../components/catalog/ItemPicker';
import ItemNameField from '../../components/catalog/ItemNameField';
import { formatPurityBreakdown } from '../../utils/purityBreakdown';
import { toast, ToastViewport } from '../../components/common/Toast';
import { priceLine, totalFine995, cashValueOfFine995, isLinePriceable } from '../../utils/goldPricing';
import { formatCurrencyValue } from '../../utils/formatter';
import { formatGrams } from '../../utils/dues';

const PURPLE = '#0E4D3C';
const AMBER = '#87661F';
/** Silver's figures, a cool grey beside gold's amber. */
const SILVER = '#5B6573';

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

type Metal = 'gold' | 'silver';

/**
 * A silver line as it is being typed.
 *
 * Silver is sold by NET weight at a rate per gram, with no purity or wastage
 * (see utils/silverPricing.ts). Net weight fills itself in as gross less
 * packet until the user types into it; after that it is theirs, because a
 * wholesaler who weighs net directly should not have it overwritten.
 */
interface SilverDraft {
  key: string;
  itemName: string;
  quantity: string;
  grossWeight: string;
  packetWeight: string;
  netWeight: string;
  /** True once the user has typed a net weight of their own. */
  netTouched: boolean;
  rate: string;
}

/** Seeded with today's silver rate, the shop's own or the live one. Unlike
 *  gold, the user asked for the silver rate to arrive pre-filled. */
const blankSilver = (rate?: number): SilverDraft => ({
  key: Math.random().toString(36).slice(2),
  itemName: '',
  quantity: '',
  grossWeight: '',
  packetWeight: '',
  netWeight: '',
  netTouched: false,
  rate: rate && rate > 0 ? String(rate) : '',
});

/** A silver line can be saved once it has a name and some net weight. */
const silverDone = (s: SilverDraft) => s.itemName.trim().length > 0 && num(s.netWeight) > 0;

const NewOrderScreen = () => {
  const navigation: any = useNavigation();
  const route: any = useRoute();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const customers = useAppSelector(s => s.data.customers);
  const catalogProducts = useAppSelector(s => s.data.catalogProducts);
  const gramShort = t('common.gramShort') || 'gm';


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
  const silverRate = useSilverRate();

  /**
   * Which tab is showing. Only a view: gold lines and silver lines both stay
   * on the sale whichever tab is open, so one sale can carry either or both.
   * It opens on the shop's default metal (Settings), once that is known.
   */
  const defaultMetal = useAppSelector(s => s.data.shopDetails?.defaultMetal);
  const [metalTab, setMetalTab] = React.useState<Metal>(defaultMetal === 'silver' ? 'silver' : 'gold');
  const tabChosen = React.useRef(false);
  React.useEffect(() => {
    // The shop record may arrive after the screen does. Follow it until the
    // user picks a tab themselves, never after.
    if (tabChosen.current) return;
    setMetalTab(defaultMetal === 'silver' ? 'silver' : 'gold');
    // Re-picked by the effect below for whichever tab is now showing.
    setExpandedKey(null);
  }, [defaultMetal]);
  const chooseTab = (m: Metal) => {
    tabChosen.current = true;
    setMetalTab(m);
    // Open the first unfinished row of the tab being switched to, so there is
    // somewhere to type straight away.
    setExpandedKey(m === 'silver'
      ? (silverItems.find(x => !silverDone(x)) ?? silverItems[0])?.key ?? null
      : (items.find(i => !(isLinePriceable({ weight: i.weight, purity: i.purity }) && i.itemName.trim())) ?? items[0])?.key ?? null);
  };

  const [silverItems, setSilverItems] = React.useState<SilverDraft[]>(() => [blankSilver()]);
  /** Cash put towards the silver account, and silver handed over, in grams. */
  const [paySilverCash, setPaySilverCash] = React.useState('');
  const [paySilver, setPaySilver] = React.useState('');

  const [customerId, setCustomerId] = React.useState<string | undefined>(route.params?.customerId);
  const [items, setItems] = React.useState<DraftItem[]>(() => [blankItem()]);
  const [payCash, setPayCash] = React.useState('');
  const [payGold, setPayGold] = React.useState('');
  /** Grams of 99.50 drawn from melt credit this retailer already has here. */
  const [payMelt, setPayMelt] = React.useState('');
  /** Rupees of cash held for the retailer (an advance, or cash whose rate was
   *  not fixed) to put on this sale, converted at this sale's own rate. */
  const [payHeld, setPayHeld] = React.useState('');
  const [includeGST, setIncludeGST] = React.useState(false);
  // YYYY-MM-DD, the shape DatePickerModal reads and writes.
  const [orderDate, setOrderDate] = React.useState(() => new Date().toISOString().split('T')[0]);
  const [datePickerOpen, setDatePickerOpen] = React.useState(false);
  /** Only one row is open at a time; a finished row collapses to its summary. */
  const [expandedKey, setExpandedKey] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  /** The line whose item name the picker is open for. */
  const [namePickerFor, setNamePickerFor] = React.useState<string | null>(null);

  React.useEffect(() => {
    dispatch(fetchCustomers());
    dispatch(fetchMetalRates());
    dispatch(fetchCatalogProducts());
    dispatch(fetchShopDetails());
  }, [dispatch]);

  // Empty silver rates fill from today's silver rate once it is known. A rate
  // the user typed is left alone, as on the gold side.
  React.useEffect(() => {
    if (!silverRate.rate) return;
    setSilverItems(prev => prev.map(s => (s.rate.trim() ? s : { ...s, rate: String(silverRate.rate) })));
  }, [silverRate.rate]);

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
    setExpandedKey(prev => prev ?? (metalTab === 'silver' ? silverItems[0]?.key : items[0]?.key) ?? null);
    // Only on first load and tab follow; chooseTab handles a user's switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, metalTab]);

  const retailer = customers.find((c: any) => c.id === customerId);

  /**
   * What this retailer has left with the shop: gold held (advances and melt
   * credit, in 99.50 grams) and cash held (an advance, or cash whose rate was
   * not fixed).
   *
   * Fetched per retailer, and re-fetched whenever the chosen one changes,
   * because the balances are what the two fields are allowed to spend. It is
   * deliberately only a display: the server checks each draw against the
   * account again, so another device drawing the same credit down first is
   * refused rather than double-spent.
   *
   * Not behind the melt flag any more. Gold held is also a gold ADVANCE,
   * which has nothing to do with melting, and a shop that never melts still
   * takes advances.
   */
  const meltCredit = useAppSelector(
    s => (customerId ? s.data.retailerAccounts[customerId]?.meltCredit : 0) || 0,
  );
  const heldCash = useAppSelector(
    s => (customerId ? s.data.retailerAccounts[customerId]?.heldCash : 0) || 0,
  );

  React.useEffect(() => {
    if (!customerId) return;
    dispatch(fetchRetailerAccount({ customerId }));
  }, [dispatch, customerId]);

  // A retailer swap must not carry the previous one's credit draw across —
  // that weight belongs to an account this order is no longer against.
  React.useEffect(() => { setPayMelt(''); setPayHeld(''); }, [customerId]);

  const meltAvailable = meltCredit;
  const heldApplied = Math.min(num(payHeld), heldCash);
  const heldOverdrawn = num(payHeld) > heldCash + 0.5;
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

  /**
   * A saved catalogue product fills the line as the old "Select Saved Items"
   * dropdown did (name, purity, weight); an ornament from the list or a typed
   * name fills the name only.
   */
  const handleNamePick = (pick: ItemPick) => {
    const key = namePickerFor;
    if (!key) return;
    // A silver line takes the name only: the catalogue's purity is a gold
    // figure and means nothing on silver.
    if (silverItems.some(s => s.key === key)) {
      const name = pick.kind === 'product'
        ? (catalogProducts.find((p: any) => p.id === pick.productId) as any)?.name
        : pick.name;
      if (name) patchSilver(key, { itemName: name });
      return;
    }
    if (pick.kind === 'product') {
      fillFromCatalog(key, pick.productId);
      return;
    }
    setItems(prev => prev.map(i => (i.key === key ? { ...i, itemName: pick.name } : i)));
  };

  const patch = (key: string, field: keyof DraftItem, value: any) =>
    setItems(prev => prev.map(i => (i.key === key ? { ...i, [field]: value } : i)));

  /**
   * Updates a silver line. Gross or packet changing re-derives net, unless
   * the user has typed a net of their own.
   */
  const patchSilver = (key: string, change: Partial<SilverDraft>) =>
    setSilverItems(prev => prev.map(s => {
      if (s.key !== key) return s;
      const next = { ...s, ...change };
      if (!next.netTouched && ('grossWeight' in change || 'packetWeight' in change)) {
        const net = silverNetWeight(num(next.grossWeight), num(next.packetWeight));
        next.netWeight = net > 0 ? String(net) : '';
      }
      return next;
    }));

  const addSilverItem = () => {
    const next = blankSilver(silverRate.rate);
    setSilverItems(prev => [...prev, next]);
    setExpandedKey(next.key);
  };

  const silverUsable = silverItems.filter(silverDone);
  const silverTotals = React.useMemo(() => {
    const done = silverItems.filter(silverDone);
    const net = Number(done.reduce((sum, s) => sum + num(s.netWeight), 0).toFixed(3));
    const value = done.reduce((sum, s) => sum + silverLineValue(num(s.netWeight), num(s.rate) || silverRate.rate), 0);
    // The rate the silver still owed is priced at, and the rate cash put
    // towards silver buys grams at: the lines' own, weighted by net weight.
    // The server works it out the same way (weightedSilverRate).
    const rate = net > 0 && value > 0 ? value / net : silverRate.rate;
    return { net, value, rate };
  }, [silverItems, silverRate.rate]);

  const silverSettling = React.useMemo(() => {
    const cashBuys = num(paySilverCash) > 0 && silverTotals.rate > 0 ? num(paySilverCash) / silverTotals.rate : 0;
    const covered = cashBuys + num(paySilver);
    const difference = silverTotals.net - covered;
    return {
      covered,
      remaining: Math.max(0, difference),
      excess: Math.max(0, -difference),
      isOver: silverTotals.net > 0 && difference < -0.0005,
      isExact: silverTotals.net > 0 && Math.abs(difference) <= 0.0005,
    };
  }, [paySilverCash, paySilver, silverTotals]);

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
    // GST is on the whole sale, silver included, as the server charges it.
    const gst = includeGST ? (value + silverTotals.value) * 0.03 : 0;
    return { fine, value, gst, grand: value + silverTotals.value + gst };
  }, [items, priced, includeGST, silverTotals.value]);

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
    // Held cash buys at the same rate as cash paid now: this sale's rate is
    // the rate the retailer is fixing it at by using it here.
    const heldBuys = heldApplied > 0 && settlementRate > 0 ? heldApplied / settlementRate : 0;
    // Gold held is already grams of 99.50 — it was converted when it came in,
    // so it lands beside the gold leg rather than being converted again.
    const covered = cashBuys + heldBuys + num(payGold) + meltApplied;

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
  }, [payCash, payGold, meltApplied, heldApplied, settlementRate, totals.fine]);

  /** Every row has to be priceable before another can be opened. */
  const canAddGold = items.length > 0 && items.every(i =>
    isLinePriceable({ weight: i.weight, purity: i.purity }) && i.itemName.trim().length > 0,
  );
  const canAddSilver = silverItems.length > 0 && silverItems.every(silverDone);
  const canAddItem = metalTab === 'silver' ? canAddSilver : canAddGold;
  const hasGold = priced.some(p => p.priceable);
  const hasSilver = silverUsable.length > 0;

  const canSave = !!customerId && (hasGold || hasSilver) && !saving && !meltOverdrawn && !heldOverdrawn;

  const onSave = async () => {
    if (!customerId) { toast.error(t('orders.selectRetailerFirst') || 'Choose a retailer first'); return; }
    const usable = items.filter(i => isLinePriceable({ weight: i.weight, purity: i.purity }));
    if (usable.length === 0 && silverUsable.length === 0) { toast.error(t('orders.addOneItem') || 'Add at least one item with a weight and purity'); return; }

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
      })).concat(silverUsable.map(s => ({
        metal: 'silver' as const,
        itemName: s.itemName.trim(),
        // On a silver line `weight` is the net weight: the grams owed.
        weight: num(s.netWeight),
        rate: num(s.rate) || silverRate.rate,
        quantity: num(s.quantity) || undefined,
        grossWeight: num(s.grossWeight) || undefined,
        packetWeight: num(s.packetWeight) || undefined,
      })) as any),
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
      // Gold's cash only rides along when there is gold to put it against;
      // on a silver-only sale it would buy gold grams nobody sold.
      ...(hasGold && num(payCash) > 0
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
        failures.push(String(meltLeg.payload || t('orders.goldHeld') || 'Gold held'));
      }
    }

    // The silver leg: cash at the silver lines' rate, and silver handed over.
    // Its own payment, so the server files it under silver, never gold.
    if (orderId && hasSilver && (num(paySilverCash) > 0 || num(paySilver) > 0)) {
      const silverLeg = await dispatch(addSilverPaymentToOrder({
        orderId,
        amount: num(paySilverCash),
        silverRate: Math.round(silverTotals.rate * 100) / 100,
        silverWeight: num(paySilver),
        date: orderDate,
      }) as any);
      if (!addSilverPaymentToOrder.fulfilled.match(silverLeg)) {
        failures.push(String(silverLeg.payload || t('orders.silverWord') || 'Silver'));
      }
    }

    // Held cash last, at the sale's own rate: using it on this sale is the
    // retailer fixing its rate. The server converts it and re-checks the
    // amount against what is held.
    if (orderId && heldApplied >= 1 && settlementRate > 0) {
      const heldLeg = await dispatch(allocateCash({
        customerId,
        orderId,
        amount: Math.round(heldApplied * 100) / 100,
        // To the paisa: the weighted rate is a float division, and an
        // allocation stored at 14719.999999999998 reads as noise in the data.
        goldRate: Math.round(settlementRate * 100) / 100,
        date: orderDate,
      }) as any);
      if (!allocateCash.fulfilled.match(heldLeg)) {
        failures.push(String(heldLeg.payload || t('orders.cashHeld') || 'Cash held'));
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
    <View style={{ flex: 1, backgroundColor: Brand.paper }}>
      <ToastViewport />

      {/* The Ledger header every other screen has; it clears the status bar
          itself, so this screen is a plain View, not a top-edged SafeAreaView. */}
      <LedgerHeader
        title={t('orders.newOrder') || 'New sale'}
        subtitle={`${priced.filter(p => p.priceable).length + silverUsable.length} ${t('orders.itemsCount') || 'items'}`}
        onBack={() => navigation.goBack()}
      />

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
                <Text fontSize={14} fontWeight="$bold" color="#1D1B16">
                  {orderDate === new Date().toISOString().split('T')[0]
                    ? (t('common.today') || 'Today')
                    : new Date(orderDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </Text>
              </HStack>
            </HStack>
          </Pressable>

          {/* Items live in one card with a count and their own Add action, so
              a long order reads as a list rather than a stack of loose cards. */}
          <Box bg="$white" rounded="$2xl" p="$4" mb="$4" borderWidth={1} borderColor="#DCE2D8" style={styles.card}>
            {/* Gold | Silver. Each tab keeps its own lines and both are saved
                on the one sale; the count says what the other tab holds
                without having to open it. */}
            <HStack bg="#F2F4EF" rounded="$xl" p="$1" mb="$3">
              {(['gold', 'silver'] as const).map(m => {
                const active = metalTab === m;
                const count = m === 'gold' ? priced.filter(p => p.priceable).length : silverUsable.length;
                return (
                  <Pressable key={m} flex={1} onPress={() => chooseTab(m)} accessibilityRole="tab" accessibilityState={{ selected: active }}>
                    <Box py="$2" rounded="$lg" alignItems="center" bg={active ? '$white' : 'transparent'} style={active ? styles.tabActive : undefined}>
                      <Text fontWeight="$bold" fontSize={14} color={active ? (m === 'gold' ? AMBER : SILVER) : '$coolGray500'}>
                        {m === 'gold' ? (t('orders.goldWord') || 'Gold') : (t('orders.silverWord') || 'Silver')}
                        {count > 0 ? ` (${count})` : ''}
                      </Text>
                    </Box>
                  </Pressable>
                );
              })}
            </HStack>

            <HStack alignItems="center" justifyContent="space-between" mb="$1">
              <Text fontWeight="$bold" fontSize={16}>
                {t('orders.itemsHeading') || 'Items'} ({metalTab === 'silver' ? silverItems.length : items.length})
              </Text>
              {/* Held shut until the open row is priceable. Letting a second
                  row open over an unfinished one is how you end up with a
                  half-typed line nobody notices until the total is wrong. */}
              <Pressable onPress={canAddItem ? (metalTab === 'silver' ? addSilverItem : addItem) : undefined} disabled={!canAddItem}>
                <Box
                  px="$4" py="$2.5" rounded="$lg"
                  overflow="hidden"
                  bg={canAddItem ? 'transparent' : '#DCEBE4'}
                >
                  {/* Live, it carries the app's violet-to-pink action gradient;
                      spent, a flat tint — a dimmed gradient still reads as
                      pressable, which is the thing the gate is trying to say. */}
                  {canAddItem && (
                    <GradientSurface colors={['#145F4A', '#145F4A']} borderRadius={8} />
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

            {metalTab === 'gold' && items.length === 0 && (
              <Box borderWidth={1} borderColor="#DCE2D8" borderStyle="dashed" rounded="$xl" py="$8" alignItems="center">
                <Text color="$coolGray500" fontWeight="$medium">
                  {t('orders.noItemsYet') || 'No items added yet'}
                </Text>
                <Text color="$coolGray400" fontSize={13} mt="$1">
                  {t('orders.noItemsHint') || 'Tap "Add Item" to start'}
                </Text>
              </Box>
            )}

          {metalTab === 'gold' && items.map((item, index) => {
            const p = priced[index];
            const expanded = expandedKey === item.key;
            const done = p?.priceable && item.itemName.trim().length > 0;

            return (
              <Box
                key={item.key}
                bg="#F2F4EF"
                p="$3.5"
                rounded="$xl"
                mb={index === items.length - 1 ? '$0' : '$3'}
                borderWidth={1}
                borderColor="#E8ECE5"
              >
                {/* Header doubles as the collapse control. A finished row shows
                    its name and figures on one line, so a five-item order stays
                    readable instead of becoming five identical open forms. */}
                <Pressable onPress={() => setExpandedKey(expanded ? null : item.key)}>
                  <HStack alignItems="center" justifyContent="space-between" mb={expanded ? '$3' : '$0'}>
                    <HStack alignItems="center" space="xs" flex={1}>
                      <Text fontWeight="$bold" color={done && !expanded ? '#1D1B16' : PURPLE}>
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
                  {/* One field for the name: it searches the shop's own catalogue
                      and the list of ornaments, or takes a new name. It
                      replaced a "Select Saved Items" dropdown above a plain
                      text box. */}
                  <ItemNameField
                    label={t('orders.itemName') || 'Item Name'}
                    required
                    value={item.itemName}
                    hint={t('itemPicker.fieldHint') || 'Search or type'}
                    onPress={() => setNamePickerFor(item.key)}
                  />

                  <HStack space="md">
                    <FloatingLabelInput
                      label={t('orders.weightGrams') || 'Weight (grams)'}
                      required
                      keyboardType="decimal-pad"
                      value={item.weight}
                      onChangeText={v => patch(item.key, 'weight', v)}
                    />
                    {/* The wholesaler types the ROUNDED purity they charge on —
                        92 for 22K, 84 for 20K — not the metal's real fineness.
                        The hint states what that number contains, because the
                        uplift is money: 0.4% of 100 g at 15,270 is about
                        ₹6,100, and folding it silently into a total is how a
                        retailer ends up querying a bill nobody can explain. */}
                    <FloatingLabelInput
                      label={t('orders.purityPct') || 'Purity (%)'}
                      required
                      keyboardType="decimal-pad"
                      value={item.purity}
                      onChangeText={v => patch(item.key, 'purity', v)}
                      hint={formatPurityBreakdown(item.purity) || undefined}
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
                              borderColor={item.useLiveRate ? PURPLE : '#C9D2C5'}
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
                    <Box bg="#FBF6EA" p="$3" rounded="$xl" borderWidth={1} borderColor="#EBD9AE">
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

          {metalTab === 'silver' && silverItems.map((s, index) => {
            const expanded = expandedKey === s.key;
            const done = silverDone(s);
            const value = silverLineValue(num(s.netWeight), num(s.rate) || silverRate.rate);
            return (
              <Box
                key={s.key}
                bg="#F2F4EF"
                p="$3.5"
                rounded="$xl"
                mb={index === silverItems.length - 1 ? '$0' : '$3'}
                borderWidth={1}
                borderColor="#E8ECE5"
              >
                <Pressable onPress={() => setExpandedKey(expanded ? null : s.key)}>
                  <HStack alignItems="center" justifyContent="space-between" mb={expanded ? '$3' : '$0'}>
                    <HStack alignItems="center" space="xs" flex={1}>
                      <Text fontWeight="$bold" color={done && !expanded ? '#1D1B16' : PURPLE}>
                        {done && !expanded ? s.itemName.trim() : `${t('orders.item') || 'Item'} ${index + 1}`}
                      </Text>
                      <Icon as={expanded ? ChevronUp : ChevronDown} size="xs" color="$coolGray500" />
                    </HStack>
                    {silverItems.length > 1 && (
                      <Pressable
                        onPress={() => {
                          setSilverItems(prev => prev.filter(x => x.key !== s.key));
                          if (expanded) setExpandedKey(null);
                        }}
                        p="$1"
                      >
                        <Icon as={Trash2} size="sm" color="#DC2626" />
                      </Pressable>
                    )}
                  </HStack>
                  {done && !expanded && (
                    <Text fontSize={12} color="$coolGray500" mt="$1">
                      {num(s.quantity) > 0 ? `${num(s.quantity)} ${t('orders.pcsShort') || 'pcs'} · ` : ''}
                      {t('orders.netShort') || 'Net'} {formatGrams(num(s.netWeight), gramShort)} · {formatCurrencyValue(num(s.rate))}/{gramShort} · {formatCurrencyValue(value)}
                    </Text>
                  )}
                </Pressable>

                {expanded && (
                  <VStack space="md">
                    {/* The same catalogue search as gold: the shop's saved
                        items and the ornament list, or a typed name. */}
                    <ItemNameField
                      label={t('orders.itemName') || 'Item Name'}
                      required
                      value={s.itemName}
                      hint={t('itemPicker.fieldHint') || 'Search or type'}
                      onPress={() => setNamePickerFor(s.key)}
                    />
                    <HStack space="md">
                      <FloatingLabelInput
                        label={t('orders.quantity') || 'Quantity'}
                        keyboardType="number-pad"
                        value={s.quantity}
                        onChangeText={v => patchSilver(s.key, { quantity: v })}
                      />
                      <FloatingLabelInput
                        label={`${t('orders.grossWeight') || 'Gross Wt'} (${gramShort})`}
                        keyboardType="decimal-pad"
                        value={s.grossWeight}
                        onChangeText={v => patchSilver(s.key, { grossWeight: v })}
                      />
                    </HStack>
                    <HStack space="md" alignItems="flex-start">
                      <FloatingLabelInput
                        label={`${t('orders.packetWeight') || 'Packet Wt'} (${gramShort})`}
                        keyboardType="decimal-pad"
                        value={s.packetWeight}
                        onChangeText={v => patchSilver(s.key, { packetWeight: v })}
                      />
                      {/* Gross less packet until typed over. Clearing the
                          field hands it back to the calculation. */}
                      <FloatingLabelInput
                        label={`${t('orders.netWeight') || 'Net Wt'} (${gramShort})`}
                        required
                        keyboardType="decimal-pad"
                        value={s.netWeight}
                        onChangeText={v => patchSilver(s.key, v.trim()
                          ? { netWeight: v, netTouched: true }
                          : {
                            netTouched: false,
                            netWeight: (() => {
                              const n = silverNetWeight(num(s.grossWeight), num(s.packetWeight));
                              return n > 0 ? String(n) : '';
                            })(),
                          })}
                        hint={s.netTouched
                          ? (t('orders.netTyped') || 'Typed by you')
                          : (t('orders.netAuto') || 'Gross − Packet')}
                      />
                    </HStack>
                    <FloatingLabelInput
                      label={t('orders.silverRate') || 'Rate (₹/gram)'}
                      keyboardType="decimal-pad"
                      value={s.rate}
                      onChangeText={v => patchSilver(s.key, { rate: v })}
                      hint={silverRate.rate > 0
                        ? `${silverRate.isOverride ? (t('rate.shopRateShort') || 'Shop') : (t('orders.liveRate') || 'Live')} ${formatCurrencyValue(silverRate.rate)}`
                        : undefined}
                    />
                    {num(s.netWeight) > 0 && (
                      <Box bg="#F1F3F6" p="$3" rounded="$xl" borderWidth={1} borderColor="#D5DAE1">
                        <HStack justifyContent="space-between">
                          <Text fontSize={12} color={SILVER}>
                            {formatGrams(num(s.netWeight), gramShort)} × {formatCurrencyValue(num(s.rate) || silverRate.rate)}
                          </Text>
                          <Text fontSize={13} fontWeight="$bold" color={SILVER}>
                            {formatCurrencyValue(value)}
                          </Text>
                        </HStack>
                        <Text fontSize={11} color="$coolGray500" mt="$1">
                          {t('orders.totalAmount') || 'Total amount'}
                        </Text>
                      </Box>
                    )}
                  </VStack>
                )}
              </Box>
            );
          })}
          </Box>

          {/* Payment — and the thing that decides the order type */}
          <Box bg="$white" p="$4" rounded="$2xl" borderWidth={1} borderColor="#DCE2D8" style={styles.card}>
            <Text fontWeight="$bold" mb="$3">{t('orders.paymentNow') || 'Paying now'}</Text>
            {/* The gold fields only when there is gold on the sale. On a
                silver-only sale they would buy gold grams nobody sold. */}
            {(hasGold || !hasSilver) && (<>
            {hasSilver && (
              <Text fontSize={12} fontWeight="$bold" color={AMBER} mb="$2">
                {t('orders.towardsGold') || 'Towards gold'}
              </Text>
            )}
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

            {/* Gold held for this retailer: an advance in gold, or melt
                credit from old ornaments. Shown only when there is some: an
                empty "0.000 gm available" row on every other order is a
                control that can never be used, and the shopkeeper learns to
                look past exactly the row that matters when it is finally not
                empty. */}
            {meltAvailable > 0.0005 && (
              <Box mt="$3">
                <FloatingLabelInput
                  label={`${t('orders.goldHeld') || 'From gold held'} (${gramShort})`}
                  keyboardType="decimal-pad"
                  value={payMelt}
                  onChangeText={setPayMelt}
                />
                <HStack justifyContent="space-between" alignItems="center" mt="$1">
                  <Text fontSize={11} color={meltOverdrawn ? '#B42318' : '$coolGray500'}>
                    {meltOverdrawn
                      ? (t('orders.goldHeldOverdrawn') || 'That is more gold than is held for this retailer')
                      : `${t('orders.meltAvailable') || 'Available'} ${formatGrams(meltAvailable, gramShort)}`}
                  </Text>
                  {/* Spending the lot is the common case: the retailer left it
                      so it would come off a bill. */}
                  <Pressable onPress={() => setPayMelt(String(Math.min(meltAvailable, totals.fine || meltAvailable)))}>
                    <Text fontSize={11} fontWeight="$bold" color={PURPLE}>
                      {t('orders.meltUseAll') || 'Use all'}
                    </Text>
                  </Pressable>
                </HStack>
              </Box>
            )}

            {/* Cash held for this retailer: an advance, or cash paid earlier
                with the rate left open. Using it here converts it at this
                sale's rate, the rate shown beside it. */}
            {heldCash >= 0.5 && (
              <Box mt="$3">
                <FloatingLabelInput
                  label={`${t('orders.cashHeld') || 'From cash held'} (₹)`}
                  keyboardType="decimal-pad"
                  value={payHeld}
                  onChangeText={setPayHeld}
                />
                <HStack justifyContent="space-between" alignItems="center" mt="$1">
                  <Text fontSize={11} color={heldOverdrawn ? '#B42318' : '$coolGray500'} flex={1} mr="$2">
                    {heldOverdrawn
                      ? (t('orders.cashHeldOverdrawn') || 'That is more cash than is held for this retailer')
                      : (t('orders.cashHeldHint') || '{amount} held · converts at {rate}/gm')
                          .replace('{amount}', formatCurrencyValue(heldCash))
                          .replace('{rate}', formatCurrencyValue(settlementRate || 0))}
                  </Text>
                  <Pressable
                    onPress={() => setPayHeld(String(Math.min(
                      heldCash,
                      Math.round(Math.max(0, totals.fine - num(payGold) - meltApplied - (settlementRate > 0 ? num(payCash) / settlementRate : 0)) * settlementRate * 100) / 100 || heldCash,
                    )))}
                  >
                    <Text fontSize={11} fontWeight="$bold" color={PURPLE}>
                      {t('orders.meltUseAll') || 'Use all'}
                    </Text>
                  </Pressable>
                </HStack>
              </Box>
            )}

            </>)}

            {/* Silver's own account: cash buys silver grams at the silver
                lines' rate, and silver handed over counts gram for gram. */}
            {hasSilver && (
              <Box mt={hasGold ? '$4' : '$0'}>
                {hasGold && (
                  <Text fontSize={12} fontWeight="$bold" color={SILVER} mb="$2">
                    {t('orders.towardsSilver') || 'Towards silver'}
                  </Text>
                )}
                <HStack space="md">
                  <FloatingLabelInput
                    label={t('orders.cashAmount') || 'Cash (₹)'}
                    keyboardType="decimal-pad"
                    value={paySilverCash}
                    onChangeText={setPaySilverCash}
                  />
                  <FloatingLabelInput
                    label={`${t('orders.silverWord') || 'Silver'} (${gramShort})`}
                    keyboardType="decimal-pad"
                    value={paySilver}
                    onChangeText={setPaySilver}
                  />
                </HStack>
              </Box>
            )}

            {/* The only thing that lands on the cash account — a wholesale
                line is metal, and wastage is already inside the fine weight. */}
            <Pressable onPress={() => setIncludeGST(v => !v)} mt="$3">
              <HStack alignItems="center" space="sm">
                <Box
                  w={18} h={18} rounded="$sm" borderWidth={1.5}
                  borderColor={includeGST ? PURPLE : '#C9D2C5'}
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
              <Box mt="$3" pt="$3" borderTopWidth={1} borderColor="#E8ECE5">
                <HStack justifyContent="space-between">
                  <Text fontSize={13} color="$coolGray600">{t('orders.settles') || 'Settles'}</Text>
                  <Text fontSize={13} fontWeight="$bold" color="#1D1B16">
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

            {silverTotals.net > 0 && (
              <Box mt="$3" pt="$3" borderTopWidth={1} borderColor="#E8ECE5">
                <HStack justifyContent="space-between">
                  <Text fontSize={13} color="$coolGray600">
                    {t('orders.silverSettles') || 'Silver settles'}
                  </Text>
                  <Text fontSize={13} fontWeight="$bold" color="#1D1B16">
                    {formatGrams(silverSettling.covered, gramShort)} / {formatGrams(silverTotals.net, gramShort)}
                  </Text>
                </HStack>
                <HStack justifyContent="space-between" mt="$1">
                  <Text fontSize={13} color="$coolGray600">
                    {silverSettling.isOver
                      ? (t('orders.excess') || 'Paid extra')
                      : (t('orders.remaining') || 'Remaining')}
                  </Text>
                  <Text
                    fontSize={13}
                    fontWeight="$bold"
                    color={silverSettling.isOver ? '#B91C1C' : silverSettling.isExact ? '#15803D' : SILVER}
                  >
                    {silverSettling.isExact
                      ? (t('orders.paidInFull') || 'Full payment')
                      : (() => {
                        const grams = silverSettling.isOver ? silverSettling.excess : silverSettling.remaining;
                        const cash = grams * silverTotals.rate;
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
          bg="$white" px="$4" pt="$3" borderTopWidth={1} borderColor="#DCE2D8"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          {/* One capped wrapper around BOTH the totals and the button. Capping
              only the totals row left the button spanning the whole window. */}
          <Box style={LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}}>
          <HStack justifyContent="space-between" alignItems="center" mb="$3">
            {/* Each metal in its own figure, never summed: a gram of silver
                is not a gram of gold. Before any line is finished, the
                figure follows the open tab, so a silver sale does not start
                under "TOTAL FINE 99.50". */}
            <HStack space="lg">
              {(hasGold || (!hasSilver && metalTab === 'gold')) && (
                <VStack>
                  <Text fontSize={11} color="$coolGray500">{t('orders.totalFine') || 'TOTAL FINE 99.50'}</Text>
                  <Text fontSize={19} fontWeight="$black" color={AMBER}>
                    {formatGrams(totals.fine, gramShort)}
                  </Text>
                </VStack>
              )}
              {(hasSilver || (!hasGold && metalTab === 'silver')) && (
                <VStack>
                  <Text fontSize={11} color="$coolGray500">{t('orders.totalSilver') || 'SILVER NET'}</Text>
                  <Text fontSize={19} fontWeight="$black" color={SILVER}>
                    {formatGrams(silverTotals.net, gramShort)}
                  </Text>
                </VStack>
              )}
            </HStack>
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
                ? <GradientSurface colors={['#0E4D3C', '#0A3A2D']} borderRadius={16} />
                : <Box position="absolute" top={0} left={0} right={0} bottom={0} bg="#DCE2D8" />}
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

      <ItemPicker
        visible={!!namePickerFor}
        onClose={() => setNamePickerFor(null)}
        products={catalogProducts.map((c: any) => ({ id: c.id, name: c.name, purity: c.purity, category: c.category }))}
        initialQuery={(items.find(i => i.key === namePickerFor) ?? silverItems.find(x => x.key === namePickerFor))?.itemName}
        onPick={handleNamePick}
        // Silver lines see the silver ornaments; gold lines are unfiltered,
        // exactly as before.
        metal={silverItems.some(x => x.key === namePickerFor) ? 'silver' : undefined}
      />

      <DatePickerModal
        isOpen={datePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        date={orderDate}
        onSelect={(d: string) => { setOrderDate(d); setDatePickerOpen(false); }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: { elevation: 2, shadowOpacity: 0.06 },
  tabActive: { elevation: 1, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
});

export default NewOrderScreen;

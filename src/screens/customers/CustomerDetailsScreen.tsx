import React, { useMemo } from 'react';
import { Modal, Platform, StyleSheet, Keyboard, KeyboardAvoidingView, Text as RNText, TextInput, View, Pressable as RNPressable } from 'react-native';
import {
  Box,
  HStack,
  VStack,
  Text,
  Pressable,
  Icon,
  ScrollView,
  Center,
  Input,
  InputField,
} from '@gluestack-ui/themed';
import { ChevronRight, Edit2, X, Search } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../navigation/types';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { useTranslation } from '../../hooks/useTranslation';
import { capitalizeWords } from '../../utils/textUtils';
import {
  updateCustomer,
  deleteCustomer,
  clearUserData,
  fetchRetailerAccount,
  allocateCash,
  applyMeltCredit,
} from '../../store/data/dataSlice';
import { ToastViewport } from '../../components/common/Toast';
import { endImpersonation } from '../../store/auth/authSlice';
import { toast } from '../../components/common/Toast';
import ImpersonationBlockModal from '../../components/ImpersonationBlockModal';
import ValidationErrorModal from '../../components/ValidationErrorModal';
import ConfirmModal from '../../components/ConfirmModal';
import { Trash2, Plus, MessageCircle, FileText, Hourglass, Coins, ArrowDownLeft } from 'lucide-react-native';
import { useContentContainerStyle } from '../../constants/layout';
import { orderOutstanding, hasOutstanding, formatGrams } from '../../utils/dues';
import { INPUT_LIMITS, validateText } from '../../constants/inputLimits';
import CharCounter from '../../components/common/CharCounter';
import { formatCurrencyValue } from '../../utils/formatter';
import { retailerDisplayName, retailerSubtitle } from '../../utils/retailerName';
import { useShopRate } from '../../hooks/useShopRate';
import { buildRetailerStatement, statementToWhatsAppText } from '../../utils/retailerStatement';
import { buildStatementHTML } from '../../print/statementTemplate';
import { openWhatsApp } from '../../utils/whatsappUtils';
import { generateInvoicePDF, sharePDF } from '../../utils/pdfService';
import { CASH_SETTLED_EPSILON, WEIGHT_SETTLED_EPSILON_GM } from '../../utils/dues';
import { buildDayBook } from '../../utils/dayBook';
import LedgerHeader, { LedgerHeaderAction } from '../../components/ledger/LedgerHeader';
import EntryRow from '../../components/ledger/EntryRow';
import { GemBullet, GoldFrame } from '../../components/ledger/Motifs';
import ReceiveOnAccountSheet from '../../components/account/ReceiveOnAccountSheet';
import FixRateSheet from '../../components/account/FixRateSheet';
import UseGoldSheet from '../../components/account/UseGoldSheet';
import { planCashAllocation, planGoldApplication } from '../../utils/heldMoney';
import { Brand, tabularNums } from '../../theme/brand';

const LOCALES: Record<string, string> = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN', gu: 'gu-IN' };

const fmtDate = (value: any, language: string, opts: Intl.DateTimeFormatOptions) => {
  const d = new Date(value || Date.now());
  try {
    return d.toLocaleDateString(LOCALES[language] || 'en-IN', opts);
  } catch {
    return d.toLocaleDateString('en-IN', opts);
  }
};


type RouteProps = NativeStackScreenProps<RootStackParamList, 'CustomerDetails'>['route'];

export default function CustomerDetailsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProps>();
  const { customerId: paramId, customer: paramCustomer } = route.params;
  const customerId = paramId || paramCustomer?.id;

  const insets = useSafeAreaInsets();
  const { t, language } = useTranslation();
  // Centres and caps content on iPad; no-op on phones.
  const contentStyle = useContentContainerStyle();
  const dispatch = useAppDispatch();
  const customers = useAppSelector(s => s.data.customers);
  const orders = useAppSelector(s => s.data.orders);
  const { impersonateUserId, impersonatePhone } = useAppSelector(s => s.auth);
  const [blockModalVisible, setBlockModalVisible] = React.useState(false);

  const handleEndSession = () => {
    dispatch(endImpersonation());
    dispatch(clearUserData());
    navigation.navigate('AdminDashboard');
  };

  /**
   * Held as one element and rendered in exactly one place at a time.
   *
   * Both handleDelete and handleUpdate can raise it, but they run in different
   * layers - the screen and the edit modal - and on iOS only the topmost
   * presented layer can present anything further. Rendering it in both at once
   * would leave the screen's copy trying to present from a view controller
   * that is already presenting the edit modal, which UIKit drops silently.
   */
  const impersonationBlock = (
    <ImpersonationBlockModal
      isOpen={blockModalVisible}
      phone={impersonatePhone || ''}
      onEndSession={handleEndSession}
      onClose={() => setBlockModalVisible(false)}
    />
  );

  const customer = customers.find(c => c.id === customerId) || paramCustomer;

  const [showEditModal, setShowEditModal] = React.useState(false);
  // Owner name (required), shop name, phone — the same three the Add Retailer
  // forms ask for. Email, address, ID proof and the portrait were dropped from
  // all of them so a record cannot carry fields no form can create or edit.
  //
  // `customer.name` is not edited directly: it is re-derived on save from these
  // two, so renaming a shop renames what the bills say. Older records have no
  // ownerName, so it falls back to the display name — otherwise opening the
  // edit sheet on one and saving would blank the only name it has.
  const [form, setForm] = React.useState({
    ownerName: customer?.ownerName || customer?.name || '',
    shopName: customer?.shopName || '',
    phone: customer?.phone || '',
  });

  // Direction, not document type: what the customer bought from this shop, and
  // what they sold to it. An exchange appears in both, since it is genuinely
  // both — categorising it by which way the cash moved would make each tab
  // incomplete for the question it answers.
  const [searchQuery, setSearchQuery] = React.useState('');
  const [validationErrors, setValidationErrors] = React.useState<string[]>([]);
  const [showValidationModal, setShowValidationModal] = React.useState(false);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  /**
   * What deleting this customer would orphan. The backend removes only the
   * customer row, so bills, orders and declarations stay behind — the warning
   * has to say so rather than implying a cascade.
   */
  const deleteImpact = useMemo(() => {
    const own = orders.filter((o: any) => o.customerId === customerId && !o.deletedAt);
    return {
      orders: own.length,
      pending: own.filter((o: any) => o.status === 'pending').length,
    };
  }, [orders, customerId]);
  const hasRecords = deleteImpact.orders > 0 || deleteImpact.pending > 0;

  // Declarations aren't part of the dashboard's initial load, so pull them the
  // first time this screen is opened.
  React.useEffect(() => {
  }, [dispatch]);


  const handleDelete = () => {
    if (impersonateUserId) { setBlockModalVisible(true); return; }
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await dispatch(deleteCustomer(customerId)).unwrap();
      setShowDeleteModal(false);
      toast.success('Retailer deleted');
      navigation.goBack();
    } catch (error: any) {
      toast.error(error || 'Failed to delete retailer');
    } finally {
      setDeleting(false);
    }
  };

  React.useEffect(() => {
    if (customer) {
      setForm({
        ownerName: customer.ownerName || customer.name || '',
        shopName: customer.shopName || '',
        phone: customer.phone || '',
      });
    }
  }, [customer]);

  const handleUpdate = async () => {
    if (impersonateUserId) { setBlockModalVisible(true); return; }
    if (!form.ownerName.trim()) {
      setValidationErrors([t('customers.validation.ownerNameRequired') || 'Owner name is required']);
      setShowValidationModal(true);
      return;
    }
    // Optional, but still a real number when one is given. Blank is allowed and
    // means "clear it" — without that, a customer added without a phone could
    // never have any other field edited either.
    if (form.phone.trim() && form.phone.trim().length !== 10) {
      setValidationErrors([
        t('customers.detailsScreen.phoneValidationMessage') ||
        'Please enter a 10-digit phone number',
      ]);
      setShowValidationModal(true);
      return;
    }

    // Records saved before these caps existed can still be over the limit, so
    // re-check on save rather than relying on the inputs' maxLength alone.
    const lengthErrors = [
      validateText(form.ownerName, { label: t('customers.ownerName') || 'Owner Name', limit: INPUT_LIMITS.customerName }),
      validateText(form.shopName, { label: t('customers.shopName') || 'Shop Name', limit: INPUT_LIMITS.customerName }),
    ].filter(Boolean) as string[];
    if (lengthErrors.length > 0) {
      setValidationErrors(lengthErrors);
      setShowValidationModal(true);
      return;
    }

    try {
      await dispatch(updateCustomer({
        ...customer,
        ...form,
        // Re-derived, so renaming the shop renames what the bills say.
        name: retailerDisplayName(form.shopName, form.ownerName),
        ownerName: form.ownerName.trim(),
        shopName: form.shopName.trim() || undefined,
        // Kept as `""` when cleared rather than dropped: on UPDATE an empty
        // string means "remove the number I entered by mistake", and the
        // service turns it into a $unset. `undefined` would mean "not sent,
        // leave it alone" — see customer.schema.ts.
        phone: form.phone.trim(),
      })).unwrap();
      setShowEditModal(false);
      toast.success('Retailer updated');
    } catch (e: any) {
      toast.error(e.message ||
        t('customers.detailsScreen.updateErrorMessage') ||
        'Failed to update retailer');
    }
  };

  // Soft-deleted orders are excluded, exactly as on the Customers list and the
  // Orders tab — a trashed bill was counting towards this customer's orders and
  // total here, so the same customer showed two different numbers on the two
  // screens, and the deleted bill still appeared in their history.
  const customerOrders = useMemo(() => {
    if (!customerId) return [];
    return orders
      .filter((o: any) => o.customerId === customerId && !o.deletedAt)
      .slice()
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [orders, customerId]);

  // "Bought from us" holds everything the customer bought — invoices and
  // advance orders together. Splitting them into separate tabs meant answering
  // "what has this person bought from me" required checking two places and
  // adding up. An exchange stays here too and is badged, because the customer
  // did buy something; its old-gold half shows under "Sold to us".
  const filteredOrders = useMemo(() => {
    let list = customerOrders;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(o =>
        o.id.toLowerCase().includes(q) ||
        (o.invoiceNumber || '').toLowerCase().includes(q) ||
        (o.orderNumber || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [customerOrders, searchQuery]);

  const gramShort = t('common.gramShort') || 'gm';

  /**
   * What the shop is HOLDING for this retailer, as opposed to what they owe.
   *
   * Overpay a bill and the surplus lands here as held cash; hand in old gold
   * and it lands here as melt credit. Both are the retailer's money sitting
   * with the wholesaler, and both belong on a statement — a reminder that
   * lists only debts, while quietly holding four hundred rupees of theirs,
   * is the kind of thing that costs a wholesaler the account.
   */
  const account = useAppSelector(
    s => (customerId ? s.data.retailerAccounts[customerId] : undefined),
  );

  React.useEffect(() => {
    if (!customerId) return;
    dispatch(fetchRetailerAccount({ customerId }));
  }, [dispatch, customerId]);

  const shopDetails = useAppSelector(s => s.data.shopDetails);
  /** Today's 99.50 rate — the shop's own when set, the feed otherwise. Used
   *  only to restate a metal balance in rupees on the statement. */
  const { rate: liveRate } = useShopRate();

  const statement = useMemo(
    () => buildRetailerStatement(customerOrders, account),
    [customerOrders, account],
  );

  /** Labels once, so the text and the PDF cannot drift apart. */
  const statementLabels = useMemo(() => ({
    heading: t('statement.asOn') || 'Balance as on',
    settled: t('statement.settled') || 'settled',
    due: t('statement.due') || 'due',
    totalDue: t('statement.totalDue') || 'Total due',
    approxAt: t('statement.approxAt') || 'Approx',
    perGram: t('common.gramShort') || 'gm',
    credit: t('statement.credit') || 'Credit with us',
    meltCredit: t('statement.meltCredit') || 'Melt credit',
    nothingDue: t('statement.nothingDue') || 'Nothing due',
  }), [t]);

  const retailerLabel = customer ? retailerDisplayName(customer.shopName, customer.name) : '';

  const onRemindWhatsApp = React.useCallback(async () => {
    const message = statementToWhatsAppText(statement, {
      retailerName: retailerLabel,
      shopName: shopDetails?.shopName || shopDetails?.name,
      gramShort,
      rate: liveRate,
      labels: statementLabels,
    });
    // No phone is not a failure: wa.me with no number opens WhatsApp's own
    // contact picker with the message already written, which is one tap more
    // rather than a dead end.
    await openWhatsApp(customer?.phone, message);
  }, [statement, retailerLabel, shopDetails, gramShort, liveRate, statementLabels, customer]);

  const onShareStatementPdf = React.useCallback(async () => {
    const html = buildStatementHTML(statement, {
      retailerName: retailerLabel,
      retailerPhone: customer?.phone,
      shopName: shopDetails?.shopName || shopDetails?.name,
      shopAddress: shopDetails?.address,
      shopPhone: shopDetails?.phone,
      gramShort,
      labels: {
        title: t('statement.title') || 'Account Statement',
        asOn: t('statement.asOn') || 'Balance as on',
        orderCol: t('statement.orderCol') || 'Bill',
        dateCol: t('statement.dateCol') || 'Date',
        dueCol: t('statement.dueCol') || 'Outstanding',
        ...statementLabels,
      },
    });
    const fileName = `statement-${(customer?.customerCode || retailerLabel || 'retailer')
      .replace(/[^a-zA-Z0-9-]/g, '-')}.pdf`;

    const filePath = await generateInvoicePDF(html, fileName);
    if (!filePath) {
      toast.error(t('statement.pdfFailed') || 'Could not create the statement PDF');
      return;
    }
    await sharePDF(filePath, t('statement.title') || 'Account Statement');
  }, [statement, retailerLabel, customer, shopDetails, gramShort, statementLabels, t]);


  /** Everything that moved on this account, newest first, from the same
   *  builder as the Day Book. What moved, never a balance. The balance above
   *  is the authoritative one, from utils/dues.ts. */
  const entries = useMemo(
    () => buildDayBook(customerOrders, account ? [account] : []),
    [customerOrders, account],
  );

  /**
   * Taking money or metal onto the account, and spending what is held.
   *
   * The receipt that is NOT against a sale (cash with the rate fixed later, or
   * an advance in cash or gold), and the two ways to use it: Fix rate turns
   * held cash into grams at the rate the retailer names, and Use gold held
   * puts held gold on their dues gram for gram. Both go oldest sale first
   * (utils/heldMoney.ts) and post each step to the server, which re-checks
   * every figure against the balance.
   */
  const [receiveOpen, setReceiveOpen] = React.useState(false);
  const [fixRateOpen, setFixRateOpen] = React.useState(false);
  const [useGoldOpen, setUseGoldOpen] = React.useState(false);

  const guardWrite = (open: () => void) => () => {
    if (impersonateUserId) { setBlockModalVisible(true); return; }
    open();
  };

  const onFixRate = React.useCallback(async (amount: number, rate: number): Promise<string | null> => {
    if (!customerId) return null;
    const steps = planCashAllocation(customerOrders, amount, rate);
    if (steps.length === 0) return t('account.nothingToFix') || 'No sale owes gold to put this against.';
    let grams = 0;
    for (const step of steps) {
      const res: any = await dispatch(allocateCash({
        customerId,
        orderId: step.orderId,
        amount: step.amount,
        goldRate: rate,
      }) as any);
      if (!allocateCash.fulfilled.match(res)) {
        return String(res.payload || t('account.fixRateFailed') || 'Could not fix the rate');
      }
      grams += step.amount / rate;
    }
    toast.success(
      (t('account.rateFixedToast') || 'Rate fixed. {grams} off their gold due.')
        .replace('{grams}', formatGrams(grams, t('common.gramShort') || 'gm')),
    );
    return null;
  }, [customerId, customerOrders, dispatch, t]);

  /** Gold held onto their dues: the weight chosen in the sheet (all of it, half,
   *  or any part), oldest sale first. */
  const onUseGold = React.useCallback(async (weight: number): Promise<string | null> => {
    if (!customerId) return null;
    const steps = planGoldApplication(customerOrders, weight);
    if (steps.length === 0) return t('account.nothingToFix') || 'No sale owes gold to put this against.';
    for (const step of steps) {
      const res: any = await dispatch(applyMeltCredit({
        customerId,
        orderId: step.orderId,
        weight: step.weight,
      }) as any);
      if (!applyMeltCredit.fulfilled.match(res)) {
        return String(res.payload || t('account.useGoldFailed') || 'Could not use the gold held');
      }
    }
    toast.success(t('account.goldUsedToast') || 'Gold held put against their dues');
    return null;
  }, [customerId, customerOrders, dispatch, t]);

  if (!customer) {
    return (
      <View style={styles.screen}>
        <LedgerHeader
          title={t('customers.detailsTitle') || 'Retailer Details'}
          onBack={() => navigation.goBack()}
        />
        <Center flex={1} px="$6">
          <RNText style={styles.muted}>{t('customers.notFound') || 'Retailer not found'}</RNText>
        </Center>
      </View>
    );
  }

  const subtitle = [
    customer.customerCode,
    retailerSubtitle(customer),
    customer.phone || (t('customers.noPhone') || 'No phone number'),
    customer.address,
  ].filter(Boolean).join(' · ');
  const holding =
    statement.heldCash >= CASH_SETTLED_EPSILON || statement.meltCredit >= WEIGHT_SETTLED_EPSILON_GM;

  return (
    <View style={styles.screen}>
      {/* The retailer's statement: what they owe as of today, what the shop is
          holding for them, their sales and every entry on the account.

          It was SoneBill's customer profile: contact chips, a lifetime rupee
          total, tinted summary cards, invoice cards and a floating "+". App
          Review rejected the app as a SoneBill copy under guideline 4.3(a)
          (APP_STORE_4.3_REWORK.md). Balances still come from utils/dues.ts
          through buildRetailerStatement. Nothing is computed here. */}
      <LedgerHeader
        title={customer.name}
        subtitle={subtitle}
        onBack={() => navigation.goBack()}
        right={
          <>
            {/* Always offered. It used to be hidden once the retailer had any
                sale, which left no way to remove a duplicate or mistyped
                entry. The confirmation carries the warning instead. */}
            <LedgerHeaderAction
              icon={Trash2}
              onPress={handleDelete}
              accessibilityLabel={t('customers.delete.title') || 'Delete retailer'}
            />
            <LedgerHeaderAction
              icon={Edit2}
              onPress={() => setShowEditModal(true)}
              accessibilityLabel={t('customers.detailsScreen.editTitle') || 'Edit Retailer'}
            />
          </>
        }
      />

      <ScrollView
        flex={1}
        // The search box and the sale rows share this container, so without
        // this the first tap on a row while searching is spent dismissing the
        // keyboard and the row never opens.
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 16,
          paddingBottom: Math.max(insets.bottom, 24) + 16,
          ...contentStyle,
        }}
      >
        {/* The balance. Two figures, never one: metal is owed as metal and
            cash as cash, and they settle independently. Pricing the gold into
            rupees needs a rate, and the rate on the day the metal comes back
            is not today's. */}
        <View style={[styles.card, styles.heroCard]}>
          <GoldFrame />
          <View style={styles.kickerRow}>
            <GemBullet />
            <RNText style={styles.kicker}>
              {(t('statement.asOn') || 'Balance as on')} {fmtDate(Date.now(), language, { day: 'numeric', month: 'short', year: 'numeric' })}
            </RNText>
          </View>
          {statement.totalGold > 0 || statement.totalCash > 0 ? (
            <View style={styles.balanceRow}>
              <View style={{ flex: 1 }}>
                <RNText style={styles.balanceLabel}>{t('khata.fineGold') || 'Fine gold (99.50)'}</RNText>
                <RNText style={[styles.balanceValue, { color: statement.totalGold > 0 ? Brand.gold : Brand.inkFaint }, tabularNums]} numberOfLines={1} adjustsFontSizeToFit>
                  {statement.totalGold > 0 ? formatGrams(statement.totalGold, gramShort) : '—'}
                </RNText>
              </View>
              <View style={styles.balanceDivider} />
              <View style={{ flex: 1 }}>
                <RNText style={styles.balanceLabel}>{t('khata.cash') || 'Cash'}</RNText>
                <RNText style={[styles.balanceValue, { color: statement.totalCash > 0 ? Brand.ink : Brand.inkFaint }, tabularNums]} numberOfLines={1} adjustsFontSizeToFit>
                  {statement.totalCash > 0 ? formatCurrencyValue(statement.totalCash) : '—'}
                </RNText>
              </View>
            </View>
          ) : (
            <RNText style={styles.nothingDue}>{t('statement.nothingDue') || 'Nothing due'}</RNText>
          )}

          {/* What the shop is HOLDING for this retailer, kept apart from what
              they owe rather than netted off it. One is a debt, the other is
              the retailer's own money sitting here, and subtracting one from
              the other hides the second entirely. */}
          {holding && (
            <View style={styles.heldRow}>
              <RNText style={styles.heldLabel}>{t('statement.heldTitle') || 'Held for this retailer'}</RNText>

              {/* Cash whose rate is not fixed. With gold owed, Fix rate turns it
                  into grams off the due at the rate the retailer names; with
                  nothing owed it is an advance, waiting for their next sale. */}
              {statement.heldCash >= CASH_SETTLED_EPSILON && (
                <View style={styles.heldLine}>
                  <View style={[styles.heldIcon, { backgroundColor: Brand.goldSoft }]}>
                    <Hourglass size={15} color={Brand.goldDark} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <RNText style={[styles.heldValue, tabularNums]}>{formatCurrencyValue(statement.heldCash)}</RNText>
                    <RNText style={styles.heldHint}>
                      {statement.totalGold > 0
                        ? (t('account.cashHeldRateLater') || 'Cash held · rate not fixed')
                        : (t('account.cashAdvance') || 'Cash advance · for their next sale')}
                    </RNText>
                  </View>
                  {statement.totalGold > 0 && (
                    <RNPressable style={styles.heldAction} onPress={guardWrite(() => setFixRateOpen(true))}>
                      <RNText style={styles.heldActionText}>{t('account.fixRate') || 'Fix rate'}</RNText>
                    </RNPressable>
                  )}
                </View>
              )}

              {/* Gold held: advances and melt credit, in 99.50 grams. */}
              {statement.meltCredit >= WEIGHT_SETTLED_EPSILON_GM && (
                <View style={styles.heldLine}>
                  <View style={[styles.heldIcon, { backgroundColor: Brand.goldSoft }]}>
                    <Coins size={15} color={Brand.goldDark} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <RNText style={[styles.heldValue, tabularNums]}>{formatGrams(statement.meltCredit, gramShort)}</RNText>
                    <RNText style={styles.heldHint}>
                      {statement.totalGold > 0
                        ? (t('account.goldHeld') || 'Gold held · fine 99.50')
                        : (t('account.goldAdvanceHint') || 'Gold advance · for their next sale')}
                    </RNText>
                  </View>
                  {statement.totalGold > 0 && (
                    <RNPressable style={styles.heldAction} onPress={guardWrite(() => setUseGoldOpen(true))}>
                      <RNText style={styles.heldActionText}>{t('account.useGold') || 'Use'}</RNText>
                    </RNPressable>
                  )}
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <RNPressable
            style={[styles.action, styles.actionPrimary]}
            onPress={() => navigation.navigate('NewOrder', { customerId })}
          >
            <Plus size={16} color="#FFFFFF" />
            <RNText style={[styles.actionText, { color: '#FFFFFF' }]}>{t('newEntry.sale') || 'New sale'}</RNText>
          </RNPressable>
          {/* Money or metal that is not against one sale: cash with the rate
              fixed later, or an advance. A payment against a sale is still
              recorded on that sale, from the list below. */}
          <RNPressable
            style={[styles.action, styles.actionOutline, { flex: 1 }]}
            onPress={guardWrite(() => setReceiveOpen(true))}
          >
            <ArrowDownLeft size={16} color={Brand.received} />
            <RNText style={[styles.actionText, { color: Brand.received }]}>{t('account.receive') || 'Receive'}</RNText>
          </RNPressable>
        </View>
        {/* Sending the statement. Offered whenever there is anything to say,
            a debt OR a credit, and not for a flat account, where a reminder
            would be noise. */}
        {!statement.isClear && (
          <View style={styles.actions}>
            <RNPressable style={[styles.action, styles.actionWhatsApp, { flex: 1 }]} onPress={onRemindWhatsApp}>
              <MessageCircle size={16} color="#FFFFFF" />
              <RNText style={[styles.actionText, { color: '#FFFFFF' }]}>{t('retailer.remind') || 'Remind'}</RNText>
            </RNPressable>
            <RNPressable style={[styles.action, styles.actionOutline, { flex: 1 }]} onPress={onShareStatementPdf}>
              <FileText size={16} color={Brand.primary} />
              <RNText style={[styles.actionText, { color: Brand.primary }]}>{t('statement.pdf') || 'PDF'}</RNText>
            </RNPressable>
          </View>
        )}

        {/* Sales, with what is still owed on each. A receipt is recorded
            against a sale, on its own screen, so this is where Receive starts. */}
        <View style={styles.sectionHead}>
          <RNText style={styles.sectionTitle}>{t('dayBook.sales') || 'Sales'}</RNText>
          {customerOrders.length > 0 && (
            <RNText style={styles.sectionHint}>{t('retailer.receiveHint') || 'Tap a sale to record what was received against it.'}</RNText>
          )}
        </View>

        {customerOrders.length > 6 && (
          <View style={styles.search}>
            <Search size={16} color={Brand.inkFaint} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('customers.detailsScreen.searchInvoicePlaceholder') || 'Search sale number...'}
              placeholderTextColor={Brand.inkFaint}
              value={searchQuery}
              onChangeText={setSearchQuery}
              maxLength={INPUT_LIMITS.searchQuery}
            />
            {searchQuery.length > 0 && (
              <RNPressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <X size={14} color={Brand.inkFaint} />
              </RNPressable>
            )}
          </View>
        )}

        <View style={styles.table}>
          {filteredOrders.length === 0 ? (
            <RNText style={[styles.muted, { textAlign: 'center', paddingVertical: 20 }]}>
              {searchQuery
                ? t('customers.detailsScreen.noMatchingResults') || 'No matching results found'
                : t('retailer.noSales') || 'No sales to this retailer yet.'}
            </RNText>
          ) : (
            filteredOrders.map((order, i) => {
              const due = orderOutstanding(order);
              const owes = hasOutstanding(due);
              return (
                <RNPressable
                  key={order.id}
                  onPress={() => navigation.navigate('OrderDetails', { orderId: order.id })}
                  style={({ pressed }) => [styles.saleRow, i < filteredOrders.length - 1 && styles.divider, pressed && { opacity: 0.6 }]}
                >
                  <View style={{ flex: 1 }}>
                    <RNText style={styles.saleNo}>
                      {order.invoiceNumber || order.orderNumber || order.id.slice(-6).toUpperCase()}
                    </RNText>
                    <RNText style={styles.saleMeta} numberOfLines={1}>
                      {fmtDate(order.date || order.createdAt, language, { day: 'numeric', month: 'short', year: 'numeric' })}
                      {order.items?.[0]?.itemName ? ` · ${order.items[0].itemName}` : ''}
                      {(order.items?.length ?? 0) > 1 ? ` +${(order.items?.length ?? 0) - 1}` : ''}
                    </RNText>
                  </View>
                  {/* This sale's share of the balance above, each account only
                      when it has something on it. Settled sales stay listed so
                      a retailer chased for one bill can see the last one was
                      acknowledged. */}
                  <View style={{ alignItems: 'flex-end', marginRight: 6 }}>
                    {owes ? (
                      <>
                        {due.gold > 0 && (
                          <RNText style={[styles.saleFigure, { color: Brand.gold }, tabularNums]}>{formatGrams(due.gold, gramShort)}</RNText>
                        )}
                        {due.cash > 0 && (
                          <RNText style={[styles.saleFigure, { color: Brand.ink }, tabularNums]}>{formatCurrencyValue(due.cash)}</RNText>
                        )}
                      </>
                    ) : (
                      <RNText style={styles.settled}>{t('retailer.settled') || 'Settled'}</RNText>
                    )}
                  </View>
                  <ChevronRight size={16} color={Brand.inkFaint} />
                </RNPressable>
              );
            })
          )}
        </View>

        {entries.length > 0 && (
          <>
            <View style={styles.sectionHead}>
              <RNText style={styles.sectionTitle}>{t('retailer.entries') || 'Entries'}</RNText>
            </View>
            <View style={[styles.table, { paddingVertical: 0 }]}>
              {entries.map(e => (
                <EntryRow
                  key={e.id}
                  entry={e}
                  name={fmtDate(e.at, language, { day: 'numeric', month: 'short', year: 'numeric' })}
                  t={t}
                  language={language}
                  showDate={false}
                  onPress={e.orderId ? () => navigation.navigate('OrderDetails', { orderId: e.orderId }) : undefined}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <ReceiveOnAccountSheet
        visible={receiveOpen}
        onClose={() => setReceiveOpen(false)}
        customerId={customerId}
        retailerName={retailerLabel}
        owesGold={statement.totalGold > 0}
        t={t}
      />

      <FixRateSheet
        visible={fixRateOpen}
        onClose={() => setFixRateOpen(false)}
        heldCash={statement.heldCash}
        goldDue={statement.totalGold}
        defaultRate={liveRate}
        subtitle={(t('account.fixRateSubtitle') || '{cash} held for {name} · {gold} gold due')
          .replace('{cash}', formatCurrencyValue(statement.heldCash))
          .replace('{name}', retailerLabel)
          .replace('{gold}', formatGrams(statement.totalGold, gramShort))}
        onConfirm={onFixRate}
        t={t}
      />

      <UseGoldSheet
        visible={useGoldOpen}
        onClose={() => setUseGoldOpen(false)}
        heldGold={statement.meltCredit}
        goldDue={statement.totalGold}
        subtitle={(t('account.useGoldSubtitle') || '{held} held for {name} · {due} gold due')
          .replace('{held}', formatGrams(statement.meltCredit, gramShort))
          .replace('{name}', retailerLabel)
          .replace('{due}', formatGrams(statement.totalGold, gramShort))}
        hint={t('account.useGoldHint') || 'Gram for gram, oldest sale first.'}
        onConfirm={onUseGold}
        t={t}
      />

      <ConfirmModal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        tone="destructive"
        icon="trash"
        title={t('customers.delete.title')}
        loading={deleting}
        confirmLabel={t('customers.delete.confirm')}
        cancelLabel={t('common.cancel')}
        onConfirm={confirmDelete}
        description={
          hasRecords ? (
            <VStack space="sm">
              <Text fontSize={14} color="$coolGray500" textAlign="center" lineHeight={20}>
                {t('customers.delete.hasRecords')}
              </Text>
              <VStack space="xs" bg="#FEF2F2" rounded="$xl" px="$4" py="$3">
                {deleteImpact.orders > 0 && (
                  <Text fontSize={13} fontWeight="$bold" color="#B91C1C" textAlign="center">
                    {deleteImpact.orders} {t('customers.delete.records.orders')}
                  </Text>
                )}
                {deleteImpact.pending > 0 && (
                  <Text fontSize={13} fontWeight="$bold" color="#B91C1C" textAlign="center">
                    {deleteImpact.pending} {t('customers.delete.records.pending')}
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

      {/* Edit Customer Modal */}
      <Modal visible={showEditModal} transparent animationType="fade">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <Pressable
          flex={1}
          bg="rgba(0,0,0,0.45)"
          justifyContent="flex-end"
          onPress={Platform.OS === 'web' ? undefined : Keyboard.dismiss}
        >
          <Pressable
            bg="$white"
            p="$6"
            style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 24) }]}
            onPress={(e) => e.stopPropagation()}
          >
            <HStack justifyContent="center" alignItems="center" mb="$4">
              <Text fontSize={20} fontWeight="$bold">
                {t('customers.detailsScreen.editTitle') || 'Edit Retailer'}
              </Text>
              <Pressable position="absolute" right={0} onPress={() => setShowEditModal(false)}>
                <Icon as={X} size="md" />
              </Pressable>
            </HStack>

            <VStack space="md">
              {/* Owner name — the required one, so it leads and keeps the
                  highlighted border. */}
              <VStack space="xs">
                <Text fontWeight="$semibold">{t('customers.ownerName') || 'Owner Name'}</Text>
                <Input rounded="$xl" borderWidth={2} borderColor="#145F4A" bg="$white">
                  <InputField
                    placeholder={t('customers.placeholders.ownerName') || 'e.g. Ramesh Patel'}
                    value={form.ownerName}
                    onChangeText={text => setForm({ ...form, ownerName: text })}
                    // Title-cased once the field is done rather than on every
                    // keystroke, which re-cases mid-word and makes a deliberate
                    // lower-case letter impossible to keep.
                    onBlur={() => setForm(f => ({ ...f, ownerName: capitalizeWords(f.ownerName) }))}
                    maxLength={INPUT_LIMITS.customerName}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />
                </Input>
                <CharCounter value={form.ownerName} limit={INPUT_LIMITS.customerName} />
              </VStack>

              <VStack space="xs">
                <Text fontWeight="$semibold">{t('customers.shopName') || 'Shop Name'}</Text>
                <Input bg="$coolGray100" borderWidth={0} rounded="$xl">
                  <InputField
                    placeholder={t('customers.placeholders.shopName') || 'e.g. Krishna Jewellers'}
                    value={form.shopName}
                    onChangeText={text => setForm({ ...form, shopName: text })}
                    onBlur={() => setForm(f => ({ ...f, shopName: capitalizeWords(f.shopName) }))}
                    maxLength={INPUT_LIMITS.customerName}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />
                </Input>
                <CharCounter value={form.shopName} limit={INPUT_LIMITS.customerName} />
              </VStack>

              {/* Editable only while empty. Adding a number a customer did not
                  give at the counter is safe and is the whole point of the
                  field being optional — an old-gold declaration, for one, still
                  requires it. CHANGING an existing number is what stays locked:
                  it re-keys the customer's photo folder and is how two people's
                  records get quietly merged. */}
              <VStack space="xs">
                <Text fontWeight="$semibold">
                  {customer.phone
                    ? (t('customers.phone') || 'Phone')
                    : (t('customers.phoneOptional') || 'Phone (optional)')}
                </Text>
                <Input
                  isDisabled={Boolean(customer.phone)}
                  bg="$coolGray100"
                  borderWidth={0}
                  rounded="$xl"
                >
                  <InputField
                    placeholder={t('customers.placeholders.phone') || '10-digit mobile number'}
                    keyboardType="phone-pad"
                    value={form.phone}
                    maxLength={INPUT_LIMITS.phone}
                    onChangeText={text => setForm({ ...form, phone: text })}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />
                </Input>
              </VStack>

            </VStack>

            <Pressable onPress={handleUpdate} style={{ marginTop: 18 }}>
              <Box bg="#0E4D3C" rounded="$xl" py="$3" alignItems="center">
                <Text color="$white" fontWeight="$bold" fontSize={16}>
                  {t('customers.detailsScreen.saveChanges') || 'Save Changes'}
                </Text>
              </Box>
            </Pressable>

            <Pressable onPress={() => setShowEditModal(false)} style={{ marginTop: 12 }}>
              <Box
                bg="$coolGray100"
                rounded="$xl"
                py="$3"
                alignItems="center"
              >
                <Text fontWeight="$medium">{t('common.cancel') || 'Cancel'}</Text>
              </Box>
            </Pressable>
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>

        {/* Inside this Modal, not beside it. iOS presents one RN Modal at a
            time from a given view controller, so a sibling raised while this
            one is open is never presented: saving an invalid form set the flag
            and nothing appeared, leaving the red field outline the same code
            path sets as the only feedback. Nested, it presents on top of this
            one - which is what the photo source sheet in here already relies
            on. handleUpdate is the only caller, so it belongs entirely here. */}
        <ValidationErrorModal
          isOpen={showValidationModal}
          errors={validationErrors}
          onClose={() => setShowValidationModal(false)}
        />

        {/* Rendered in whichever layer is on top: handleDelete raises this from
            the screen, handleUpdate from inside this modal, and only the
            topmost presented layer can show it. */}
        {impersonationBlock}

        {/* handleUpdate reports a failed save with a toast, and so does the
            photo picker on a failed pick. The root viewport sits under this
            modal's own native layer, so without one here both are silent. */}
        <ToastViewport />
      </Modal>

      {!showEditModal && impersonationBlock}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Brand.paper,
  },
  muted: {
    fontSize: 14,
    color: Brand.inkMuted,
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
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  balanceRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  balanceDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: Brand.lineStrong,
    marginHorizontal: 14,
  },
  balanceLabel: {
    fontSize: 13,
    color: Brand.inkMuted,
  },
  balanceValue: {
    fontSize: 26,
    fontWeight: '700',
    marginTop: 4,
  },
  nothingDue: {
    fontSize: 20,
    fontWeight: '700',
    color: Brand.received,
    marginTop: 10,
  },
  heldRow: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Brand.line,
  },
  heldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.received,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heldValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Brand.received,
  },
  heldLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  heldIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  heldHint: {
    fontSize: 12,
    color: Brand.inkMuted,
    marginTop: 1,
  },
  heldAction: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  heldActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: Brand.primary,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 8,
    paddingHorizontal: 14,
  },
  actionPrimary: {
    flex: 1,
    backgroundColor: Brand.primary,
  },
  actionWhatsApp: {
    backgroundColor: '#1F9D55',
  },
  actionOutline: {
    borderWidth: 1,
    borderColor: Brand.lineStrong,
    backgroundColor: Brand.card,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '700',
  },
  sectionHead: {
    marginTop: 22,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Brand.ink,
  },
  sectionHint: {
    fontSize: 13,
    color: Brand.inkMuted,
    marginTop: 2,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    paddingHorizontal: 12,
    backgroundColor: Brand.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Brand.line,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Brand.ink,
    paddingVertical: 0,
  },
  table: {
    backgroundColor: Brand.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Brand.line,
    paddingHorizontal: 14,
  },
  saleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.line,
  },
  saleNo: {
    fontSize: 15,
    fontWeight: '700',
    color: Brand.ink,
  },
  saleMeta: {
    fontSize: 12,
    color: Brand.inkMuted,
    marginTop: 2,
  },
  saleFigure: {
    fontSize: 14,
    fontWeight: '700',
  },
  settled: {
    fontSize: 11,
    fontWeight: '700',
    color: Brand.received,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 -6px 20px rgba(0,0,0,0.15)', marginHorizontal: 'auto', width: '100%', maxWidth: 500, borderRadius: 24 }
      : { elevation: 20 }),
  },
});


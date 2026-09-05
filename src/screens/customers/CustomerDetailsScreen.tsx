import React, { useMemo } from 'react';
import { Modal, Platform, StyleSheet, Keyboard, KeyboardAvoidingView } from 'react-native';
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
import { ArrowLeft, Phone, Mail, MapPin, User, ChevronRight, Clock, CheckCircle, Edit2, X, Search } from 'lucide-react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
} from '../../store/data/dataSlice';
import { ToastViewport } from '../../components/common/Toast';
import { endImpersonation } from '../../store/auth/authSlice';
import { toast } from '../../components/common/Toast';
import ImpersonationBlockModal from '../../components/ImpersonationBlockModal';
import ValidationErrorModal from '../../components/ValidationErrorModal';
import ConfirmModal from '../../components/ConfirmModal';
import { Trash2, Plus, Wallet, Coins, MessageCircle, FileText } from 'lucide-react-native';
import { LAYOUT } from '../../constants/layout';
import { orderOutstanding, hasOutstanding, sumOutstanding, formatGrams } from '../../utils/dues';
import { INPUT_LIMITS, validateText } from '../../constants/inputLimits';
import CharCounter from '../../components/common/CharCounter';
import { formatOrderDateTime, formatCurrencyValue } from '../../utils/formatter';
import CustomerCodeBadge from '../../components/customers/CustomerCodeBadge';
import { retailerDisplayName, retailerSubtitle } from '../../utils/retailerName';
import { useShopRate } from '../../hooks/useShopRate';
import { buildRetailerStatement, statementToWhatsAppText } from '../../utils/retailerStatement';
import { buildStatementHTML } from '../../print/statementTemplate';
import { openWhatsApp } from '../../utils/whatsappUtils';
import { generateInvoicePDF, sharePDF } from '../../utils/pdfService';
import { CASH_SETTLED_EPSILON, WEIGHT_SETTLED_EPSILON_GM } from '../../utils/dues';


/**
 * Tints for the three summary cards.
 *
 * Not decoration for its own sake — three identical white cards made the row
 * read as one block, and the eye had to parse the labels to find the number it
 * came for. A colour per card makes each findable at a glance.
 *
 * The values are the ones the rest of the app already uses for these ideas, so
 * the screen agrees with the dashboard rather than inventing a second scheme:
 * Sold to us is the dashboard tile's indigo, Orders is the violet of the
 * exchange badge on the orders list, and Total is the green every money figure
 * in the app is printed in.
 */
const STAT_TONES = {
  orders: { bg: '#F5F3FF', border: '#DDD6FE', fg: '#6D28D9', icon: '#7C3AED', chip: '#EDE9FE' },
  sold:   { bg: '#EEF2FF', border: '#C7D2FE', fg: '#4338CA', icon: '#6366F1', chip: '#E0E7FF' },
  // Kept although no tile uses it: the lifetime-value row on the info card is
  // this green, and the next thing that needs a money tone should reach for the
  // same one rather than inventing a second.
  total:  { bg: '#ECFDF5', border: '#A7F3D0', fg: '#047857', icon: '#10B981', chip: '#D1FAE5' },
} as const;

/**
 * One line of contact detail, with its icon in a tinted chip.
 *
 * Three grey icons stacked in a column read as a list of the same thing; the
 * chips let phone, email and address be told apart without reading them. The
 * colours are only ever decoration — nothing downstream branches on them.
 *
 * `placeholder` renders in place of a missing value rather than dropping the
 * row, so a customer with no phone number shows that plainly instead of just
 * having one fewer line than the last customer looked at.
 */
const ContactRow = ({
  icon,
  tint,
  value,
  placeholder,
}: {
  icon: any;
  tint: { bg: string; fg: string };
  value?: string;
  placeholder?: string;
}) => {
  if (!value && !placeholder) return null;
  return (
    <HStack alignItems="center" space="sm">
      <Box bg={tint.bg} p="$1.5" rounded="$lg">
        <Icon as={icon} size="xs" color={tint.fg} />
      </Box>
      {value ? (
        <Text color="$coolGray700" flex={1}>
          {value}
        </Text>
      ) : (
        <Text color="$coolGray400" fontStyle="italic" flex={1}>
          {placeholder}
        </Text>
      )}
    </HStack>
  );
};

type RouteProps = NativeStackScreenProps<RootStackParamList, 'CustomerDetails'>['route'];

export default function CustomerDetailsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProps>();
  const { customerId: paramId, customer: paramCustomer } = route.params;
  const customerId = paramId || paramCustomer?.id;

  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
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

  const totalAmount = customerOrders.reduce((sum: number, o: any) => sum + (Number(o.amount) || 0), 0);

  /**
   * This retailer's running position across every order they hold — the metal
   * account in grams and the cash account in rupees, summed. Each order's own
   * share is shown on its row below, so the total and the rows it came from are
   * both on this screen rather than only the total.
   */
  const outstanding = useMemo(() => sumOutstanding(customerOrders), [customerOrders]);
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


  const getStatusLabel = (status: string) => {
    if (status === 'completed') {
      return t('orders.status.completed') || 'Completed';
    }
    if (status === 'pending') {
      return t('orders.status.pending') || 'Pending';
    }
    return status;
  };

  if (!customer) {
    return (
      <Box flex={1} bg="$white">
        <SafeAreaView edges={['top']} style={{ backgroundColor: '#FFFFFF' }}>
          <Box bg="$white" borderBottomWidth={1} borderBottomColor="$coolGray200">
            <HStack px="$4" py="$3.5" alignItems="center" space="md">
              <Pressable onPress={() => navigation.goBack()} p="$2" rounded="$lg">
                <ArrowLeft size={22} color="#111827" />
              </Pressable>
              <Text fontWeight="$bold" color="$coolGray900" style={{ fontSize: 20 }}>
                {t('customers.detailsTitle') || 'Retailer Details'}
              </Text>
            </HStack>
          </Box>
        </SafeAreaView>
        <Center flex={1} px="$6">
          <Text color="$coolGray500">
            {t('customers.notFound') || 'Retailer not found'}
          </Text>
        </Center>
      </Box>
    );
  }

  return (
    <Box flex={1} bg="#F3F4F6">
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#FFFFFF' }}>
        {/* Header */}
        <Box bg="$white" borderBottomWidth={1} borderBottomColor="$coolGray200">
          <HStack 
            px="$4" 
            py="$3.5" 
            alignItems="center" 
            space="md"
            style={{ ...(LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}) }}
          >
            <Pressable onPress={() => navigation.goBack()} p="$2" rounded="$lg">
              <ArrowLeft size={22} color="#111827" />
            </Pressable>
            <VStack>
              <Text
                fontWeight="$bold"
                color="$coolGray900"
                style={{ fontSize: 22, lineHeight: 26 }}
              >
                {t('customers.detailsTitle') || 'Retailer Details'}
              </Text>
            </VStack>
            <Box flex={1} />
            <HStack space="sm">
              {/* Always offered. It used to be hidden once the customer had any
                  order, which left no way to remove a duplicate or mistyped
                  entry — the confirmation below carries the warning instead. */}
              <Pressable
                onPress={handleDelete}
                p="$2"
                rounded="$lg"
                bg="$red50"
              >
                <Icon as={Trash2} size="sm" color="#EF4444" />
              </Pressable>
              <Pressable
                onPress={() => setShowEditModal(true)}
                p="$2"
                rounded="$lg"
                bg="#EDE9FE"
              >
                <Icon as={Edit2} size="sm" color="#6D5EF7" />
              </Pressable>
            </HStack>
          </HStack>
        </Box>
      </SafeAreaView>

      <ScrollView
        flex={1}
        // The search box and the order rows share this container, so without
        // this the first tap on a row while searching is spent dismissing the
        // keyboard and the row never opens.
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 16,
          paddingBottom: Math.max(insets.bottom, 150),
          ...(LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {})
        }}
      >
        {/* Info card */}
        <Box bg="$white" rounded="$2xl" p="$5" style={styles.card}>
          {/* The code beside the name, so the shopkeeper can confirm they
              opened the right one of two same-named customers before acting
              on anything on this screen. */}
          <HStack alignItems="center" space="sm">
            <Text fontWeight="$bold" fontSize={20} color="$coolGray900" flexShrink={1}>
              {customer.name}
            </Text>
            <CustomerCodeBadge code={customer.customerCode} size="md" />
          </HStack>

          <VStack mt="$4" space="sm">
            {/* Who to ask for. Hidden when absent — plenty of retailers are
                known only as the shop, and an empty row would suggest
                something is missing when nothing is. */}
            <ContactRow
              icon={User}
              tint={{ bg: '#F3E8FF', fg: '#7857FF' }}
              value={retailerSubtitle(customer)}
            />
            {/* Shown even when empty, unlike the rows below: a missing number
                is worth noticing here, and this is where it gets added. */}
            <ContactRow
              icon={Phone}
              tint={{ bg: '#EDE9FE', fg: '#7C3AED' }}
              value={customer.phone}
              placeholder={t('customers.noPhone') || 'No phone number'}
            />
            {!!customer.email && (
              <ContactRow
                icon={Mail}
                tint={{ bg: '#DBEAFE', fg: '#2563EB' }}
                value={customer.email}
              />
            )}
            {!!customer.address && (
              <ContactRow
                icon={MapPin}
                tint={{ bg: '#FEF3C7', fg: '#D97706' }}
                value={customer.address}
              />
            )}
          </VStack>

          {/* What this customer is worth, on the card that identifies them.

              It was a third tile in the row below, where a lakh-and-above
              figure had a third of the screen and the smallest type on it -
              the most valuable number was the least legible. It also does
              not belong there: the other two tiles switch the tabs below,
              and this one never did, so it sat among controls looking like
              one without being one.

              Hidden at zero. A customer who has not bought anything yet does
              not need a row telling them so. */}
          {totalAmount > 0 && (
            <HStack
              mt="$4"
              pt="$4"
              borderTopWidth={1}
              borderTopColor="$coolGray100"
              alignItems="center"
              justifyContent="space-between"
            >
              <Text fontSize={13} color="$coolGray500" fontWeight="$medium">
                {t('customers.total') || 'Total'}
              </Text>
              <Text fontSize={20} fontWeight="$black" color="#059669">
                {formatCurrencyValue(totalAmount)}
              </Text>
            </HStack>
          )}
        </Box>


        {/* What this retailer still owes.

            Two figures, never one. Metal is owed as metal and cash as cash, and
            they settle independently — pricing the gold into the rupee total
            would need today's rate, which is not the rate on the day the metal
            actually comes back. Each order's own share is on its row below, so
            this total can be traced to the orders that make it up.

            Hidden entirely when nothing is owed rather than shown as a pair of
            zeroes: a settled retailer is the common case, and an always-present
            "₹0 / 0.000 gm" is a row of noise on every one of them. */}
        {hasOutstanding(outstanding) && (
          <Box
            mt="$4"
            bg="#FFFBEB"
            rounded="$2xl"
            p="$4"
            borderWidth={1}
            borderColor="#FDE68A"
            style={styles.card}
          >
            <Text fontSize={13} fontWeight="$bold" color="#92400E" mb="$3">
              {t('customers.detailsScreen.outstanding') || 'Outstanding'}
            </Text>

            <HStack space="md" alignItems="stretch">
              {outstanding.gold > 0 && (
                <VStack flex={1} space="xs">
                  <HStack space="xs" alignItems="center">
                    <Icon as={Coins} size="xs" color="#D97706" />
                    <Text fontSize={12} color="$coolGray600">
                      {t('dashboard.dues.gold') || 'Gold'}
                    </Text>
                  </HStack>
                  <Text fontWeight="$black" fontSize={19} color="#B45309" numberOfLines={1}>
                    {formatGrams(outstanding.gold, gramShort)}
                  </Text>
                </VStack>
              )}

              {outstanding.cash > 0 && (
                <VStack flex={1} space="xs">
                  <HStack space="xs" alignItems="center">
                    <Icon as={Wallet} size="xs" color="#6366F1" />
                    <Text fontSize={12} color="$coolGray600">
                      {t('dashboard.dues.cash') || 'Cash'}
                    </Text>
                  </HStack>
                  <Text fontWeight="$black" fontSize={19} color="#4338CA" numberOfLines={1}>
                    {formatCurrencyValue(outstanding.cash)}
                  </Text>
                </VStack>
              )}
            </HStack>
          </Box>
        )}

        {/* What the shop is holding FOR this retailer, kept in its own card
            rather than netted off the Outstanding one above. They are two
            different things — one is a debt, the other is the retailer's own
            money sitting here — and subtracting one from the other hides the
            second entirely. Green, because on this screen it is the only
            figure that is in the retailer's favour. */}
        {(statement.heldCash >= CASH_SETTLED_EPSILON
          || statement.meltCredit >= WEIGHT_SETTLED_EPSILON_GM) && (
          <Box
            mt="$4"
            bg="#F0FDF4"
            rounded="$2xl"
            p="$4"
            borderWidth={1}
            borderColor="#BBF7D0"
            style={styles.card}
          >
            <Text fontSize={13} fontWeight="$bold" color="#166534" mb="$3">
              {t('statement.heldTitle') || 'Held for this retailer'}
            </Text>

            <HStack space="md" alignItems="stretch">
              {statement.heldCash >= CASH_SETTLED_EPSILON && (
                <VStack flex={1} space="xs">
                  <HStack space="xs" alignItems="center">
                    <Icon as={Wallet} size="xs" color="#15803D" />
                    <Text fontSize={12} color="$coolGray600">
                      {t('statement.credit') || 'Credit with us'}
                    </Text>
                  </HStack>
                  <Text fontWeight="$black" fontSize={19} color="#15803D" numberOfLines={1}>
                    {formatCurrencyValue(statement.heldCash)}
                  </Text>
                </VStack>
              )}

              {statement.meltCredit >= WEIGHT_SETTLED_EPSILON_GM && (
                <VStack flex={1} space="xs">
                  <HStack space="xs" alignItems="center">
                    <Icon as={Coins} size="xs" color="#15803D" />
                    <Text fontSize={12} color="$coolGray600">
                      {t('statement.meltCredit') || 'Melt credit'}
                    </Text>
                  </HStack>
                  <Text fontWeight="$black" fontSize={19} color="#15803D" numberOfLines={1}>
                    {formatGrams(statement.meltCredit, gramShort)}
                  </Text>
                </VStack>
              )}
            </HStack>
          </Box>
        )}

        {/* Sending the statement. Shown whenever there is anything to say —
            a debt OR a credit — because "you are ₹400 in hand with us" is
            worth sending too, and hidden for a retailer whose account is
            flat, where a reminder would be nothing but noise. */}
        {!statement.isClear && (
          <HStack mt="$4" space="md">
            <Pressable flex={1} onPress={onRemindWhatsApp}>
              <HStack
                bg="#25D366"
                rounded="$xl"
                py="$3"
                alignItems="center"
                justifyContent="center"
                space="sm"
              >
                <Icon as={MessageCircle} size="sm" color="$white" />
                <Text color="$white" fontWeight="$bold" fontSize={14}>
                  {t('statement.sendWhatsApp') || 'Remind on WhatsApp'}
                </Text>
              </HStack>
            </Pressable>

            <Pressable onPress={onShareStatementPdf}>
              <HStack
                bg="$coolGray100"
                rounded="$xl"
                py="$3"
                px="$4"
                alignItems="center"
                justifyContent="center"
                space="sm"
              >
                <Icon as={FileText} size="sm" color="$coolGray700" />
                <Text color="$coolGray700" fontWeight="$bold" fontSize={14}>
                  {t('statement.pdf') || 'PDF'}
                </Text>
              </HStack>
            </Pressable>
          </HStack>
        )}

        {/* Tabs and Search Section */}
        <Box mt="$6">
          {/* Search Bar */}
          <Box bg="$white" rounded="$2xl" px="$4" py="$1" mb="$4" style={styles.card}>
            <HStack alignItems="center" space="sm">
              <Icon as={Search} size="sm" color="$coolGray400" />
              <Input variant="outline" borderWidth={0} flex={1}>
                <InputField
                  placeholder={
                    t('customers.detailsScreen.searchInvoicePlaceholder') ||
                    'Search invoice number...'
                  }
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  maxLength={INPUT_LIMITS.searchQuery}
                  fontSize="$sm"
                />
              </Input>
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')}>
                  <Icon as={X} size="xs" color="$coolGray400" />
                </Pressable>
              )}
            </HStack>
          </Box>

          {filteredOrders.length === 0 ? (
            <Box bg="$white" rounded="$2xl" p="$10" style={styles.card} alignItems="center">
              <Icon as={Search} size="xl" color="$coolGray200" mb="$2" />
              <Text textAlign="center" color="$coolGray500">
                {searchQuery
                  ? t('customers.detailsScreen.noMatchingResults') ||
                  'No matching results found'
                  : t('customers.detailsScreen.noInvoicesFound') ||
                  'No invoices found'}
              </Text>
            </Box>
          ) : (
            <VStack space="md">
              {filteredOrders.map(order => (
                <Pressable key={order.id} onPress={() => navigation.navigate('OrderDetails', { orderId: order.id })}>
                  <Box
                    bg="$white"
                    rounded="$2xl"
                    p="$4"
                    borderLeftWidth={4}
                    borderLeftColor={STAT_TONES.orders.icon}
                    style={styles.card}
                  >
                    <HStack justifyContent="space-between" alignItems="center">
                      <VStack flex={1}>
                        {/* Invoices and advance orders share this tab now, so the
                            row has to say which it is, and whether old gold was
                            taken in against it. */}
                        <HStack mb="$1" space="xs" alignItems="center" flexWrap="wrap">
                          <HStack
                            px="$2"
                            py="$1"
                            rounded="$full"
                            bg={order.status === 'completed' ? '#DCFCE7' : '#FEF3C7'}
                            alignItems="center"
                            space="xs"
                          >
                            <Icon as={order.status === 'completed' ? CheckCircle : Clock} size="xs" color={order.status === 'completed' ? '#166534' : '#92400E'} />
                            <Text fontSize={10} fontWeight="$bold" color={order.status === 'completed' ? '#166534' : '#92400E'} textTransform="uppercase">
                              {getStatusLabel(order.status)}
                            </Text>
                          </HStack>

                          <Box px="$2" py="$1" rounded="$full" bg="$coolGray100">
                            <Text fontSize={10} fontWeight="$bold" color="$coolGray600">
                              {order.type === 'advance'
                                ? t('orders.advancePayment.title') || 'Advance'
                                : t('orders.fullPayment.title') || 'Full Payment'}
                            </Text>
                          </Box>

                        </HStack>
                        <HStack alignItems="center" space="sm" flexWrap="wrap">
                          <Text fontWeight="$bold" fontSize={16} color="$coolGray900">
                            {order.invoiceNumber || order.orderNumber || order.id.slice(-6).toUpperCase()}
                          </Text>

                        </HStack>
                        <Text color="$coolGray500" fontSize="$xs" mt="$1">
                          {formatOrderDateTime(order.date, order.createdAt)}
                          {order.type === 'advance' &&
                            order.items?.[0] &&
                            ` • ${order.items[0].itemName || (t('orders.itemsFallback') || 'Jewelry')}`}
                        </Text>
                      </VStack>
                      <HStack alignItems="center" space="xs">
                        <VStack alignItems="flex-end">
                          <Text color="#16A34A" fontWeight="$black" fontSize={17}>
                            ₹{Number(order.amount).toFixed(2)}
                          </Text>
                          {/* This order's share of the two totals above.
                              Previously one rupee "Due" read off
                              estimatedBalance, which already prices the metal
                              in — so an order owing only gold looked like a
                              cash debt, and the row could not be reconciled
                              against the gold total. Each account is printed
                              only when it has something on it. */}
                          {(() => {
                            const due = orderOutstanding(order);
                            if (!hasOutstanding(due)) return null;
                            const dueLabel = t('customers.detailsScreen.dueLabel') || 'Due';
                            return (
                              <VStack alignItems="flex-end">
                                {due.gold > 0 && (
                                  <Text fontSize={10} color="#B45309">
                                    {dueLabel}: {formatGrams(due.gold, gramShort)}
                                  </Text>
                                )}
                                {due.cash > 0 && (
                                  <Text fontSize={10} color="#4338CA">
                                    {dueLabel}: {formatCurrencyValue(due.cash)}
                                  </Text>
                                )}
                              </VStack>
                            );
                          })()}
                        </VStack>
                        <Icon as={ChevronRight} size="sm" color="#9CA3AF" />
                      </HStack>
                    </HStack>
                  </Box>
                </Pressable>
              ))}
            </VStack>
          )}
        </Box>
      </ScrollView>

      {/* FAB */}
      <Box position="absolute" bottom={insets.bottom + 20} right={20}>
        <Pressable
          onPress={() => navigation.navigate('NewOrder', { customerId })}
          style={{
            width: 60,
            height: 60,
            borderRadius: 30,
            justifyContent: 'center',
            alignItems: 'center',
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 4.65,
          }}
        >
          <Svg width="60" height="60">
            <Defs>
              <LinearGradient id="fabGradDetails" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#6366F1" />
                <Stop offset="1" stopColor="#D946EF" />
              </LinearGradient>
            </Defs>
            <Rect width="60" height="60" rx="30" fill="url(#fabGradDetails)" />
          </Svg>
          <Box position="absolute">
            <Icon as={Plus} color="$white" size="xl" />
          </Box>
        </Pressable>
      </Box>

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
                <Input rounded="$xl" borderWidth={2} borderColor="#8B5CF6" bg="$white">
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
              <Box bg="#6D5EF7" rounded="$xl" py="$3" alignItems="center">
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
    </Box>
  );
}

const styles = StyleSheet.create({
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 -6px 20px rgba(0,0,0,0.15)', marginHorizontal: 'auto', width: '100%', maxWidth: 500, borderRadius: 24 }
      : { elevation: 20 }),
  },
});


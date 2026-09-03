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
  Badge,
  BadgeText,
} from '@gluestack-ui/themed';
import { ArrowLeft, Phone, Mail, MapPin, ChevronRight, ChevronDown, ChevronUp, Clock, CheckCircle, Edit2, X, Search, ShoppingBag, Scale } from 'lucide-react-native';
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
  fetchPurchaseOldGold,
  uploadCustomerPhoto,
  removeCustomerPhoto,
} from '../../store/data/dataSlice';
import CustomerPhotoPicker from '../../components/common/CustomerPhotoPicker';
import { ToastViewport } from '../../components/common/Toast';
import { endImpersonation } from '../../store/auth/authSlice';
import { toast } from '../../components/common/Toast';
import ImpersonationBlockModal from '../../components/ImpersonationBlockModal';
import OrderTypeModal from '../../components/OrderTypeModal';
import ValidationErrorModal from '../../components/ValidationErrorModal';
import ConfirmModal from '../../components/ConfirmModal';
import { Trash2, Plus, FileSignature } from 'lucide-react-native';
import { LAYOUT } from '../../constants/layout';
import { INPUT_LIMITS, validateText } from '../../constants/inputLimits';
import CharCounter from '../../components/common/CharCounter';
import { formatOrderDateTime, formatCurrencyValue, formatNumber } from '../../utils/formatter';
import SelectField from '../../components/common/SelectField';
import { ID_PROOF_TYPES } from '../../constants/idProof';
import type { IdProofType } from '../../types';
import CustomerCodeBadge from '../../components/customers/CustomerCodeBadge';
import { standalonePurchasesFor } from '../../utils/oldGoldPurchases';


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
/** Reserved height per label line — see the label in StatCard. */
const STAT_LABEL_LINE_HEIGHT = 16;

const STAT_TONES = {
  orders: { bg: '#F5F3FF', border: '#DDD6FE', fg: '#6D28D9', icon: '#7C3AED', chip: '#EDE9FE' },
  sold:   { bg: '#EEF2FF', border: '#C7D2FE', fg: '#4338CA', icon: '#6366F1', chip: '#E0E7FF' },
  // Kept although no tile uses it: the lifetime-value row on the info card is
  // this green, and the next thing that needs a money tone should reach for the
  // same one rather than inventing a second.
  total:  { bg: '#ECFDF5', border: '#A7F3D0', fg: '#047857', icon: '#10B981', chip: '#D1FAE5' },
} as const;

type StatTone = (typeof STAT_TONES)[keyof typeof STAT_TONES];

/**
 * One summary card, optionally a control for the tabs below it.
 *
 * `onPress` is what makes it a button — omit it and the card renders as a plain
 * figure with no press feedback and no accessibility role, which is right for
 * Total: it has no tab to switch to, and a card that looks tappable but is not
 * teaches people to distrust the two beside it that are.
 *
 * `active` mirrors the tab currently showing. Only the border colour changes,
 * never its width — growing the border by a pixel on selection nudges the other
 * two cards, and a row that twitches when you tap it reads as a glitch.
 */
const StatCard = ({
  icon,
  value,
  label,
  palette,
  onPress,
  active,
  valueFontSize = 22,
  children,
}: {
  icon: any;
  value: string;
  label: string;
  palette: StatTone;
  onPress?: () => void;
  active?: boolean;
  valueFontSize?: number;
  children?: React.ReactNode;
}) => {
  const body = (
    <Box
      flex={1}
      bg={palette.bg}
      rounded="$2xl"
      p="$3.5"
      borderWidth={1.5}
      borderColor={active ? palette.fg : palette.border}
      style={styles.card}
    >
      <Center>
        <Box bg={palette.chip} p="$1.5" rounded="$full" mb="$1.5">
          <Icon as={icon} size="xs" color={palette.icon} />
        </Box>
        <Text
          fontWeight="$black"
          fontSize={valueFontSize}
          color={palette.fg}
          textAlign="center"
        >
          {value}
        </Text>
        {/* Two lines with the height reserved, not one with an ellipsis.
            These cards are a third of the screen each and the labels are
            translated — "Sold to us" is "आम्हाला विकले" in Marathi, which has no
            chance on one line. Reserving both lines keeps the three numbers on
            the same baseline whether or not a label wraps. Same reasoning, and
            the same fix, as the dashboard tiles. */}
        <Text
          fontSize={12}
          color="$coolGray600"
          textAlign="center"
          numberOfLines={2}
          lineHeight={STAT_LABEL_LINE_HEIGHT}
          style={{ minHeight: STAT_LABEL_LINE_HEIGHT * 2 }}
        >
          {label}
        </Text>
      </Center>
      {children}
    </Box>
  );

  if (!onPress) return body;

  return (
    <Pressable flex={1} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${value} ${label}`}>
      {body}
    </Pressable>
  );
};

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
  const purchaseOldGold = useAppSelector(s => s.data.purchaseOldGold);
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
  const [form, setForm] = React.useState({
    name: customer?.name || '',
    phone: customer?.phone || '',
    email: customer?.email || '',
    address: customer?.address || '',
    idProofType: (customer?.idProofType || '') as IdProofType | '',
    idProofNumber: customer?.idProofNumber || '',
  });
  const [showIdProof, setShowIdProof] = React.useState(false);

  // Direction, not document type: what the customer bought from this shop, and
  // what they sold to it. An exchange appears in both, since it is genuinely
  // both — categorising it by which way the cash moved would make each tab
  // incomplete for the question it answers.
  const [activeTab, setActiveTab] = React.useState<'bought' | 'sold'>('bought');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showOrderModal, setShowOrderModal] = React.useState(false);
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
      // Deliberately NOT filtered to standalone, unlike the tab and stat card
      // above. This counts what deleting the customer would strand, and an
      // exchange declaration is stranded just the same — a different question
      // from how many times they sold us gold.
      sold: purchaseOldGold.filter(d => d.customerId === customerId).length,
    };
  }, [orders, purchaseOldGold, customerId]);
  const hasRecords =
    deleteImpact.orders > 0 || deleteImpact.pending > 0 || deleteImpact.sold > 0;

  // Declarations aren't part of the dashboard's initial load, so pull them the
  // first time this screen is opened.
  React.useEffect(() => {
    dispatch(fetchPurchaseOldGold());
  }, [dispatch]);

  const customerPurchaseOldGold = useMemo(() => {
    const list = standalonePurchasesFor(purchaseOldGold, customerId);
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      d =>
        d.declarationNumber?.toLowerCase().includes(q) ||
        d.items.some(i => i.description?.toLowerCase().includes(q)),
    );
  }, [purchaseOldGold, customerId, searchQuery]);

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
        name: customer.name || '',
        phone: customer.phone || '',
        email: customer.email || '',
        address: customer.address || '',
        idProofType: (customer.idProofType || '') as IdProofType | '',
        idProofNumber: customer.idProofNumber || '',
      });
    }
  }, [customer]);

  const handleUpdate = async () => {
    if (impersonateUserId) { setBlockModalVisible(true); return; }
    if (!form.name.trim()) {
      setValidationErrors([t('customers.validation.nameRequired') || 'Name is required']);
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
      validateText(form.name, { label: t('customers.name') || 'Name', limit: INPUT_LIMITS.customerName }),
      validateText(form.email, { label: t('customers.email') || 'Email', limit: INPUT_LIMITS.email }),
      validateText(form.address, { label: t('customers.address') || 'Address', limit: INPUT_LIMITS.customerAddress }),
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
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
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

  // The two halves of customerOrders: an advance order still owing money, and
  // one settled in full (invoices are normalised to 'completed' in dataSlice).
  const pending = customerOrders.filter((o: any) => o.status === 'pending');
  const completed = customerOrders.filter((o: any) => o.status === 'completed');
  const totalAmount = customerOrders.reduce((sum: number, o: any) => sum + (Number(o.amount) || 0), 0);
  // Standalone purchases only — an exchange declaration belongs to the bill it
  // came in on, and is reached from that order rather than counted here.
  const soldCount = useMemo(
    () => standalonePurchasesFor(purchaseOldGold, customerId).length,
    [purchaseOldGold, customerId],
  );

  /** Orders on this page that carry a declaration — see the badge below. */
  const declaredOrderIds = useMemo(
    () => new Set(purchaseOldGold.map(d => d.orderId).filter(Boolean) as string[]),
    [purchaseOldGold],
  );

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

        {/* Two numbers, and both of them are controls: what the customer
            bought and what they sold us. Pending and Complete are the two
            halves of Orders, so they sit under it as a breakdown rather than
            as a third card competing with its parent.

            Both are the headings of the tabs below and act as them - reading
            "1 Sold to us" and then having to find the tab that shows it was a
            step nobody needed. Total used to be a third tile here and is now
            on the info card: it switches nothing, so it looked tappable
            without being tappable, and a lakh-plus figure in a third of the
            width had to shrink to fit. The two that remain remain equal and
            get half the row each. */}
        <HStack mt="$4" space="md" alignItems="stretch">
          <StatCard
            icon={ShoppingBag}
            value={String(customerOrders.length)}
            label={t('customers.orders') || 'Orders'}
            palette={STAT_TONES.orders}
            active={activeTab === 'bought'}
            onPress={() => setActiveTab('bought')}
          >
            {customerOrders.length > 0 && (
              <VStack
                mt="$2"
                pt="$2"
                borderTopWidth={1}
                borderTopColor={STAT_TONES.orders.border}
                space="xs"
              >
                <HStack space="xs" alignItems="center" justifyContent="center">
                  <Icon as={Clock} size="xs" color={pending.length > 0 ? '#B7791F' : '#9CA3AF'} />
                  <Text fontSize={11} color="$coolGray600">
                    {pending.length} {t('customers.pending') || 'Pending'}
                  </Text>
                </HStack>
                <HStack space="xs" alignItems="center" justifyContent="center">
                  <Icon as={CheckCircle} size="xs" color={completed.length > 0 ? '#10B981' : '#9CA3AF'} />
                  <Text fontSize={11} color="$coolGray600">
                    {completed.length} {t('customers.completed') || 'Complete'}
                  </Text>
                </HStack>
              </VStack>
            )}
          </StatCard>

          <StatCard
            icon={Scale}
            value={String(soldCount)}
            label={t('customers.detailsScreen.tabs.soldToUs') || 'Sold to us'}
            palette={STAT_TONES.sold}
            active={activeTab === 'sold'}
            onPress={() => setActiveTab('sold')}
          />

        </HStack>

        {/* Tabs and Search Section */}
        <Box mt="$6">
          {/* Tab Bar. Each tab takes the colour of the card above that selects
              it — violet for Orders, indigo for Sold to us — so the pair reads
              as one control rather than two purple pills that happen to sit
              under two differently coloured cards. */}
          <HStack bg="$white" p="$1" rounded="$2xl" mb="$4" style={styles.card}>
            <Pressable
              flex={1}
              onPress={() => setActiveTab('bought')}
              bg={activeTab === 'bought' ? STAT_TONES.orders.icon : 'transparent'}
              py="$2.5"
              rounded="$xl"
              alignItems="center"
            >
              <HStack space="xs" alignItems="center">
                <Icon
                  as={ShoppingBag}
                  size="xs"
                  color={activeTab === 'bought' ? '$white' : STAT_TONES.orders.icon}
                />
                <Text
                  color={activeTab === 'bought' ? '$white' : '$coolGray600'}
                  fontWeight="$bold"
                  fontSize="$sm"
                >
                  {t('customers.detailsScreen.tabs.boughtFromUs') || 'Bought from us'}
                </Text>
              </HStack>
            </Pressable>
            <Pressable
              flex={1}
              onPress={() => setActiveTab('sold')}
              bg={activeTab === 'sold' ? STAT_TONES.sold.icon : 'transparent'}
              py="$2.5"
              rounded="$xl"
              alignItems="center"
            >
              <HStack space="xs" alignItems="center">
                <Icon
                  as={Scale}
                  size="xs"
                  color={activeTab === 'sold' ? '$white' : STAT_TONES.sold.icon}
                />
                <Text
                  color={activeTab === 'sold' ? '$white' : '$coolGray600'}
                  fontWeight="$bold"
                  fontSize="$sm"
                >
                  {t('customers.detailsScreen.tabs.soldToUs') || 'Sold to us'}
                </Text>
              </HStack>
            </Pressable>
          </HStack>

          {/* Search Bar */}
          <Box bg="$white" rounded="$2xl" px="$4" py="$1" mb="$4" style={styles.card}>
            <HStack alignItems="center" space="sm">
              <Icon as={Search} size="sm" color="$coolGray400" />
              <Input variant="outline" borderWidth={0} flex={1}>
                <InputField
                  placeholder={
                    activeTab === 'bought'
                      ? t('customers.detailsScreen.searchInvoicePlaceholder') ||
                      'Search invoice number...'
                      : t('customers.detailsScreen.searchDeclarationPlaceholder') ||
                      'Search declaration...'
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

          {activeTab === 'sold' ? (
            customerPurchaseOldGold.length === 0 ? (
              <Box bg="$white" rounded="$2xl" p="$10" style={styles.card} alignItems="center">
                <Icon as={Scale} size="xl" color="$coolGray200" mb="$2" />
                <Text textAlign="center" color="$coolGray500">
                  {t('declaration.empty') || 'No purchaseOldGold yet'}
                </Text>
                <Text textAlign="center" color="$coolGray400" fontSize="$xs" mt="$1">
                  {t('declaration.emptyDesc')}
                </Text>
              </Box>
            ) : (
              <VStack space="md">
                {customerPurchaseOldGold.map(declaration => (
                  <Pressable
                    key={declaration.id}
                    onPress={() =>
                      navigation.navigate('SoldToUsDetails', { declarationId: declaration.id })
                    }
                  >
                    {/* A coloured edge in the tab's own colour, so a row still
                        says which list it came from once it is the only thing on
                        screen — and so scrolling a long list does not become a
                        wall of identical white rectangles. */}
                    <Box
                      bg="$white"
                      rounded="$2xl"
                      p="$4"
                      borderLeftWidth={4}
                      borderLeftColor={STAT_TONES.sold.icon}
                      style={styles.card}
                    >
                      <HStack justifyContent="space-between" alignItems="center" space="md">
                        <VStack flex={1}>
                          <HStack alignItems="center" space="sm" mb="$1">
                            <Text fontWeight="$bold" fontSize={16} color="$coolGray900">
                              {declaration.declarationNumber}
                            </Text>
                            {/* Says how the gold came in — against a new ornament,
                                or bought outright for cash. */}
                            <Box
                              px="$2"
                              py="$0.5"
                              rounded="$full"
                              bg={declaration.mode === 'exchange' ? '#EEF2FF' : '#FEF3C7'}
                            >
                              <Text
                                fontSize={10}
                                fontWeight="$bold"
                                color={declaration.mode === 'exchange' ? '#4F46E5' : '#92400E'}
                              >
                                {declaration.mode === 'exchange'
                                  ? t('customers.detailsScreen.badges.exchange') || 'Exchange'
                                  : t('customers.detailsScreen.badges.cashPurchase') || 'Cash'}
                              </Text>
                            </Box>
                          </HStack>
                          <Text color="$coolGray500" fontSize="$xs">
                            {formatOrderDateTime(declaration.declarationDate, declaration.createdAt)}
                            {' · '}
                            {/* formatNumber / formatCurrencyValue rather than toFixed:
                                this row read "19.000 gm · ₹9000.00" where the rest of
                                the app says "19 gm · ₹9,000". */}
                            {formatNumber(declaration.totalGrams)} {t('common.gm') || 'gm'}
                            {Number(declaration.totalAmount) > 0
                              ? ` · ${formatCurrencyValue(Number(declaration.totalAmount))}`
                              : ''}
                          </Text>
                          <Text color="$coolGray400" fontSize="$xs" mt="$1" numberOfLines={1}>
                            {declaration.items.map(i => i.description).join(', ')}
                          </Text>
                        </VStack>

                        {/* Edit and Print used to sit here as two icons, which was
                            the whole of what a Sold to Us record could do — there was
                            nowhere to open it and read what was actually bought. They
                            moved to the detail screen this chevron opens, so this row
                            now behaves like every other card in the app. */}
                        <Icon as={ChevronRight} color="$coolGray400" size="sm" />
                      </HStack>
                    </Box>
                  </Pressable>
                ))}
              </VStack>
            )
          ) : filteredOrders.length === 0 ? (
            <Box bg="$white" rounded="$2xl" p="$10" style={styles.card} alignItems="center">
              <Icon as={Search} size="xl" color="$coolGray200" mb="$2" />
              <Text textAlign="center" color="$coolGray500">
                {searchQuery
                  ? t('customers.detailsScreen.noMatchingResults') ||
                  'No matching results found'
                  : activeTab === 'bought'
                    ? t('customers.detailsScreen.noInvoicesFound') ||
                    'No invoices found'
                    : t('customers.detailsScreen.noAdvanceOrdersFound') ||
                    'No advance orders found'}
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

                          {order.isOrnamentExchanges && (order.exchanges?.length ?? 0) > 0 && (
                            <Box px="$2" py="$1" rounded="$full" bg="#EEF2FF">
                              <Text fontSize={10} fontWeight="$bold" color="#4F46E5">
                                {t('customers.detailsScreen.badges.exchange') || 'Exchange'}
                              </Text>
                            </Box>
                          )}

                          {/* The declaration for that exchange, when one was
                              made. This screen is where it matters most: the
                              Sold to us tab beside this one no longer lists
                              exchange declarations, so without a mark here
                              nothing on the customer's page says one exists
                              and the only way to find it is to open every
                              bill in turn. */}
                          {declaredOrderIds.has(order.id) && (
                            <Box
                              px="$1.5"
                              py="$1"
                              rounded="$full"
                              bg="#EEF2FF"
                              accessibilityLabel={t('declaration.title') || 'Declaration'}
                            >
                              <Icon as={FileSignature} size="xs" color="#4F46E5" />
                            </Box>
                          )}
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
                          {order.type === 'advance' && order.status === 'pending' && (
                            <Text fontSize={10} color="$coolGray400">
                              {t('customers.detailsScreen.dueLabel') || 'Due'}: ₹{(order.estimatedBalance || 0).toFixed(2)}
                            </Text>
                          )}
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
          onPress={() => setShowOrderModal(true)}
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

      <OrderTypeModal
        isOpen={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        preSelectedCustomerId={customerId}
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
                {deleteImpact.sold > 0 && (
                  <Text fontSize={13} fontWeight="$bold" color="#B91C1C" textAlign="center">
                    {deleteImpact.sold} {t('customers.delete.records.sold')}
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
              {/* The customer already exists here, so a pick uploads straight
                  away rather than waiting for Save — the photo is its own
                  endpoint and has nothing to do with the field edits below. */}
              <CustomerPhotoPicker
                url={customer.profilePhoto?.url}
                name={form.name}
                onPick={photo =>
                  dispatch(uploadCustomerPhoto({ customerId: customerId!, photo }))
                }
                onRemove={() => dispatch(removeCustomerPhoto(customerId!))}
              />

              <VStack space="xs">
                <Text fontWeight="$semibold">{t('customers.name') || 'Name'}</Text>
                <Input rounded="$xl" borderWidth={2} borderColor="#8B5CF6" bg="$white">
                  <InputField
                    placeholder={t('customers.placeholders.name') || 'Retailer name'}
                    value={form.name}
                    onChangeText={text => setForm({ ...form, name: text })}
                    // Title-cased once the field is done rather than on every
                    // keystroke, which re-cases mid-word and makes a deliberate
                    // lower-case letter impossible to keep.
                    onBlur={() => setForm(f => ({ ...f, name: capitalizeWords(f.name) }))}
                    maxLength={INPUT_LIMITS.customerName}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />
                </Input>
                <CharCounter value={form.name} limit={INPUT_LIMITS.customerName} />
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

              <VStack space="xs">
                <Text fontWeight="$semibold">{t('customers.email') || 'Email'}</Text>
                <Input bg="$coolGray100" borderWidth={0} rounded="$xl">
                  <InputField
                    placeholder={t('customers.placeholders.email') || 'Email (optional)'}
                    value={form.email}
                    onChangeText={text => setForm({ ...form, email: text })}
                    maxLength={INPUT_LIMITS.email}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />
                </Input>
                <CharCounter value={form.email} limit={INPUT_LIMITS.email} />
              </VStack>

              <VStack space="xs">
                <Text fontWeight="$semibold">{t('customers.address') || 'Address'}</Text>
                <Input bg="$coolGray100" borderWidth={0} rounded="$xl">
                  <InputField
                    placeholder={t('customers.placeholders.address') || 'Address (optional)'}
                    value={form.address}
                    onChangeText={text => setForm({ ...form, address: text })}
                    onBlur={() => setForm(f => ({ ...f, address: capitalizeWords(f.address) }))}
                    maxLength={INPUT_LIMITS.customerAddress}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />
                </Input>
                <CharCounter value={form.address} limit={INPUT_LIMITS.customerAddress} />
              </VStack>

              {/* Optional — only useful if this customer ever brings in old
                  gold; a declaration then reuses it instead of asking again. */}
              <Pressable onPress={() => setShowIdProof(v => !v)}>
                <HStack justifyContent="space-between" alignItems="center" py="$1">
                  <Text fontSize={13} fontWeight="$medium" color="$coolGray600">
                    {t('customers.idProof.title') || 'ID Proof (optional)'}
                  </Text>
                  <Icon as={showIdProof ? ChevronUp : ChevronDown} size="sm" color="$coolGray500" />
                </HStack>
              </Pressable>

              {showIdProof && (
                <VStack space="sm">
                  <VStack space="xs">
                    <Text fontSize={12} color="$coolGray600">
                      {t('customers.idProof.type') || 'ID Proof Type'}
                    </Text>
                    <SelectField
                      value={form.idProofType}
                      items={ID_PROOF_TYPES.map(v => ({
                        label: t(`declaration.idProof.types.${v}`) || v,
                        value: v,
                      }))}
                      placeholder={t('customers.idProof.selectType') || 'Select...'}
                      title={t('customers.idProof.title') || 'ID Proof'}
                      onValueChange={v => setForm(f => ({ ...f, idProofType: v as IdProofType }))}
                    />
                  </VStack>
                  <VStack space="xs">
                    <Text fontSize={12} color="$coolGray600">
                      {t('customers.idProof.number') || 'ID Proof Number'}
                    </Text>
                    <Input bg="$coolGray100" borderWidth={0} rounded="$xl">
                      <InputField
                        placeholder={t('customers.idProof.numberPlaceholder') || 'e.g. ABCDE1234F'}
                        value={form.idProofNumber}
                        maxLength={INPUT_LIMITS.idProofNumber}
                        autoCapitalize="characters"
                        onChangeText={text => setForm(f => ({ ...f, idProofNumber: text }))}
                        returnKeyType="done"
                        onSubmitEditing={Keyboard.dismiss}
                      />
                    </Input>
                  </VStack>
                </VStack>
              )}
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


import React, { useState, useMemo, useEffect } from 'react';
import { StyleSheet, ActivityIndicator, Keyboard, Platform, Modal as RNModal, KeyboardAvoidingView } from 'react-native';
import {
  Box,
  HStack,
  VStack,
  Text,
  Pressable,
  Icon,
  ScrollView,
  Center,
  Divider,
  Input,
  InputField,
  Checkbox,
  CheckboxIndicator,
  CheckboxIcon,
  CheckIcon,
  CheckboxLabel,
} from '@gluestack-ui/themed';
import {
  ArrowLeft,
  CheckCircle2,
  Calendar as CalendarIcon,
  AlertCircle,
  X
} from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../navigation/types';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { addOrder, updateOrderStatus, fetchOrders, addPaymentToAdvanceOrder, completeAdvanceOrderUnified, fetchMetalRates, clearUserData } from '../../store/data/dataSlice';
import { calculateAdvanceSettlement } from '../../utils/calculations';
import { endImpersonation } from '../../store/auth/authSlice';
import ImpersonationBlockModal from '../../components/ImpersonationBlockModal';
import DatePickerModal from '../../components/common/DatePickerModal';
import { Alert } from 'react-native';
import { useTranslation } from '../../hooks/useTranslation';
import { parseApiErrorList } from '../../utils/errorUtils';
import ValidationErrorModal from '../../components/ValidationErrorModal';
import DiscardChangesModal from '../../components/DiscardChangesModal';
import { useDiscardGuard } from '../../hooks/useDiscardGuard';
import SelectField from '../../components/common/SelectField';
import { LAYOUT } from '../../constants/layout';
import { GOLD_PURITY_OPTIONS, SILVER_PURITY_OPTIONS } from '../../constants/bill';
import { INPUT_LIMITS } from '../../constants/inputLimits';
import { formatNumber } from '../../utils/formatter';

const PURPLE = '#6D5EF7';
const BORDER = '#E5E7EB';

type RouteProps = NativeStackScreenProps<RootStackParamList, 'CompleteAdvanceOrder'>['route'];

export default function CompleteAdvanceOrderScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProps>();
  const { orderId } = route.params;

  const dispatch = useAppDispatch();
  const { orders, customers, metalRates, shopDetails } = useAppSelector(s => s.data);
  const { impersonateUserId, impersonatePhone } = useAppSelector(s => s.auth);
  const [blockModalVisible, setBlockModalVisible] = useState(false);

  const handleEndSession = () => {
    dispatch(endImpersonation());
    dispatch(clearUserData());
    navigation.navigate('AdminDashboard');
  };
  const { t } = useTranslation();

  const order = orders.find(o => o.id === orderId);
  const customer = order ? customers.find(c => c.id === order.customerId || c.id?.includes(order.customerId)) : undefined;

  const [completionDate, setCompletionDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [useCustomRate, setUseCustomRate] = useState(false);
  const [customGoldRate, setCustomGoldRate] = useState('');
  const [finalPaymentAmount, setFinalPaymentAmount] = useState('');
  const [includeGST, setIncludeGST] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPurity, setSelectedPurity] = useState((order as any)?.items?.[0]?.purity || (order as any)?.purity || '22K - 91.6%');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showValidationModal, setShowValidationModal] = useState(false);

  // The settlement is only recorded when "Complete" succeeds, so a back press —
  // header arrow, Android hardware back or iOS swipe — throws away whatever the
  // shopkeeper adjusted. The purity/date defaults come from the order itself,
  // so only a change away from them counts as input.
  const initialPurity = (order as any)?.items?.[0]?.purity || (order as any)?.purity || '22K - 91.6%';
  const hasCompletionInput =
    finalPaymentAmount.trim() !== '' ||
    useCustomRate ||
    customGoldRate.trim() !== '' ||
    !includeGST ||
    selectedPurity !== initialPurity ||
    completionDate.toDateString() !== new Date().toDateString();
  const discardGuard = useDiscardGuard(hasCompletionInput);

  const getPurityLabel = (value: string) => {
    switch (value) {
      case '24K - 99.5%': return t('metals.purity.gold24k995gw') || '24K - 99.5%';
      case '23K - 95.8%': return t('metals.purity.gold23k') || '23K - 95.8%';
      case '22K - 91.6%': return t('metals.purity.gold22k') || '22K - 91.6%';
      case '21K - 87.5%': return t('metals.purity.gold21k') || '21K - 87.5%';
      case '20K - 83.3%': return t('metals.purity.gold20k') || '20K - 83.3%';
      case '18K - 75%': return t('metals.purity.gold18k') || '18K - 75%';
      case '17K - 70.8%': return t('metals.purity.gold17k') || '17K - 70.8%';
      case '14K - 58.5%': return t('metals.purity.gold14k') || '14K - 58.5%';
      case '9K - 37.5%': return t('metals.purity.gold9k') || '9K - 37.5%';
      case 'Silver': return t('metals.purity.silver') || 'Silver';
      case 'Silver Coin': return t('metals.purity.silverCoin') || 'Silver Coin';
      default: return value;
    }
  };

  const purityOptions = [...GOLD_PURITY_OPTIONS, ...SILVER_PURITY_OPTIONS].map((v) => ({
    value: v,
    label: getPurityLabel(v),
  }));

  const purity = (order as any)?.items?.[0]?.purity || (order as any)?.purity || '22K - 91.6%';

  const bookingRate = useMemo(() => {
    if (!order) return null;
    // Always prioritize the stored booking rate from the backend
    if (order.bookingRate && order.bookingRate > 0) return order.bookingRate;

    if (!Array.isArray(order.payments) || order.payments.length === 0) return null;

    // Fallback logic for old orders: sort chronologically and take the first one with a rate
    const sorted = [...order.payments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const firstWithRate = sorted.find((p: any) => p.goldRate && Number(p.goldRate) > 0);
    return firstWithRate ? Number(firstWithRate.goldRate) : null;
  }, [order]);

  const marketRatePerGram = useMemo(() => {
    const p = selectedPurity;
    if (p.includes('24K')) return metalRates?.gold?.goldPrice24K995GW;
    if (p.includes('22K')) return metalRates?.gold?.goldPrice22K;
    if (p.includes('18K')) return metalRates?.gold?.goldPrice18K;
    if (p.includes('14K')) return metalRates?.gold?.goldPrice14K;
    if (p.includes('Silver')) {
      return p.includes('Coin')
        ? metalRates?.silver?.silverBarPrice
        : metalRates?.silver?.silverPrice;
    }
    // No dedicated Metal Rates field for this karat — rate stays manual (falls back to bookingRate/0).
    return undefined;
  }, [metalRates, selectedPurity]);

  const currentRatePerGram = useMemo(() => {
    if (useCustomRate && customGoldRate) return parseFloat(customGoldRate) || 0;
    return marketRatePerGram || bookingRate || 0;
  }, [useCustomRate, customGoldRate, marketRatePerGram, bookingRate]);

  const settlementRate = currentRatePerGram;
  const totalWeight = order?.totalWeight || 0;

  const makingChargeType = (order as any)?.items?.[0]?.makingChargeType || (order as any)?.makingChargeType || '%';
  const makingChargeValue = (order as any)?.items?.[0]?.makingChargeValue || (order as any)?.makingChargeValue || 0;
  const gstPercentage = shopDetails?.gstPercentage || 3;

  /**
   * The settled figures, from the one calculator both this screen and
   * OrderDetailsScreen now share.
   *
   * The version that lived here added gold and making charges and stopped, so
   * a per-item discount or an other charge never reached the final bill:
   * ADV-80 was settled for 2,52,511.71 against an invoice reading 2,52,311.71.
   * It also billed percentage making on net weight where every other path in
   * the app bills it on gross.
   */
  const settlement = useMemo(
    () =>
      calculateAdvanceSettlement((order as any)?.items || [], settlementRate, {
        includeGst: includeGST,
        gstRatePercent: gstPercentage,
      }),
    [order, settlementRate, includeGST, gstPercentage],
  );

  const totalGoldValue = settlement.goldValue;
  const makingCharges = settlement.makingCharges;
  const subtotal = settlement.subtotal;
  const gstAmount = settlement.gstAmount;
  const grandTotal = settlement.grandTotal;

  const totalPaid = useMemo(() => {
    if (!order || !Array.isArray(order.payments)) return 0;
    return order.payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
  }, [order]);

  const balanceDue = Math.max(0, grandTotal - totalPaid);
  const finalPayment = parseFloat(finalPaymentAmount) || 0;

  useEffect(() => {
    dispatch(fetchMetalRates());
  }, [dispatch]);

  useEffect(() => {
    if (balanceDue > 0) {
      setFinalPaymentAmount(balanceDue.toFixed(3));
    }
  }, [balanceDue]);

  const handleComplete = async () => {
    if (impersonateUserId) { setBlockModalVisible(true); return; }
    if (!order) return;

    if (finalPayment < balanceDue - 0.01) {
      setValidationErrors([`${t('completeAdvance.alerts.balanceAtLeast') || 'Balance payment must be at least'} ₹${balanceDue.toLocaleString()}`]);
      setShowValidationModal(true);
      return;
    }

    setIsProcessing(true);
    try {
      const unifiedPayload = {
        orderId: orderId,
        dukandarId: order.dukandarId,
        payment: finalPayment > 0 ? {
          amount: finalPayment,
          goldRate: currentRatePerGram,
          notes: 'Final settlement',
          date: completionDate.toISOString(),
        } : undefined,
        invoice: {
          invoiceDate: completionDate.toISOString(),
          // invoiceNumber: let backend generate it for consistency
          items: (order as any).items.map((it: any) => ({
            name: it.itemName || it.name || 'Jewelry Item',
            huid: it.huid || '',
            pieces: it.pcs || it.pieces || 1,
            itemType: it.itemType || 'Gold',
            purity: it.purity || purity,
            grossWeight: Number(it.grossWt || it.grossWeight || 0),
            lessWeight: Number(it.lessWt || it.lessWeight || 0),
            netWeight: Number(it.netWt || it.weight || it.netWeight || 0),
            rate: currentRatePerGram,
            makingType: (it.makingChargeType || 'Fixed').toLowerCase().replace(' ', ''),
            makingCharge: Number(it.makingChargeValue || it.makingCharge || 0),
            chargeDescription: it.chargeDescription || it.otherChargesDescription || 'N/A',
            chargeAmount: Number(it.chargeAmount || it.otherChargesAmount || 0),
            discountType: it.discountType || 'fixed',
            discount: Number(it.discount || 0),
          })),
          includeGST: includeGST,
          subTotal: subtotal,
          gstAmount: gstAmount,
          totalAmount: grandTotal,
          isOrnamentExchanges: false,
          // Must be the row array the API expects, not the legacy
          // { gold, silver } aggregate — Zod rejects the object outright
          // ("expected array, received object") and the settlement fails.
          // Empty because this screen bills the order's items only: the
          // totals above deduct no exchange, and the backend recalculates
          // from what we send, so any row here would bill less than the
          // shopkeeper just collected.
          ornamentExchanges: [],
        }
      };

      const actionRet = await dispatch(completeAdvanceOrderUnified(unifiedPayload));

      if (completeAdvanceOrderUnified.fulfilled.match(actionRet)) {
        // Success! Reducer handles updating the orders list.
        discardGuard.allowNextNavigation();
        navigation.replace('OrderDetails', { orderId: orderId });
      } else {
        const apiErrors = parseApiErrorList(actionRet.payload);
        setValidationErrors(apiErrors.length ? apiErrors : [t('completeAdvance.alerts.completeFailed') || 'Failed to complete order']);
        setShowValidationModal(true);
      }
    } catch (e: any) {
      setValidationErrors(parseApiErrorList(e));
      setShowValidationModal(true);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!order) {
    return (
      <Box flex={1} bg="$white" alignItems="center" justifyContent="center">
        <Text>{t('orders.notFound') || 'Order not found.'}</Text>
      </Box>
    );
  }

  return (
    <Box flex={1} bg="#F8FAFC">
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#FFFFFF' }}>
        <Box bg="$white" borderBottomWidth={1} borderBottomColor="$coolGray100">
          <HStack 
            px="$4" 
            py="$3.5" 
            alignItems="center" 
            space="md"
            style={LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}}
          >
            <Pressable onPress={() => navigation.goBack()} p="$2" rounded="$xl" bg="$coolGray50">
              <ArrowLeft size={20} color={PURPLE} />
            </Pressable>
            <VStack>
              <Text fontWeight="$black" color="$coolGray900" fontSize="$lg">
                {t('completeAdvance.title') || 'Complete Order'}
              </Text>
              <Text fontSize="$2xs" color="$coolGray400" textTransform="uppercase" fontWeight="$bold">
                {order.invoiceNumber || order.orderNumber || order.id.slice(-8)}
              </Text>
            </VStack>
          </HStack>
        </Box>
      </SafeAreaView>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ 
            padding: 16, 
            paddingBottom: 120,
            ...(LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {})
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable onPress={Platform.OS === 'web' ? undefined : Keyboard.dismiss}>
            <>
              {/* Detailed Order Summary (Card from OrderDetailsScreen) */}
              <Box bg="$white" p="$6" rounded="$2xl" mb="$4" style={styles.card}>
                {/* Customer Info */}
                <HStack justifyContent="space-between" alignItems="flex-start" mb="$6">
                  <VStack flex={1}>
                    <Text fontSize="$xs" color="$coolGray400" fontWeight="$bold" textTransform="uppercase" mb="$1">
                      {t('orders.details.billTo') || 'Bill To'}
                    </Text>
                    <Text fontWeight="$black" color="$coolGray900" fontSize="$lg">
                      {customer?.name || (t('orders.details.walkInCustomer') || 'Walk-in Retailer')}
                    </Text>
                  </VStack>
                  {!!customer?.phone && (
                    <VStack alignItems="flex-end">
                      <Text fontSize="$xs" color="$coolGray400" fontWeight="$bold" textTransform="uppercase">
                        {t('common.phone') || 'Phone'}
                      </Text>
                      <Text fontWeight="$bold" color="$coolGray800" fontSize="$sm">
                        +91 {customer?.phone}
                      </Text>
                    </VStack>
                  )}
                </HStack>

                <Divider bg="$coolGray50" mb="$4" />

                {/* Items Table */}
                <HStack pb="$2" borderBottomWidth={1} borderColor="$coolGray200" mb="$4">
                  <Text flex={2} fontWeight="$black" fontSize="$2xs" color="$coolGray400" textTransform="uppercase">
                    {t('orders.details.itemDetails') || 'Item Details'}
                  </Text>
                  <Text flex={1} fontWeight="$black" fontSize="$2xs" color="$coolGray400" textTransform="uppercase" textAlign="center">
                    {t('orders.details.weightLabel') || 'Weight (gm)'}
                  </Text>
                </HStack>

                <VStack space="md">
                  {(order.items || []).map((it: any, idx: number) => (
                    <HStack key={idx} alignItems="flex-start" pb="$2" borderBottomWidth={idx === (order.items || []).length - 1 ? 0 : 1} borderColor="$coolGray50">
                      <VStack flex={2}>
                        <Text fontWeight="$bold" fontSize="$sm" color="$coolGray800">
                          {it.itemName || it.name || 'Item'}
                        </Text>
                        <Text fontSize="$2xs" color="$coolGray400" fontWeight="$medium">
                          {it.purity || ''} • {it.pcs || it.pieces || 1} {t('orders.details.piecesShort') || 'Pcs'}
                        </Text>
                      </VStack>
                      <VStack flex={1} alignItems="center">
                        <Text fontSize="$sm" fontWeight="$bold" color="$coolGray700">
                          {formatNumber(it.netWt || it.weight || it.netWeight || 0, 3)}
                        </Text>
                      </VStack>
                    </HStack>
                  ))}
                </VStack>
              </Box>

              {/* Advance Payments Received */}
              <Box bg="rgba(109, 94, 247, 0.05)" p="$5" rounded="$2xl" mb="$4" borderWidth={1} borderColor="rgba(109, 94, 247, 0.2)">
                <Text fontSize="$xs" fontWeight="$bold" color={PURPLE} textTransform="uppercase" mb="$3">
                  {t('completeAdvance.payments.receivedTitle') || 'Advance Payments Received'}
                </Text>
                <HStack justifyContent="space-between" mb="$1">
                  <Text color="$coolGray600" fontSize="$sm">
                    {t('completeAdvance.payments.totalPayments') || 'Total Payments'} ({order.payments?.length || 0})
                  </Text>
                  <Text fontWeight="$bold" color="$coolGray900" fontSize="$sm">₹{totalPaid.toLocaleString()}</Text>
                </HStack>
                <HStack justifyContent="space-between">
                  <Text color="$coolGray600" fontSize="$sm">
                    {t('completeAdvance.payments.weightCovered') || 'Weight Covered'}
                  </Text>
                  <Text fontWeight="$bold" color="$coolGray900" fontSize="$sm">
                    {(order.weightPaid || 0).toFixed(3)} {t('common.gramShort') || 'gm'}
                  </Text>
                </HStack>
              </Box>

              {/* Completion Date */}
              <Box bg="$white" p="$4" rounded="$xl" mb="$4" style={styles.card} flexDirection="row" alignItems="center" justifyContent="space-between">
                <HStack space="sm" alignItems="center" flex={1}>
                  <CalendarIcon size={16} color="#6B7280" />
                  <Text color="$coolGray600" fontSize="$sm">
                    {t('completeAdvance.completionDate') || 'Completion Date:'}
                  </Text>
                </HStack>
                <Pressable onPress={() => setShowDatePicker(true)} bg="$coolGray50" px="$3" py="$1.5" rounded="$md">
                  <Text fontWeight="$bold" color="$coolGray900" fontSize={13}>
                    {completionDate.toISOString().split('T')[0] === new Date().toISOString().split('T')[0]
                      ? t('common.today') || 'Today'
                      : completionDate.toISOString().split('T')[0]}
                  </Text>
                </Pressable>
              </Box>

              {/* Gold Rate (Matching OrderDetails Payment Modal) */}
              <Box bg="$white" p="$5" rounded="$2xl" mb="$4" style={styles.card}>
                <HStack justifyContent="space-between" alignItems="center" mb="$3">
                  <Text fontSize={12} color="$coolGray500" fontWeight="$bold" textTransform="uppercase">
                    {t('orders.details.goldRate') || 'Gold Rate'}
                  </Text>
                  <HStack space="md" alignItems="center">
                    {bookingRate && (
                      <Pressable
                        onPress={() => {
                          setCustomGoldRate(String(bookingRate));
                          setUseCustomRate(true);
                        }}
                        bg="$blue50"
                        px="$1"
                        py="$0.5"
                        rounded="$md"
                      >
                        <Text fontSize="$2xs" color="$blue600" fontWeight="$bold">
                          {t('orders.details.useBookingRate') || 'Use Booking Rate'} (₹{bookingRate})
                        </Text>
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() => setUseCustomRate(!useCustomRate)}
                      flexDirection="row"
                      alignItems="center"
                    >
                      <Box
                        w="$4"
                        h="$4"
                        rounded="$md"
                        borderWidth={2}
                        borderColor={useCustomRate ? PURPLE : "$coolGray300"}
                        bg={useCustomRate ? PURPLE : "transparent"}
                        alignItems="center"
                        justifyContent="center"
                        mr="$1"
                      >
                        {useCustomRate && <CheckIcon size="xs" color="white" />}
                      </Box>
                      <Text fontSize="$xs" color="$coolGray700">
                        {t('orders.details.customRate') || 'Custom rate'}
                      </Text>
                    </Pressable>
                  </HStack>
                </HStack>

                {!useCustomRate && (
                  <Box mb="$3">
                    <SelectField
                      value={selectedPurity}
                      onValueChange={(v) => setSelectedPurity(v)}
                      items={purityOptions}
                      placeholder={t('orders.details.selectPurity') || 'Select purity'}
                      title={t('orders.details.selectPurity') || 'Select purity'}
                    />
                  </Box>
                )}

                {useCustomRate ? (
                  <Input variant="outline" h={50} bg="$coolGray50" borderColor="$coolGray200" rounded="$full">
                    <InputField
                      keyboardType="numeric"
                      value={customGoldRate}
                      onChangeText={setCustomGoldRate}
                      maxLength={INPUT_LIMITS.rate}
                      placeholder={String(marketRatePerGram || bookingRate || 0)}
                      style={{ fontSize: 16, fontWeight: '600' }}
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                    />
                  </Input>
                ) : (
                  <Box h={50} bg="$coolGray50" rounded="$2xl" px="$4" justifyContent="center">
                    <HStack alignItems="baseline" space="xs">
                      <Text fontSize={18} fontWeight="$black" color="$coolGray900">₹{currentRatePerGram.toLocaleString()}</Text>
                      <Text fontSize={13} color="$coolGray500">
                        {t('orders.details.perGram') || 'per gram'}
                      </Text>
                    </HStack>
                  </Box>
                )}
              </Box>

              {/* GST Toggle Card */}
              <Pressable onPress={() => setIncludeGST(!includeGST)}>
                <Box bg="$white" rounded="$2xl" borderWidth={1} borderColor={includeGST ? PURPLE : "$coolGray100"} p="$4" mb="$4" style={styles.card}>
                  <HStack alignItems="center" justifyContent="space-between">
                    <HStack alignItems="center">
                      <Box w="$6" h="$6" rounded="$full" bg={includeGST ? PURPLE : "$white"} borderWidth={includeGST ? 0 : 2} borderColor="$coolGray300" alignItems="center" justifyContent="center" mr="$3">
                        {includeGST && <Icon as={CheckIcon} size="xs" color="$white" />}
                      </Box>
                      <VStack>
                        <Text fontWeight="$bold" color="$coolGray900">{t('invoice.includeGst') || 'Include GST in the bill'}</Text>
                        {/* <Text fontSize="$xs" color="$coolGray400">{t('invoice.gstApplied') || 'GST APPLIED'}</Text> */}
                      </VStack>
                    </HStack>
                    <Box bg={includeGST ? "rgba(109, 94, 247, 0.1)" : "$coolGray50"} px="$3" py="$1" rounded="$lg" borderWidth={1} borderColor={includeGST ? "rgba(109, 94, 247, 0.2)" : "$coolGray200"}>
                      <Text color={includeGST ? PURPLE : "$coolGray400"} fontWeight="$bold" fontSize="$xs">
                        {includeGST ? `${gstPercentage}%` : 'OFF'}
                      </Text>
                    </Box>
                  </HStack>
                </Box>
              </Pressable>

              {/* Final Bill Calculation */}
              <Box bg="$white" p="$5" rounded="$2xl" mb="$4" style={styles.card}>
                <Text fontSize="$xs" fontWeight="$bold" color="$coolGray400" textTransform="uppercase" mb="$3">
                  {t('completeAdvance.finalBill.title') || 'Final Bill Calculation'}
                </Text>
                <VStack space="sm">
                  <HStack justifyContent="space-between">
                    <Text color="$coolGray500" fontSize="$sm">
                      {t('completeAdvance.finalBill.goldValue') || 'Gold Value'}
                    </Text>
                    <Text fontWeight="$medium" color="$coolGray800">₹{totalGoldValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
                  </HStack>
                  {makingCharges > 0 && (
                    <HStack justifyContent="space-between">
                      <Text color="$coolGray500" fontSize="$sm">
                        {t('completeAdvance.finalBill.makingCharges') || 'Making Charges'}
                      </Text>
                      <Text fontWeight="$medium" color="$coolGray800">₹{makingCharges.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
                    </HStack>
                  )}
                  {/* Both rows only when GST actually applies. `grandTotal` is
                      `subtotal + gstAmount`, so without GST the subtotal simply
                      repeats the grand total two rows down — and the GST line
                      rendered as "GST (3%) ₹0", which reads as though 3% had
                      been applied and come to nothing. */}
                  {gstAmount > 0 && (
                    <>
                      <HStack justifyContent="space-between">
                        <Text color="$coolGray500" fontSize="$sm">
                          {t('completeAdvance.finalBill.subtotal') || 'Subtotal'}
                        </Text>
                        <Text fontWeight="$medium" color="$coolGray800">₹{subtotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
                      </HStack>
                      <HStack justifyContent="space-between" alignItems="center">
                        <Text color="$coolGray500" fontSize="$sm">
                          {t('completeAdvance.finalBill.gst') || 'GST'} ({gstPercentage}%)
                        </Text>
                        <Text fontWeight="$medium" color="$coolGray800">₹{gstAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
                      </HStack>
                    </>
                  )}
                  <Divider bg="$coolGray100" my="$2" />
                  <HStack justifyContent="space-between">
                    <Text fontWeight="$bold" color="$coolGray900" fontSize="$md">
                      {t('completeAdvance.finalBill.grandTotal') || 'Grand Total'}
                    </Text>
                    <Text fontWeight="$bold" color="$coolGray900" fontSize="$md">₹{grandTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
                  </HStack>
                  <HStack justifyContent="space-between">
                    <Text color={PURPLE} fontSize="$sm">
                      {t('completeAdvance.finalBill.advancePaid') || 'Advance Paid'}
                    </Text>
                    <Text color={PURPLE} fontSize="$sm">- ₹{totalPaid.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
                  </HStack>
                  <Divider bg="$coolGray100" my="$2" />
                  <HStack justifyContent="space-between" alignItems="center">
                    <Text fontWeight="$black" color="#D97706" fontSize="$lg">
                      {t('completeAdvance.finalBill.balanceDue') || 'Balance Due'}
                    </Text>
                    <Text fontWeight="$black" color="#D97706" fontSize="$lg">₹{balanceDue.toLocaleString(undefined, { maximumFractionDigits: 3 })}</Text>
                  </HStack>
                </VStack>
              </Box>

              {/* Final Payment Amount */}
              <Box bg="$white" p="$5" rounded="$2xl" mb="$6" style={styles.card}>
                <Text fontSize="$sm" fontWeight="$bold" color="$coolGray800" mb="$2">
                  {t('completeAdvance.finalPayment') || 'Final Payment Amount (₹)'}
                </Text>
                <Input variant="outline" h={50} bg="$coolGray50" borderColor="$coolGray200" rounded="$xl">
                  <InputField
                    keyboardType="numeric"
                    value={finalPaymentAmount}
                    onChangeText={setFinalPaymentAmount}
                    maxLength={INPUT_LIMITS.amount}
                    placeholder={balanceDue.toFixed(2)}
                    style={{ fontSize: 16, fontWeight: 'bold' }}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />
                </Input>
                {finalPayment > 0 && finalPayment < balanceDue - 0.01 && (
                  <HStack space="xs" alignItems="center" mt="$3">
                    <AlertCircle size={14} color="#D97706" />
                    <Text fontSize="$xs" color="#D97706">
                      {t('completeAdvance.amountLessThanBalance') || 'Amount is less than balance due'}
                    </Text>
                  </HStack>
                )}
              </Box>

              {/* Complete Button */}
              <Pressable
                onPress={handleComplete}
                disabled={isProcessing || !finalPaymentAmount || finalPayment < balanceDue - 0.01}
              >
                <Box
                  bg={isProcessing || !finalPaymentAmount || finalPayment < balanceDue - 0.01 ? "$coolGray300" : PURPLE}
                  p="$4"
                  rounded="$2xl"
                  flexDirection="row"
                  justifyContent="center"
                  alignItems="center"
                  style={styles.card}
                >
                  {isProcessing ? (
                    <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
                  ) : (
                    <CheckCircle2 size={18} color="#fff" style={{ marginRight: 8 }} />
                  )}
                  <Text fontWeight="$black" color="$white" fontSize={16}>
                    {isProcessing
                      ? (t('completeAdvance.processing') || 'Processing...')
                      : (t('completeAdvance.completeAndGenerate') || 'Complete Order & Generate Bill')}
                  </Text>
                </Box>
              </Pressable>
            </>
          </Pressable>
        </ScrollView>

      </KeyboardAvoidingView>

      <DatePickerModal
        isOpen={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        date={completionDate.toISOString().split('T')[0]}
        onSelect={(d) => {
          setCompletionDate(new Date(d));
          setShowDatePicker(false);
        }}
      />
      <DiscardChangesModal
        visible={discardGuard.promptVisible}
        onCancel={discardGuard.cancelDiscard}
        onDiscard={discardGuard.confirmDiscard}
        title={t('common.discard.completionTitle')}
      />
      <ValidationErrorModal
        isOpen={showValidationModal}
        errors={validationErrors}
        onClose={() => setShowValidationModal(false)}
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
});

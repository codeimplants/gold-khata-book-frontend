import React, { useMemo } from 'react';
import { StyleSheet, Platform, Share, ScrollView as RNScrollView, Alert } from 'react-native';
import {
    Box,
    HStack,
    VStack,
    Text,
    Pressable,
    Icon,
    Center,
    ScrollView,
    Divider,
    Switch,
} from '@gluestack-ui/themed';
import { CheckCircle2, Share2, Printer, MoveLeft, MoveRight, FileSignature } from 'lucide-react-native';
import { AppReview } from '@codeimplants/app-review';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useTranslation } from '../../hooks/useTranslation';
import { useEffectiveMetalRates } from '../../hooks/useShopRate';
import { toast } from '../../components/common/Toast';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { usePrintBill } from '../../hooks/usePrintBill';
import { prepareShopForPrint, prepareBillForPrint } from '../../utils/imageUtils';
import { openWhatsApp } from '../../utils/whatsappUtils';
import { calcItemTotal, calculateItemMakingCharge } from '../../utils/calculations';
import PrintTargetNote from '../../components/common/PrintTargetNote';
import { LAYOUT } from '../../constants/layout';
import { formatNumber } from '../../utils/formatter';

const PURPLE = "#6D5EF7";
const PINK = "#D946EF";

const formatCurrency = (value: number) =>
    value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const AdvanceOrderSuccessScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { t, invoiceLanguage, invoiceTemplate, declarationLanguage } = useTranslation();
    const {
        print: printBill,
        openChooser,
        targetLabel: printTargetLabel,
        canChoosePrinter,
        chooser: printerChooser,
    } = usePrintBill(
        invoiceLanguage,
        invoiceTemplate,
    );
    const { shopDetails, customers } = useAppSelector((state) => state.data);
    /** Shop rate when set, live feed otherwise. */
    const effectiveRates = useEffectiveMetalRates();
    const dispatch = useAppDispatch();

    const order = route.params?.order;

    // One-off, per-export choice: collapse itemized advance payments into a
    // single anonymized line (for gift bills). Not persisted.
    const [combinePayments, setCombinePayments] = React.useState(false);

    const hasExchange = Boolean(order?.isOrnamentExchanges && (order?.exchanges?.length ?? 0) > 0);


    // An advance order just went through — a genuine moment of satisfaction, so ask the
    // SDK whether this is a good time to request a rating. It usually decides no.
    React.useEffect(() => {
        const timer = setTimeout(() => {
            AppReview.requestIfEligible();
        }, 1500);
        return () => clearTimeout(timer);
    }, []);


    // Basic validation if order is missing
    if (!order) {
        return (
            <Center flex={1} bg="#F9FAFB">
                <Text>{t('advanceOrderSuccess.noOrderData')}</Text>
                <Pressable onPress={() => navigation.navigate('MainTabs')} mt="$4">
                    <Text color={PURPLE}>{t('advanceOrderSuccess.backToDashboard')}</Text>
                </Pressable>
            </Center>
        );
    }

    const bookingRate = useMemo(() => {
        // Priority 1: From navigation params (most reliable for direct flow)
        if (route.params?.bookingRate) return Number(route.params.bookingRate);

        // Priority 2: From order's payment history (for deep links/viewing existing)
        if (!order || !Array.isArray(order.payments) || order.payments.length === 0) return null;
        const firstWithRate = order.payments.find((p: any) => (p.goldRate && Number(p.goldRate) > 0));
        return firstWithRate ? Number(firstWithRate.goldRate) : null;
    }, [order, route.params?.bookingRate]);

    const ratePerGram = useMemo(() => {
        if (bookingRate) return bookingRate;

        return (order.purity?.includes('24K')
            ? effectiveRates?.gold?.goldPrice24K995GW
            : order.purity?.includes('18K')
                ? effectiveRates?.gold?.goldPrice18K
                : order.purity?.includes('Silver')
                    ? effectiveRates?.silver?.silverPrice
                    : effectiveRates?.gold?.goldPrice22K) || 6750;
    }, [bookingRate, order.purity, effectiveRates]);

    // These should ideally come from the order object passed from handleSave
    const goldBalance = (order.remainingWeight || 0) * ratePerGram;

    // Re-calculate making charges for display - Iterating over all items
    const makingCharges = order.items?.reduce((acc: number, it: any) => {
        const netWt = Number(it.netWt || it.weight || it.netWeight || 0);
        const grossWt = Number(it.grossWt || it.grossWeight || netWt);
        const itemGoldValue = netWt * ratePerGram;

        if (it.makingChargeType === '%') return acc + (itemGoldValue * (Number(it.makingChargeValue || it.makingCharge || 0)) / 100);
        if (['Per Gram', 'pergram'].includes(it.makingChargeType)) return acc + (grossWt * (Number(it.makingChargeValue || it.makingCharge || 0)));
        return acc + (Number(it.makingChargeValue || it.makingCharge || 0)); // Fixed
    }, 0) || 0;

    const paymentsTotal = useMemo(() => {
        if (!order || !Array.isArray(order.payments)) return 0;
        return order.payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    }, [order]);

    const advancePaidAmount = useMemo(() => {
        if (paymentsTotal > 0) return paymentsTotal;
        return Number(order.initialPayment?.amount ?? 0);
    }, [paymentsTotal, order.initialPayment?.amount]);

    // GST quoted tentatively on the whole order at the booking rate, matching
    // the create screen and the stored estimatedBalance the printed bill uses.
    // Omitting it here made this screen quote a lower balance than the bill the
    // customer walks out with.
    const orderGstAmount = order.includeGST ? Number(order.gstAmount || 0) : 0;

    const estimatedTotalBalance = goldBalance + makingCharges + orderGstAmount;

    // The order's full worth at the rate it was just booked at, before the
    // advance (and any old gold) is taken off. `goldBalance` below prices only
    // the weight still owed, so without this the screen never states the total
    // the shop is actually subtracting from.
    const totalOrderCost = (order.totalWeight || 0) * ratePerGram + makingCharges;

    const customer = useMemo(() => {
        if (!order) return undefined;
        const direct = customers.find(c => c.id === order.customerId);
        if (direct) return direct;
        // Fallback: match by _id substring if needed
        return customers.find(
            c => order.customerId?.includes(c.id) || c.id?.includes(order.customerId),
        );
    }, [customers, order]);


    const prepareInvoiceValues = () => {
        if (!order) return null;

        const payments = (order.payments || []).map((p: any, index: number) => ({
            id: p.id || p._id || `payment-${index}`,
            amount: Number(p.amount || 0).toFixed(2),
            date: p.date ? new Date(p.date).toLocaleDateString('en-IN') : '',
            goldRate: Number(p.goldRate || 0).toFixed(2),
            weightCovered: Number(p.weightCovered || 0).toFixed(3),
            purity: p.purity || '',
            notes: p.notes || p.remarks || '',
        }));

        const totalWeightValue = Number(order.totalWeight ?? 0);
        const weightPaidValue = Number(order.weightPaid ?? 0);
        const remainingWeightValue =
            order.remainingWeight ?? Math.max(0, totalWeightValue - weightPaidValue);

        const settlementRateForInvoice =
            bookingRate || 0;

        const paymentSummary = {
            amountPaid: Number(order.totalPaid ?? order.amount ?? 0).toFixed(2),
            bookingRate: Number(order.bookingRate ?? 0).toFixed(2),
            weightCovered: weightPaidValue.toFixed(3),
            totalWeight: totalWeightValue.toFixed(3),
            remainingWeight: remainingWeightValue.toFixed(3),
            estimatedBalance: Number(order.estimatedBalance ?? 0).toFixed(2),
            payments,
        };

        return {
            invoiceDate: new Date(order.date).toISOString(),
            customerName: customer?.name || 'Walk-in Retailer',
            address: customer?.address || '',
            phone: customer?.phone || '',
            includeGst: order.includeGST || false,
            items: (order.items || []).map((it: any, index: number) => {
                const computedMakingCharge =
                    settlementRateForInvoice > 0
                        ? calculateItemMakingCharge(it, settlementRateForInvoice)
                        : Number(it.makingCharge || it.makingCharges || 0);
                return {
                    id: it.id || it._id || String(index),
                    itemName: it.itemName || it.name || 'Item',
                    metalType: it.itemType || it.productType || 'Gold',
                    purity: it.purity || '',
                    pcs: String(it.pieces || it.pcs || 1),
                    grossWt: String(
                        Number(it.grossWeight || it.grossWt || it.weight || 0).toFixed(3),
                    ),
                    lessWt: String(Number(it.lessWeight || it.lessWt || 0).toFixed(3)),
                    netWt: String(
                        Number(it.netWeight || it.netWt || it.weight || 0).toFixed(3),
                    ),
                    ratePerGm: String(Number(it.rate || 0).toFixed(2)),
                    // Always 'Fixed', matching OrderDetailsScreen: `makingCharges`
                    // below is the RESOLVED rupee amount, so any type that implies
                    // a rate makes anything recomputing from it multiply by the
                    // weight a second time. This used to say 'Per Gram' for every
                    // non-fixed charge — the same ~18x overstatement that was
                    // already found and fixed in the order-details print path, in
                    // a copy of the mapping that never got the fix.
                    makingChargeType: 'Fixed' as 'Per Gram' | 'Fixed' | 'Percentage' | '%',
                    makingCharges: String(
                        Number(computedMakingCharge).toFixed(2),
                    ),
                    // Display only — the basis the customer agreed to, for the
                    // printed column header. Never recomputed from.
                    makingBasisType: it.makingType || it.makingChargeType || '',
                    makingBasisValue: String(it.makingCharge ?? it.makingCharges ?? ''),
                    // `chargeDescription` first — the persisted field name. See
                    // the same mapping in OrderDetailsScreen.
                    otherChargesDescription: it.chargeDescription || it.otherChargesDescription || '',
                    otherChargesAmount: String(
                        Number(it.chargeAmount || it.otherChargesAmount || 0).toFixed(2),
                    ),
                    discountType: (it.discountType as 'Percentage' | 'Fixed' | '%') || 'Fixed',
                    discount: String(Number(it.discount || 0).toFixed(2)),
                    itemTotal: String(Number(calcItemTotal(it)).toFixed(2)),
                };
            }),
            subtotal: String(Number(order.subTotal || 0).toFixed(2)),
            gst: String(Number(order.gstAmount || 0).toFixed(2)),
            gstPercentage: shopDetails?.gstPercentage || 3,
            grandTotal: String(Number(order.amount || 0).toFixed(2)),
            orderType: order.type,
            orderNumber: order.orderNumber || order.invoiceNumber || '',
            orderStatus: order.status,
            exchanges: (order as any).exchanges || [],
            enableExchange: false,
            paymentSummary,
        };
    };

    const handleShare = async () => {
        try {
            await Share.share({
                message: `Advance Order Created!\nOrder: ${order.orderNumber || 'New'}\nItem: ${order.items?.[0]?.itemName || 'Jewelry'}\nAdvance Paid: ₹${formatCurrency(advancePaidAmount)}`,
            });
        } catch (error) {
            console.error(error);
        }
    };

    const handlePrint = async () => {
        const mappedValues = prepareInvoiceValues();
        if (!mappedValues) return;

        const [printableShop, printableBill] = await Promise.all([
            prepareShopForPrint(shopDetails),
            prepareBillForPrint(mappedValues),
        ]);
        printBill(printableBill, {
            billNo: order?.invoiceNumber || order?.id,
            billDate: new Date(order.date).toLocaleDateString(),
            mode: 'print',
            shopDetails: printableShop,
            combinePayments,
        });
    };

    const handleWhatsApp = async () => {
        try {
            const customer = customers.find(c => c.id === order.customerId);
            const shopName = shopDetails?.shopName || shopDetails?.name || 'Gold Khata Book';

            const textLines = [
                `🧾 *Advance Order Created!*`,
                `*Reference:* ${order.orderNumber || order.invoiceNumber || order.id?.slice(-8).toUpperCase() || 'ADV-ORDER'}`,
                `*Retailer:* ${customer?.name || 'Retailer'}`,
                `*Item:* ${order.items?.[0]?.itemName || 'Jewelry'}`,
                `*Total Weight:* ${formatNumber(order.totalWeight, 3)} gm`,
                `*Advance Paid:* ₹${formatCurrency(advancePaidAmount)}`,
                `*Remaining Weight:* ${formatNumber(order.remainingWeight, 3)} gm`,
                '',
                `*${shopName}*`,
                `Thank you! 🙏`,
            ];

            await openWhatsApp(customer?.phone, textLines.join('\n'));
        } catch (error) {
            console.error(error);
            toast.error('Could not open WhatsApp');
        }
    };

    return (
        <Box flex={1} bg="#F9FAFB">
            <SafeAreaView edges={['top']} style={{ flex: 1 }}>
                <ScrollView flex={1} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 100, alignItems: 'center', ...(LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}) }}>

                    {/* Success Animation Area */}
                    <Box p="$6" alignItems="center">
                        <Box w={80} h={80} rounded="$full" bg="rgba(22, 163, 74, 0.1)" justifyContent="center" alignItems="center" mb="$4">
                            <Icon as={CheckCircle2} size={40} color="#16A34A" />
                        </Box>
                        <Text fontSize={24} fontWeight="$black" color="#111827" textAlign="center">
                            {t('advanceOrderSuccess.title')}
                        </Text>
                        <Text color="$coolGray500" textAlign="center" mt="$1">
                            {t('advanceOrderSuccess.subtitle')}
                        </Text>
                    </Box>

                    {/* Receipt Card */}
                    <Box bg="$white" w="$full" rounded="$3xl" p="$6" shadowColor="#000" shadowOffset={{ width: 0, height: 4 }} shadowOpacity={0.06} shadowRadius={12} elevation={5} borderWidth={1} borderColor="#E5E7EB" mt="$4">
                        <VStack space="md">
                            <HStack justifyContent="space-between">
                                <Text color="$coolGray500" fontSize={14}>{t('advanceOrderSuccess.receiptNo')}</Text>
                                <Text fontWeight="$bold" color="$coolGray900">{order.orderNumber || order.invoiceNumber || order.id?.slice(-8).toUpperCase() || 'ADV-1029'}</Text>
                            </HStack>

                            <HStack justifyContent="space-between">
                                <Text color="$coolGray500" fontSize={14}>{t('advanceOrderSuccess.item')}</Text>
                                <Text fontWeight="$medium" color="$coolGray900">{order.items?.[0]?.itemName || 'Multiple Items'}</Text>
                            </HStack>

                            <HStack justifyContent="space-between">
                                <Text color="$coolGray500" fontSize={14}>{t('advanceOrderSuccess.totalWeight')}</Text>
                                <Text fontWeight="$medium" color="$coolGray900">{formatNumber(order.totalWeight, 3)} gm</Text>
                            </HStack>

                            <Divider my="$2" />

                            <HStack justifyContent="space-between">
                                <Text color="$coolGray500" fontSize={14}>{t('advanceOrderSuccess.advancePaid')}</Text>
                                <Text fontWeight="$black" color={PURPLE}>₹{formatCurrency(advancePaidAmount)}</Text>
                            </HStack>

                            <HStack justifyContent="space-between">
                                <Text color="$coolGray500" fontSize={14}>{t('advanceOrderSuccess.weightCovered')}</Text>
                                <Text fontWeight="$bold" color="#16A34A">{formatNumber(order.weightPaid, 3)} gm</Text>
                            </HStack>

                            <HStack justifyContent="space-between">
                                <Text color="$coolGray500" fontSize={14}>{t('advanceOrderSuccess.remainingWeight')}</Text>
                                <Text fontWeight="$bold" color="#EF4444">{formatNumber(order.remainingWeight, 3)} gm</Text>
                            </HStack>

                            {/* Estimation Alert Box */}
                            <Box bg="#FFFBEB" rounded="$2xl" p="$4" mt="$2" borderWidth={1} borderColor="#FEF3C7">
                                <VStack space="xs">
                                    <HStack justifyContent="space-between">
                                        <Text fontSize={12} fontWeight="$bold" color="#92400E">{t('advanceOrderSuccess.totalOrderCost') || 'Total Order Cost'} (@ ₹{ratePerGram.toLocaleString()}/gm)</Text>
                                        <Text fontSize={12} fontWeight="$bold" color="#92400E">₹{Math.round(totalOrderCost).toLocaleString()}</Text>
                                    </HStack>
                                    {/* Metal and labour split out beneath the total
                                        they make up, so the figure is checkable
                                        rather than something to take on trust. */}
                                    <VStack space="xs" pl="$3">
                                        <HStack justifyContent="space-between">
                                            <Text fontSize={11} color="#B45309">
                                                {t('advanceOrder.summary.itemCost') || 'Item cost'}
                                                {Number(order.totalWeight) > 0 ? ` (${Number(order.totalWeight).toFixed(3)} gm)` : ''}
                                            </Text>
                                            <Text fontSize={11} color="#B45309">₹{Math.round((order.totalWeight || 0) * ratePerGram).toLocaleString()}</Text>
                                        </HStack>
                                        {makingCharges > 0 && (
                                            <HStack justifyContent="space-between">
                                                <Text fontSize={11} color="#B45309">{t('advanceOrderSuccess.makingCharges')}</Text>
                                                <Text fontSize={11} color="#B45309">₹{Math.round(makingCharges).toLocaleString()}</Text>
                                            </HStack>
                                        )}
                                    </VStack>
                                    <Divider my="$1" bg="#FDE68A" />
                                    <HStack justifyContent="space-between">
                                        <Text fontSize={12} color="#92400E">{t('advanceOrderSuccess.goldBalance')} (@ ₹{ratePerGram.toLocaleString()}/gm)</Text>
                                        <Text fontSize={12} color="#92400E">₹{Math.round(goldBalance).toLocaleString()}</Text>
                                    </HStack>
                                    {makingCharges > 0 && (
                                        <HStack justifyContent="space-between">
                                            <Text fontSize={12} color="#92400E">{t('advanceOrderSuccess.makingCharges')}</Text>
                                            <Text fontSize={12} color="#92400E">₹{Math.round(makingCharges).toLocaleString()}</Text>
                                        </HStack>
                                    )}
                                    {orderGstAmount > 0 && (
                                        <HStack justifyContent="space-between">
                                            <Text fontSize={12} color="#92400E">{t('invoicePreview.gst') || 'GST'} ({shopDetails?.gstPercentage || 3}%)</Text>
                                            <Text fontSize={12} color="#92400E">₹{Math.round(orderGstAmount).toLocaleString()}</Text>
                                        </HStack>
                                    )}
                                    <Divider my="$1" bg="#FDE68A" />
                                    <HStack justifyContent="space-between">
                                        <Text fontSize={14} fontWeight="$bold" color="#92400E">{t('advanceOrderSuccess.estTotalBalance')}</Text>
                                        <Text fontSize={16} fontWeight="$black" color="#D97706">₹{Math.round(estimatedTotalBalance).toLocaleString()}</Text>
                                    </HStack>
                                </VStack>
                            </Box>

                            <Text fontSize={10} color="$coolGray400" textAlign="center" mt="$2">
                                {t('advanceOrderSuccess.settlementNote')}
                            </Text>
                        </VStack>
                    </Box>

                    {/* Quick Actions */}
                    <VStack space="md" mt="$8" w="$full">

                        {(order.payments?.length ?? 0) > 1 && (
                            <HStack
                                justifyContent="space-between"
                                alignItems="center"
                                bg="$white"
                                p="$3"
                                rounded="$xl"
                                borderWidth={1}
                                borderColor="#E5E7EB"
                            >
                                <VStack flex={1} pr="$2">
                                    <Text fontWeight="$bold" fontSize={13} color="$coolGray900">
                                        {t('orders.details.combinePaymentsTitle') || 'Combine payments as single (gift bill)'}
                                    </Text>
                                    <Text fontSize={11} color="$coolGray500" mt="$1">
                                        {t('orders.details.combinePaymentsDesc') || "Hides individual installments on this copy only — your records stay itemized"}
                                    </Text>
                                </VStack>
                                <Switch
                                    value={combinePayments}
                                    onValueChange={setCombinePayments}
                                />
                            </HStack>
                        )}

                        <Pressable onPress={handlePrint}>
                            <Box bg="$white" rounded="$2xl" p="$4" alignItems="center" borderWidth={1} borderColor="#E5E7EB" flexDirection="row" justifyContent="center">
                                <Icon as={Printer} size="sm" color="$coolGray700" mr="$2" />
                                <Text fontWeight="$bold" color="$coolGray700">{t('advanceOrderSuccess.print')}</Text>
                            </Box>
                        </Pressable>

                        {/* Which printer Print will use, matching the invoice
                            success screen. A shop set to thermal with the
                            printer switched off otherwise taps Print and meets
                            an error with no clue the setting was ever thermal. */}
                        {printTargetLabel ? (
                            <PrintTargetNote
                                mt="-$2"
                                label={printTargetLabel}
                                // On web the chooser has nothing to offer, so
                                // Change falls through to Print Settings rather
                                // than disappearing.
                                onChangeInPlace={canChoosePrinter ? openChooser : undefined}
                            />
                        ) : null}

                        <Pressable onPress={handleShare}>
                            <Box bg="$white" rounded="$2xl" p="$4" alignItems="center" borderWidth={1} borderColor="#E5E7EB" flexDirection="row" justifyContent="center">
                                <Icon as={Share2} size="sm" color="$coolGray700" mr="$2" />
                                <Text fontWeight="$bold" color="$coolGray700">{t('advanceOrderSuccess.otherShare')}</Text>
                            </Box>
                        </Pressable>

                        <Pressable onPress={handleWhatsApp}>
                            <Box bg="#16A34A" rounded="$2xl" p="$4" alignItems="center" flexDirection="row" justifyContent="center">
                                <Icon as={Share2} size="sm" color="$white" mr="$2" />
                                <Text fontWeight="$bold" color="$white">{t('advanceOrderSuccess.shareWhatsApp')}</Text>
                            </Box>
                        </Pressable>
                    </VStack>

                    {/* Navigation Buttons */}
                    <VStack space="md" w="$full" mt="$10">
                        <Pressable onPress={() => {
                            navigation.reset({
                                index: 0,
                                routes: [{ 
                                    name: 'MainTabs', 
                                    params: { 
                                        screen: 'Orders', 
                                        params: { filter: 'pending' } 
                                    } 
                                }],
                            });
                        }}>
                            <Box rounded="$2xl" overflow="hidden" h={56} borderWidth={1} borderColor='#dcdfe5'>
                                <Center display="flex" flexDirection='row' alignItems='center' justifyContent='center' margin={'auto'} gap={10}>
                                    <Text color="$black" fontWeight="$black" fontSize={16}>
                                        {t('advanceOrderSuccess.backToPendingOrders')}</Text>
                                    <MoveRight size={18} color="black" />
                                </Center>
                            </Box>
                        </Pressable>
                        <Pressable onPress={() => {
                            navigation.reset({
                                index: 0,
                                routes: [{ name: 'MainTabs', params: { screen: 'Orders' } }],
                            });
                        }}>
                            <Box rounded="$2xl" overflow="hidden" h={56}>
                                <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
                                    <Defs>
                                        <LinearGradient id="btnSuccess" x1="0" y1="0" x2="1" y2="0">
                                            <Stop offset="0" stopColor={PURPLE} />
                                            <Stop offset="1" stopColor={PINK} />
                                        </LinearGradient>
                                    </Defs>
                                    <Rect width="100%" height="100%" fill="url(#btnSuccess)" />
                                </Svg>

                                <Center display="flex" flexDirection='row' alignItems='center' justifyContent='center' margin={'auto'} gap={10}>
                                    <Text color="$white" fontWeight="$black" fontSize={16}>
                                        {t('advanceOrderSuccess.backToOrders')}</Text>
                                </Center>
                            </Box>
                        </Pressable>
                    </VStack>
                </ScrollView>
            </SafeAreaView>
            {printerChooser}
        </Box>
    );
};

export default AdvanceOrderSuccessScreen;

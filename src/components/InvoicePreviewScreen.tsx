import React from 'react';
import { ScrollView, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    Box,
    VStack,
    HStack,
    Text,
    Icon,
    ArrowLeftIcon,
    Divider,
} from '@gluestack-ui/themed';
import { JewelleryFormValues } from '../types';
import GradientButton from './common/GradientButton';
import { useTranslation } from '../hooks/useTranslation';
import { useAppSelector } from '../store/hooks';
import { getFullImageUrl } from '../utils/imageUtils';
import { formatMakingChargeDetail, formatNumber, formatCurrencyValue, getSharedMakingBasis } from '../utils/formatter';
import { formatOtherChargesLabel, getBillTotals } from '../utils/calculations';
import { LAYOUT } from '../constants/layout';
import ItemPhotoThumbnails from './items/ItemPhotoThumbnails';

interface InvoicePreviewScreenProps {
    data: JewelleryFormValues;
    onBack: () => void;
    onConfirm: () => void;
    isLoading?: boolean;
    submitError?: string | null;
}

const InvoicePreviewScreen = ({ data, onBack, onConfirm, isLoading, submitError }: InvoicePreviewScreenProps) => {

    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const { shopDetails } = useAppSelector(s => s.data);

    // Only label the totals row when every item shares the same making-charge
    // type and rate — a single bracket would misrepresent a mixed invoice.
    // Mirrors the saved-order view in OrderDetailsScreen so the pre-save
    // preview and the reopened invoice read identically.
    // The same helper the printed bill's MAKING column header uses, so the two
    // cannot word the basis differently for one bill. This was a hand-rolled
    // copy of the same rules; it agreed with the print side only by coincidence.
    const makingBasis = getSharedMakingBasis(data.items, t('invoice.dropdown.fixed') || 'Fixed');
    const makingChargeLabelSuffix = makingBasis ? ` (${makingBasis})` : '';

    // The same totals the printed bill uses, rather than a second set of reduces
    // over the same items. The two had already drifted: this screen summed the
    // raw `discount` field, so a 10% discount showed as "- ₹10" while taking off
    // thousands — the mirror of the bug the print column had.
    const totals = getBillTotals(data.items);

    return (<Box flex={1} bg="$coolGray50">
        {/* Custom Header */}
        <Box bg="$white" pt="$12" pb="$4" px="$4" borderBottomWidth={1} borderBottomColor="$coolGray200" shadowColor="$coolGray300" shadowOpacity={0.1} shadowRadius={4} elevation={2}>
            <HStack alignItems="center" space="md" style={LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}}>
                <TouchableOpacity onPress={onBack} disabled={isLoading}>
                    <Box p="$2" rounded="$lg" bg="$coolGray100" opacity={isLoading ? 0.5 : 1}>
                        <Icon as={ArrowLeftIcon} size="xl" color="$coolGray700" />
                    </Box>
                </TouchableOpacity>
                <VStack>
                    <Text fontSize="$xl" fontWeight="$bold" color="$coolGray900">
                        {t("invoicePreview.title")}
                    </Text>
                    <Text fontSize="$sm" color="$coolGray600">
                        {t("invoicePreview.subtitle")}
                    </Text>
                </VStack>
            </HStack>
        </Box>

        <ScrollView contentContainerStyle={{ padding: 16, ...(LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}) }}>
            <Box bg="$white" p="$6" rounded="$3xl" shadowColor="#000" shadowOffset={{ width: 0, height: 4 }} shadowOpacity={0.08} shadowRadius={12} elevation={5} borderWidth={1} borderColor="$coolGray100">
                {/* Shop Header */}
                <VStack alignItems="center" mb="$6">
                    {getFullImageUrl(shopDetails?.logo) && (
                        <Image
                            source={{ uri: getFullImageUrl(shopDetails?.logo)! }}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                    )}
                    <Text fontSize="$2xl" fontWeight="$black" color="#6D5EF7">{shopDetails?.shopName || shopDetails?.name || 'Gold Khata Book'}</Text>
                    <Text fontSize="$xs" color="$coolGray500" textAlign="center" mt="$1">{shopDetails?.address}</Text>
                    <Text fontSize="$xs" color="$coolGray500">{t("common.phone")}: {shopDetails?.phone}</Text>
                    {shopDetails?.gst && <Text fontSize="$2xs" fontWeight="$bold" color="$coolGray400" mt="$1">GST: {shopDetails.gst}</Text>}
                </VStack>

                <Divider my="$2" bg="$coolGray100" />

                {/* Invoice Meta */}
                <HStack justifyContent="space-between" py="$4" mb="$4">
                    <VStack alignItems="flex-start">
                        <Text
                            color="$coolGray500"
                            fontSize="$xs"
                            fontWeight="$black"
                            textTransform="uppercase"
                        >
                            {t('invoicePreview.billTo') || 'Bill To'}
                        </Text>
                        <Text color="$coolGray900" fontWeight="$black" fontSize="$lg">
                            {data.customerName || t('orders.details.walkInCustomer')}
                        </Text>
                        <HStack space="xs" alignItems="center" mt="$1">
                            <Text color="$coolGray600" fontSize="$sm">
                                {data.phone || ''}
                            </Text>
                        </HStack>
                    </VStack>
                    <VStack alignItems="flex-end">
                        <Text fontSize="$xs" color="$coolGray400" fontWeight="$bold" textTransform="uppercase">{t("invoicePreview.date")}</Text>
                        <Text fontWeight="$bold" color="$coolGray900">{new Date(data.invoiceDate).toLocaleDateString()}</Text>
                    </VStack>
                </HStack>

                {/* Item Table Header */}
                <HStack pb="$2" borderBottomWidth={1} borderColor="$coolGray200">
                    <Text flex={2} fontWeight="$black" fontSize="$2xs" color="$coolGray400" textTransform="uppercase">{t("invoicePreview.table.item")}</Text>
                    <Text flex={1} fontWeight="$black" fontSize="$2xs" color="$coolGray400" textTransform="uppercase" textAlign="center">{t("invoicePreview.table.weight")}</Text>
                    <Text flex={1} fontWeight="$black" fontSize="$2xs" color="$coolGray400" textTransform="uppercase" textAlign="center">{t("invoicePreview.table.rate") || "Rate"}</Text>
                    <Text flex={1} fontWeight="$black" fontSize="$2xs" color="$coolGray400" textTransform="uppercase" textAlign="right">{t("invoicePreview.table.amount")}</Text>
                </HStack>

                <VStack space="md" py="$4">
                    {data.items.map((item, index) => (
                        <VStack key={item.id} space="xs">
                            <HStack alignItems="flex-start">
                                <VStack flex={2}>
                                    <Text fontWeight="$bold" fontSize="$sm" color="$coolGray800">{item.itemName}</Text>
                                    <Text fontSize="$2xs" color="$coolGray400" fontWeight="$medium">{item.metalType} • {item.purity}</Text>
                                    {!!formatMakingChargeDetail(item, t('bill.makingFixed') || 'Fixed') && (
                                        <Text fontSize="$2xs" color="$coolGray400">
                                            {t('invoicePreview.makingCharges')}: {formatMakingChargeDetail(item, t('bill.makingFixed') || 'Fixed')}
                                        </Text>
                                    )}
                                </VStack>
                                <VStack flex={1} alignItems="center">
                                    <Text fontSize="$sm" fontWeight="$bold" color="$coolGray700">{formatNumber(item.netWt)}</Text>
                                </VStack>
                                <VStack flex={1} alignItems="center">
                                    <Text fontSize="$sm" fontWeight="$bold" color="$coolGray700">{formatCurrencyValue(Number(item.ratePerGm) || 0)}</Text>
                                </VStack>
                                <Text flex={1} fontSize="$sm" fontWeight="$black" color="$coolGray900" textAlign="right">{formatCurrencyValue(Number(item.netWt) * Number(item.ratePerGm) || 0)}</Text>
                            </HStack>
                            {/* Pre-save preview, so these are still local picks —
                                `pendingPhotos`, not the uploaded `photos`. Shown
                                for the same reason as on a saved bill: this is
                                the shopkeeper's last chance to notice they
                                photographed the wrong piece. */}
                            {(item.pendingPhotos?.length || item.photos?.length) ? (
                                <ItemPhotoThumbnails
                                    photos={[
                                        ...(item.photos || []),
                                        ...(item.pendingPhotos || []).map(p => ({ url: p.uri, fileId: p.uri })),
                                    ]}
                                    size={40}
                                />
                            ) : null}
                        </VStack>
                    ))}
                </VStack>

                <Divider my="$2" bg="$coolGray100" />

                {/* Totals Block */}
                <VStack space="sm" mt="$2">
                    <HStack justifyContent="space-between">
                        <Text fontSize="$sm" color="$coolGray500" fontWeight="$medium">{t("invoicePreview.totalAmount")}</Text>
                        <Text fontSize="$sm" fontWeight="$bold" color="$coolGray800">
                            {formatCurrencyValue(totals.metalValue)}
                        </Text>
                    </HStack>

                    {/* Only when there is a making charge. "Making Charges ₹0" is
                        not information — the customer reads it as a charge that
                        happened to come to nothing, and it is the row that pushes
                        the real ones off a short bill. The printed bill has hidden
                        it since d321801; this screen had not caught up. */}
                    {totals.makingCharges > 0 && (
                        <HStack justifyContent="space-between">
                            <Text fontSize="$sm" color="$coolGray500" fontWeight="$medium">{t("invoicePreview.makingCharges")}{makingChargeLabelSuffix}</Text>
                            <Text fontSize="$sm" fontWeight="$bold" color="$coolGray800">
                                {formatCurrencyValue(totals.makingCharges)}
                            </Text>
                        </HStack>
                    )}

                    {totals.otherCharges > 0 && (
                        <HStack justifyContent="space-between">
                            {/* Named — `Hallmark`, not `Other Charges`. The amount
                                on its own tells nobody what it was for. Falls back
                                to the generic label only when nothing was typed. */}
                            <Text fontSize="$sm" color="$coolGray500" fontWeight="$medium" flex={1} mr="$2">
                                {formatOtherChargesLabel(t("invoicePreview.otherCharges"), data.items)}
                            </Text>
                            <Text fontSize="$sm" fontWeight="$bold" color="$coolGray800">
                                {formatCurrencyValue(totals.otherCharges)}
                            </Text>
                        </HStack>
                    )}

                    {totals.discount > 0 && (
                        <HStack justifyContent="space-between">
                            <Text fontSize="$sm" color="$coolGray500" fontWeight="$medium">{t("invoicePreview.totalDiscount")}</Text>
                            <Text fontSize="$sm" fontWeight="$bold" color="$red500">
                                - {formatCurrencyValue(totals.discount)}
                            </Text>
                        </HStack>
                    )}

                    {data.enableExchange && data.exchanges.length > 0 && (
                        <VStack space="sm">
                            {data.exchanges.map((ex) => {
                                const netWt = ex.netWt || ex.weight;
                                const details = [
                                    // Trailing zeros trimmed so a whole weight reads
                                    // "19 gm", matching the saved-order view.
                                    netWt ? `${formatNumber(netWt)} gm` : null,
                                    ex.purity || null,
                                    ex.ratePerGm ? `@ ₹${formatNumber(ex.ratePerGm, 2)}/gm` : null,
                                ].filter(Boolean).join(' · ');
                                const title = ex.itemName
                                    ? ex.itemName
                                    : `${t(`invoice.dropdown.${ex.type.toLowerCase()}`)} exchange`;
                                return (
                                    <VStack key={ex.id}>
                                        <HStack justifyContent="space-between">
                                            <Text fontSize="$sm" color="$coolGray500" fontWeight="$medium">{title}</Text>
                                            <Text fontSize="$sm" fontWeight="$bold" color="$red500">- {formatCurrencyValue(parseFloat(ex.amount) || 0)}</Text>
                                        </HStack>
                                        {!!details && (
                                            <Text fontSize="$xs" color="$coolGray400">{details}</Text>
                                        )}
                                        {/* This row's own photos, merged the same way as
                                            the item rows above: `photos` only exist when a
                                            saved bill is being edited, `pendingPhotos` are
                                            the local picks a new exchange has. The block
                                            below shows `data.ornamentPhotos` — the bill-wide
                                            set that predates per-row photos, and the only one
                                            this screen used to read. Nothing populates it on
                                            the create path, so an exchange photographed at
                                            the counter appeared on the item rows and silently
                                            vanished from the exchange rows, which is where a
                                            shopkeeper most needs to check the right piece was
                                            photographed. */}
                                        {(ex.pendingPhotos?.length || ex.photos?.length) ? (
                                            <ItemPhotoThumbnails
                                                photos={[
                                                    ...(ex.photos || []),
                                                    ...(ex.pendingPhotos || []).map(p => ({ url: p.uri, fileId: p.uri })),
                                                ]}
                                                size={40}
                                            />
                                        ) : null}
                                    </VStack>
                                );
                            })}

                            {/* Local previews of ornament photos taken during the
                                exchange, if any — these are not yet uploaded, so
                                they render straight from the picker's local URIs. */}
                            {(data.ornamentPhotos?.length ?? 0) > 0 && (
                                <HStack space="sm" flexWrap="wrap" mt="$1">
                                    {data.ornamentPhotos!.map((p, i) => (
                                        <Image
                                            key={`${p.uri}_${i}`}
                                            source={{ uri: p.uri }}
                                            style={styles.exchangePhotoThumb}
                                        />
                                    ))}
                                </HStack>
                            )}
                        </VStack>
                    )}

                    {/* Subtotal only when GST comes between it and the Grand
                        Total below. This subtotal is already net of any
                        exchange (the rows above), so on a bill without GST it
                        is the grand total to the rupee, and showing both reads
                        as though one of the two must mean something different.
                        Its divider goes with it, or two separators end up
                        stacked with nothing between them. */}
                    {data.includeGst && (
                        <>
                            <Divider bg="$coolGray100" my="$1" />

                            <HStack justifyContent="space-between">
                                <Text fontSize="$sm" color="$coolGray500" fontWeight="$medium">{t("invoicePreview.subtotal")}</Text>
                                <Text fontSize="$sm" fontWeight="$bold" color="$coolGray800">{formatCurrencyValue(parseFloat(data.subtotal) || 0)}</Text>
                            </HStack>
                        </>
                    )}

                    {data.includeGst && (
                        <HStack justifyContent="space-between">
                            <Text fontSize="$sm" color="$coolGray500" fontWeight="$medium">{t("invoicePreview.gst")} ({shopDetails?.gstPercentage || 3}%)</Text>
                            <Text fontSize="$sm" fontWeight="$bold" color="$coolGray800">{formatCurrencyValue(parseFloat(data.gst) || 0)}</Text>
                        </HStack>
                    )}

                    <Box h={1} bg="$coolGray200" my="$2" style={{ borderStyle: 'dotted' }} />

                    <HStack justifyContent="space-between" alignItems="center">
                        <Text fontWeight="$black" fontSize="$xl" color="#6D5EF7">{t("invoicePreview.grandTotal")}</Text>
                        <Text fontWeight="$black" fontSize="$xl" color="#6D5EF7">{formatCurrencyValue(parseFloat(data.grandTotal) || 0)}</Text>
                    </HStack>

                    {!!data.paymentMethod && (
                        <HStack justifyContent="space-between" mt="$2">
                            <Text fontSize="$sm" color="$coolGray500" fontWeight="$medium">
                                {t("invoice.paymentMethod.title") || "Payment Mode"}
                            </Text>
                            <Text fontSize="$sm" fontWeight="$bold" color="$coolGray800">
                                {t(`invoice.paymentMethod.${data.paymentMethod}`) ||
                                    (data.paymentMethod === 'cash' ? 'Cash' : 'Online')}
                                {data.paymentMethod === 'online' && data.onlinePaymentType
                                    ? ` · ${t(`invoice.paymentMethod.${data.onlinePaymentType}`) || data.onlinePaymentType}`
                                    : ''}
                            </Text>
                        </HStack>
                    )}
                </VStack>
            </Box>
        </ScrollView>

        {/* Footer Buttons — the bar stays full-bleed so the border reads as a
            page edge, but its contents are capped to the same column as the
            header and body, matching InvoiceCreationScreen on desktop web. */}
        <Box
            p="$4"
            pb={Math.max(insets.bottom, 16)}
            bg="$white"
            borderTopWidth={1}
            borderTopColor="$coolGray100"
        >
            <HStack space="md" style={LAYOUT.isWeb ? LAYOUT.contentContainerStyle : {}}>
                <TouchableOpacity
                    onPress={onBack}
                    disabled={isLoading}
                    style={[styles.button, styles.cancelButton, isLoading && { opacity: 0.5 }]}
                >
                    <Text color="#D946EF" fontWeight="$bold">{t("common.cancel")}</Text>
                </TouchableOpacity>
                <Box flex={2}>
                {!!submitError && (
                    <Box bg="$red50" borderWidth={1} borderColor="$red200" rounded="$xl" p="$3" mb="$3" mx="$4">
                        <Text color="$red600" fontSize={13} fontWeight="$medium">{submitError}</Text>
                    </Box>
                )}
                    <GradientButton
                        label={isLoading ? "Saving..." : t("invoicePreview.buttons.confirmSave")}
                        onPress={onConfirm}
                        disabled={isLoading}
                    />
                </Box>
            </HStack>
        </Box>
    </Box>
    );
};

const styles = StyleSheet.create({
    button: {
        height: 56,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cancelButton: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#D946EF',
    },
    logo: {
        width: 64,
        height: 64,
        borderRadius: 12,
        marginBottom: 8,
    },
    exchangePhotoThumb: {
        width: 56,
        height: 56,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
});

export default InvoicePreviewScreen;

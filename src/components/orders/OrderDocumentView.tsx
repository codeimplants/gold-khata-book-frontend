import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { Box, Divider, HStack, Text, VStack } from '@gluestack-ui/themed';

import { useTranslation } from '../../hooks/useTranslation';
import {
  calculateItemMakingCharge,
  formatOtherChargesLabel,
  normalizeMakingType,
} from '../../utils/calculations';
import {
  formatCurrencyValue,
  formatMakingChargeDetail,
  formatNumber,
} from '../../utils/formatter';
import { inspectItemEntry } from '../../utils/itemPlausibility';
import { getFullImageUrl } from '../../utils/imageUtils';
import ItemPhotoThumbnails from '../items/ItemPhotoThumbnails';
import ExchangeTotalsRow from '../oldGold/ExchangeTotalsRow';

/**
 * The parts every order document shares: who it is for, what is on it, and what
 * it comes to.
 *
 * Full payment, advance and old-gold purchase each grew their own version of
 * these three sections, and they drifted - different labels, different columns,
 * item photos on one and not the others. This is the full-payment layout, which
 * is the one that reads best, extracted so all three use it.
 *
 * Extended by slots rather than by type flags. `afterItems` and `afterTotals`
 * let a caller add whatever only it has - payment history on an advance order,
 * ornaments and the declaration on a purchase - without this component learning
 * what those are. A type flag here would put every order type's exceptions in
 * one file and make each new one a change to shared code; a slot keeps them
 * where they belong and keeps this component the same shape as it grows.
 */

export interface OrderDocumentTotals {
  /** Overrides the derived figures, for a record whose totals are authoritative
   *  (a settled advance order reads them off the invoice it produced). */
  subTotal?: number;
  gstAmount?: number;
  grandTotal?: number;
}

interface OrderDocumentViewProps {
  /** Shop block at the top. Omit to render the document without a letterhead.
   *  Takes shopDetails as-is - it carries `shopName` on some paths and
   *  `name` on others, and picking one here would blank the header on the
   *  screens that use the other. */
  shop?: {
    shopName?: string;
    name?: string;
    address?: string;
    phone?: string | number;
    gst?: string;
    logo?: any;
  } | null;
  customer?: { name?: string; phone?: string } | null;
  /** ISO string or Date. */
  date?: string | Date;
  items: any[];
  /** Old gold taken in against this document, netted off the subtotal. */
  exchanges?: any[];
  /**
   * Photos of the exchange as a whole.
   *
   * Captured against the bill rather than against one ornament, which is how
   * every exchange before per-row photos was recorded - so they still have to
   * be shown, and they hang off the first metal row rather than appearing
   * twice.
   */
  exchangePhotos?: { url: string; fileId?: string }[];
  onExchangePhotoPress?: (index: number) => void;
  /** Opens the viewer for one exchange row's own photos. */
  onOrnamentPhotoPress?: (ornament: any, photoIndex: number) => void;
  /** Attaches photos to one exchange row. Index is into `exchanges`. */
  onAddOrnamentPhotos?: (ornament: any, ornamentIndex: number) => void;
  /** Omitted where the record cannot take new photos (a read-only view). */
  onAddExchangePhotos?: () => void;
  gstAmount?: number;
  /** Shown in the GST row's label, e.g. 3 renders "GST (3%)". */
  gstRatePercent?: number;
  /** Authoritative figures, where the caller has them. */
  totals?: OrderDocumentTotals;
  /** Opens the fullscreen viewer for one item's photos. */
  onPhotoPress?: (item: any, photoIndex: number) => void;
  /** Hides the rate column, for a document where a per-gram rate is meaningless. */
  showRate?: boolean;
  /**
   * Names the party the document is addressed to. Defaults to "Bill To",
   * which is wrong on a purchase: an old-gold declaration is money going
   * out to the person named, not a bill being sent to them.
   */
  partyLabel?: string;
  /**
   * Renders the caller's own totals instead of this component's.
   *
   * An old-gold purchase totals in grams as well as rupees, and weight is
   * the figure that matters on it - the shop is buying metal, not selling a
   * piece. Rather than teach this block a second kind of total, the screen
   * that needs one keeps its own and takes the header and item table.
   */
  showTotals?: boolean;
  afterItems?: React.ReactNode;
  afterTotals?: React.ReactNode;
}

const itemLabel = (item: any, fallback: string): string =>
  (item &&
    (item.itemName || item.name || item.productName || item.title)) ||
  fallback;

const netWeightOf = (item: any) =>
  Number(item?.netWeight ?? item?.netWt ?? item?.weight ?? 0) || 0;

const rateOf = (item: any) => Number(item?.rate ?? item?.ratePerGm ?? 0) || 0;

const OrderDocumentView = ({
  shop,
  customer,
  date,
  items,
  exchanges = [],
  exchangePhotos,
  onExchangePhotoPress,
  onOrnamentPhotoPress,
  onAddOrnamentPhotos,
  onAddExchangePhotos,
  gstAmount = 0,
  gstRatePercent,
  totals,
  onPhotoPress,
  showRate = true,
  partyLabel,
  showTotals = true,
  afterItems,
  afterTotals,
}: OrderDocumentViewProps) => {
  const { t } = useTranslation();
  const list = Array.isArray(items) ? items : [];
  const exList = Array.isArray(exchanges) ? exchanges : [];

  /**
   * The totals block, aggregated across every line.
   *
   * Deliberately derived here rather than taken apart by each screen: the
   * making-charge label in particular is only safe to print when every line
   * agrees on the type and the rate, and that rule was worth stating once.
   */
  const derived = React.useMemo(() => {
    let base = 0;
    let making = 0;
    let other = 0;
    let discount = 0;
    const percentRates = new Set<number>();
    const perGramRates = new Set<number>();
    const typesSeen = new Set<'percent' | 'pergram' | 'fixed'>();
    let unrecognized = false;

    list.forEach(item => {
      const rate = rateOf(item);
      base += netWeightOf(item) * rate;
      making += calculateItemMakingCharge(item, rate);
      other += Number(item.chargeAmount ?? item.otherChargesAmount ?? 0) || 0;
      discount += Number(item.discount ?? 0) || 0;

      const makingValue = Number(item.makingCharge ?? item.makingCharges ?? 0) || 0;
      if (makingValue > 0) {
        const type = normalizeMakingType(item.makingType || item.makingChargeType || '');
        if (type === '%' || type.startsWith('percent')) {
          typesSeen.add('percent');
          percentRates.add(makingValue);
        } else if (type.startsWith('pergram')) {
          typesSeen.add('pergram');
          perGramRates.add(makingValue);
        } else if (type.startsWith('fix')) {
          typesSeen.add('fixed');
        } else {
          unrecognized = true;
        }
      }
    });

    // Only label when every line shares one type and one rate - a single
    // bracket on a mixed invoice would misstate what was charged.
    let makingLabel = '';
    if (!unrecognized && typesSeen.size === 1) {
      const sole = Array.from(typesSeen)[0];
      if (sole === 'percent' && percentRates.size === 1) {
        makingLabel = ` (${Array.from(percentRates)[0]}%)`;
      } else if (sole === 'pergram' && perGramRates.size === 1) {
        const r = Array.from(perGramRates)[0];
        makingLabel = ` (₹${r % 1 === 0 ? r : r.toFixed(2)} / gm)`;
      } else if (sole === 'fixed') {
        makingLabel = ` (${t('invoice.dropdown.fixed') || 'Fixed'})`;
      }
    }

    const gold = exList.filter((ex: any) => ex.type === 'Gold');
    const silver = exList.filter((ex: any) => ex.type === 'Silver');
    const sumAmount = (rows: any[]) =>
      rows.reduce((sum: number, ex: any) => sum + (Number(ex.amount) || 0), 0);
    // netWt first: `weight` exists only on the legacy aggregate rows, so
    // reading it alone reported 0.000 gm for every per-item exchange.
    const sumWeight = (rows: any[]) =>
      rows.reduce(
        (sum: number, ex: any) => sum + (Number(ex.netWt ?? ex.weight ?? 0) || 0),
        0,
      );
    const goldTotal = sumAmount(gold);
    const silverTotal = sumAmount(silver);
    const exchangeTotal = goldTotal + silverTotal;

    const subTotal =
      totals?.subTotal ?? base + making + other - discount - exchangeTotal;
    const gst = totals?.gstAmount ?? gstAmount;
    const grandTotal = totals?.grandTotal ?? subTotal + gst;

    return {
      base, making, other, discount, makingLabel,
      gold, silver, goldTotal, silverTotal,
      goldWeight: sumWeight(gold), silverWeight: sumWeight(silver),
      exchangeTotal, subTotal, gst, grandTotal,
    };
  }, [list, exchanges, gstAmount, totals, t]);

  const gstLabel =
    gstRatePercent != null
      ? `${t('invoicePreview.gst') || 'GST'} (${gstRatePercent}%)`
      : t('invoicePreview.gst') || 'GST';

  return (
    <VStack>
      {!!shop && (
        <>
          <VStack alignItems="center" mb="$6">
            {!!getFullImageUrl(shop.logo) && (
              <Image
                source={{ uri: getFullImageUrl(shop.logo)! }}
                style={styles.shopLogo}
                resizeMode="contain"
              />
            )}
            <Text fontSize="$2xl" fontWeight="$black" color="#6D5EF7">
              {shop.shopName || shop.name || 'Gold Khata Book'}
            </Text>
            {!!shop.address && (
              <Text fontSize="$xs" color="$coolGray500" textAlign="center" mt="$1">
                {shop.address}
              </Text>
            )}
            {!!shop.phone && (
              <Text fontSize="$xs" color="$coolGray500">
                {t('invoicePreview.phone') || 'Phone'}: {shop.phone}
              </Text>
            )}
            {!!shop.gst && (
              <Text fontSize="$2xs" fontWeight="$bold" color="$coolGray400" mt="$1">
                GST: {shop.gst}
              </Text>
            )}
          </VStack>
          <Divider my="$2" bg="$coolGray100" />
        </>
      )}

      <HStack justifyContent="space-between" py="$4" mb="$4">
        <VStack alignItems="flex-start" flex={1} pr="$2">
          <Text
            color="$coolGray500"
            fontSize="$xs"
            fontWeight="$black"
            textTransform="uppercase"
          >
            {partyLabel || t('invoicePreview.billTo') || 'Bill To'}
          </Text>
          <Text color="$coolGray900" fontWeight="$black" fontSize="$lg">
            {customer?.name || t('orders.details.walkInCustomer') || 'Walk-in retailer'}
          </Text>
          {!!customer?.phone && (
            <Text color="$coolGray600" fontSize="$sm" mt="$1">
              {customer.phone}
            </Text>
          )}
        </VStack>
        {!!date && (
          <VStack alignItems="flex-end">
            <Text
              fontSize="$xs"
              color="$coolGray400"
              fontWeight="$bold"
              textTransform="uppercase"
            >
              {t('invoicePreview.date') || 'Date'}
            </Text>
            <Text fontWeight="$bold" color="$coolGray900">
              {new Date(date).toLocaleDateString()}
            </Text>
          </VStack>
        )}
      </HStack>

      <HStack pb="$2" borderBottomWidth={1} borderColor="$coolGray200">
        <Text
          flex={1.5}
          fontWeight="$black"
          fontSize="$2xs"
          color="$coolGray400"
          textTransform="uppercase"
        >
          {t('invoicePreview.table.item') || 'Item Details'}
        </Text>
        <Text
          flex={1}
          fontWeight="$black"
          fontSize="$2xs"
          color="$coolGray400"
          textTransform="uppercase"
          textAlign="center"
        >
          {t('invoicePreview.table.weight') || 'Weight (gm)'}
        </Text>
        {showRate && (
          <Text
            flex={1}
            fontWeight="$black"
            fontSize="$2xs"
            color="$coolGray400"
            textTransform="uppercase"
            textAlign="center"
          >
            {t('invoicePreview.table.rate') || 'Rate'}
          </Text>
        )}
        <Text
          flex={1}
          fontWeight="$black"
          fontSize="$2xs"
          color="$coolGray400"
          textTransform="uppercase"
          textAlign="right"
        >
          {t('invoicePreview.table.amount') || 'Amount'}
        </Text>
      </HStack>

      <VStack space="md" py="$4">
        {list.map((item: any, index: number) => {
          const rate = rateOf(item);
          const netWeight = netWeightOf(item);
          const makingDetail = formatMakingChargeDetail(
            item,
            t('bill.makingFixed') || 'Fixed',
          );
          const finding = inspectItemEntry({
            itemType: item.itemType || item.metalType,
            purity: item.purity,
            weight: netWeight,
            rate,
          });

          return (
            <HStack key={item.id || index} alignItems="flex-start">
              <VStack flex={1.5}>
                <Text fontWeight="$bold" fontSize="$sm" color="$coolGray800">
                  {itemLabel(item, t('orders.details.itemFallback') || 'Item')}
                </Text>
                <Text fontSize="$2xs" color="$coolGray400" fontWeight="$medium">
                  {[item.purity, item.pieces ? `${item.pieces} ${t('orders.details.piecesShort') || 'Pcs'}` : '']
                    .filter(Boolean)
                    .join(' • ')}
                </Text>
                {!!makingDetail && (
                  <Text fontSize="$2xs" color="$coolGray400">
                    {t('invoicePreview.makingCharges') || 'Making Charges'}: {makingDetail}
                  </Text>
                )}
                {/* A saved line whose weight/rate cannot be real. Shown here
                    only, never on the printed bill - the customer's copy should
                    not carry our doubt about the shop's data entry. */}
                {!!finding && (
                  <Text fontSize="$2xs" color="$amber700" mt="$1">
                    {finding.suggestedWeight !== undefined && finding.suggestedRate !== undefined
                      ? (t('invoicePreview.lineNeedsCheck') || '')
                          .replace(
                            '{weight}',
                            `${formatNumber(finding.suggestedWeight, 3)} ${t('common.gramShort')}`,
                          )
                          .replace(
                            '{rate}',
                            `${formatCurrencyValue(finding.suggestedRate)}/${t('common.gramShort')}`,
                          )
                      : t('invoicePreview.lineNeedsCheckPlain')}
                  </Text>
                )}
                {/* What the piece actually looked like - the one thing a bill
                    cannot describe, and the reason a shopkeeper opens an old
                    bill in the first place. */}
                <ItemPhotoThumbnails
                  photos={(item.photos || []) as any}
                  onPress={photoIndex => onPhotoPress?.(item, photoIndex)}
                />
              </VStack>
              <VStack flex={1} alignItems="center">
                <Text fontSize="$sm" fontWeight="$bold" color="$coolGray700">
                  {formatNumber(netWeight)}
                </Text>
              </VStack>
              {showRate && (
                <VStack flex={1} alignItems="center">
                  <Text fontSize="$sm" fontWeight="$bold" color="$coolGray700">
                    {formatCurrencyValue(rate).replace('₹', '')}
                  </Text>
                </VStack>
              )}
              <Text
                flex={1}
                fontSize="$sm"
                fontWeight="$black"
                color="$coolGray900"
                textAlign="right"
              >
                {formatCurrencyValue(netWeight * rate)}
              </Text>
            </HStack>
          );
        })}
      </VStack>

      {afterItems}

      {showTotals && (
        <>
      <Divider my="$2" bg="$coolGray100" />

      <VStack space="sm" mt="$2">
        <HStack justifyContent="space-between">
          <Text fontSize="$sm" color="$coolGray500" fontWeight="$medium">
            {t('invoicePreview.totalAmount') || 'Total Amount'}
          </Text>
          <Text fontSize="$sm" fontWeight="$bold" color="$coolGray800">
            {formatCurrencyValue(derived.base)}
          </Text>
        </HStack>

        {/* Every charge row hides at zero, like the printed bill: a shop that
            does not charge making should not have a row saying it charged
            nothing. */}
        {derived.making > 0 && (
          <HStack justifyContent="space-between">
            <Text fontSize="$sm" color="$coolGray500" fontWeight="$medium">
              {(t('invoicePreview.makingCharges') || 'Making Charges') + derived.makingLabel}
            </Text>
            <Text fontSize="$sm" fontWeight="$bold" color="$coolGray800">
              {formatCurrencyValue(derived.making)}
            </Text>
          </HStack>
        )}

        {derived.other > 0 && (
          <HStack justifyContent="space-between">
            <Text fontSize="$sm" color="$coolGray500" fontWeight="$medium" flex={1} mr="$2">
              {formatOtherChargesLabel(
                t('invoicePreview.otherCharges') || 'Other Charges',
                list,
              )}
            </Text>
            <Text fontSize="$sm" fontWeight="$bold" color="$coolGray800">
              {formatCurrencyValue(derived.other)}
            </Text>
          </HStack>
        )}

        {derived.discount !== 0 && (
          <HStack justifyContent="space-between">
            <Text fontSize="$sm" fontWeight="$medium" color="$coolGray500">
              {t('invoicePreview.totalDiscount') || 'Total Discount'}
            </Text>
            <Text fontSize="$sm" fontWeight="$bold" color="$red400">
              - {formatCurrencyValue(derived.discount)}
            </Text>
          </HStack>
        )}

        {/* Expandable per metal, carrying the ornament breakdown and the
            exchange photos. A flat "- Rs X" line lost the weight, what was
            handed over, and the photos entirely. */}
        {derived.goldTotal > 0 && (
          <ExchangeTotalsRow
            label={t('invoicePreview.goldExchange') || 'Gold Exchange'}
            weightGm={derived.goldWeight}
            amount={derived.goldTotal}
            ornaments={derived.gold}
            photos={exchangePhotos}
            onPhotoPress={onExchangePhotoPress}
            onOrnamentPhotoPress={onOrnamentPhotoPress}
            // The upload addresses a row by its index in the stored list, and
            // this component shows gold and silver as two lists - so the index
            // the row hands back is looked up rather than trusted.
            onAddOrnamentPhotos={
              onAddOrnamentPhotos
                ? ornament =>
                    onAddOrnamentPhotos(ornament, exList.indexOf(ornament))
                : undefined
            }
            onAddPhotos={onAddExchangePhotos}
            formatAmount={formatCurrencyValue}
          />
        )}

        {derived.silverTotal > 0 && (
          <ExchangeTotalsRow
            label={t('invoicePreview.silverExchange') || 'Silver Exchange'}
            weightGm={derived.silverWeight}
            amount={derived.silverTotal}
            ornaments={derived.silver}
            onAddOrnamentPhotos={
              onAddOrnamentPhotos
                ? ornament =>
                    onAddOrnamentPhotos(ornament, exList.indexOf(ornament))
                : undefined
            }
            // Only when gold is not already carrying them, so the one shared
            // set has exactly one place to be shown and added.
            photos={derived.goldTotal > 0 ? [] : exchangePhotos}
            onPhotoPress={onExchangePhotoPress}
            onOrnamentPhotoPress={onOrnamentPhotoPress}
            onAddPhotos={derived.goldTotal > 0 ? undefined : onAddExchangePhotos}
            formatAmount={formatCurrencyValue}
          />
        )}

        {/* Subtotal only when GST sits between it and the Grand Total.
            It is already net of any exchange, so on a bill without GST it
            equals the grand total to the rupee and the two rows read as
            though one of them must mean something else. */}
        {derived.gst > 0 && (
          <>
            <Divider my="$1" bg="$coolGray100" />
            <HStack justifyContent="space-between">
              <Text fontSize="$sm" color="$coolGray500" fontWeight="$medium">
                {t('invoicePreview.subtotal') || 'Sub Total'}
              </Text>
              <Text fontSize="$sm" fontWeight="$bold" color="$coolGray800">
                {formatCurrencyValue(derived.subTotal)}
              </Text>
            </HStack>
          </>
        )}

        {derived.gst > 0 && (
          <HStack justifyContent="space-between">
            <Text fontSize="$sm" color="$coolGray500" fontWeight="$medium">
              {gstLabel}
            </Text>
            <Text fontSize="$sm" fontWeight="$bold" color="$coolGray800">
              {formatCurrencyValue(derived.gst)}
            </Text>
          </HStack>
        )}

        <Divider my="$1" bg="$coolGray100" />

        <HStack justifyContent="space-between" alignItems="center">
          <Text fontSize="$lg" fontWeight="$black" color="#6D5EF7">
            {t('invoicePreview.grandTotal') || 'Grand Total'}
          </Text>
          <Text fontSize="$lg" fontWeight="$black" color="#6D5EF7">
            {formatCurrencyValue(derived.grandTotal)}
          </Text>
        </HStack>
      </VStack>
        </>
      )}

      {afterTotals}
    </VStack>
  );
};

const styles = StyleSheet.create({
  shopLogo: { width: 64, height: 64, marginBottom: 8 },
});

export default OrderDocumentView;

import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Box, HStack, VStack, Text, Icon } from '@gluestack-ui/themed';
import { Camera, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react-native';
import { useTranslation } from '../../hooks/useTranslation';
import { formatNumber } from '../../utils/formatter';
import { getFullImageUrl } from '../../utils/imageUtils';
import AddPhotosButton from '../photos/AddPhotosButton';
import ItemPhotoThumbnails from '../items/ItemPhotoThumbnails';
import type { ViewablePhoto } from './OrnamentPhotoViewer';

interface ExchangeTotalsRowProps {
  /** "Gold Exchange" / "Silver Exchange". */
  label: string;
  /** Summed net weight for this metal. 0 hides the "(n gm)" suffix. */
  weightGm: number;
  amount: number;
  /** The exchange rows for this metal. */
  ornaments: any[];
  /**
   * Photos for the exchange as a whole. They are captured per order, not per
   * metal, so the caller passes them to one row only (see OrderDetailsScreen).
   */
  photos?: ViewablePhoto[];
  onPhotoPress?: (index: number) => void;
  /**
   * Opens the viewer for one ornament's own photos.
   *
   * Separate from onPhotoPress, which pages the bill-wide set: these belong
   * to a specific row, so the viewer has to be told which list as well as
   * where to start in it.
   */
  onOrnamentPhotoPress?: (ornament: any, photoIndex: number) => void;
  /**
   * Attaches photos to one ornament. Sits beside that ornament's own
   * thumbnails, because the photo being added is of that piece - the
   * bill-wide button below could only ever add to the shared set.
   */
  onAddOrnamentPhotos?: (ornament: any, ornamentIndex: number) => void;
  /**
   * Opens the attach-photos flow. Given to the same single row that receives
   * `photos`, so the two never appear on both metals at once.
   */
  onAddPhotos?: () => void;
  formatAmount: (value: number) => string;
}

/**
 * One exchange line inside the invoice/order totals block, which expands in
 * place to show the ornaments behind it and their photos.
 *
 * Replaces a separate "Old Ornaments" card that repeated the same amount lower
 * down the screen. Two places showing one fact is how a weight mismatch between
 * them went unnoticed; this keeps the money and its explanation together.
 *
 * The row only becomes interactive when there is genuinely more to show. An
 * exchange recorded as nothing but a name and an amount stays a plain totals
 * line, with no chevron to invite a tap that would reveal nothing.
 *
 * Shared deliberately: the advance-order detail view shows the same ornaments
 * and needs identical behaviour. (Its weight-settlement figure is a different
 * fact — how much booked weight the exchange covered — and stays in the payment
 * section rather than here.)
 */
const ExchangeTotalsRow = ({
  label,
  weightGm,
  amount,
  ornaments,
  photos = [],
  onPhotoPress,
  onOrnamentPhotoPress,
  onAddOrnamentPhotos,
  onAddPhotos,
  formatAmount,
}: ExchangeTotalsRowProps) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const hasOrnamentDetail = ornaments.some(
    ex =>
      ex.itemName ||
      Number(ex.netWt || ex.weight) > 0 ||
      ex.purity ||
      Number(ex.ratePerGm) > 0,
  );
  // `onAddPhotos` counts: with no photos yet and nothing else to show, the row
  // would otherwise be inert — which is exactly the state of a record finished
  // on a desktop, where the photos are the thing still missing.
  // Every photo the row holds, per ornament plus the shared set. Counting
  // only the shared one made a bill whose photos are all per-ornament
  // announce "No photos" in amber directly above the photos themselves.
  const ornamentPhotoCount = ornaments.reduce(
    (sum: number, ex: any) => sum + ((ex.photos || []).length || 0),
    0,
  );
  const totalPhotoCount = photos.length + ornamentPhotoCount;
  const canAddPhotos = !!onAddPhotos || !!onAddOrnamentPhotos;
  const canExpand = hasOrnamentDetail || totalPhotoCount > 0 || canAddPhotos;
  /** Shown collapsed, so "no photos" is legible without opening the row. */
  const showPhotoBadge = canAddPhotos || totalPhotoCount > 0;

  const header = (
    <HStack justifyContent="space-between" alignItems="center">
      <HStack alignItems="center" space="xs" flex={1}>
        <Text fontSize="$sm" fontWeight="$medium">
          {label}
          {/* formatNumber, not toFixed: this reads as inline prose, so a whole
              number should say "19 gm" rather than "19.000 gm". Fractions are
              kept to 3 places, so 18.621 is unaffected. */}
          {weightGm > 0 ? ` (${formatNumber(weightGm)} gm)` : ''}
        </Text>
        {showPhotoBadge && (
          <HStack alignItems="center" space="xs">
            <Icon
              as={Camera}
              size="xs"
              color={totalPhotoCount > 0 ? '$coolGray400' : '#F59E0B'}
            />
            <Text
              fontSize="$2xs"
              color={totalPhotoCount > 0 ? '$coolGray400' : '#B45309'}
            >
              {totalPhotoCount > 0
                ? String(totalPhotoCount)
                : t('declaration.photos.noPhotos') || 'No photos'}
            </Text>
          </HStack>
        )}
        {canExpand && (
          <Icon
            as={expanded ? ChevronUp : ChevronDown}
            size="xs"
            color="$coolGray400"
          />
        )}
      </HStack>
      <Text fontSize="$sm" fontWeight="$bold" color="$red400">
        -{formatAmount(amount)}
      </Text>
    </HStack>
  );

  return (
    <VStack>
      {canExpand ? (
        <Pressable onPress={() => setExpanded(v => !v)}>{header}</Pressable>
      ) : (
        header
      )}

      {expanded && (
        <Box
          mt="$2"
          mb="$1"
          ml="$2"
          pl="$3"
          borderLeftWidth={2}
          borderLeftColor="$coolGray100"
        >
          <VStack space="sm">
            {ornaments.map((ex: any, idx: number) => {
              const netWt = ex.netWt || ex.weight;
              const details = [
                Number(netWt) > 0 ? `${formatNumber(netWt)} gm` : null,
                ex.purity || null,
                Number(ex.ratePerGm) > 0
                  ? `@ ₹${formatNumber(ex.ratePerGm, 2)}/gm`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ');

              return (
                <HStack
                  key={ex.id || idx}
                  justifyContent="space-between"
                  alignItems="flex-start"
                  space="md"
                >
                  <VStack flex={1}>
                    <Text fontSize="$xs" fontWeight="$medium" color="$coolGray700">
                      {ex.itemName || `${ex.type || 'Gold'} ${t('invoice.exchange.exchange_short') || 'Exchange'}`}
                    </Text>
                    {!!details && (
                      <Text fontSize="$2xs" color="$coolGray400">
                        {details}
                      </Text>
                    )}
                    {/* This ornament's own photos, which is what makes a photo
                        answer "which piece was this?". The bill-wide set below
                        predates per-row photos and is shown separately. */}
                    <HStack alignItems="center" space="sm" mt="$1">
                      <ItemPhotoThumbnails
                        photos={(ex.photos || []) as any}
                        onPress={photoIndex =>
                          onOrnamentPhotoPress?.(ex, photoIndex)
                        }
                      />
                      {!!onAddOrnamentPhotos && (
                        <AddPhotosButton
                          variant="tile"
                          tileSize={44}
                          label={t('declaration.photos.addPhotos') || 'Add Photos'}
                          onPress={() => onAddOrnamentPhotos(ex, idx)}
                          accessibilityLabel={t('declaration.photos.addPhotos') || 'Add photos'}
                        />
                      )}
                    </HStack>
                  </VStack>
                  <Text fontSize="$xs" color="$coolGray500">
                    -{formatAmount(Number(ex.amount || 0))}
                  </Text>
                </HStack>
              );
            })}
          </VStack>

          {/* The shared set, shown only when it actually holds something.

              It used to render empty-but-addable, because it was the only way
              to attach a photo to an exchange. Photos now go on the ornament
              they are of, so an empty shared block is a heading and a button
              for a thing nobody should be adding to any more - and on a bill
              whose photos are all per-ornament it appeared directly below
              them, reading as though those did not count. Bills recorded
              before per-row photos keep theirs, and keep showing them. */}
          {photos.length > 0 && (
            <VStack mt="$3">
              <Text
                fontSize="$2xs"
                fontWeight="$bold"
                color="$coolGray400"
                textTransform="uppercase"
                mb="$2"
              >
                {t('declaration.photos.title') || 'Ornament Photos'}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <HStack space="sm">
                  {photos.map((p, i) => (
                    <Pressable
                      key={p.fileId || `${p.url}_${i}`}
                      onPress={() => onPhotoPress?.(i)}
                      accessibilityLabel={t('declaration.photos.title') || 'Ornament photo'}
                    >
                      <Image
                        source={{ uri: getFullImageUrl(p.url) || p.url }}
                        style={styles.thumb}
                      />
                    </Pressable>
                  ))}
                  {/* Kept alongside the photos it manages. Removing it left a
                      bill recorded before per-row photos with no way to reach
                      the sheet its delete lives in - the block renders only
                      when it holds something, so this cannot invite adding to
                      the shared set on a bill that has none. */}
                  {!!onAddPhotos && (
                    <AddPhotosButton
                      variant="tile"
                      label={t('declaration.photos.addPhotos') || 'Add Photos'}
                      onPress={onAddPhotos}
                      accessibilityLabel={t('declaration.photos.addPhotos') || 'Add photos'}
                    />
                  )}
                </HStack>
              </ScrollView>
              {photos.length > 0 && (
                <HStack alignItems="center" space="xs" mt="$1">
                  <Text fontSize="$2xs" color="$coolGray400">
                    {t('declaration.photos.tapToEnlarge') || 'Tap a photo to enlarge'}
                  </Text>
                  <Icon as={ChevronRight} size="xs" color="$coolGray300" />
                </HStack>
              )}
            </VStack>
          )}
        </Box>
      )}
    </VStack>
  );
};

const styles = StyleSheet.create({
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
});

export default ExchangeTotalsRow;

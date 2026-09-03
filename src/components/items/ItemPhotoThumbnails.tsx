import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { HStack, Box, Text, Pressable } from '@gluestack-ui/themed';
import { useTranslation } from '../../hooks/useTranslation';
import { getFullImageUrl } from '../../utils/imageUtils';
import type { DeclarationPhoto } from '../../types';

interface ItemPhotoThumbnailsProps {
  photos: DeclarationPhoto[];
  /** Opens the full-screen viewer at this photo. */
  onPress?: (index: number) => void;
  size?: number;
  /** How many to show before collapsing the rest into a "+N" tile. */
  maxVisible?: number;
}

/**
 * The row of item photos on a read-only bill or order.
 *
 * Thumbnails rather than a count or an icon: the whole point is recognising a
 * piece at a glance, and "3 photos" makes the shopkeeper open something to find
 * out whether it is the right item. Small enough to sit under an item row
 * without pushing the price off the card, tappable for the full-size viewer the
 * screen already has for exchange photos.
 *
 * Overflow collapses into a "+N" tile instead of wrapping — an item row is one
 * line of a table, and a second row of thumbnails would break the alignment
 * between every item's weight, rate and amount.
 */
const ItemPhotoThumbnails = ({
  photos,
  onPress,
  size = 44,
  maxVisible = 3,
}: ItemPhotoThumbnailsProps) => {
  const { t } = useTranslation();
  if (!photos?.length) return null;

  const visible = photos.slice(0, maxVisible);
  const overflow = photos.length - visible.length;

  return (
    <HStack space="xs" mt="$1" alignItems="center">
      {visible.map((photo, index) => (
        <Pressable
          key={photo.fileId || photo.url || index}
          onPress={onPress ? () => onPress(index) : undefined}
          accessibilityRole="imagebutton"
          accessibilityLabel={t('itemPhotos.viewPhoto')}
        >
          <Image
            source={{ uri: getFullImageUrl(photo.url) || undefined }}
            style={[styles.thumb, { width: size, height: size }]}
            resizeMode="cover"
          />
        </Pressable>
      ))}
      {overflow > 0 && (
        <Pressable
          onPress={onPress ? () => onPress(maxVisible) : undefined}
          accessibilityRole="button"
        >
          <Box
            style={[styles.thumb, styles.overflow, { width: size, height: size }]}
            alignItems="center"
            justifyContent="center"
          >
            <Text fontSize="$xs" fontWeight="$bold" color="$coolGray600">
              +{overflow}
            </Text>
          </Box>
        </Pressable>
      )}
    </HStack>
  );
};

const styles = StyleSheet.create({
  thumb: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F3F4F6',
  },
  overflow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ItemPhotoThumbnails;

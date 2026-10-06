import React from 'react';
import { Box, HStack, Icon, Pressable, Text, VStack } from '@gluestack-ui/themed';
import { Plus } from 'lucide-react-native';

import { Brand } from '../../theme/brand';

/**
 * The one "add photos" affordance in the app.
 *
 * Every photo control used a dashed violet outline on a near-white fill, which
 * read as a disabled placeholder rather than something to press. It is a solid
 * primary-action fill instead, so adding a photo looks like an action, not an
 * empty slot.
 *
 * Two shapes, one fill: `pill` for a standalone button under a photo strip,
 * `tile` for the square that sits inline among 64px thumbnails, where a pill
 * would break the grid.
 *
 * The fill was SoneBill's purple-to-pink gradient: an SVG on native, sized
 * from a measured layout because a percentage-width SVG painted nothing, and
 * CSS on web. It is flat ledger green now (src/theme/brand.ts), because
 * gradients were the most recognisable part of the look App Review rejected
 * under guideline 4.3(a). A flat fill needs no measuring, so that machinery is
 * gone too.
 */

interface AddPhotosButtonProps {
  label: string;
  onPress: () => void;
  /** Shorter pill for dense contexts, e.g. inside an invoice item card. */
  compact?: boolean;
  variant?: 'pill' | 'tile';
  /**
   * Square size for the tile variant, to match whatever thumbnails it sits
   * beside. Defaults to 64, which is the grid in the photo fields; the
   * exchange rows draw 44px thumbnails and a 64px tile beside them read as a
   * different kind of control rather than one more square in the row.
   */
  tileSize?: number;
  accessibilityLabel?: string;
}

const TILE_SIZE = 64;

const AddPhotosButton = ({
  label,
  onPress,
  compact = false,
  variant = 'pill',
  tileSize,
  accessibilityLabel,
}: AddPhotosButtonProps) => {
  const isTile = variant === 'tile';
  const tile = tileSize ?? TILE_SIZE;
  const height = isTile ? tile : compact ? 34 : 40;
  // Below about 56px the label cannot be read and only crowds the plus, so a
  // small tile carries the icon alone and leans on its accessibility label.
  const showTileLabel = tile >= 56;
  // The same 8pt corner as every other Ledger button (src/theme/brand.ts). It
  // was a fully round pill, SoneBill's shape.
  const radius = 8;

  // Flat ledger green, like every primary action (see the note at the top).
  const surface = {
    height,
    borderRadius: radius,
    overflow: 'hidden' as const,
    backgroundColor: Brand.primary,
  };

  if (isTile) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || label}
      >
        <Box style={[surface, { width: tile }]}>
          <VStack flex={1} alignItems="center" justifyContent="center" space="xs" px="$1">
            <Icon as={Plus} size={showTileLabel ? "sm" : "md"} color="$white" />
            {showTileLabel && (
              <Text fontSize={10} color="$white" fontWeight="$medium" textAlign="center">
                {label}
              </Text>
            )}
          </VStack>
        </Box>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      style={{ alignSelf: 'flex-start' }}
    >
      <Box
        style={[surface, { paddingHorizontal: compact ? 14 : 18 }]}
      >
        <HStack flex={1} space="xs" alignItems="center" justifyContent="center">
          <Icon as={Plus} size={compact ? 'xs' : 'sm'} color="$white" />
          <Text
            fontSize={compact ? 12 : 14}
            fontWeight="$bold"
            color="$white"
          >
            {label}
          </Text>
        </HStack>
      </Box>
    </Pressable>
  );
};


export default AddPhotosButton;

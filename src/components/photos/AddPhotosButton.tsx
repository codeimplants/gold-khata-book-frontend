import React from 'react';
import { LayoutChangeEvent, Platform, StyleSheet } from 'react-native';
import { Box, HStack, Icon, Pressable, Text, VStack } from '@gluestack-ui/themed';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Plus } from 'lucide-react-native';

import { AppColors } from '../../theme/colors';

/**
 * The one "add photos" affordance in the app.
 *
 * Every photo control used a dashed violet outline on a near-white fill, which
 * read as a disabled placeholder rather than something to press. This is the
 * same purple-to-pink gradient as GradientButton — the app's primary action
 * colour — so adding a photo now looks like an action instead of an empty slot.
 *
 * Two shapes, one gradient: `pill` for a standalone button under a photo strip,
 * `tile` for the square that sits inline among 64px thumbnails, where a pill
 * would break the grid.
 *
 * The gradient is drawn per platform for the same reason GradientButton does it:
 * react-native-svg on native, a CSS gradient on web. There is no
 * react-native-linear-gradient in this project and adding one for a button would
 * be a native dependency for something SVG already covers.
 *
 * The native `<Svg>` is sized from a measured layout, never `width="100%"`. A
 * percentage needs a resolvable viewport, and the pill has no explicit width —
 * it is sized by its own label and padding — so react-native-svg resolved it to
 * zero and painted nothing. The button then showed the solid `purple500`
 * fallback underneath, which is why Android and iOS looked flat next to web's
 * CSS gradient. Measuring gives real pixels, and lets the rounded rect carry the
 * same radius as the container instead of relying on `overflow: hidden` alone.
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
  // A pill is fully round; the tile keeps a soft corner so it sits with the
  // square thumbnails beside it rather than fighting them.
  const radius = isTile ? (tile >= 56 ? 14 : 10) : height / 2;

  // Unique per instance: two gradients sharing an id would collide, and several
  // of these can be on screen at once (one per item card on an invoice).
  const gradId = React.useMemo(
    () => `addPhotosGrad_${Math.random().toString(36).slice(2, 11)}`,
    [],
  );

  const isNative = Platform.OS !== 'web';
  // The tile is a known square; only the pill has to be measured.
  const [width, setWidth] = React.useState(isTile ? tile : 0);
  const onLayout = React.useCallback(
    (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width),
    [],
  );

  const gradient =
    isNative && width > 0 ? (
      <Svg width={width} height={height} style={styles.gradientLayer}>
        <Defs>
          {/* userSpaceOnUse over the measured box, so the ramp runs corner to
              corner in real pixels and matches web's `135deg`. In the default
              objectBoundingBox units a wide, short pill squashes the diagonal
              and lands short of the pink end. */}
          <LinearGradient
            id={gradId}
            x1="0"
            y1="0"
            x2={width}
            y2={height}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={AppColors.purple500} />
            <Stop offset="1" stopColor={AppColors.pink500} />
          </LinearGradient>
        </Defs>
        <Rect
          x="0"
          y="0"
          width={width}
          height={height}
          rx={radius}
          fill={`url(#${gradId})`}
        />
      </Svg>
    ) : null;

  const surface = {
    height,
    borderRadius: radius,
    overflow: 'hidden' as const,
    // Solid fallback so the control is never transparent for the frame before
    // the SVG paints, and so web has a colour under the CSS gradient.
    backgroundColor: AppColors.purple500,
    ...Platform.select({
      web: {
        backgroundImage: `linear-gradient(135deg, ${AppColors.purple500}, ${AppColors.pink500})`,
        boxShadow: '0 4px 14px -4px rgba(139, 92, 246, 0.45)',
      },
      android: { elevation: 3 },
      ios: {
        shadowColor: AppColors.purple500,
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      },
      default: {},
    }),
  };

  if (isTile) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || label}
      >
        <Box style={[surface, { width: tile }]}>
          {gradient}
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
        onLayout={isNative ? onLayout : undefined}
      >
        {gradient}
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

const styles = StyleSheet.create({
  // Pinned by origin only — the Svg carries its own measured width/height, and
  // an absoluteFill's right/bottom would fight them.
  gradientLayer: { position: 'absolute', left: 0, top: 0 },
});

export default AddPhotosButton;

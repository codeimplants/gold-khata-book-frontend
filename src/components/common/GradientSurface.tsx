import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

type GradientSurfaceProps = {
  colors: string[];
  borderRadius?: number;
  /** Kept so existing callers compile. The surface is flat. */
  direction?: 'horizontal' | 'diagonal';
  style?: StyleProp<ViewStyle>;
};

/**
 * Background fill for headers, cards and modal tops.
 *
 * This used to draw a gradient: an SVG on native, CSS on web. Gradients were
 * the most recognisable part of SoneBill's look, and App Review rejected this
 * app as a SoneBill copy under guideline 4.3(a) (see APP_STORE_4.3_REWORK.md).
 * The Ledger design language (src/theme/brand.ts) is flat, so this now paints
 * the first colour solid. The name and props stay so the 13 call sites did not
 * all have to change at once. New code should set a backgroundColor instead.
 */
const GradientSurface = ({ colors, borderRadius = 0, style }: GradientSurfaceProps) => (
  <View
    pointerEvents="none"
    style={[
      StyleSheet.absoluteFill,
      { borderRadius, overflow: 'hidden', backgroundColor: colors[0], zIndex: -1 },
      style,
    ]}
  />
);

export default GradientSurface;

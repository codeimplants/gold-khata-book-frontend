import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { TwilightGradient } from '../../theme/brand';

/**
 * The twilight band behind the header and the login cover: sapphire into
 * peacock. It is the only gradient in the app, and src/theme/brand.ts says
 * where it may go (not the tab bar, buttons, cards or icon chips).
 *
 * On web, webpack swaps react-native-linear-gradient for
 * src/mocks/react-native-linear-gradient.js, which draws the same direction
 * with a CSS gradient.
 */
export default function TwilightBand({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  return (
    <LinearGradient
      colors={TwilightGradient.colors}
      start={TwilightGradient.start}
      end={TwilightGradient.end}
      style={style}
    >
      {children}
    </LinearGradient>
  );
}

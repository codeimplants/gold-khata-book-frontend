import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

type GradientSurfaceProps = {
  colors: string[];
  borderRadius?: number;
  direction?: 'horizontal' | 'diagonal';
  style?: StyleProp<ViewStyle>;
};

const GradientSurface = ({
  colors,
  borderRadius = 0,
  direction = 'diagonal',
  style,
}: GradientSurfaceProps) => {
  const gradientId = React.useMemo(
    () => `grad_${Math.random().toString(16).slice(2)}`,
    []
  );

  const stops = colors.map((color, index) => {
    const offset =
      colors.length === 1 ? '0%' : `${(index / (colors.length - 1)) * 100}%`;
    return <Stop key={`${gradientId}_${index}`} offset={offset} stopColor={color} />;
  });

  if (Platform.OS === 'web') {
    const angle = direction === 'horizontal' ? '90deg' : '135deg';
    return (
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius,
            overflow: 'hidden',
            backgroundColor: colors[0],
            zIndex: -1,
          },
          {
            background: `linear-gradient(${angle}, ${colors.join(', ')})`,
          } as ViewStyle,
          style,
        ]}
      />
    );
  }

  const gradientProps =
    direction === 'horizontal'
      ? { x1: '0', y1: '0', x2: '1', y2: '0' }
      : { x1: '0', y1: '0', x2: '1', y2: '1' };

  return (
    <Svg
      pointerEvents="none"
      width="100%"
      height="100%"
      style={[StyleSheet.absoluteFill, style]}
    >
      <Defs>
        <LinearGradient id={gradientId} {...gradientProps}>
          {stops}
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" rx={borderRadius} ry={borderRadius} fill={`url(#${gradientId})`} />
    </Svg>
  );
};

export default GradientSurface;

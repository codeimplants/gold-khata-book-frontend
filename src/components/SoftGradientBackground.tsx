import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { AppColors } from '../theme/colors';

const SoftGradientBackground = () => {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <LinearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={AppColors.bgSoft1} />
          <Stop offset="0.5" stopColor={AppColors.bgSoft2} />
          <Stop offset="1" stopColor={AppColors.bgSoft3} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#bgGrad)" />
    </Svg>
  );
};

export default SoftGradientBackground;

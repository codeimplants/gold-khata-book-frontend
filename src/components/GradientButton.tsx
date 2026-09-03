import React from 'react';
import { Pressable, ActivityIndicator, Platform } from 'react-native';
import { Box, HStack, Text } from '@gluestack-ui/themed';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { ArrowRight } from 'lucide-react-native';
import { AppColors } from '../theme/colors';
import { useAppSelector } from '../store/hooks';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  showArrow?: boolean;
  style?: any;
  colors?: [string, string];
};

const BUTTON_HEIGHT = 40;

const GradientButton: React.FC<Props> = ({
  label,
  onPress,
  disabled,
  loading: localLoading,
  showArrow,
  style,
  colors
}) => {
  const isGlobalLoading = useAppSelector(state => state.ui.isGlobalLoading);
  const isLoading = localLoading || isGlobalLoading;
  const isDisabled = disabled || isLoading;

  const gradId = React.useMemo(() => `btnGrad_${Math.random().toString(36).substr(2, 9)}`, []);

  const startColor = colors ? colors[0] : AppColors.purple500;
  const endColor = colors ? colors[1] : AppColors.pink500;

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      style={[
        {
          width: '100%',
          opacity: isDisabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <Box
        rounded="$xl"
        overflow="hidden"
        style={[
          {
            height: BUTTON_HEIGHT,
            width: '100%',
            backgroundColor: isDisabled ? '#9CA3AF' : '#6D5EF7',
          },
          Platform.OS === 'web' && {
            // Always show gradient on web; opacity on Pressable handles disabled dimming
            backgroundImage: 'linear-gradient(135deg, hsl(252 100% 67%), hsl(330 85% 60%))',
            backgroundColor: '#6D5EF7',
            boxShadow: isDisabled ? 'none' : '0 4px 20px -4px hsl(252 100% 67% / 0.35)',
            display: 'flex',
            width: '100%',
          } as any,
        ]}
      >
        {Platform.OS !== 'web' && (
          <Svg height={BUTTON_HEIGHT} width="100%" style={{ position: 'absolute' }}>
            <Defs>
              <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={isDisabled ? '#9CA3AF' : startColor} />
                <Stop offset="1" stopColor={isDisabled ? '#6B7280' : endColor} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height={BUTTON_HEIGHT} rx="14" fill={`url(#${gradId})`} />
          </Svg>
        )}

        <Box h={BUTTON_HEIGHT} alignItems="center" justifyContent="center">
          {isLoading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <HStack alignItems="center" space="sm">
              <Text color="$white" fontWeight="$bold">{label}</Text>
              {showArrow && <ArrowRight size={16} color="white" />}
            </HStack>
          )}
        </Box>
      </Box>
    </Pressable>
  );
};

export default GradientButton;

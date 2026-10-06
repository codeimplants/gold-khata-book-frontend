import React from 'react';
import { Pressable, ActivityIndicator } from 'react-native';
import { Box, HStack, Text } from '@gluestack-ui/themed';
import { ArrowRight } from 'lucide-react-native';
import { useAppSelector } from '../store/hooks';
import { Brand } from '../theme/brand';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  showArrow?: boolean;
  style?: any;
  /** A solid fill colour. Only the first entry is used; kept as a pair so existing callers compile. */
  colors?: [string, string];
};

// 44pt is the smallest reliable touch target on iOS. This was 40.
const BUTTON_HEIGHT = 44;

/**
 * The primary call-to-action button.
 *
 * Despite the name it is flat now, a solid ledger green with an 8pt radius.
 * It was SoneBill's violet-to-pink gradient (an SVG on native, CSS on web, with
 * a coloured glow), the most recognisable piece of the look App Review
 * rejected under guideline 4.3(a). See src/theme/brand.ts and
 * APP_STORE_4.3_REWORK.md. Renaming it would touch every form for no change in
 * behaviour, so the name stays.
 */
const GradientButton: React.FC<Props> = ({
  label,
  onPress,
  disabled,
  loading: localLoading,
  showArrow,
  style,
  colors,
}) => {
  const isGlobalLoading = useAppSelector(state => state.ui.isGlobalLoading);
  const isLoading = localLoading || isGlobalLoading;
  const isDisabled = disabled || isLoading;
  const fill = isDisabled ? Brand.inkFaint : colors ? colors[0] : Brand.primary;

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        { width: '100%', opacity: isDisabled ? 0.6 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      <Box
        h={BUTTON_HEIGHT}
        w="100%"
        alignItems="center"
        justifyContent="center"
        style={{ borderRadius: 8, backgroundColor: fill }}
      >
        {isLoading ? (
          <ActivityIndicator color="white" size="small" />
        ) : (
          <HStack alignItems="center" space="sm">
            <Text color="$white" fontWeight="$semibold" fontSize="$md">{label}</Text>
            {showArrow && <ArrowRight size={16} color="white" />}
          </HStack>
        )}
      </Box>
    </Pressable>
  );
};

export default GradientButton;

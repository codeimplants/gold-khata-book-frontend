import React from 'react';
import { Modal, Platform, Keyboard, KeyboardAvoidingView, StyleSheet } from 'react-native';
import {
  Box, HStack, Text, Pressable, Icon,
} from '@gluestack-ui/themed';
import { X, TrendingUp } from 'lucide-react-native';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppDispatch } from '../../store/hooks';
import { setShopRate, clearShopRate } from '../../store/data/dataSlice';
import { useSheetBottomInset } from '../../hooks/useSheetBottomInset';
import GradientSurface from './GradientSurface';
import FloatingLabelInput from './FloatingLabelInput';
import { toast } from './Toast';
import { formatCurrencyValue } from '../../utils/formatter';
import { LAYOUT } from '../../constants/layout';

const num = (v: string) => Number(String(v ?? '').trim()) || 0;

/**
 * Setting the rate the shop will deal at today.
 *
 * Opens by itself once a day (see `useDailyRatePrompt`) and can be opened again
 * any time from the dashboard or Settings. Dismissing it is a real answer —
 * the shop stays on the live rate and every screen says so — so there is a
 * plain "use the live rate" action rather than only a close button.
 */
const SetRateModal = ({
  isOpen,
  onClose,
  liveRate,
  currentOverride,
}: {
  isOpen: boolean;
  onClose: () => void;
  liveRate: number;
  /** Today's rate if one is already set, so re-opening shows what is in force. */
  currentOverride?: number;
}) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const bottomInset = useSheetBottomInset(24);

  const [value, setValue] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  // Seeded each time it opens, from whatever is in force. Not held across
  // opens: a half-typed rate from this morning is not an answer for tonight.
  React.useEffect(() => {
    if (!isOpen) return;
    setValue(currentOverride ? String(currentOverride) : (liveRate ? String(liveRate) : ''));
  }, [isOpen, currentOverride, liveRate]);

  const entered = num(value);
  const canSave = entered > 0 && !saving;

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    const action = await dispatch(setShopRate({ goldRate: entered }) as any);
    setSaving(false);
    if (setShopRate.fulfilled.match(action)) {
      toast.success(t('rate.saved') || 'Today’s rate saved');
      onClose();
    } else {
      toast.error(String(action.payload || t('rate.failed') || 'Could not save the rate'));
    }
  };

  const onUseLive = async () => {
    setSaving(true);
    // Only worth a request when there is something to clear; otherwise this is
    // just "leave things as they are".
    if (currentOverride) await dispatch(clearShopRate(undefined) as any);
    setSaving(false);
    onClose();
  };

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable
          flex={1}
          bg="rgba(0,0,0,0.45)"
          justifyContent={LAYOUT.isWeb ? 'center' : 'flex-end'}
          onPress={Platform.OS === 'web' ? undefined : Keyboard.dismiss}
        >
          <Pressable
            bg="$white"
            p="$6"
            style={[
              styles.sheet,
              { paddingBottom: bottomInset },
              LAYOUT.isWeb && LAYOUT.contentContainerStyle,
              LAYOUT.isWeb && { alignSelf: 'center', width: '100%', borderRadius: 24 },
            ]}
            onPress={(e: any) => e.stopPropagation?.()}
          >
            <HStack justifyContent="center" alignItems="center" mb="$4">
              <Text fontSize={20} fontWeight="$bold">
                {t('rate.title') || 'Today’s Rate'}
              </Text>
              <Pressable position="absolute" right={0} onPress={onClose}>
                <Icon as={X} size="md" />
              </Pressable>
            </HStack>

            {/* The market figure, so the shopkeeper is deciding against
                something rather than typing into a vacuum. */}
            {liveRate > 0 && (
              <HStack
                bg="#FFFBEB"
                borderWidth={1}
                borderColor="#FDE68A"
                rounded="$xl"
                p="$3"
                mb="$4"
                alignItems="center"
                space="sm"
              >
                <Icon as={TrendingUp} size="xs" color="#B45309" />
                <Text fontSize={13} color="#92400E" flex={1}>
                  {t('rate.liveIs') || 'Live rate'} ({t('rate.fineness') || '99.50'})
                </Text>
                <Text fontSize={14} fontWeight="$bold" color="#B45309">
                  {formatCurrencyValue(liveRate)}
                </Text>
              </HStack>
            )}

            <FloatingLabelInput
              label={`${t('rate.yourRate') || 'Your rate'} (${t('rate.perGram') || '₹/gram'})`}
              keyboardType="decimal-pad"
              value={value}
              onChangeText={setValue}
              autoFocus
            />
            {/* The unit, said explicitly. Everything in this app is
                denominated in fine gold at 99.50 and a shopkeeper typing a
                rate has no way to know that unless it is written down — a
                figure entered as a 22K rate would misprice every bill. */}
            <Text fontSize={11} color="$coolGray400" mt="$1" ml="$1">
              {t('rate.unitNote') || 'Per gram of 99.50 fine gold'}
            </Text>
            <Text fontSize={11} color="$coolGray400" mt="$0.5" ml="$1">
              {t('rate.hint') || 'Used for every order raised today'}
            </Text>

            <Pressable onPress={onSave} disabled={!canSave} style={{ marginTop: 20 }}>
              <Box height={52} rounded="$xl" overflow="hidden" justifyContent="center" alignItems="center">
                {canSave
                  ? <GradientSurface colors={['#6366F1', '#D946EF']} borderRadius={12} />
                  : <Box position="absolute" top={0} left={0} right={0} bottom={0} bg="#E5E7EB" />}
                <Text color={canSave ? '$white' : '$coolGray400'} fontWeight="$bold" fontSize={16}>
                  {saving ? (t('common.saving') || 'Saving…') : (t('rate.save') || 'Set today’s rate')}
                </Text>
              </Box>
            </Pressable>

            {/* Dismissing is an answer, not an escape — so it is a labelled
                choice rather than only the X in the corner. */}
            <Pressable onPress={onUseLive} disabled={saving} style={{ marginTop: 12 }}>
              <Box bg="$coolGray100" rounded="$xl" py="$3" alignItems="center">
                <Text fontWeight="$medium" color="$coolGray700">
                  {t('rate.useLive') || 'Use the live rate'}
                </Text>
              </Box>
            </Pressable>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  sheet: { borderTopLeftRadius: 25, borderTopRightRadius: 25 },
});

export default SetRateModal;

import React from 'react';
import { Modal, Platform, Keyboard, KeyboardAvoidingView, ScrollView, StyleSheet } from 'react-native';
import {
  Box, HStack, Text, Pressable, Icon,
} from '@gluestack-ui/themed';
import { X, TrendingUp } from 'lucide-react-native';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppDispatch } from '../../store/hooks';
import { setShopRate, clearShopRate } from '../../store/data/dataSlice';
import { useSheetBottomInset } from '../../hooks/useSheetBottomInset';
import GradientSurface from './GradientSurface';
import FloatingLabelInput, { type FloatingLabelInputHandle } from './FloatingLabelInput';
import { toast } from './Toast';
import { formatCurrencyValue } from '../../utils/formatter';
import { LAYOUT } from '../../constants/layout';
import { useSilverRate } from '../../hooks/useShopRate';

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
  /**
   * Today's silver rate, set beside gold's. Read here rather than passed in, so
   * the dashboard and Settings, which both open this sheet, cannot get it out
   * of step with what the sale screen uses.
   */
  const silver = useSilverRate();
  const [silverValue, setSilverValue] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef<FloatingLabelInputHandle>(null);

  /**
   * Focus once the modal's window actually exists.
   *
   * `autoFocus` on the field did not work: inside a React Native Modal it fires
   * before the window is attached, so the field took focus and the keyboard
   * never opened — which read as "the rate cannot be edited at all". Modal's
   * own `onShow` is the first moment the window is real. The extra frame is for
   * Android, where onShow can still land marginally ahead of the window being
   * ready to accept input.
   */
  const focusRate = React.useCallback(() => {
    if (Platform.OS === 'web') return;
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  // Seeded each time it opens, from whatever is in force. Not held across
  // opens: a half-typed rate from this morning is not an answer for tonight.
  React.useEffect(() => {
    if (!isOpen) return;
    setValue(currentOverride ? String(currentOverride) : (liveRate ? String(liveRate) : ''));
    setSilverValue(silver.rate ? String(silver.rate) : '');
    // silver.rate is left out on purpose: a re-seed while the sheet is open
    // would overwrite what the user is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentOverride, liveRate]);

  const entered = num(value);
  const enteredSilver = num(silverValue);
  // Either rate on its own is a valid answer; a silver-only wholesaler may
  // never set a gold rate.
  const canSave = (entered > 0 || enteredSilver > 0) && !saving;

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    const action = await dispatch(setShopRate({
      ...(entered > 0 ? { goldRate: entered } : {}),
      ...(enteredSilver > 0 ? { silverRate: enteredSilver } : {}),
    }) as any);
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
    if (currentOverride || silver.isOverride) await dispatch(clearShopRate(undefined) as any);
    setSaving(false);
    onClose();
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onShow={focusRate}
    >
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
            style={[
              styles.sheet,
              LAYOUT.isWeb && LAYOUT.contentContainerStyle,
              LAYOUT.isWeb && { alignSelf: 'center', width: '100%', borderRadius: 24 },
            ]}
            onPress={() => {
              // Empty on purpose. React Native has no event bubbling to stop —
              // this Pressable claims the touch responder, which is what keeps
              // the backdrop behind it from seeing the press at all.
              //
              // It previously called `e.stopPropagation?.()`, a DOM API that
              // does not exist on a React Native press event. The optional
              // chaining swallowed it, so the sheet looked shielded from the
              // backdrop's Keyboard.dismiss while being shielded by nothing.
            }}
          >
            {/* Scrolls only when it has to. The sheet opens with the gold field
                focused, so the keyboard is up from the start. Once both fields
                had their real height (see the note on the gold field), the
                sheet no longer fit above the keyboard on most phones, and its
                title and close button went off the top of the screen. The sheet
                is capped at the space left (styles.sheet) and this takes up the
                rest, so nothing is cut off and nothing is drawn over.

                keyboardShouldPersistTaps: without it the first tap on "Set
                today's rate" would only close the keyboard, and the shopkeeper
                would have to tap again to save. */}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
              contentContainerStyle={{ padding: 24, paddingBottom: bottomInset }}
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
                  bg="#FBF6EA"
                  borderWidth={1}
                  borderColor="#EBD9AE"
                  rounded="$xl"
                  p="$3"
                  mb="$4"
                  alignItems="center"
                  space="sm"
                >
                  <Icon as={TrendingUp} size="xs" color="#87661F" />
                  <Text fontSize={13} color="#6F5318" flex={1}>
                    {t('rate.liveIs') || 'Live rate'} ({t('rate.fineness') || '99.50'})
                  </Text>
                  <Text fontSize={14} fontWeight="$bold" color="#87661F">
                    {formatCurrencyValue(liveRate)}
                  </Text>
                </HStack>
              )}

              {/* `column` drops the field's default `flex: 1`. That default suits
                  the order screens, where fields share an HStack; here the field
                  is a child of a COLUMN. Overriding it from outside failed every
                  way it was tried, each time with the hints drawn over the value:
                    - `flex: 1` as-is stretched the field down the sheet.
                    - `flex: 0` works on native, but react-native-web passes it to
                      CSS as `0 1 0%`, and the field collapsed on web (2026-10-06).
                    - The longhands that fixed web (grow 0, shrink 0, basis auto)
                      collapsed it on Android and iOS instead (2026-10-21). Yoga
                      treats an explicit `auto` basis as unset, and the `flex: 1`
                      still in the style supplied a basis of 0.
                  FloatingLabelInput has the details. */}
              <FloatingLabelInput
                ref={inputRef}
                column
                // "Gold rate" rather than "Your rate" now that silver's field sits
                // under it: with two rates in one sheet, "yours" names neither.
                label={`${t('rate.goldRateField') || 'Gold rate'} (${t('rate.perGram') || '₹/gram'})`}
                keyboardType="decimal-pad"
                value={value}
                onChangeText={setValue}
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

              {/* Silver, set on its own. It fills the rate on every silver line
                  today, the way the gold rate fills gold lines. */}
              <FloatingLabelInput
                column
                containerStyle={{ marginTop: 16 }}
                label={`${t('rate.silverRate') || 'Silver rate'} (${t('rate.perGram') || '₹/gram'})`}
                keyboardType="decimal-pad"
                value={silverValue}
                onChangeText={setSilverValue}
              />
              <Text fontSize={11} color="$coolGray400" mt="$1" ml="$1">
                {silver.liveRate > 0
                  ? `${t('rate.liveIs') || 'Live rate'} ${formatCurrencyValue(silver.liveRate)} · ${t('rate.silverUnitNote') || 'Per gram of silver'}`
                  : (t('rate.silverUnitNote') || 'Per gram of silver')}
              </Text>

              <Pressable onPress={onSave} disabled={!canSave} style={{ marginTop: 20 }}>
                <Box height={52} rounded="$xl" overflow="hidden" justifyContent="center" alignItems="center">
                  {canSave
                    ? <GradientSurface colors={['#0E4D3C', '#0A3A2D']} borderRadius={12} />
                    : <Box position="absolute" top={0} left={0} right={0} bottom={0} bg="#DCE2D8" />}
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
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // maxHeight: never taller than the space above the keyboard. The ScrollView
  // inside scrolls whatever does not fit.
  sheet: { borderTopLeftRadius: 25, borderTopRightRadius: 25, maxHeight: '100%', overflow: 'hidden' },
});

export default SetRateModal;

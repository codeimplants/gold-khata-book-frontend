import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import { useSheetBottomInset } from '../../hooks/useSheetBottomInset';
import { LAYOUT } from '../../constants/layout';
import { Brand, tabularNums } from '../../theme/brand';

/**
 * A bottom sheet in the Ledger design, for short forms: a title, a line saying
 * what the form is for, fields, and one action.
 *
 * The keyboard rules from CLAUDE.md, once, so each form does not have to get
 * them right again: its own KeyboardAvoidingView (a parent screen's does not
 * reach into a Modal), `padding` on iOS and `height` on Android (edge to edge
 * ignores adjustResize), `keyboardShouldPersistTaps="handled"` so the button
 * under a field takes the first tap, and the bottom padding from
 * useSheetBottomInset so the button never sits under Android's navigation bar.
 */
export default function LedgerSheet({
  visible,
  onClose,
  title,
  subtitle,
  closeLabel,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  closeLabel: string;
  children: React.ReactNode;
}) {
  const bottomInset = useSheetBottomInset(20);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={closeLabel}>
          <View style={[styles.wrap, LAYOUT.isWeb && styles.wrapWeb]}>
            {/* Claims the touch so a press inside the sheet never reaches the
                backdrop's onClose. React Native has no event bubbling to stop. */}
            <Pressable style={[styles.sheet, LAYOUT.sheetSurfaceStyle, { paddingBottom: bottomInset }]} onPress={() => {}}>
              <View style={styles.grabber} />
              <Text style={styles.title}>{title}</Text>
              {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
                {children}
              </ScrollView>
            </Pressable>
          </View>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** A labelled input in the Ledger style. Numbers right-aligned in tabular figures. */
export const SheetField = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  prefix,
  suffix,
  autoFocus,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  prefix?: string;
  suffix?: string;
  autoFocus?: boolean;
  maxLength?: number;
}) => {
  const numeric = keyboardType === 'decimal-pad' || keyboardType === 'number-pad' || keyboardType === 'numeric';
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputBox}>
        {!!prefix && <Text style={styles.affix}>{prefix}</Text>}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Brand.inkFaint}
          keyboardType={keyboardType}
          autoFocus={autoFocus}
          maxLength={maxLength ?? (numeric ? 12 : 120)}
          style={[styles.input, numeric && tabularNums, numeric && { textAlign: 'right' }]}
        />
        {!!suffix && <Text style={styles.affix}>{suffix}</Text>}
      </View>
    </View>
  );
};

/** The one action at the foot of a sheet. */
export const SheetButton = ({
  label,
  onPress,
  disabled,
  busy,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}) => (
  <Pressable
    onPress={onPress}
    disabled={disabled || busy}
    accessibilityRole="button"
    style={({ pressed }) => [
      styles.button,
      (disabled || busy) && styles.buttonDisabled,
      pressed && { opacity: 0.85 },
    ]}
  >
    <Text style={styles.buttonText}>{busy ? '…' : label}</Text>
  </Pressable>
);

/** Plain words under a form: what will happen, or what a figure means. */
export const SheetNote = ({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'good' | 'warn' }) => (
  <Text style={[styles.note, tone === 'good' && { color: Brand.received }, tone === 'warn' && { color: Brand.due }]}>
    {children}
  </Text>
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(29, 27, 22, 0.45)',
  },
  wrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  wrapWeb: {
    alignItems: 'center',
  },
  sheet: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '92%',
    backgroundColor: Brand.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Brand.line,
    marginBottom: 14,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: Brand.ink,
  },
  subtitle: {
    fontSize: 14,
    color: Brand.inkMuted,
    marginTop: 2,
    marginBottom: 10,
    lineHeight: 20,
  },
  field: {
    marginTop: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.inkMuted,
    marginBottom: 6,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Brand.lineStrong,
    borderRadius: 8,
    backgroundColor: Brand.card,
    paddingHorizontal: 12,
    height: 48,
  },
  input: {
    flex: 1,
    // Without it a web <input> keeps its default ~20-character width inside a
    // row, so in a half-width field it overflowed the box and pushed both the
    // typed figure (right-aligned) and the unit out of sight.
    minWidth: 0,
    fontSize: 17,
    fontWeight: '600',
    color: Brand.ink,
    paddingVertical: 0,
  },
  affix: {
    fontSize: 15,
    fontWeight: '600',
    color: Brand.inkMuted,
    marginHorizontal: 4,
  },
  note: {
    fontSize: 13,
    color: Brand.inkMuted,
    marginTop: 10,
    lineHeight: 19,
  },
  button: {
    height: 50,
    borderRadius: 8,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  buttonDisabled: {
    backgroundColor: Brand.lineStrong,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

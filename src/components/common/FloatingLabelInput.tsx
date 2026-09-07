import React from 'react';
import { Animated, Platform, StyleSheet, TextInput, View, Pressable } from 'react-native';
import { Text } from '@gluestack-ui/themed';

/**
 * A text field whose label sits inside the box until the field is touched,
 * then lifts onto the top border and stays there, cutting a notch through it.
 *
 * The notch is the label painted in the field's own fill colour: sitting on the
 * border line, it masks the pixels behind it, so the outline appears to break
 * around the text rather than run underneath it.
 *
 * Why not a label above the box: an order line has six fields on a phone
 * screen, and a stacked label above each one costs a line of height apiece.
 * Floating them recovers that without the usual placeholder trap, where the
 * only thing naming the field disappears the moment you type — on a form of
 * weights and percentages, a filled row of bare numbers is unreadable.
 *
 * The label is driven by focus OR content, never focus alone: a field the user
 * filled and left has to keep its name.
 */
interface Props {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  /** Marks the field required, and colours the asterisk. */
  required?: boolean;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad' | 'phone-pad';
  maxLength?: number;
  /** Shown inside the field, to the right — a unit, or a live-rate hint. */
  suffix?: string;
  editable?: boolean;
  onBlur?: () => void;
  /** Turns the border red and prints the reason under the field. */
  error?: string;
  /**
   * A quiet line under the field explaining what was entered — the purity
   * split, for one. Suppressed while `error` is showing: the reason a value is
   * rejected must not compete with a note about what it means.
   */
  hint?: string;
  autoFocus?: boolean;
  /**
   * Overrides the wrapper's layout. Needed because the default is `flex: 1`,
   * which is right in the order screens — the fields sit in HStacks and share
   * the row evenly — and wrong anywhere the field is a child of a COLUMN, where
   * `flex: 1` makes it grow to fill the sheet and overlap whatever follows.
   *
   * That is not hypothetical: it stretched the rate field down SetRateModal and
   * drew the value on top of the two unit hints beneath it.
   */
  containerStyle?: object;
}

/**
 * The field's own palette — a pale lavender ground with a violet keyline,
 * rather than grey-on-white.
 *
 * It reads as one tinted block per field, which is what keeps a six-field
 * order line legible: the eye separates the fields by their fill instead of
 * hunting for hairline borders on a white card. That part stands.
 *
 * The RESTING LABEL is now grey, not violet. It was violet on the same
 * reasoning as the fill, and at rest the label is doing a placeholder's job —
 * naming an empty field — so violet made every unfilled field read as active
 * and the form as a wall of purple. Grey at rest, violet on focus, is the
 * standard signal: colour marks the one field you are in.
 *
 * #9CA3AF matches `placeholderTextColor` already used in AdminHomeScreen and
 * CompleteRegistrationScreen, so a resting label and a plain placeholder are
 * the same grey rather than two greys a shade apart.
 */
const ACCENT = '#7C3AED';
const REST_BORDER = '#E9DCF7';
const REST_LABEL = '#9CA3AF';
/** Violet, kept for the suffix — a live-rate hint is information, not a label. */
const SUFFIX_COLOR = '#8B5CF6';
const FILL = '#FCFAFE';
const FILL_DISABLED = '#F4F4F6';
const DANGER = '#DC2626';

/** What a parent can do to the field from outside. */
export interface FloatingLabelInputHandle {
  focus: () => void;
}

/**
 * forwardRef so a parent can focus the field *after* deciding the moment is
 * right. `autoFocus` cannot do that inside a React Native `Modal`: the modal's
 * window is not attached when autofocus fires, so the field takes focus and the
 * soft keyboard never opens — the field looks active and cannot be typed into.
 * SetRateModal focuses from the Modal's own `onShow` instead.
 */
const FloatingLabelInput = React.forwardRef<FloatingLabelInputHandle, Props>(({
  label,
  value,
  onChangeText,
  required,
  keyboardType = 'default',
  maxLength,
  suffix,
  editable = true,
  onBlur,
  error,
  hint,
  autoFocus,
  containerStyle,
}: Props, ref) => {
  const [focused, setFocused] = React.useState(false);
  const inputRef = React.useRef<TextInput>(null);

  React.useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }), []);

  const hasValue = String(value ?? '').length > 0;
  const lifted = focused || hasValue;

  // Animated rather than a conditional style so the label travels instead of
  // jumping between two positions, which reads as a glitch at this size.
  const anim = React.useRef(new Animated.Value(lifted ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.timing(anim, {
      toValue: lifted ? 1 : 0,
      duration: 140,
      // Layout properties (top/fontSize) cannot run on the native driver.
      useNativeDriver: false,
    }).start();
  }, [lifted, anim]);

  const borderColor = error ? DANGER : focused ? ACCENT : REST_BORDER;

  return (
    <View style={[styles.wrap, containerStyle]}>
      <Pressable onPress={() => inputRef.current?.focus()}>
        <View style={[styles.box, { borderColor, backgroundColor: editable ? FILL : FILL_DISABLED }]}>
          <Animated.Text
            // pointerEvents none so a tap on the label still reaches the field
            // underneath rather than being swallowed by the label itself.
            pointerEvents="none"
            style={[
              styles.label,
              {
                // -9 puts the text across the 1.5px border rather than just
                // inside it, which is what makes the notch read as a break in
                // the outline instead of a label crowding it.
                top: anim.interpolate({ inputRange: [0, 1], outputRange: [16, -9] }),
                fontSize: anim.interpolate({ inputRange: [0, 1], outputRange: [15, 12] }),
                color: error ? DANGER : focused ? ACCENT : REST_LABEL,
                // Same colour as the ground it sits on: invisible while the
                // label is inside the box, a mask once it is on the border.
                backgroundColor: editable ? FILL : FILL_DISABLED,
              },
            ]}
          >
            {label}
            {required ? <Text style={styles.star}> *</Text> : null}
          </Animated.Text>

          <View style={styles.row}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={String(value ?? '')}
              onChangeText={onChangeText}
              onFocus={() => setFocused(true)}
              onBlur={() => { setFocused(false); onBlur?.(); }}
              keyboardType={keyboardType}
              maxLength={maxLength}
              editable={editable}
              autoFocus={autoFocus}
              // The label IS the placeholder while it sits low, so a second one
              // would render two strings on top of each other.
              placeholder=""
              underlineColorAndroid="transparent"
            />
            {!!suffix && <Text style={styles.suffix}>{suffix}</Text>}
          </View>
        </View>
      </Pressable>

      {!!error && <Text style={styles.error}>{error}</Text>}
      {!error && !!hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
});

FloatingLabelInput.displayName = 'FloatingLabelInput';

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  box: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    // The lifted label leaves the box entirely, so no band is reserved for it
    // and the value sits centred instead of pushed to the bottom.
    paddingVertical: 15,
    minHeight: 56,
    justifyContent: 'center',
  },
  label: {
    position: 'absolute',
    // 10 + the 4px of self-padding lines the text up with the value at 14.
    left: 10,
    paddingHorizontal: 4,
    fontWeight: '600',
  },
  star: { color: DANGER },
  row: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    padding: 0,
    margin: 0,
    // Android gives TextInput a minimum height that outgrows the box.
    ...(Platform.OS === 'android' ? { paddingVertical: 0, height: 22 } : {}),
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  suffix: { fontSize: 13, color: SUFFIX_COLOR, marginLeft: 8 },
  error: { fontSize: 12, color: DANGER, marginTop: 4, marginLeft: 4 },
  hint: { fontSize: 12, color: '#6B7280', marginTop: 4, marginLeft: 4 },
});

export default FloatingLabelInput;

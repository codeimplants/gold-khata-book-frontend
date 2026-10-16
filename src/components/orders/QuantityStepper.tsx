import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { Brand, tabularNums } from '../../theme/brand';

/**
 * Quantity with − and + either side, for changing a count in one tap on a
 * phone or with a mouse; the number can still be typed for a big jump.
 *
 * Kept as a string, like every other field on the sale form, so a half-typed
 * value is not forced to a number mid-edit. Never below `min`.
 */
export default function QuantityStepper({
  label,
  value,
  onChange,
  min = 1,
  max = 999,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  min?: number;
  max?: number;
}) {
  const n = Math.floor(Number(value)) || 0;
  const step = (d: number) => onChange(String(Math.min(max, Math.max(min, (n || min) + d))));

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable
          onPress={() => step(-1)}
          disabled={n <= min}
          accessibilityRole="button"
          accessibilityLabel={`${label} −`}
          hitSlop={6}
          style={({ pressed }) => [styles.btn, (n <= min) && styles.btnOff, pressed && styles.btnPressed]}
        >
          <Minus size={18} color={n <= min ? Brand.inkFaint : Brand.primary} />
        </Pressable>
        <TextInput
          value={value}
          onChangeText={v => onChange(v.replace(/[^0-9]/g, '').slice(0, 3))}
          // Leaving the field empty would read as zero pieces; it snaps back.
          onBlur={() => { if (!(n >= min)) onChange(String(min)); }}
          keyboardType="number-pad"
          selectTextOnFocus
          style={[styles.input, tabularNums]}
          accessibilityLabel={label}
        />
        <Pressable
          onPress={() => step(1)}
          disabled={n >= max}
          accessibilityRole="button"
          accessibilityLabel={`${label} +`}
          hitSlop={6}
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
        >
          <Plus size={18} color={Brand.primary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  label: { fontSize: 12, fontWeight: '600', color: Brand.inkMuted, marginBottom: 4, marginLeft: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1,
    borderColor: Brand.lineStrong,
    borderRadius: 12,
    backgroundColor: Brand.card,
    overflow: 'hidden',
  },
  btn: { width: 46, height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: Brand.primaryTint },
  btnOff: { backgroundColor: Brand.sunken },
  btnPressed: { opacity: 0.6 },
  input: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: Brand.ink,
    paddingVertical: 0,
  },
});

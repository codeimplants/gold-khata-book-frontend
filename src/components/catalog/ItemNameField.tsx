import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Search } from 'lucide-react-native';

/** The same box as FloatingLabelInput, so a sale line reads as one form. */
const FILL = '#F7FAF8';
const REST_BORDER = '#DCEBE4';
const ACCENT = '#145F4A';
const DANGER = '#DC2626';

/**
 * The item-name field on a sale line: it looks like the line's other inputs,
 * and opens the item picker (ItemPicker) instead of a keyboard, so the name
 * is searched from the shop's catalogue and the ornament list, or typed there
 * when it is new.
 */
export default function ItemNameField({
  label,
  value,
  hint,
  required,
  onPress,
}: {
  label: string;
  value: string;
  /** Shown at rest, in place of a value: "Search or type". */
  hint: string;
  required?: boolean;
  onPress: () => void;
}) {
  const filled = value.trim().length > 0;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={filled ? `${label}: ${value}` : label}
      style={({ pressed }) => [styles.box, pressed && { borderColor: ACCENT }]}
    >
      {/* Lifted onto the border once there is a value, as the inputs do. */}
      <Text style={[styles.label, filled ? styles.labelUp : styles.labelRest]} numberOfLines={1}>
        {label}
        {required ? <Text style={styles.star}> *</Text> : null}
      </Text>
      <View style={styles.row}>
        <Text style={[styles.value, !filled && styles.placeholder]} numberOfLines={1}>
          {filled ? value : hint}
        </Text>
        <Search size={18} color={ACCENT} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1.5,
    borderColor: REST_BORDER,
    borderRadius: 14,
    backgroundColor: FILL,
    paddingHorizontal: 14,
    paddingTop: 15,
    paddingBottom: 15,
    minHeight: 56,
    justifyContent: 'center',
  },
  label: {
    position: 'absolute',
    left: 10,
    paddingHorizontal: 4,
    fontWeight: '600',
    backgroundColor: FILL,
  },
  labelRest: { top: -9, fontSize: 12, color: '#6B665B' },
  labelUp: { top: -9, fontSize: 12, color: ACCENT },
  star: { color: DANGER },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  value: { flex: 1, minWidth: 0, fontSize: 16, fontWeight: '600', color: '#1D1B16' },
  placeholder: { color: '#A39E92', fontWeight: '500' },
});

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import LedgerSheet, { SheetButton, SheetField, SheetNote } from '../ledger/LedgerSheet';
import { WEIGHT_SETTLED_EPSILON_GM, formatGrams } from '../../utils/dues';
import { Brand, tabularNums } from '../../theme/brand';

const num = (v: string) => {
  const n = Number(String(v ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
};
/** Grams to the milligram, the precision every weight is shown at. */
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Gold held for a retailer (an advance, or melt credit) put against the gold
 * they owe, in full or in part.
 *
 * Gram for gram: held gold is already fine 99.50, so no rate is asked. "Full"
 * is the most it can usefully cover, the smaller of what is held and what is
 * owed, and is filled in already, so a full payment is one tap. "Half" or a
 * typed weight is a part payment; whatever is not used stays held.
 */
export default function UseGoldSheet({
  visible,
  onClose,
  heldGold,
  goldDue,
  subtitle,
  hint,
  onConfirm,
  t,
}: {
  visible: boolean;
  onClose: () => void;
  /** Grams of 99.50 held for the retailer. */
  heldGold: number;
  /** Grams of 99.50 owed on the sale(s) this goes against. */
  goldDue: number;
  subtitle?: string;
  hint?: string;
  /** Posts it. Resolves to an error message, or null when done. */
  onConfirm: (weight: number) => Promise<string | null>;
  t: any;
}) {
  const gm = t('common.gramShort') || 'gm';
  const full = round3(Math.max(0, Math.min(heldGold, goldDue)));
  const half = round3(full / 2);
  const [weight, setWeight] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!visible) return;
    setWeight(full > 0 ? String(full) : '');
    setError(null);
  }, [visible, full]);

  const w = num(weight);
  const overHeld = w > heldGold + WEIGHT_SETTLED_EPSILON_GM;
  const overDue = !overHeld && w > goldDue + WEIGHT_SETTLED_EPSILON_GM;
  const canSave = w > WEIGHT_SETTLED_EPSILON_GM && !overHeld && !overDue;
  const staysHeld = round3(heldGold - w);
  const stillDue = round3(goldDue - w);

  const save = async () => {
    if (!canSave || busy) return;
    setBusy(true);
    setError(null);
    try {
      const failure = await onConfirm(round3(w));
      if (failure) setError(failure);
      else onClose();
    } finally {
      setBusy(false);
    }
  };

  const chips: { key: string; label: string; value: number }[] = [
    { key: 'full', label: `${t('account.full') || 'Full'} · ${formatGrams(full, gm)}`, value: full },
    { key: 'half', label: `${t('account.half') || 'Half'} · ${formatGrams(half, gm)}`, value: half },
  ];

  return (
    <LedgerSheet
      visible={visible}
      onClose={onClose}
      title={t('account.useGoldTitle') || 'Use gold held?'}
      subtitle={subtitle}
      closeLabel={t('common.close') || 'Close'}
    >
      <View style={styles.chips}>
        {chips.map(c => {
          const on = Math.abs(w - c.value) < 0.0005 && c.value > 0;
          return (
            <Pressable
              key={c.key}
              onPress={() => setWeight(String(c.value))}
              disabled={c.value <= 0}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn, tabularNums]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <SheetField
        label={t('account.goldToUse') || 'Gold to use, fine 99.50'}
        suffix={gm}
        keyboardType="decimal-pad"
        value={weight}
        onChangeText={setWeight}
      />

      {overHeld ? (
        <SheetNote tone="warn">
          {(t('account.onlyGoldHeld') || 'Only {grams} is held.').replace('{grams}', formatGrams(heldGold, gm))}
        </SheetNote>
      ) : overDue ? (
        <SheetNote tone="warn">
          {(t('account.moreThanDue') || 'That is more than the {due} owed.').replace('{due}', formatGrams(goldDue, gm))}
        </SheetNote>
      ) : w > 0 ? (
        <SheetNote tone="good">
          <Text style={tabularNums}>
            {stillDue <= WEIGHT_SETTLED_EPSILON_GM
              ? (t('account.clearsDue') || 'Clears the gold due.')
              : (t('account.leavesDue') || '{grams} of gold stays owed.').replace('{grams}', formatGrams(stillDue, gm))}
            {staysHeld > WEIGHT_SETTLED_EPSILON_GM
              ? ` ${(t('account.goldStaysHeld') || '{grams} stays held.').replace('{grams}', formatGrams(staysHeld, gm))}`
              : ''}
          </Text>
        </SheetNote>
      ) : null}
      {!!hint && <SheetNote>{hint}</SheetNote>}

      {!!error && <SheetNote tone="warn">{error}</SheetNote>}

      <SheetButton
        label={w > 0
          ? (t('account.useGrams') || 'Use {grams}').replace('{grams}', formatGrams(w, gm))
          : (t('account.useGoldConfirm') || 'Use gold held')}
        onPress={save}
        disabled={!canSave}
        busy={busy}
      />
    </LedgerSheet>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Brand.lineStrong,
  },
  chipOn: {
    borderColor: Brand.primary,
    backgroundColor: Brand.primarySoft,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.inkMuted,
  },
  chipTextOn: {
    color: Brand.primary,
  },
});

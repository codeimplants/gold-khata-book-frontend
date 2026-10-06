import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import LedgerSheet, { SheetButton, SheetField, SheetNote } from '../ledger/LedgerSheet';
import { CASH_SETTLED_EPSILON, formatGrams } from '../../utils/dues';
import { Brand, tabularNums } from '../../theme/brand';

const num = (v: string) => {
  const n = Number(String(v ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;
const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/**
 * Fixing the rate on cash a retailer left with the shop.
 *
 * The retailer owes gold and paid cash, but asked for it to be converted later
 * at a rate of their choosing; or left cash as an advance. This is the day
 * they choose. The rate is asked for, and defaults to today's, because it is
 * never the rate on the day the cash came in: that difference is the whole
 * reason the cash was held.
 *
 * The grams shown are a preview, `amount / rate`, the same sum the server does
 * when it posts the payment. The server's figure is the one kept.
 */
export default function FixRateSheet({
  visible,
  onClose,
  heldCash,
  goldDue,
  defaultRate,
  subtitle,
  hint,
  onConfirm,
  t,
}: {
  visible: boolean;
  onClose: () => void;
  /** Rupees held for the retailer. */
  heldCash: number;
  /** Grams of 99.50 still owed on the sale(s) this converts against. */
  goldDue: number;
  /** Today's rate, the shop's own when set. A starting point only. */
  defaultRate: number;
  subtitle?: string;
  /** What applying it does, when it is not the account-wide oldest-first. */
  hint?: string;
  /** Posts the conversion. Resolves to an error message, or null when done. */
  onConfirm: (amount: number, rate: number) => Promise<string | null>;
  t: any;
}) {
  const gm = t('common.gramShort') || 'gm';
  const [rate, setRate] = React.useState('');
  const [amount, setAmount] = React.useState('');
  /**
   * Full or half follows the rate: change the rate and the amount is worked out
   * again. Once an amount is typed it is the shopkeeper's, and a rate change
   * no longer rewrites it.
   */
  const [mode, setMode] = React.useState<'full' | 'half' | 'typed'>('full');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // What the held cash can usefully buy at a rate: no more than is held, and
  // no more than the due is worth (beyond that it would only come straight
  // back onto the account as an overpayment).
  const suggested = React.useCallback(
    (r: number) => (r > 0 ? round2(Math.min(heldCash, goldDue * r)) : round2(heldCash)),
    [heldCash, goldDue],
  );

  React.useEffect(() => {
    if (!visible) return;
    const r = defaultRate > 0 ? defaultRate : 0;
    setRate(r ? String(r) : '');
    setAmount(String(suggested(r)));
    setMode('full');
    setError(null);
  }, [visible, defaultRate, suggested]);

  const onRate = (v: string) => {
    setRate(v);
    if (mode === 'full') setAmount(String(suggested(num(v))));
    if (mode === 'half') setAmount(String(round2(suggested(num(v)) / 2)));
  };

  /** Full: everything held, or as much as clears the gold due if that is less. */
  const pick = (m: 'full' | 'half') => {
    setMode(m);
    const full = suggested(num(rate));
    setAmount(String(m === 'full' ? full : round2(full / 2)));
  };

  const r = num(rate);
  const a = num(amount);
  const grams = r > 0 ? a / r : 0;
  const tooMuch = a > heldCash + CASH_SETTLED_EPSILON;
  const canSave = r > 0 && a >= 1 && !tooMuch && goldDue > 0;
  const staysHeld = round2(heldCash - a);

  const save = async () => {
    if (!canSave || busy) return;
    setBusy(true);
    setError(null);
    try {
      const failure = await onConfirm(round2(a), r);
      if (failure) setError(failure);
      else onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <LedgerSheet
      visible={visible}
      onClose={onClose}
      title={t('account.fixRateTitle') || 'Fix rate'}
      subtitle={subtitle}
      closeLabel={t('common.close') || 'Close'}
    >
      <SheetField
        label={t('account.rateLabel') || 'Rate, per gm of 99.50'}
        prefix="₹"
        keyboardType="decimal-pad"
        value={rate}
        onChangeText={onRate}
      />
      {/* One tap for the usual answers; any other amount is typed. */}
      <View style={styles.chips}>
        {(['full', 'half'] as const).map(m => {
          const value = m === 'full' ? suggested(num(rate)) : round2(suggested(num(rate)) / 2);
          const on = mode === m;
          return (
            <Pressable
              key={m}
              onPress={() => pick(m)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn, tabularNums]}>
                {m === 'full' ? (t('account.full') || 'Full') : (t('account.half') || 'Half')} · {inr(value)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <SheetField
        label={t('account.convertLabel') || 'Cash to convert'}
        prefix="₹"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={v => { setMode('typed'); setAmount(v); }}
      />

      {tooMuch ? (
        <SheetNote tone="warn">
          {(t('account.onlyHeld') || 'Only {amount} is held.').replace('{amount}', inr(heldCash))}
        </SheetNote>
      ) : grams > 0 ? (
        <SheetNote tone="good">
          <Text style={tabularNums}>
            {(t('account.buysGrams') || 'Buys {grams} at this rate, against {due} due.')
              .replace('{grams}', formatGrams(grams, gm))
              .replace('{due}', formatGrams(goldDue, gm))}
          </Text>
        </SheetNote>
      ) : null}
      {!tooMuch && staysHeld >= CASH_SETTLED_EPSILON && a > 0 && (
        <SheetNote>
          {(t('account.staysHeld') || '{amount} stays held.').replace('{amount}', inr(staysHeld))}
        </SheetNote>
      )}
      <SheetNote>
        {hint || t('account.fixRateHint') || 'Oldest sale first. Their gold due comes down by the grams this buys.'}
      </SheetNote>

      {!!error && <SheetNote tone="warn">{error}</SheetNote>}

      <SheetButton
        label={t('account.fixRateConfirm') || 'Fix rate and apply'}
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
    marginTop: 12,
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

import React from 'react';
import { Text } from 'react-native';
import LedgerSheet, { SheetButton, SheetField, SheetNote } from '../ledger/LedgerSheet';
import { WEIGHT_SETTLED_EPSILON_GM, formatGrams } from '../../utils/dues';
import { formatCurrencyValue } from '../../utils/formatter';
import { tabularNums } from '../../theme/brand';

const num = (v: string) => {
  const n = Number(String(v ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
};
/** Grams to the milligram, the precision every weight is shown at. */
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * A receipt against a sale's SILVER account: cash, silver, or both.
 *
 * Cash buys silver grams down at the rate in the sheet, which starts at
 * today's silver rate and can be changed, the same as a gold receipt names
 * its rate. Silver handed over counts gram for gram, because the sale charged
 * net weight with no purity (utils/silverPricing.ts).
 *
 * Its own sheet rather than an option on the gold one: a silver receipt that
 * went out through the gold path would be filed under gold at a silver rate.
 */
export default function ReceiveSilverSheet({
  visible,
  onClose,
  silverDue,
  defaultRate,
  onConfirm,
  t,
  editing,
}: {
  visible: boolean;
  onClose: () => void;
  /** Grams of silver still owed on the sale. */
  silverDue: number;
  /** Today's silver rate, the shop's own or the live one. */
  defaultRate: number;
  /** Posts it. Resolves to an error message, or null when done. */
  onConfirm: (p: { amount: number; silverRate: number; silverWeight: number }) => Promise<string | null>;
  t: any;
  /**
   * An existing silver receipt being corrected. The fields start from it, and
   * the due is taken back to before it was paid, so the preview says what the
   * corrected receipt leaves owed rather than counting the old one twice.
   */
  editing?: { amount: number; silverRate: number; silverWeight: number };
}) {
  const gm = t('common.gramShort') || 'gm';
  const [cash, setCash] = React.useState('');
  const [rate, setRate] = React.useState('');
  const [silver, setSilver] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!visible) return;
    if (editing) {
      setCash(editing.amount > 0 ? String(editing.amount) : '');
      setSilver(editing.silverWeight > 0 ? String(editing.silverWeight) : '');
      setRate(editing.silverRate > 0 ? String(editing.silverRate) : (defaultRate > 0 ? String(defaultRate) : ''));
    } else {
      setCash('');
      setSilver('');
      setRate(defaultRate > 0 ? String(defaultRate) : '');
    }
    setError(null);
    // defaultRate is left out: a rate arriving while the sheet is open must
    // not overwrite the one being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const c = num(cash);
  const r = num(rate);
  const s = num(silver);
  const cashGrams = c > 0 && r > 0 ? c / r : 0;
  const covered = cashGrams + s;
  // What was owed before this receipt: the current due, plus what the receipt
  // being edited already took off it.
  const dueBefore = editing
    ? silverDue
      + (editing.amount > 0 && editing.silverRate > 0 ? editing.amount / editing.silverRate : 0)
      + (editing.silverWeight || 0)
    : silverDue;
  const stillDue = round3(dueBefore - covered);
  const needsRate = c > 0 && r <= 0;
  const canSave = (c > 0 || s > WEIGHT_SETTLED_EPSILON_GM) && !needsRate;

  const save = async () => {
    if (!canSave || busy) return;
    setBusy(true);
    setError(null);
    try {
      const failure = await onConfirm({ amount: c, silverRate: r, silverWeight: round3(s) });
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
      title={editing
        ? (t('silver.editTitle') || 'Edit silver receipt')
        : (t('silver.receiveTitle') || 'Receive silver')}
      subtitle={(editing
        ? (t('silver.owedBefore') || '{grams} of silver owed before this receipt')
        : (t('silver.owedOnSale') || '{grams} of silver owed on this sale'))
        .replace('{grams}', formatGrams(dueBefore, gm))}
      closeLabel={t('common.close') || 'Close'}
    >
      <SheetField
        label={t('silver.cashLabel') || 'Cash'}
        suffix="₹"
        keyboardType="decimal-pad"
        value={cash}
        onChangeText={setCash}
      />
      <SheetField
        label={t('silver.rateLabel') || 'Silver rate, per gram'}
        suffix="₹"
        keyboardType="decimal-pad"
        value={rate}
        onChangeText={setRate}
      />
      <SheetField
        label={t('silver.metalLabel') || 'Silver handed over'}
        suffix={gm}
        keyboardType="decimal-pad"
        value={silver}
        onChangeText={setSilver}
      />

      {needsRate ? (
        <SheetNote tone="warn">{t('silver.needsRate') || 'Enter the rate the cash buys silver at.'}</SheetNote>
      ) : covered > 0 ? (
        <SheetNote tone={stillDue < -WEIGHT_SETTLED_EPSILON_GM ? 'warn' : 'good'}>
          <Text style={tabularNums}>
            {cashGrams > 0
              ? `${formatCurrencyValue(c)} = ${formatGrams(cashGrams, gm)} @ ${formatCurrencyValue(r)}/${gm}. `
              : ''}
            {stillDue < -WEIGHT_SETTLED_EPSILON_GM
              ? (t('silver.moreThanDue') || 'That is {grams} more than is owed.').replace('{grams}', formatGrams(-stillDue, gm))
              : stillDue <= WEIGHT_SETTLED_EPSILON_GM
                ? (t('silver.clearsDue') || 'Clears the silver due.')
                : (t('silver.leavesDue') || '{grams} of silver stays owed.').replace('{grams}', formatGrams(stillDue, gm))}
          </Text>
        </SheetNote>
      ) : null}

      {!!error && <SheetNote tone="warn">{error}</SheetNote>}

      <SheetButton
        label={editing
          ? (t('silver.saveEdit') || 'Save changes')
          : (t('silver.receiveConfirm') || 'Record receipt')}
        onPress={save}
        disabled={!canSave}
        busy={busy}
      />
    </LedgerSheet>
  );
}

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Coins, Hourglass } from 'lucide-react-native';
import LedgerSheet, { SheetButton, SheetField, SheetNote } from '../ledger/LedgerSheet';
import { useAppDispatch } from '../../store/hooks';
import { receiveGoldAdvance, receiveHeldCash } from '../../store/data/dataSlice';
import { priceInboundMetal } from '../../utils/goldPricing';
import { formatGrams } from '../../utils/dues';
import { toast } from '../common/Toast';
import { Brand, tabularNums } from '../../theme/brand';

type Mode = 'cash' | 'gold';

/** Purities a wholesaler is handed most: a bar, the settlement grade, 22K, 20K. */
const PURITY_CHIPS = ['99.9', '99.5', '91.6', '84'];

const num = (v: string) => {
  const n = Number(String(v ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
};

const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/**
 * Money or metal taken from a retailer that is NOT set against a sale.
 *
 * Cash: the retailer owes gold, pays cash, and asks for the rate to be fixed
 * later, when it suits them. Or cash left as an advance before the purchases
 * it is for. Either way it buys no gold until Fix rate, at that day's rate.
 *
 * Gold: an advance in metal. Restated at 99.50 by the server's inbound rule,
 * the same one a metal payment on a sale goes through; the preview here uses
 * the app's mirror of it (utils/goldPricing.ts), and the server's figure is
 * the one that is kept.
 *
 * A payment against one particular sale is still recorded on that sale.
 */
export default function ReceiveOnAccountSheet({
  visible,
  onClose,
  customerId,
  retailerName,
  owesGold,
  initialMode = 'cash',
  t,
}: {
  visible: boolean;
  onClose: () => void;
  customerId: string;
  retailerName: string;
  /** Changes the wording only: cash against a due, or an advance. */
  owesGold: boolean;
  initialMode?: Mode;
  t: any;
}) {
  const dispatch = useAppDispatch();
  const [mode, setMode] = React.useState<Mode>(initialMode);
  const [amount, setAmount] = React.useState('');
  const [weight, setWeight] = React.useState('');
  const [purity, setPurity] = React.useState('99.5');
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  /** Shown in the sheet: a toast would sit behind the modal on a phone. */
  const [error, setError] = React.useState<string | null>(null);
  const gm = t('common.gramShort') || 'gm';

  React.useEffect(() => {
    if (!visible) return;
    setMode(initialMode);
    setAmount('');
    setWeight('');
    setPurity('99.5');
    setNote('');
    setError(null);
  }, [visible, initialMode]);

  const credit = mode === 'gold' ? priceInboundMetal(num(weight), num(purity)) : 0;
  const purityOk = num(purity) > 0 && num(purity) <= 100;
  const canSave = mode === 'cash' ? num(amount) >= 1 : num(weight) > 0 && purityOk && credit > 0;

  const save = async () => {
    if (!canSave || busy) return;
    setBusy(true);
    setError(null);
    try {
      const action: any = mode === 'cash'
        ? await dispatch(receiveHeldCash({
            customerId,
            amount: num(amount),
            notes: note.trim() || (owesGold
              ? (t('account.noteRateLater') || 'Rate to be fixed later')
              : (t('account.noteAdvance') || 'Advance')),
          }) as any)
        : await dispatch(receiveGoldAdvance({
            customerId,
            weight: num(weight),
            purity: num(purity),
            notes: note.trim() || (t('account.noteGoldAdvance') || 'Gold advance'),
          }) as any);
      const ok = mode === 'cash'
        ? receiveHeldCash.fulfilled.match(action)
        : receiveGoldAdvance.fulfilled.match(action);
      if (!ok) {
        setError(String(action.payload || t('account.saveFailed') || 'Could not record it'));
        return;
      }
      toast.success(
        (mode === 'cash'
          ? (t('account.cashHeldFor') || 'Cash held for {name}')
          : (t('account.goldHeldFor') || 'Gold held for {name}')).replace('{name}', retailerName),
      );
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const tabs: { key: Mode; label: string; Icon: any }[] = [
    { key: 'cash', label: t('account.tabCash') || 'Cash · fix rate later', Icon: Hourglass },
    { key: 'gold', label: t('account.tabGold') || 'Gold advance', Icon: Coins },
  ];

  return (
    <LedgerSheet
      visible={visible}
      onClose={onClose}
      title={t('account.receiveTitle') || 'Receive on account'}
      subtitle={(t('account.receiveSubtitle') || 'Not against a sale. Held for {name} until it is used.').replace('{name}', retailerName)}
      closeLabel={t('common.close') || 'Close'}
    >
      <View style={styles.tabs}>
        {tabs.map(({ key, label, Icon }) => {
          const on = mode === key;
          return (
            <Pressable
              key={key}
              onPress={() => setMode(key)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.tab, on && styles.tabOn]}
            >
              <Icon size={15} color={on ? Brand.primary : Brand.inkMuted} />
              <Text style={[styles.tabText, on && styles.tabTextOn]} numberOfLines={1}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {mode === 'cash' ? (
        <>
          <SheetField
            label={t('account.amount') || 'Amount'}
            prefix="₹"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
            autoFocus
          />
          <SheetNote>
            {owesGold
              ? (t('account.cashHintDue') || 'Their gold due stays as it is until the rate is fixed. Fix it from their account when they ask, at the rate they choose.')
              : (t('account.cashHintAdvance') || 'An advance. When they buy, fix the rate on the sale and it comes off what they owe.')}
          </SheetNote>
        </>
      ) : (
        <>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <SheetField
                label={t('account.weight') || 'Weight'}
                suffix={gm}
                keyboardType="decimal-pad"
                value={weight}
                onChangeText={setWeight}
                autoFocus
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <SheetField
                label={t('account.purity') || 'Purity'}
                suffix="%"
                keyboardType="decimal-pad"
                value={purity}
                onChangeText={setPurity}
              />
            </View>
          </View>
          <View style={styles.chips}>
            {PURITY_CHIPS.map(p => (
              <Pressable key={p} onPress={() => setPurity(p)} style={[styles.chip, purity === p && styles.chipOn]}>
                <Text style={[styles.chipText, purity === p && styles.chipTextOn]}>{p}</Text>
              </Pressable>
            ))}
          </View>
          {credit > 0 ? (
            <SheetNote tone="good">
              <Text style={tabularNums}>
                {(t('account.creditPreview') || 'Credited as {grams} of 99.50').replace('{grams}', formatGrams(credit, gm))}
              </Text>
            </SheetNote>
          ) : null}
          <SheetNote>
            {t('account.goldHint') || 'Used on their sales gram for gram, oldest due first, or on the next sale they make.'}
          </SheetNote>
        </>
      )}

      <SheetField
        label={t('account.note') || 'Note (optional)'}
        value={note}
        onChangeText={setNote}
        placeholder={mode === 'cash'
          ? (t('account.notePlaceholderCash') || 'e.g. Will fix at 14,500')
          : (t('account.notePlaceholderGold') || 'e.g. Bar, for Diwali orders')}
      />

      {!!error && <SheetNote tone="warn">{error}</SheetNote>}

      <SheetButton
        label={mode === 'cash'
          ? (num(amount) >= 1
              ? (t('account.holdAmount') || 'Hold {amount}').replace('{amount}', inr(num(amount)))
              : (t('account.holdCash') || 'Hold cash'))
          : (t('account.keepGold') || 'Keep gold on account')}
        onPress={save}
        disabled={!canSave}
        busy={busy}
      />
    </LedgerSheet>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Brand.lineStrong,
    paddingHorizontal: 8,
  },
  tabOn: {
    borderColor: Brand.primary,
    backgroundColor: Brand.primarySoft,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.inkMuted,
    flexShrink: 1,
  },
  tabTextOn: {
    color: Brand.primary,
  },
  row: {
    flexDirection: 'row',
  },
  chips: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Brand.lineStrong,
  },
  chipOn: {
    borderColor: Brand.gold,
    backgroundColor: Brand.goldSoft,
  },
  chipText: {
    fontSize: 13,
    color: Brand.inkMuted,
    fontWeight: '600',
  },
  chipTextOn: {
    color: Brand.goldDark,
  },
});

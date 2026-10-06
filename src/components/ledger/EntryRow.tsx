import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, Coins, Hourglass, Undo2 } from 'lucide-react-native';
import type { DayBookEntry } from '../../utils/dayBook';
import { formatGrams } from '../../utils/dues';
import { Brand, tabularNums } from '../../theme/brand';

const LOCALES: Record<string, string> = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN', gu: 'gu-IN' };

/** Indian-format currency, no decimals (₹2,76,581). */
const inr = (n: number) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const shortDate = (at: number, language: string) => {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  try {
    return new Date(at).toLocaleDateString(LOCALES[language] || 'en-IN', opts);
  } catch {
    return new Date(at).toLocaleDateString('en-IN', opts);
  }
};

/** What the line is, in words, for the meta line under the name. */
const describe = (entry: DayBookEntry, t: any, gm: string): string => {
  switch (entry.detail) {
    case 'cash-held':
      // The shopkeeper's own words when they gave any ("Advance for wedding
      // orders", "Will fix at 14,500"): they say which of the two cases this
      // is, which the book cannot tell on its own.
      return entry.note
        ? `${t('khata.cashHeldShort') || 'Cash held'} · ${entry.note}`
        : (t('khata.cashHeld') || 'Cash held · rate not fixed');
    case 'gold-advance': {
      const label = t('khata.goldAdvance') || 'Gold advance';
      return entry.grossWeight && entry.purity
        ? `${label} · ${formatGrams(entry.grossWeight, gm)} @ ${entry.purity}%`
        : label;
    }
    case 'melt':
      return t('khata.meltCredit') || 'Melt credit';
    case 'fix-rate':
      return entry.rate
        ? (t('khata.rateFixedAt') || 'Rate fixed at {rate}').replace('{rate}', `${inr(entry.rate)}/${gm}`)
        : (t('khata.rateFixed') || 'Rate fixed');
    case 'gold-used':
      return t('khata.goldUsed') || 'Gold held used';
    case 'overpaid':
      return t('khata.overpaid') || 'Overpaid, kept as cash held';
    case 'cash-back':
      return t('khata.cashBack') || 'Cash returned';
    case 'gold-back':
      return t('khata.goldBack') || 'Gold returned';
    default:
      return entry.kind === 'sale' ? (t('khata.sale') || 'Sale') : (t('khata.receipt') || 'Received');
  }
};

/** Icon, its tint and the figures' colour, per kind of line. */
const LOOK: Record<DayBookEntry['kind'], { bg: string; fg: string; figure: string }> = {
  sale: { bg: Brand.dueSoft, fg: Brand.due, figure: Brand.gold },
  receipt: { bg: Brand.receivedSoft, fg: Brand.received, figure: Brand.received },
  held: { bg: Brand.goldSoft, fg: Brand.goldDark, figure: Brand.received },
  // Muted: a transfer moved money that was already counted the day it came in.
  transfer: { bg: Brand.sunken, fg: Brand.inkMuted, figure: Brand.inkMuted },
  payout: { bg: Brand.dueSoft, fg: Brand.due, figure: Brand.due },
};

/**
 * One line of the khata: a sale out to a retailer, a receipt back in, cash or
 * gold held on the retailer's account, or held money moving onto a sale.
 *
 * Direction is carried by the icon and its colour, as in a ledger's columns. A
 * sale points up and away in the colour of a due; a receipt points down and
 * in, in green. Held money waits (an hourglass for cash whose rate is not
 * fixed, coins for gold); a transfer is grey, because nothing came in that
 * day. The figures say what moved: fine gold at 99.50 and/or cash. Never a
 * combined rupee value, because pricing grams into rupees needs a rate that
 * is not today's.
 *
 * Shared by the Khata home (recent entries), the Day Book tab and the retailer
 * statement.
 */
export default function EntryRow({
  entry,
  name,
  t,
  language,
  showDate = true,
  onPress,
}: {
  entry: DayBookEntry;
  name: string;
  t: any;
  language: string;
  /** Off where the row already sits under a date heading, as in the Day Book. */
  showDate?: boolean;
  onPress?: () => void;
}) {
  const gm = t('common.gramShort') || 'gm';
  const look = LOOK[entry.kind] || LOOK.receipt;
  const Icon =
    entry.kind === 'sale' ? ArrowUpRight
      : entry.kind === 'receipt' ? ArrowDownLeft
        : entry.kind === 'transfer' ? ArrowRightLeft
          : entry.kind === 'payout' ? Undo2
            : entry.detail === 'cash-held' ? Hourglass
              : Coins;
  const meta = [
    describe(entry, t, gm),
    entry.docNo,
    showDate && entry.at ? shortDate(entry.at, language) : undefined,
  ].filter(Boolean).join(' · ');

  const gold = entry.kind === 'sale' ? entry.goldOut : entry.goldIn;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
    >
      <View style={[styles.icon, { backgroundColor: look.bg }]}>
        <Icon size={16} color={look.fg} />
      </View>
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <Text style={styles.meta} numberOfLines={1}>{meta}</Text>
      </View>
      <View style={styles.figures}>
        {gold > 0 && (
          <Text style={[styles.figure, { color: look.figure }, tabularNums]}>{formatGrams(gold, gm)}</Text>
        )}
        {entry.kind !== 'sale' && entry.cashIn > 0 && (
          <Text style={[styles.figure, { color: look.figure }, tabularNums]}>{inr(entry.cashIn)}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.line,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  text: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: Brand.ink,
  },
  meta: {
    fontSize: 12,
    color: Brand.inkMuted,
    marginTop: 1,
  },
  figures: {
    alignItems: 'flex-end',
  },
  figure: {
    fontSize: 14,
    fontWeight: '700',
  },
});

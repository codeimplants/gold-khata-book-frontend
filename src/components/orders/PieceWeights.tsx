import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Check } from 'lucide-react-native';
import { Brand, tabularNums } from '../../theme/brand';
import { type PieceDraft, silverPieceNet } from '../../utils/pieceWeights';
import { cashValueOfFine995, isLinePriceable, priceLine } from '../../utils/goldPricing';
import { formatCurrencyValue } from '../../utils/formatter';

const num = (v?: string) => Number(String(v ?? '').trim()) || 0;

/**
 * A row per piece, laid out to take as little room as a phone allows.
 *
 *   gold    each piece its own weight, purity, wastage and rate (with the
 *           live-rate tick), and the fine weight and value it comes to: two
 *           pieces on one line are not always alike. Two short lines per
 *           piece on a phone, one table row on a wide screen.
 *   silver  one line per piece: gross, packet, and the net they leave
 *
 * Plain TextInputs, not the form's floating-label fields: a line of twelve
 * pieces is dozens of inputs, and the light ones keep typing quick on a
 * low-end phone. Enter moves to the next box, so a counter can weigh and type
 * without reaching for the screen between pieces.
 */
export default function PieceWeights({
  metal,
  pieces,
  onChange,
  gramShort,
  labels,
  liveRate = 0,
  liveLabel = 'Live',
}: {
  metal: 'gold' | 'silver';
  pieces: PieceDraft[];
  onChange: (index: number, change: Partial<PieceDraft>) => void;
  gramShort: string;
  labels: {
    piece: string; weight: string; gross: string; packet: string; net: string;
    purity?: string; wastage?: string; rate?: string; fine?: string;
  };
  /** Gold: today's rate, which a ticked piece follows and a blank rate uses. */
  liveRate?: number;
  /** "Live" or "Shop", whichever today's rate is. */
  liveLabel?: string;
}) {
  const { width } = useWindowDimensions();
  const wide = width >= 640;
  const refs = React.useRef<(TextInput | null)[]>([]);
  const focus = (i: number) => refs.current[i]?.focus();

  if (metal === 'gold') {
    // Four inputs a piece: refs at 4i (weight), +1 purity, +2 wastage, +3 rate.
    const input = (i: number, k: 0 | 1 | 2 | 3, value: string | undefined, change: (v: string) => Partial<PieceDraft>, label: string, placeholder: string) => (
      <TextInput
        ref={r => { refs.current[4 * i + k] = r; }}
        value={value ?? ''}
        onChangeText={v => onChange(i, change(v))}
        keyboardType="decimal-pad"
        returnKeyType={i === pieces.length - 1 && k === 3 ? 'done' : 'next'}
        blurOnSubmit={i === pieces.length - 1 && k === 3}
        onSubmitEditing={() => focus(4 * i + k + 1)}
        placeholder={placeholder}
        placeholderTextColor={Brand.inkFaint}
        style={[styles.lineInput, tabularNums]}
        accessibilityLabel={`${labels.piece} ${i + 1} ${label}`}
      />
    );

    const liveTick = (i: number, p: PieceDraft) => liveRate > 0 && (
      <Pressable
        onPress={() => onChange(i, p.useLiveRate
          ? { useLiveRate: false }
          : { useLiveRate: true, rate: String(liveRate) })}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: !!p.useLiveRate }}
        hitSlop={6}
        style={styles.tick}
      >
        <View style={[styles.box, p.useLiveRate && styles.boxOn]}>
          {p.useLiveRate && <Check size={12} color="#FFFFFF" />}
        </View>
        <Text style={styles.tickText} numberOfLines={1}>{liveLabel} {formatCurrencyValue(liveRate)}</Text>
      </Pressable>
    );

    const result = (p: PieceDraft) => {
      if (!isLinePriceable({ weight: p.weight, purity: p.purity })) return null;
      const priced = priceLine({ weight: num(p.weight), purity: num(p.purity), wastage: num(p.wastage) });
      const value = cashValueOfFine995(priced.fine995, num(p.rate) || liveRate);
      return { fine: priced.fine995, value, charged: `${priced.chargedPurity} + ${num(p.wastage)} = ${priced.effectivePercent}%` };
    };

    if (wide) {
      return (
        <View>
          <View style={styles.head}>
            <Text style={[styles.th, styles.colNo]}>#</Text>
            <Text style={[styles.th, styles.colIn]}>{labels.weight}</Text>
            <Text style={[styles.th, styles.colIn]}>{labels.purity}</Text>
            <Text style={[styles.th, styles.colIn]}>{labels.wastage}</Text>
            <Text style={[styles.th, styles.colRate]}>{labels.rate}</Text>
            <Text style={[styles.th, styles.colFine]}>{labels.fine}</Text>
          </View>
          {pieces.map((p, i) => {
            const r = result(p);
            return (
              <View key={i} style={styles.line}>
                <Text style={[styles.lineNo, styles.colNo]}>{i + 1}</Text>
                <View style={styles.colIn}>{input(i, 0, p.weight, v => ({ weight: v }), labels.weight, gramShort)}</View>
                <View style={styles.colIn}>{input(i, 1, p.purity, v => ({ purity: v }), labels.purity || 'Purity', '%')}</View>
                <View style={styles.colIn}>{input(i, 2, p.wastage, v => ({ wastage: v }), labels.wastage || 'Wastage', '%')}</View>
                <View style={styles.colRate}>
                  {input(i, 3, p.rate, v => ({ rate: v, useLiveRate: false }), labels.rate || 'Rate', '₹')}
                  {liveTick(i, p)}
                </View>
                <View style={styles.colFine}>
                  <Text style={[styles.fine, tabularNums]} numberOfLines={1}>{r ? r.fine.toFixed(3) : '—'}</Text>
                  {!!r && <Text style={[styles.value, tabularNums]} numberOfLines={1}>{formatCurrencyValue(r.value)}</Text>}
                </View>
              </View>
            );
          })}
        </View>
      );
    }

    // A phone: two short lines a piece, then what it comes to.
    return (
      <View>
        {pieces.map((p, i) => {
          const r = result(p);
          return (
            <View key={i} style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={[styles.lineNo, styles.colNo]}>{i + 1}</Text>
                <View style={styles.colIn}>
                  <Text style={styles.cap}>{labels.weight}</Text>
                  {input(i, 0, p.weight, v => ({ weight: v }), labels.weight, gramShort)}
                </View>
                <View style={styles.colIn}>
                  <Text style={styles.cap}>{labels.purity}</Text>
                  {input(i, 1, p.purity, v => ({ purity: v }), labels.purity || 'Purity', '%')}
                </View>
                <View style={styles.colIn}>
                  <Text style={styles.cap}>{labels.wastage}</Text>
                  {input(i, 2, p.wastage, v => ({ wastage: v }), labels.wastage || 'Wastage', '%')}
                </View>
              </View>
              <View style={[styles.cardRow, { marginTop: 6 }]}>
                <View style={styles.colNo} />
                <View style={[styles.colIn, { flex: 1.4 }]}>
                  <Text style={styles.cap}>{labels.rate}</Text>
                  {input(i, 3, p.rate, v => ({ rate: v, useLiveRate: false }), labels.rate || 'Rate', '₹')}
                </View>
                <View style={[styles.colIn, { flex: 1.6, justifyContent: 'flex-end', paddingTop: 14 }]}>
                  {liveTick(i, p)}
                </View>
              </View>
              {!!r && (
                <View style={[styles.cardRow, styles.resultRow]}>
                  <View style={styles.colNo} />
                  <Text style={styles.charged}>{r.charged}</Text>
                  <Text style={[styles.fine, tabularNums]}>{r.fine.toFixed(3)} {gramShort}</Text>
                  <Text style={[styles.value, tabularNums, { marginLeft: 8 }]}>{formatCurrencyValue(r.value)}</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    );
  }

  // Silver: two inputs per piece, refs at 2i (gross) and 2i + 1 (packet).
  return (
    <View>
      <View style={styles.head}>
        <Text style={[styles.th, styles.colNo]}>#</Text>
        <Text style={[styles.th, styles.colIn]}>{labels.gross}</Text>
        <Text style={[styles.th, styles.colIn]}>{labels.packet}</Text>
        <Text style={[styles.th, styles.colNet]}>{labels.net}</Text>
      </View>
      {pieces.map((p, i) => {
        const net = silverPieceNet(p);
        return (
          <View key={i} style={styles.line}>
            <Text style={[styles.lineNo, styles.colNo]}>{i + 1}</Text>
            <View style={styles.colIn}>
              <TextInput
                ref={r => { refs.current[2 * i] = r; }}
                value={p.weight}
                onChangeText={v => onChange(i, { weight: v })}
                keyboardType="decimal-pad"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => focus(2 * i + 1)}
                placeholder={gramShort}
                placeholderTextColor={Brand.inkFaint}
                style={[styles.lineInput, tabularNums]}
                accessibilityLabel={`${labels.piece} ${i + 1} ${labels.gross}`}
              />
            </View>
            <View style={styles.colIn}>
              <TextInput
                ref={r => { refs.current[2 * i + 1] = r; }}
                value={p.packet}
                onChangeText={v => onChange(i, { packet: v })}
                keyboardType="decimal-pad"
                returnKeyType={i < pieces.length - 1 ? 'next' : 'done'}
                blurOnSubmit={i === pieces.length - 1}
                onSubmitEditing={() => focus(2 * i + 2)}
                placeholder="0"
                placeholderTextColor={Brand.inkFaint}
                style={[styles.lineInput, tabularNums]}
                accessibilityLabel={`${labels.piece} ${i + 1} ${labels.packet}`}
              />
            </View>
            <Text style={[styles.lineNet, styles.colNet, tabularNums, { color: net > 0 ? Brand.silver : Brand.inkFaint }]} numberOfLines={1}>
              {net > 0 ? net.toFixed(3) : '—'}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** "Weigh all together" / "Weigh each piece": the switch between the two ways. */
export function WeighModeLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={6} style={styles.link}>
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', paddingBottom: 4 },
  th: { fontSize: 11, fontWeight: '700', color: Brand.inkMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  line: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  colNo: { width: 22 },
  colIn: { flex: 1, marginRight: 6 },
  colNet: { width: 78, textAlign: 'right' },
  colRate: { flex: 1.6, marginRight: 6, gap: 4 },
  colFine: { width: 96, alignItems: 'flex-end' },
  lineNo: { fontSize: 12, fontWeight: '700', color: Brand.inkMuted },
  lineInput: {
    height: 40,
    borderWidth: 1,
    borderColor: Brand.lineStrong,
    borderRadius: 10,
    backgroundColor: Brand.card,
    textAlign: 'right',
    paddingHorizontal: 8,
    fontSize: 15,
    color: Brand.ink,
    paddingVertical: 0,
  },
  lineNet: { fontSize: 14, fontWeight: '700' },
  // A gold piece on a phone: a light card, so piece 3's rate is not read as
  // piece 4's.
  card: {
    borderWidth: 1,
    borderColor: Brand.line,
    borderRadius: 10,
    backgroundColor: Brand.paper,
    padding: 8,
    marginBottom: 8,
  },
  cardRow: { flexDirection: 'row', alignItems: 'flex-end' },
  cap: { fontSize: 10, fontWeight: '700', color: Brand.inkMuted, marginBottom: 2, marginLeft: 2, textTransform: 'uppercase' },
  resultRow: { alignItems: 'center', marginTop: 6 },
  charged: { flex: 1, fontSize: 11, color: Brand.goldDark },
  fine: { fontSize: 13, fontWeight: '700', color: Brand.gold },
  value: { fontSize: 12, color: Brand.inkMuted },
  tick: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 26 },
  box: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Brand.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  tickText: { fontSize: 12, color: Brand.inkMuted, flexShrink: 1 },
  link: { alignSelf: 'flex-start', paddingVertical: 2 },
  linkText: { fontSize: 13, fontWeight: '700', color: Brand.primary },
});

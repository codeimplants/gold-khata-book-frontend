import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Brand, tabularNums } from '../../theme/brand';
import { type PieceDraft, silverPieceNet } from '../../utils/pieceWeights';

/**
 * One input per piece, laid out to take as little room as a phone allows.
 *
 *   gold    a grid of weights, three across on a phone and six on a wide
 *           screen: one number per piece needs no more than a small box
 *   silver  one line per piece: gross, packet, and the net they leave
 *
 * Plain TextInputs, not the form's floating-label fields: a line of twelve
 * pieces is twenty-four inputs, and the light ones keep typing quick on a
 * low-end phone. Enter moves to the next box, so a counter can weigh and type
 * without reaching for the screen between pieces.
 */
export default function PieceWeights({
  metal,
  pieces,
  onChange,
  gramShort,
  labels,
}: {
  metal: 'gold' | 'silver';
  pieces: PieceDraft[];
  onChange: (index: number, change: Partial<PieceDraft>) => void;
  gramShort: string;
  labels: { piece: string; weight: string; gross: string; packet: string; net: string };
}) {
  const { width } = useWindowDimensions();
  const wide = width >= 640;
  const refs = React.useRef<(TextInput | null)[]>([]);
  const focus = (i: number) => refs.current[i]?.focus();

  if (metal === 'gold') {
    const columns = wide ? 6 : 3;
    return (
      <View style={styles.grid}>
        {pieces.map((p, i) => (
          <View key={i} style={{ width: `${100 / columns}%`, padding: 3 }}>
            <View style={styles.cell}>
              <Text style={styles.cellNo}>{i + 1}</Text>
              <TextInput
                ref={r => { refs.current[i] = r; }}
                value={p.weight}
                onChangeText={v => onChange(i, { weight: v })}
                keyboardType="decimal-pad"
                returnKeyType={i < pieces.length - 1 ? 'next' : 'done'}
                blurOnSubmit={i === pieces.length - 1}
                onSubmitEditing={() => focus(i + 1)}
                placeholder={gramShort}
                placeholderTextColor={Brand.inkFaint}
                style={[styles.cellInput, tabularNums]}
                accessibilityLabel={`${labels.piece} ${i + 1} ${labels.weight}`}
              />
            </View>
          </View>
        ))}
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 },
  cell: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderWidth: 1,
    borderColor: Brand.lineStrong,
    borderRadius: 10,
    backgroundColor: Brand.card,
    paddingLeft: 8,
  },
  cellNo: { fontSize: 11, fontWeight: '700', color: Brand.inkMuted, width: 18 },
  cellInput: { flex: 1, minWidth: 0, height: '100%', textAlign: 'right', paddingRight: 8, fontSize: 15, color: Brand.ink, paddingVertical: 0 },
  head: { flexDirection: 'row', alignItems: 'center', paddingBottom: 4 },
  th: { fontSize: 11, fontWeight: '700', color: Brand.inkMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  line: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  colNo: { width: 22 },
  colIn: { flex: 1, marginRight: 6 },
  colNet: { width: 78, textAlign: 'right' },
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
  link: { alignSelf: 'flex-start', paddingVertical: 2 },
  linkText: { fontSize: 13, fontWeight: '700', color: Brand.primary },
});

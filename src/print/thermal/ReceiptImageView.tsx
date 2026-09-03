import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { ReceiptLine } from './receiptModel';

/**
 * The receipt as real React Native views, so it can be screenshotted and printed as a
 * bitmap. This exists solely to make non-Latin scripts printable: RN's Text already
 * shapes Devanagari and Gujarati correctly using the device's own fonts, which is why
 * this approach was chosen over a graphics library that would need fonts bundled and
 * complex-script shaping configured (and would add several MB to the app).
 *
 * Laid out at exactly PRINTER_DOTS wide so the capture maps 1:1 onto the print head
 * with no reflow between what is measured and what is printed.
 */

export const CAPTURE_WIDTH = 384;

/**
 * Height of one rasterised line, in printer dots.
 *
 * Every line in a strip is forced to exactly this height so the captured image can be
 * sliced into per-line bands by arithmetic (line N is rows N*STRIP_LINE_HEIGHT to
 * (N+1)*STRIP_LINE_HEIGHT) rather than by measuring each line's layout.
 *
 * 32 keeps rasterised lines close to the printer's own 24-dot text rows so mixed
 * text/image receipts do not look ragged, while leaving headroom for Devanagari
 * matras and conjuncts, which extend above and below the Latin baseline.
 */
export const STRIP_LINE_HEIGHT = 32;

/** A `large` line (the shop name) is printed at double height in text mode, so its
 * rasterised counterpart must match or a Marathi shop name comes out visually smaller
 * than an English one. */
export const STRIP_LARGE_LINE_HEIGHT = 60;

/** Height of one strip cell. Heights are declared per line rather than measured, so
 * the captured strip can still be sliced into bands arithmetically. */
/** Logo box height in printer dots. Kept modest: every dot of logo is paper spent on
 * every receipt, and thermal output is 1-bit so detail is lost regardless. */
export const STRIP_LOGO_HEIGHT = 96;

export function stripCellHeight(line: ReceiptLine): number {
  if (line.kind === 'logo') return STRIP_LOGO_HEIGHT;
  return line.kind === 'text' && line.large ? STRIP_LARGE_LINE_HEIGHT : STRIP_LINE_HEIGHT;
}

/** Row offsets of each cell in the strip, plus the total height. */
export function stripLayout(lines: ReceiptLine[]): { offsets: number[]; total: number } {
  const offsets: number[] = [];
  let y = 0;
  lines.forEach(line => {
    offsets.push(y);
    y += stripCellHeight(line);
  });
  return { offsets, total: y };
}

/** Monospace keeps the two-column rows aligned exactly as the text renderer does.
 * Indic glyphs fall back to the system font automatically. */
const MONO = { fontFamily: 'monospace' as const };

const styles = StyleSheet.create({
  page: {
    width: CAPTURE_WIDTH,
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  line: { color: '#000000', fontSize: 19, lineHeight: 26, ...MONO },
  large: { fontSize: 30, lineHeight: 38, fontWeight: 'bold' },
  bold: { fontWeight: 'bold' },
  center: { textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  // The left cell shrinks so a long item name wraps instead of pushing the amount
  // off the paper.
  rowLeft: { flexShrink: 1, paddingRight: 8 },
  divider: { color: '#000000', fontSize: 16, lineHeight: 20, ...MONO },
  space: { height: 12 },
});

const stripStyles = StyleSheet.create({
  strip: { width: CAPTURE_WIDTH, backgroundColor: '#ffffff' },
  cell: {
    width: CAPTURE_WIDTH,
    paddingHorizontal: 8,
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  cellRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cellText: { color: '#000000', fontSize: 20, ...MONO },
  // The shop name is double-height in text mode; matching that here keeps a Marathi
  // shop header from printing smaller than an English one.
  cellLarge: { fontSize: 38, fontWeight: 'bold' },
  cellLeft: { flexShrink: 1, paddingRight: 8 },
  // Explicit pixel dimensions, not '100%': a percentage-sized Image resolves against a
  // parent whose height is not settled at measure time, and can lay out to zero — which
  // captures as a blank band with no error anywhere.
  logo: { width: CAPTURE_WIDTH - 16, height: STRIP_LOGO_HEIGHT - 8 },
});

/**
 * Only the lines that need rasterising, stacked at a fixed height each.
 *
 * Captured in one pass rather than one capture per line: capture overhead is largely
 * fixed (~150ms observed), so N captures would cost N times that for no benefit.
 */
export const ReceiptStripView = ({
  lines,
  onImageSettled,
}: {
  lines: ReceiptLine[];
  /** Fires once per logo, on load or failure. Capture must wait for these: an image
   * that has not painted yet captures as blank. `ok` distinguishes a decode failure
   * from a slow load, which look identical on paper. */
  onImageSettled?: (ok: boolean) => void;
}) => (
  <View style={stripStyles.strip}>
    {lines.map((line, i) => {
      const large = line.kind === 'text' && line.large;
      return (
        <View key={i} style={[stripStyles.cell, { height: stripCellHeight(line) }]}>
          {line.kind === 'logo' ? (
            <Image
              source={{ uri: line.uri }}
              style={stripStyles.logo}
              // `contain` so a non-square logo keeps its proportions inside the fixed
              // box that band-slicing depends on.
              resizeMode="contain"
              onLoad={() => onImageSettled?.(true)}
              onError={() => onImageSettled?.(false)}
            />
          ) : line.kind === 'row' ? (
            <View style={stripStyles.cellRow}>
              <Text
                numberOfLines={1}
                style={[stripStyles.cellText, stripStyles.cellLeft, line.bold && styles.bold]}
              >
                {line.left}
              </Text>
              <Text numberOfLines={1} style={[stripStyles.cellText, line.bold && styles.bold]}>
                {line.right}
              </Text>
            </View>
          ) : (
            <Text
              numberOfLines={1}
              // Long addresses shrink to fit rather than being clipped: losing the
              // tail of an address is worse than a slightly smaller line.
              adjustsFontSizeToFit
              minimumFontScale={0.6}
              style={[
                stripStyles.cellText,
                large && stripStyles.cellLarge,
                line.kind === 'text' && line.bold && styles.bold,
                line.kind === 'text' && line.align === 'center' && styles.center,
              ]}
            >
              {line.kind === 'text' ? line.text : ''}
            </Text>
          )}
        </View>
      );
    })}
  </View>
);

const ReceiptImageView = ({ lines }: { lines: ReceiptLine[] }) => (
  <View style={styles.page}>
    {lines.map((line, i) => {
      switch (line.kind) {
        case 'divider':
          return (
            <Text key={i} style={styles.divider} numberOfLines={1}>
              {'-'.repeat(48)}
            </Text>
          );
        case 'space':
          return <View key={i} style={styles.space} />;
        case 'logo':
          return (
            <Image
              key={i}
              source={{ uri: line.uri }}
              style={{ width: '100%', height: STRIP_LOGO_HEIGHT }}
              resizeMode="contain"
            />
          );
        case 'row':
          return (
            <View key={i} style={styles.row}>
              <Text style={[styles.line, styles.rowLeft, line.bold && styles.bold]}>
                {line.left}
              </Text>
              <Text style={[styles.line, line.bold && styles.bold]}>{line.right}</Text>
            </View>
          );
        case 'text':
          return (
            <Text
              key={i}
              style={[
                styles.line,
                line.large && styles.large,
                line.bold && styles.bold,
                line.align === 'center' && styles.center,
              ]}
            >
              {line.text}
            </Text>
          );
        default:
          return null;
      }
    })}
  </View>
);

export default ReceiptImageView;

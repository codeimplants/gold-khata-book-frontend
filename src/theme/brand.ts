/**
 * Gold Khata Book's own visual identity: the "Ledger" design language.
 *
 * This app was forked from SoneBill, a retail billing app, and shipped with
 * SoneBill's look: indigo, violet and fuchsia gradients, a differently coloured
 * gradient header on every tab, and gradient icon chips. On 2026-09-25 App
 * Review rejected it under guideline 4.3(a) as a repackaged copy of SoneBill
 * (see APP_STORE_4.3_REWORK.md). This palette is a deliberate break from that:
 * flat and built around a bookkeeper's ledger and the trade it serves: emerald
 * and gold on pearl, with figures that line up in columns, and a few gold
 * jewellery motifs (components/ledger/Motifs.tsx).
 *
 * Pearl, not ivory (2026-10-06): SoneBill's design-lab work moves SoneBill to
 * warm ivory with gold lattice and mandala patterns. This app stays on a cool
 * pearl ground with its own motifs, so the two do not converge.
 *
 * Rules that keep it from drifting back:
 * - No purple, indigo, violet or fuchsia anywhere. Those are SoneBill's.
 * - No gradient headers, buttons or icon chips. One flat header colour on
 *   every tab.
 * - Red means "owed to you". Keep it out of decoration so it stays legible as a
 *   balance.
 * - Gold text uses `gold` (#87661F, 5.3:1 on white). The lighter `goldFill`
 *   is only 4.3:1, below WCAG AA for small text, so it is for fills and large
 *   glyphs only. `goldLeaf` is decoration on the green band, never text.
 * - Motifs are flat gold line or fill: no lattice, no mandala, no gradients.
 */
export const Brand = {
  primary: '#0E4D3C',
  primaryDark: '#0A3A2D',
  primaryDeep: '#072A20',
  primaryMid: '#145F4A',
  primarySoft: '#E7F0EC',
  primaryTint: '#F3F8F5',

  gold: '#87661F',
  goldDark: '#6F5318',
  goldFill: '#9A7425',
  goldLight: '#C6A25A',
  goldSoft: '#F5ECD7',
  goldTint: '#FBF6EA',
  /** Bright metallic gold for the keri on the emerald band. Decoration only. */
  goldLeaf: '#D9B96A',

  paper: '#F2F4EF',
  card: '#FFFFFF',
  line: '#DCE2D8',
  lineStrong: '#C9D2C5',
  sunken: '#E8ECE5',

  ink: '#1D1B16',
  inkSoft: '#3A372F',
  inkMuted: '#6B665B',
  inkFaint: '#A39E92',

  due: '#B42318',
  dueSoft: '#FDECEA',
  received: '#1E7B4F',
  receivedSoft: '#E8F4EE',
} as const;

/** The same green as a gluestack colour scale, registered as `$brand50` to `$brand950`. */
export const BrandScale = {
  brand50: '#F3F8F5',
  brand100: '#E7F0EC',
  brand200: '#C3DDD2',
  brand300: '#93C4B1',
  brand400: '#5FA88E',
  brand500: '#2E8B6E',
  brand600: '#145F4A',
  brand700: '#0E4D3C',
  brand800: '#0A3A2D',
  brand900: '#072A20',
  brand950: '#041A14',
} as const;

/** Antique gold as a gluestack scale, registered as `$gold50` to `$gold900`. */
export const GoldScale = {
  gold50: '#FBF6EA',
  gold100: '#F5ECD7',
  gold200: '#EBD9AE',
  gold300: '#DCC38A',
  gold400: '#C6A25A',
  gold500: '#B08A3A',
  gold600: '#9A7425',
  gold700: '#87661F',
  gold800: '#6F5318',
  gold900: '#4A3812',
} as const;

/**
 * Figures in a ledger line up digit under digit. Use on every balance, weight
 * and amount.
 */
export const tabularNums = { fontVariant: ['tabular-nums'] as ['tabular-nums'] };

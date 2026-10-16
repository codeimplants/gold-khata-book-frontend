/**
 * Gold Khata Book's own visual identity: the "Ledger" design language, in the
 * Twilight palette.
 *
 * This app was forked from SoneBill, a retail billing app, and shipped with
 * SoneBill's look: indigo, violet and fuchsia gradients, a differently coloured
 * gradient header on every tab, and gradient icon chips. On 2026-09-25 App
 * Review rejected it under guideline 4.3(a) as a repackaged copy of SoneBill
 * (see APP_STORE_4.3_REWORK.md). The Ledger design is a deliberate break from
 * that: built around a bookkeeper's ledger and the trade it serves, with
 * figures that line up in columns and a few gold jewellery motifs
 * (components/ledger/Motifs.tsx).
 *
 * Twilight (2026-10-16): the owner chose this palette from the theme studio,
 * replacing the emerald of 2026-10-05. Sapphire into peacock blue, the colours
 * of a jewellery bazaar in the evening, with antique gold and a chandbali
 * (crescent-moon earring) as the motif. The gradient is the one exception to
 * the flat rule and it is fenced in (below).
 *
 * Pearl, not ivory (2026-10-06): SoneBill's design-lab work moves SoneBill to
 * warm ivory with gold lattice and mandala patterns. This app stays on a cool
 * pearl ground with its own motifs, so the two do not converge.
 *
 * Rules that keep it from drifting back:
 * - No purple, indigo, violet or fuchsia anywhere. Those are SoneBill's. The
 *   blues here are a dark sapphire and greyish tints that lean toward peacock,
 *   never the bright, saturated indigo family (#4F46E5, #6366F1, #EEF2FF).
 * - One gradient, `TwilightGradient`, on the header band and the login cover
 *   only. It is the same on every tab. No gradient on the tab bar, buttons,
 *   cards or icon chips: SoneBill's bar put the active icon in a gradient
 *   rounded square.
 * - Red means "owed to you". Keep it out of decoration so it stays legible as a
 *   balance.
 * - Gold text uses `gold` (#87661F, 5.3:1 on white). The lighter `goldFill`
 *   is only 4.3:1, below WCAG AA for small text, so it is for fills and large
 *   glyphs only. `goldLeaf` is decoration on the twilight band, never text.
 * - Motifs are flat gold line or fill: no lattice, no mandala.
 */
export const Brand = {
  primary: '#132859',
  primaryDark: '#0C1C42',
  primaryDeep: '#081430',
  primaryMid: '#1D3A75',
  primarySoft: '#E4ECF3',
  primaryTint: '#F2F6F9',
  /** Where the twilight band ends. Part of the gradient, not a colour of its own. */
  peacock: '#0B5870',

  gold: '#87661F',
  goldDark: '#6F5318',
  goldFill: '#9A7425',
  goldLight: '#C6A25A',
  goldSoft: '#F5ECD7',
  goldTint: '#FBF6EA',
  /** Bright metallic gold for the chandbali on the twilight band. Decoration only. */
  goldLeaf: '#DDBD6D',

  paper: '#F1F4F7',
  card: '#FFFFFF',
  line: '#DAE0E8',
  lineStrong: '#C5CEDA',
  sunken: '#E6EAF0',

  ink: '#171B23',
  inkSoft: '#353B48',
  inkMuted: '#5C6372',
  inkFaint: '#9399A6',

  due: '#B42318',
  dueSoft: '#FDECEA',
  received: '#1E7B4F',
  receivedSoft: '#E8F4EE',
} as const;

/**
 * The twilight band: sapphire, through a deep blue, into peacock. Props for
 * react-native-linear-gradient (components/ledger/TwilightBand.tsx). Corner to
 * corner, so on a wide header it reads left to right.
 */
export const TwilightGradient = {
  colors: [Brand.primary, '#0E3F66', Brand.peacock],
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
};

/** The sapphire as a gluestack colour scale, registered as `$brand50` to `$brand950`. */
export const BrandScale = {
  brand50: '#F2F6F9',
  brand100: '#E4ECF3',
  brand200: '#C3D3E2',
  brand300: '#93B0CB',
  brand400: '#5A84AE',
  brand500: '#2D5A8E',
  brand600: '#1D3A75',
  brand700: '#132859',
  brand800: '#0C1C42',
  brand900: '#081430',
  brand950: '#040B1D',
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

import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Path, Polygon } from 'react-native-svg';
import { Brand } from '../../theme/brand';

/**
 * The jewellery in the Ledger design: a few flat gold motifs from the trade a
 * wholesaler works in, used sparingly on the twilight band and a pearl ground.
 *
 *   ChandbaliMotif  a chandbali, the crescent-moon earring, in gold line,
 *                   faint on the twilight band and the login cover.
 *   GemBullet       a cut stone that marks a card's heading.
 *   GoldFrame       a fine gold rule inside the one card a screen is about.
 *
 * The chandbali replaced a keri (paisley) on 2026-10-16, with the Twilight
 * palette the owner chose (src/theme/brand.ts). The keri was drawn for the
 * emerald band.
 *
 * A bead chain under the headers and a beaded rim on the "+" button were tried
 * on 2026-10-06 and removed the same day: the owner did not like them. The
 * headers keep their plain gold rule, and the "+" carries no ornament.
 *
 * Deliberately NOT SoneBill's motifs. SoneBill's design-lab work (approved
 * 2026-09-25/26) puts a jaali lattice and a mandala watermark on warm ivory,
 * under a purple-to-pink gradient. App Review rejected this app as a SoneBill
 * copy under 4.3(a) (APP_STORE_4.3_REWORK.md), so: no lattice, no mandala, no
 * ivory. Everything here is flat gold line or fill.
 */

/** An SVG transform applied about the point (x, y) rather than the origin. */
const about = (x: number, y: number, t: string) => `translate(${x} ${y}) ${t} translate(${-x} ${-y})`;

/**
 * A chandbali in a 100 x 100 box: a stud, a small dome, the crescent with a
 * cut stone in it, and three drops. Line work only, so it reads as a watermark
 * at low opacity and never as a picture competing with the figures.
 */
export const ChandbaliMotif = ({
  size = 120,
  color = Brand.goldLeaf,
  opacity = 0.28,
  rotate = 0,
  style,
}: {
  /** Width and height in points. */
  size?: number;
  color?: string;
  opacity?: number;
  /** Degrees, around its own centre. */
  rotate?: number;
  style?: StyleProp<ViewStyle>;
}) => (
  <View style={[{ width: size, height: size }, style]} pointerEvents="none">
    <Svg width={size} height={size} viewBox="0 0 100 100" opacity={opacity}>
      <G
        transform={about(50, 50, `rotate(${rotate})`)}
        fill="none"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* The stud, and the hook down to the dome. */}
        <Circle cx={50} cy={12} r={6} />
        <Path d="M50 18 V28" />
        <Path d="M26 48 C30 34 40 28 50 28 S70 34 74 48" />
        {/* The crescent, horns up, with a cut stone at its lowest point. */}
        <Path d="M16 38 C16 62 31 80 50 80 S84 62 84 38 C77 52 65 60 50 60 S23 52 16 38 Z" />
        <Path d="M50 63 L55 70 L50 77 L45 70 Z" />
        {/* Three drops below. */}
        <Path d="M50 82 C46.5 87 46.5 91 50 92 C53.5 91 53.5 87 50 82 Z" />
        <Path d="M36 79 C32.5 84 32.5 88 36 89 C39.5 88 39.5 84 36 79 Z" />
        <Path d="M64 79 C60.5 84 60.5 88 64 89 C67.5 88 67.5 84 64 79 Z" />
      </G>
    </Svg>
  </View>
);

/** A small cut stone, set before a card's heading. */
export const GemBullet = ({ size = 8, style }: { size?: number; style?: StyleProp<ViewStyle> }) => (
  <View style={[{ width: size, height: size }, style]} pointerEvents="none">
    <Svg width={size} height={size} viewBox="0 0 10 10">
      <Polygon points="5,0 10,5 5,10 0,5" fill={Brand.goldFill} />
      <Polygon points="5,0 10,5 5,5" fill={Brand.goldLight} />
      <Polygon points="0,5 5,5 5,10" fill={Brand.goldDark} />
    </Svg>
  </View>
);

/**
 * A fine gold frame inside a card's edge, like the inner rule of a jewellery
 * box or a hallmark certificate. Only on the one card a screen is about (the
 * Owed card on the Khata home, the balance on a statement), so it means
 * "this is the figure".
 */
export const GoldFrame = ({ radius = 7 }: { radius?: number }) => (
  <View
    pointerEvents="none"
    style={{
      position: 'absolute',
      top: 4,
      left: 4,
      right: 4,
      bottom: 4,
      borderWidth: 1,
      borderColor: Brand.goldLight,
      borderRadius: radius,
      opacity: 0.75,
    }}
  />
);

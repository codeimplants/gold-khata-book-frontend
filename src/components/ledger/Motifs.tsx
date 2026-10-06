import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Path, Polygon } from 'react-native-svg';
import { Brand } from '../../theme/brand';

/**
 * The jewellery in the Ledger design: a few flat gold motifs from the trade a
 * wholesaler works in, used sparingly on a plain emerald-and-pearl ground.
 *
 *   KeriMotif     a keri (paisley) drawn as filigree, the shape of the mango
 *                 necklace, faint on the green band and the login cover.
 *   GemBullet     a cut stone that marks a card's heading.
 *   GoldFrame     a fine gold rule inside the one card a screen is about.
 *
 * A bead chain under the headers and a beaded rim on the "+" button were tried
 * on 2026-10-06 and removed the same day: the owner did not like them. The
 * headers keep their plain gold rule, the "+" its plain gold coin.
 *
 * Deliberately NOT SoneBill's motifs. SoneBill's design-lab work (approved
 * 2026-09-25/26) puts a jaali lattice and a mandala watermark on warm ivory,
 * under a purple-to-pink gradient. App Review rejected this app as a SoneBill
 * copy under 4.3(a) (APP_STORE_4.3_REWORK.md), so: no lattice, no mandala, no
 * gradients, no ivory. Everything here is flat gold line or fill.
 */

/** An SVG transform applied about the point (x, y) rather than the origin. */
const about = (x: number, y: number, t: string) => `translate(${x} ${y}) ${t} translate(${-x} ${-y})`;

// The keri, in a 120 x 160 box: a teardrop whose tip curls up and to the right.
const KERI = 'M60 152 C26 152 8 126 8 96 C8 60 34 34 64 22 C80 15 92 8 98 2 C104 14 100 30 90 40 C110 60 114 92 104 118 C96 140 80 152 60 152 Z';

/**
 * A keri (paisley) in filigree: the outline, a beaded edge, an inner keri and
 * a small flower at its heart. Line work only, so it reads as a watermark at
 * low opacity and never as a picture competing with the figures.
 */
export const KeriMotif = ({
  size = 120,
  color = Brand.goldLeaf,
  opacity = 0.16,
  rotate = 0,
  style,
}: {
  /** Height in points; the width follows at 3:4. */
  size?: number;
  color?: string;
  opacity?: number;
  /** Degrees, around its own centre. */
  rotate?: number;
  style?: StyleProp<ViewStyle>;
}) => {
  const width = (size * 120) / 160;
  return (
    <View style={[{ width, height: size }, style]} pointerEvents="none">
      <Svg width={width} height={size} viewBox="0 0 120 160" opacity={opacity}>
        <G transform={about(60, 90, `rotate(${rotate})`)}>
          {/* The beaded edge, just outside the outline. */}
          <G transform={about(60, 92, 'scale(1.07)')}>
            <Path d={KERI} fill="none" stroke={color} strokeWidth={3.2} strokeLinecap="round" strokeDasharray="0.01 7.5" />
          </G>
          <Path d={KERI} fill="none" stroke={color} strokeWidth={2.2} />
          {/* The inner keri, and a third inside it. */}
          <G transform={about(60, 100, 'scale(0.66)')}>
            <Path d={KERI} fill="none" stroke={color} strokeWidth={2.6} />
          </G>
          <G transform={about(60, 106, 'scale(0.38)')}>
            <Path d={KERI} fill="none" stroke={color} strokeWidth={3.6} />
          </G>
          {/* A six-petal flower at the heart. */}
          {[0, 60, 120, 180, 240, 300].map(a => (
            <G key={a} transform={about(58, 108, `rotate(${a})`)}>
              <Path d="M58 108 C54 101 55 95 58 92 C61 95 62 101 58 108 Z" fill={color} />
            </G>
          ))}
          <Circle cx={58} cy={108} r={2.6} fill={color} />
          {/* The curl of the tip. */}
          <Path d="M98 2 C88 6 84 16 90 22 C94 26 100 22 98 17" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
        </G>
      </Svg>
    </View>
  );
};

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

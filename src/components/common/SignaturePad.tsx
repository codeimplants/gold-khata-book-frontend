import React from 'react';
import {
  PanResponder,
  View,
  StyleSheet,
  LayoutChangeEvent,
  GestureResponderEvent,
  StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Box, Text } from '@gluestack-ui/themed';

export interface Point {
  x: number;
  y: number;
  /** Capture time, used to derive stroke width from pen speed. */
  t: number;
}

export type Stroke = Point[];

/** A drawn segment: its path data and the width the ink should have there. */
interface Segment {
  d: string;
  w: number;
}

const r = (n: number) => Math.round(n * 10) / 10;

// Ink shaping. A signature drawn at a constant width reads as a marker trace;
// real pens lay down less ink the faster they travel, and reproducing that is
// most of what makes a captured signature look handwritten rather than drawn.
const MAX_WIDTH = 3.4;
const MIN_WIDTH = 1.1;
const SPEED_SCALE = 1.9; // px/ms of speed that costs one px of width

/** Samples closer than this are jitter, not motion — see filtering below. */
const MIN_SAMPLE_DISTANCE = 1.5;

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function widthFor(prev: Point, next: Point): number {
  const dt = Math.max(next.t - prev.t, 1);
  const speed = distance(prev, next) / dt;
  const w = MAX_WIDTH - speed * SPEED_SCALE;
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w));
}

const mid = (a: Point, b: Point) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

/**
 * Turns a stroke into variable-width curve segments.
 *
 * Each sampled point is the control point of a quadratic running between the
 * midpoints of its neighbouring segments — the standard signature-smoothing
 * construction. Joining raw touch samples with straight lines instead produces
 * a visibly faceted stroke even from a steady hand, because sampling is coarse
 * relative to how fast a signature moves.
 *
 * Width is smoothed against the previous segment so it tapers rather than
 * stepping, which is what the abrupt per-sample speed changes would otherwise
 * produce.
 *
 * Shared by the live canvas and the SVG export, so what is saved is exactly
 * what the customer saw themselves sign.
 */
export function strokeToSegments(stroke: Stroke): Segment[] {
  if (stroke.length === 0) return [];

  // A lone tap: a zero-length line with a round cap renders the dot that the
  // dot of an "i" or a full stop needs.
  if (stroke.length === 1) {
    const p = stroke[0];
    return [{ d: `M ${r(p.x)} ${r(p.y)} L ${r(p.x)} ${r(p.y)}`, w: MAX_WIDTH }];
  }

  if (stroke.length === 2) {
    return [
      {
        d: `M ${r(stroke[0].x)} ${r(stroke[0].y)} L ${r(stroke[1].x)} ${r(stroke[1].y)}`,
        w: widthFor(stroke[0], stroke[1]),
      },
    ];
  }

  const segments: Segment[] = [];
  let prevWidth = widthFor(stroke[0], stroke[1]);

  // Opening run: start point to the first midpoint.
  const firstMid = mid(stroke[0], stroke[1]);
  segments.push({
    d: `M ${r(stroke[0].x)} ${r(stroke[0].y)} L ${r(firstMid.x)} ${r(firstMid.y)}`,
    w: prevWidth,
  });

  for (let i = 1; i < stroke.length - 1; i++) {
    const from = mid(stroke[i - 1], stroke[i]);
    const to = mid(stroke[i], stroke[i + 1]);
    const raw = widthFor(stroke[i], stroke[i + 1]);
    const w = (prevWidth + raw) / 2;
    prevWidth = w;

    segments.push({
      d: `M ${r(from.x)} ${r(from.y)} Q ${r(stroke[i].x)} ${r(stroke[i].y)} ${r(to.x)} ${r(to.y)}`,
      w,
    });
  }

  // Closing run: last midpoint to the final point.
  const last = stroke[stroke.length - 1];
  const lastMid = mid(stroke[stroke.length - 2], last);
  segments.push({
    d: `M ${r(lastMid.x)} ${r(lastMid.y)} L ${r(last.x)} ${r(last.y)}`,
    w: prevWidth,
  });

  return segments;
}

/**
 * Serialises strokes to a standalone SVG, cropped to the ink.
 *
 * The viewBox is the bounding box of what was actually drawn, not the canvas.
 * A full-screen pad is far larger than the signature on it, and without the
 * crop the stored image is mostly empty space — which then renders as a speck
 * inside the declaration's signature box. Cropping lets the printed output
 * scale the ink to fill whatever space it is given.
 *
 * Vector rather than raster keeps it a short string, so it travels on the
 * ordinary JSON body with no multipart upload or image host, and
 * `getFullImageUrl` turns it directly into a data: URI for the print templates.
 */
export function buildSignatureSvg(strokes: Stroke[]): string | null {
  const points = strokes.flat();
  if (points.length === 0) return null;

  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const pad = MAX_WIDTH;

  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const width = Math.max(Math.max(...xs) + pad - minX, 1);
  const height = Math.max(Math.max(...ys) + pad - minY, 1);

  const paths = strokes
    .flatMap(strokeToSegments)
    .map(
      s =>
        `<path d="${s.d}" stroke="black" stroke-width="${r(s.w)}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join('');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `viewBox="${r(minX)} ${r(minY)} ${r(width)} ${r(height)}" ` +
    `width="${r(width)}" height="${r(height)}">${paths}</svg>`
  );
}

export interface SignaturePadHandle {
  clear(): void;
  /** Removes the last stroke. */
  undo(): void;
  /** The signature as an SVG string, cropped to the ink. Null when blank. */
  toSvg(): string | null;
  isEmpty(): boolean;
}

interface SignaturePadProps {
  /** Fires when the pad goes from blank to drawn or back, so a parent can
   *  enable Save and Clear. */
  onDrawingChange?: (hasInk: boolean) => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The drawing surface shared by every signature capture in the app.
 *
 * One implementation on purpose: the shop's own signature and the customer's
 * declaration signature had no reason to diverge, and a fix to coordinate
 * handling or web pointer behaviour should never need making twice.
 *
 * Works with a finger, a stylus or a mouse. PanResponder already receives mouse
 * events under react-native-web, but the surface needs `touchAction: none` or
 * the browser claims the drag as a scroll and the stroke breaks up, and
 * `userSelect: none` or dragging selects surrounding text instead of drawing.
 */
const SignaturePad = React.forwardRef<SignaturePadHandle, SignaturePadProps>(
  ({ onDrawingChange, placeholder, style }, ref) => {
    const [strokes, setStrokes] = React.useState<Stroke[]>([]);
    const [size, setSize] = React.useState({ width: 300, height: 180 });

    const currentStroke = React.useRef<Stroke>([]);
    const isDrawing = React.useRef(false);
    // Mirrors `strokes` for the gesture handlers and the imperative handle,
    // which must read the latest value without the stale closure a state read
    // inside the long-lived PanResponder would capture.
    const strokesRef = React.useRef<Stroke[]>([]);

    const commit = React.useCallback(
      (next: Stroke[]) => {
        const had = strokesRef.current.length > 0;
        strokesRef.current = next;
        setStrokes(next);
        const has = next.length > 0;
        if (had !== has) onDrawingChange?.(has);
      },
      [onDrawingChange],
    );

    const getPoint = (e: GestureResponderEvent): Point => {
      const native: any = e.nativeEvent;
      // Touch events carry a touches array; a mouse event on web does not and
      // falls through to the event itself. offsetX/offsetY is the last resort
      // for browsers that leave locationX undefined on a synthetic event.
      const src = native.touches?.[0] ?? native;
      return {
        x: src.locationX ?? src.offsetX ?? 0,
        y: src.locationY ?? src.offsetY ?? 0,
        t: Date.now(),
      };
    };

    const panResponder = React.useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: e => {
          isDrawing.current = true;
          currentStroke.current = [getPoint(e)];
          commit([...strokesRef.current, currentStroke.current]);
        },
        onPanResponderMove: e => {
          if (!isDrawing.current) return;
          const pt = getPoint(e);
          const prev = currentStroke.current[currentStroke.current.length - 1];
          // Move events fire far faster than a hand moves, so consecutive
          // samples land sub-pixel apart. Keeping them adds jitter to the
          // smoothing and bloats the stored SVG, which is persisted as a string
          // on the record and so is not free.
          if (prev && distance(prev, pt) < MIN_SAMPLE_DISTANCE) return;

          currentStroke.current = [...currentStroke.current, pt];
          const updated = [...strokesRef.current];
          updated[updated.length - 1] = currentStroke.current;
          commit(updated);
        },
        onPanResponderRelease: () => {
          isDrawing.current = false;
        },
        // Without this the stroke stays open when the gesture is stolen — on
        // web the pointer leaving the surface mid-drag does exactly that.
        onPanResponderTerminate: () => {
          isDrawing.current = false;
        },
      }),
    ).current;

    React.useImperativeHandle(ref, () => ({
      clear: () => {
        currentStroke.current = [];
        commit([]);
      },
      undo: () => {
        if (strokesRef.current.length === 0) return;
        commit(strokesRef.current.slice(0, -1));
      },
      isEmpty: () => strokesRef.current.length === 0,
      toSvg: () => buildSignatureSvg(strokesRef.current),
    }));

    const handleLayout = (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      setSize({ width, height });
    };

    return (
      <View
        style={[styles.canvas, webCanvasStyle, style]}
        onLayout={handleLayout}
        {...panResponder.panHandlers}
      >
        <Svg
          width={size.width}
          height={size.height}
          style={StyleSheet.absoluteFill}
        >
          {strokes.flatMap((stroke, si) =>
            strokeToSegments(stroke).map((seg, gi) => (
              <Path
                key={`${si}-${gi}`}
                d={seg.d}
                stroke="#111827"
                strokeWidth={seg.w}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )),
          )}
        </Svg>

        {strokes.length === 0 && !!placeholder && (
          <Box
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            justifyContent="center"
            alignItems="center"
            pointerEvents="none"
          >
            <Text color="$coolGray400" fontSize="$sm">
              {placeholder}
            </Text>
          </Box>
        )}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  canvas: {
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
});

/**
 * Web-only style keys, kept outside StyleSheet.create because React Native's
 * types model neither the properties nor their values — and these are exactly
 * what make a mouse drag draw: without `touchAction: none` the browser claims
 * the drag as a scroll and the stroke breaks up, and without `userSelect: none`
 * it selects surrounding text instead. react-native-web passes them through to
 * CSS; native platforms ignore keys they do not recognise.
 */
const webCanvasStyle = {
  cursor: 'crosshair',
  touchAction: 'none',
  userSelect: 'none',
} as unknown as ViewStyle;

export default SignaturePad;

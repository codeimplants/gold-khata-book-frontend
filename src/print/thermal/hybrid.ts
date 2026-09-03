// Builds a receipt that mixes ESC/POS text with rasterised lines.
//
// Rasterising the whole receipt whenever one line was non-ASCII made the cost scale
// with bill size rather than with how much Indic text it contained: a one-item Marathi
// bill measured 4.1s, and a six-item one would have been roughly 9s.
//
// ESC/POS lets text and raster commands interleave freely, so only the handful of lines
// that actually need it become images. Everything else — amounts, dates, GSTIN, English
// labels — stays on the fast text path.
import { ReceiptLine, lineHasNonAscii } from './receiptModel';
import { modelToEscPos } from './receiptBuilder';
import * as escpos from './escpos';

/**
 * Text lines that need rasterising, in receipt order.
 *
 * Excludes the logo: it is decoded straight from its data URI rather than rendered
 * into the capture strip, because an off-screen React <Image> fires onLoad but never
 * paints — Android's image backend detaches drawables for views it treats as
 * invisible, so the logo captured as blank paper.
 */
export function nonAsciiLines(lines: ReceiptLine[]): ReceiptLine[] {
  return lines.filter(l => l.kind !== 'logo' && lineHasNonAscii(l));
}

export function logoLine(lines: ReceiptLine[]): { uri: string } | undefined {
  return lines.find(l => l.kind === 'logo') as { uri: string } | undefined;
}

/**
 * Splits the receipt into runs of ASCII lines (pre-rendered as text) and placeholders
 * for the lines that must be images.
 *
 * `imageIndex` is the line's position among the non-ASCII lines only, which is also
 * its cell index in the captured strip.
 */
export type PrintSegment =
  | { kind: 'text'; commands: number[] }
  | { kind: 'image'; imageIndex: number }
  /** The logo, sourced from its own decode rather than the capture strip. */
  | { kind: 'logo' };

export function planHybridReceipt(lines: ReceiptLine[]): PrintSegment[] {
  const segments: PrintSegment[] = [];
  let run: ReceiptLine[] = [];
  let imageIndex = 0;

  const flushRun = () => {
    if (run.length === 0) return;
    // modelToEscPos brackets its output with init/cut, which must appear once for the
    // whole receipt rather than once per run — stripped here and re-added by the
    // caller assembling the final job.
    segments.push({ kind: 'text', commands: stripInitAndCut(modelToEscPos(run)) });
    run = [];
  };

  lines.forEach(line => {
    if (line.kind === 'logo') {
      flushRun();
      segments.push({ kind: 'logo' });
    } else if (lineHasNonAscii(line)) {
      flushRun();
      segments.push({ kind: 'image', imageIndex: imageIndex++ });
    } else {
      run.push(line);
    }
  });
  flushRun();

  return segments;
}

/** modelToEscPos emits `ESC @` first and a feed+cut last; both belong to the job, not
 * to an individual run of lines. */
function stripInitAndCut(commands: number[]): number[] {
  let start = 0;
  // ESC @
  if (commands[0] === 0x1b && commands[1] === 0x40) start = 2;

  // Trailing feed (ESC d n) + partial cut (GS V 1) as emitted by escpos.cut().
  let end = commands.length;
  const isCutTail =
    commands[end - 3] === 0x1d && commands[end - 2] === 0x56 && commands[end - 1] === 0x01;
  if (isCutTail) {
    end -= 3;
    if (commands[end - 3] === 0x1b && commands[end - 2] === 0x64) end -= 3;
  }

  return commands.slice(start, end);
}

/** Assembles the final job once the strip image has been sliced into per-line bands. */
export function assembleHybrid(
  segments: PrintSegment[],
  bandFor: (imageIndex: number) => number[],
  logoCommands: number[] = []
): number[] {
  const parts: number[][] = [escpos.init()];
  segments.forEach(seg => {
    if (seg.kind === 'text') parts.push(seg.commands);
    else if (seg.kind === 'logo') parts.push(logoCommands);
    else parts.push(bandFor(seg.imageIndex));
  });
  parts.push(escpos.cut());
  return parts.flat();
}

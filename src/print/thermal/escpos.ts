// Minimal ESC/POS command encoder for 58mm thermal receipt printers (e.g. Seznik Veer B41).
// No knowledge of invoice data — pure byte-sequence builders, composed by receiptBuilder.ts.
// Reference: standard ESC/POS instruction set (Epson-compatible), which this class of cheap
// 58mm printer implements — commands below are widely supported across clones.

const ESC = 0x1b;
const GS = 0x1d;

export const ALIGN = {
  left: 0x00,
  center: 0x01,
  right: 0x02,
} as const;

function bytes(...vals: number[]): number[] {
  return vals;
}

function textToBytes(text: string): number[] {
  // Printer firmware on these units expects a single-byte codepage (not UTF-8) for
  // reliable rendering; non-ASCII characters (e.g. Devanagari) will not render correctly
  // on this hardware class and are out of scope for v1 — strip to printable ASCII.
  const ascii = text.replace(/[^\x20-\x7e]/g, '?');
  const out: number[] = [];
  for (let i = 0; i < ascii.length; i++) {
    out.push(ascii.charCodeAt(i));
  }
  return out;
}

/** Printer reset — always send first. */
export function init(): number[] {
  return bytes(ESC, 0x40);
}

export function setAlign(align: keyof typeof ALIGN): number[] {
  return bytes(ESC, 0x61, ALIGN[align]);
}

export function setBold(on: boolean): number[] {
  return bytes(ESC, 0x45, on ? 1 : 0);
}

/** width/height multiplier 1-8x normal (GS ! size byte: high nibble = height, low nibble = width). */
export function setSize(width: number, height: number): number[] {
  const w = Math.max(1, Math.min(8, width)) - 1;
  const h = Math.max(1, Math.min(8, height)) - 1;
  return bytes(GS, 0x21, (w << 4) | h);
}

/** A line of text terminated with a line feed. */
export function textLine(text: string): number[] {
  return [...textToBytes(text), 0x0a];
}

/** Blank line(s). */
export function feed(lines: number = 1): number[] {
  return bytes(ESC, 0x64, Math.max(0, lines));
}

/** A horizontal divider sized to the given character width (default 32 = Veer normal-font budget). */
export function divider(char: string = '-', width: number = 32): number[] {
  return textLine(char.repeat(width));
}

/** Feed + partial cut. */
export function cut(): number[] {
  return [...feed(3), GS, 0x56, 0x01];
}

export function concat(...parts: number[][]): number[] {
  return parts.flat();
}

export function toUint8Array(cmds: number[]): Uint8Array {
  return Uint8Array.from(cmds);
}

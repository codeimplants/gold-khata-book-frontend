// Converts a captured receipt image into ESC/POS raster commands.
//
// Needed because this printer class is ASCII-only in text mode, so Devanagari,
// Gujarati and the ₹ sign can only reach paper as a bitmap.
import UPNG from 'upng-js';
import * as escpos from './escpos';
import { PrintTimer } from './perf';
import ClassicBluetooth from '../../specs/NativeClassicBluetooth';

/** The print head is 384 dots across (48 bytes). Everything is normalised to this. */
export const PRINTER_DOTS = 384;

/**
 * Rows per GS v 0 command. Cheap printers have small buffers and a single very tall
 * raster can overflow them, producing a half-printed receipt rather than an error —
 * so the image is sent as a series of horizontal bands instead.
 */
const BAND_HEIGHT = 128;

/** Below this luminance a pixel is burned black. Receipts are pure black-on-white, so
 * a mid-point threshold is sufficient and avoids dithering artefacts. */
const LUMA_THRESHOLD = 160;

export type Gray = { width: number; height: number; dark: Uint8Array };

/**
 * Decodes PNG bytes and reduces to 1-bit, scaling to the printer width.
 *
 * Capture happens at device pixel density, so the image can arrive wider or narrower
 * than the print head; nearest-neighbour scaling keeps this dependency-free and is
 * visually indistinguishable for black-on-white text at this resolution.
 */
export function pngToBilevel(pngBytes: ArrayBuffer): Gray {
  const img = UPNG.decode(pngBytes);
  const rgba = new Uint8Array(UPNG.toRGBA8(img)[0]);
  const srcW = img.width;
  const srcH = img.height;

  const dstW = PRINTER_DOTS;
  const dstH = Math.max(1, Math.round((srcH * dstW) / srcW));
  const dark = new Uint8Array(dstW * dstH);

  for (let y = 0; y < dstH; y++) {
    const srcY = Math.min(srcH - 1, Math.floor((y * srcH) / dstH));
    for (let x = 0; x < dstW; x++) {
      const srcX = Math.min(srcW - 1, Math.floor((x * srcW) / dstW));
      const i = (srcY * srcW + srcX) * 4;
      const a = rgba[i + 3];
      // Transparent pixels are paper, not ink.
      if (a < 128) continue;
      const luma = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
      if (luma < LUMA_THRESHOLD) dark[y * dstW + x] = 1;
    }
  }

  return { width: dstW, height: dstH, dark };
}

/** Packs one band of the bilevel image into a GS v 0 raster command. */
function bandToCommand(img: Gray, startY: number, rows: number): number[] {
  const bytesPerRow = img.width / 8;
  const out: number[] = [
    0x1d,
    0x76,
    0x30,
    0x00, // mode: normal
    bytesPerRow & 0xff,
    (bytesPerRow >> 8) & 0xff,
    rows & 0xff,
    (rows >> 8) & 0xff,
  ];

  for (let y = startY; y < startY + rows; y++) {
    for (let b = 0; b < bytesPerRow; b++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        // MSB is the leftmost dot.
        if (img.dark[y * img.width + b * 8 + bit]) byte |= 0x80 >> bit;
      }
      out.push(byte);
    }
  }
  return out;
}

/**
 * One line's slice of a strip image, as raster commands only (no init/cut) so it can
 * be interleaved between ordinary text lines in a single receipt.
 *
 * `index` is the line's position in the strip; every strip cell is exactly
 * `lineHeight` tall, which is what makes this pure arithmetic rather than a layout
 * measurement.
 */
export function stripBandToEscPos(
  img: Gray,
  index: number,
  /** Row offset of each cell in the *rendered* strip, plus the strip's total height —
   * cells are not uniform (the shop name is double height). */
  layout: { offsets: number[]; total: number }
): number[] {
  const { offsets, total } = layout;
  if (total <= 0 || index >= offsets.length) return [];

  // Scaled against the decoded image rather than used directly: capture happens at
  // device density and pngToBilevel rescales to the print width, so rendered
  // coordinates rarely survive as-is.
  const scale = img.height / total;
  const startY = Math.round(offsets[index] * scale);
  const endY = Math.round(
    (index + 1 < offsets.length ? offsets[index + 1] : total) * scale
  );
  const rows = Math.min(endY - startY, img.height - startY);
  if (rows <= 0) return [];
  return bandToCommand(img, startY, rows);
}

/**
 * Widens an image to the full print width, centring the original inside it.
 *
 * A GS v 0 raster always starts at the left edge of the paper, so a logo narrower than
 * the head prints hard against the left margin. Padding it out to the full width with
 * the content centred is the only way to centre a raster — there is no alignment
 * command that applies to images.
 */
export function centerHorizontally(img: Gray, width: number = PRINTER_DOTS): Gray {
  if (img.width >= width) return img;
  const dark = new Uint8Array(width * img.height);
  const offset = Math.floor((width - img.width) / 2);
  for (let y = 0; y < img.height; y++) {
    const srcRow = y * img.width;
    const dstRow = y * width + offset;
    for (let x = 0; x < img.width; x++) {
      if (img.dark[srcRow + x]) dark[dstRow + x] = 1;
    }
  }
  return { width, height: img.height, dark };
}

/** A standalone image (the shop logo) as raster commands only — no init/cut — so it
 * can sit inside a receipt between ordinary text lines. */
export function imageToBands(img: Gray): number[] {
  const parts: number[][] = [];
  for (let y = 0; y < img.height; y += BAND_HEIGHT) {
    parts.push(bandToCommand(img, y, Math.min(BAND_HEIGHT, img.height - y)));
  }
  return parts.flat();
}

/** A full receipt image as ESC/POS: init, banded raster, feed and cut. */
export function imageToEscPos(img: Gray): number[] {
  const parts: number[][] = [escpos.init()];
  for (let y = 0; y < img.height; y += BAND_HEIGHT) {
    parts.push(bandToCommand(img, y, Math.min(BAND_HEIGHT, img.height - y)));
  }
  parts.push(escpos.cut());
  return parts.flat();
}

/** Decodes a base64 PNG (what react-native-view-shot returns) to bytes. */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = Math.floor((clean.length * 3) / 4);
  const bytes = new Uint8Array(len);

  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (chars.indexOf(clean[i]) << 18) |
      (chars.indexOf(clean[i + 1]) << 12) |
      (chars.indexOf(clean[i + 2] || 'A') << 6) |
      chars.indexOf(clean[i + 3] || 'A');
    if (p < len) bytes[p++] = (n >> 16) & 0xff;
    if (p < len) bytes[p++] = (n >> 8) & 0xff;
    if (p < len) bytes[p++] = n & 0xff;
  }
  return bytes.buffer;
}

/**
 * Decodes any base64 image to 1-bit, natively where possible.
 *
 * The native path (Android) uses BitmapFactory: it handles PNG/JPEG/WebP/GIF rather
 * than PNG alone, and does in tens of milliseconds what the JS decoder measured at
 * 600-900ms. The JS path remains for iOS and as a fallback, so behaviour is the same
 * on both, just slower.
 */
export async function decodeToBilevel(
  base64Image: string,
  maxWidth: number = PRINTER_DOTS,
  maxHeight: number = 100000
): Promise<Gray> {
  if (ClassicBluetooth?.decodeImageToBilevel) {
    try {
      const json = await ClassicBluetooth.decodeImageToBilevel(base64Image, maxWidth, maxHeight);
      const { width, height, data } = JSON.parse(json);
      return { width, height, dark: unpackRows(data, width, height) };
    } catch {
      // Corrupt image, or an unusual format even BitmapFactory rejects — fall through
      // to the JS decoder, which will either cope or throw a clearer error.
    }
  }
  return pngToBilevel(base64ToArrayBuffer(stripDataUriPrefix(base64Image)));
}

function stripDataUriPrefix(value: string): string {
  const marker = 'base64,';
  const at = value.indexOf(marker);
  return at === -1 ? value : value.slice(at + marker.length);
}

/** Expands packed 1-bit rows (MSB leftmost) back into the one-byte-per-pixel form the
 * band packer works with. */
function unpackRows(base64Data: string, width: number, height: number): Uint8Array {
  const packed = new Uint8Array(base64ToArrayBuffer(base64Data));
  const bytesPerRow = width / 8;
  const dark = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const byte = packed[y * bytesPerRow + (x >> 3)];
      if (byte & (0x80 >> (x & 7))) dark[y * width + x] = 1;
    }
  }
  return dark;
}

/** base64 PNG -> 1-bit image. The hybrid path stops here because it slices the strip
 * into per-line bands itself rather than emitting one whole-page raster.
 *
 * Stages are timed individually because it is not obvious from the outside whether
 * base64 decoding, PNG inflation, thresholding or the Bluetooth transfer dominates. */
export function pngBase64ToBilevel(base64Png: string, timer?: PrintTimer): Gray {
  const buffer = base64ToArrayBuffer(base64Png);
  timer?.note(`png b64      ${Math.round(base64Png.length / 1024)} KB`);
  timer?.mark('base64');

  const img = pngToBilevel(buffer);
  timer?.note(`image        ${img.width} x ${img.height} px`);
  timer?.mark('decode+1bit');

  return img;
}

/** base64 PNG -> a complete, standalone raster receipt. */
export function pngBase64ToEscPos(base64Png: string, timer?: PrintTimer): number[] {
  const cmds = imageToEscPos(pngBase64ToBilevel(base64Png, timer));
  timer?.note(`escpos       ${Math.round(cmds.length / 1024)} KB`);
  timer?.mark('encode');
  return cmds;
}

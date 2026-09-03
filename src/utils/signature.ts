/**
 * Rotating a stored signature.
 *
 * Signatures are captured as a standalone SVG cropped to the ink (see
 * `buildSignatureSvg` in components/common/SignaturePad.tsx), so a rotation is
 * a coordinate transform on a short string rather than an image operation.
 * Nothing downstream has to change: the rotated string is still a complete SVG,
 * so `SvgXml` renders it, `getFullImageUrl` still turns it into a data: URI, and
 * the print templates are untouched.
 *
 * Why this is needed: the device is handed to the customer to sign, and people
 * turn a phone sideways to write. The signature is then stored at ninety
 * degrees to the line it has to sit on in the printed declaration.
 *
 * A photographed signature is an image, not SVG, and is left alone here — see
 * `canRotateSignature`.
 */

/** Whether `value` is a signature this module can rotate. */
export const canRotateSignature = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().startsWith('<svg');

/** Numbers in an SVG attribute, tolerant of comma or whitespace separators. */
const parseNumbers = (raw: string): number[] =>
  raw
    .trim()
    .split(/[\s,]+/)
    .map(Number)
    .filter(n => Number.isFinite(n));

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Rotates a signature SVG a quarter turn clockwise.
 *
 * Implemented by wrapping the existing content in a transform rather than
 * touching the path data: the ink is described by dozens of curve commands, and
 * rewriting those is both slow and a chance to corrupt a legal record, while a
 * group transform is exact.
 *
 * The transform reads right to left. `translate(-minX, -minY)` moves the ink's
 * bounding box to the origin, `rotate` turns it about that origin, and the
 * leading translate pushes the result back into positive space — because
 * rotating about the origin sends the box into negative coordinates, which
 * would otherwise fall outside the viewBox and render as blank.
 *
 * Returns the input unchanged if it cannot be parsed, so a malformed or
 * unexpected signature is never destroyed by a rotate tap.
 */
export const rotateSignatureSvg = (svg: string, quarterTurns = 1): string => {
  if (!canRotateSignature(svg)) return svg;

  const turns = ((Math.round(quarterTurns) % 4) + 4) % 4;
  if (turns === 0) return svg;

  const openTagMatch = svg.match(/^\s*<svg\b[^>]*>/i);
  if (!openTagMatch) return svg;
  const openTag = openTagMatch[0];

  const closeIndex = svg.lastIndexOf('</svg>');
  if (closeIndex === -1) return svg;

  const inner = svg.slice(openTag.length, closeIndex);

  const viewBoxRaw = openTag.match(/viewBox\s*=\s*"([^"]*)"/i)?.[1];
  if (!viewBoxRaw) return svg;
  const box = parseNumbers(viewBoxRaw);
  if (box.length !== 4) return svg;

  const [minX, minY, w, h] = box;
  if (!(w > 0) || !(h > 0)) return svg;

  // A quarter turn swaps the extents; a half turn preserves them.
  const swapped = turns === 1 || turns === 3;
  const newW = swapped ? h : w;
  const newH = swapped ? w : h;

  // Where the rotated box lands before it is pushed back into view.
  const shift =
    turns === 1
      ? `${round(h)} 0`
      : turns === 2
        ? `${round(w)} ${round(h)}`
        : `0 ${round(w)}`;

  const transform =
    `translate(${shift.replace(' ', ', ')}) ` +
    `rotate(${turns * 90}) ` +
    `translate(${round(-minX)}, ${round(-minY)})`;

  const rotatedOpenTag = openTag
    .replace(/viewBox\s*=\s*"[^"]*"/i, `viewBox="0 0 ${round(newW)} ${round(newH)}"`)
    .replace(/\bwidth\s*=\s*"[^"]*"/i, `width="${round(newW)}"`)
    .replace(/\bheight\s*=\s*"[^"]*"/i, `height="${round(newH)}"`);

  return `${rotatedOpenTag}<g transform="${transform}">${inner}</g></svg>`;
};

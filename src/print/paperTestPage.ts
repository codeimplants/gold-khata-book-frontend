import { PaperPrefs } from '../constants/bill';
import { buildPageCss, contentBoxMm } from './templates/shared';

export type PaperTestLabels = {
  title: string;
  /** e.g. "Paper: 95 x 200 mm · Centre · Header space 35 mm" */
  summary: string;
  hint: string;
};

/**
 * An alignment page for the shop's own paper.
 *
 * A printer images relative to the size the driver was told, so where a narrow
 * sheet actually receives ink depends on how its tray grips the paper — and
 * nothing in software can read that off the printer. This page turns it into a
 * one-print question instead: it draws the exact outline an invoice would
 * occupy, so the shopkeeper can see at a glance whether the whole box landed on
 * the sheet, and which edge is missing if it did not.
 *
 * The outline is sized from `contentBoxMm` and positioned by the same
 * `buildPageCss` the bill templates use, so it is a true rehearsal rather than
 * an approximation — if the box fits, the bill fits.
 *
 * The centimetre rules along the top and left edges make a near miss
 * measurable: a shopkeeper can read off how much was lost and adjust the width
 * or the header space by that amount instead of guessing.
 */
export const buildPaperTestHTML = (paper: PaperPrefs, labels: PaperTestLabels): string => {
  const { widthMm, heightMm } = contentBoxMm(paper);

  // A hair under the true height. A box drawn at exactly the content-box height
  // can round up past it and spill onto a second, blank sheet — which on this
  // page would read as "the settings are wrong" when they are not.
  const boxHeight = Math.max(0, heightMm - 0.4);
  const boxWidth = Math.max(0, widthMm - 0.4);

  const tick = (offsetMm: number, vertical: boolean) => {
    const major = offsetMm % 50 === 0;
    const len = major ? 5 : 3;
    const style = vertical
      ? `top:${offsetMm}mm;left:0;height:0.3mm;width:${len}mm;`
      : `left:${offsetMm}mm;top:0;width:0.3mm;height:${len}mm;`;
    const label = major
      ? `<span style="position:absolute;${
          vertical ? `top:${offsetMm + 0.6}mm;left:${len + 1}mm;` : `left:${offsetMm + 0.6}mm;top:${len + 1}mm;`
        }font-size:6pt;color:#666;line-height:1;">${offsetMm / 10}</span>`
      : '';
    return `<span style="position:absolute;background:#666;${style}"></span>${label}`;
  };

  const ticks = (lengthMm: number, vertical: boolean) => {
    const out: string[] = [];
    for (let mmPos = 10; mmPos < lengthMm - 1; mmPos += 10) out.push(tick(mmPos, vertical));
    return out.join('');
  };

  const corner = (style: string) =>
    `<span style="position:absolute;${style}width:6mm;height:6mm;border:1mm solid #000;"></span>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
${buildPageCss(paper)}
* { box-sizing: border-box; }
body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; }
</style>
</head>
<body>
<div style="position:relative;width:${boxWidth}mm;height:${boxHeight}mm;border:0.5mm solid #000;overflow:hidden;">

  ${corner('top:-0.5mm;left:-0.5mm;border-right:0;border-bottom:0;')}
  ${corner('top:-0.5mm;right:-0.5mm;border-left:0;border-bottom:0;')}
  ${corner('bottom:-0.5mm;left:-0.5mm;border-right:0;border-top:0;')}
  ${corner('bottom:-0.5mm;right:-0.5mm;border-left:0;border-top:0;')}

  ${ticks(boxWidth, false)}
  ${ticks(boxHeight, true)}

  <div style="position:absolute;top:9mm;left:9mm;right:9mm;">
    <div style="font-size:12pt;font-weight:bold;margin-bottom:2mm;">${labels.title}</div>
    <div style="font-size:9pt;margin-bottom:3mm;">${labels.summary}</div>
    <div style="font-size:8pt;color:#444;line-height:1.5;">${labels.hint}</div>
  </div>

  <div style="position:absolute;bottom:3mm;left:0;right:0;text-align:center;font-size:7pt;color:#666;">
    ${Math.round(boxWidth)} mm &times; ${Math.round(boxHeight)} mm
  </div>
</div>
</body>
</html>`;
};

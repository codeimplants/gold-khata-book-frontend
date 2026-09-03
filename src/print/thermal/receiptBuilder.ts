// Renders a receipt model (receiptModel.ts) as ESC/POS *text* commands.
//
// This is the fast path: ~1KB and near-instant, versus ~30KB and a few seconds for the
// rasterised image. It is only usable when every string is ASCII, because this printer
// class has no non-Latin glyphs — modelHasNonAscii() decides, and printThermal picks
// the renderer accordingly.
import { JewelleryFormValues, PrintContext } from '../../types';
import { MobileLang } from '../templates/shared';
import { buildReceiptModel, ReceiptLine, RECEIPT_WIDTH } from './receiptModel';
import * as escpos from './escpos';

export { RECEIPT_WIDTH } from './receiptModel';

/** The ₹ sign (U+20B9) has no glyph on this hardware and would print as "?", so the
 * text path substitutes "Rs.". The image path prints ₹ properly. */
function asciiSafe(text: string): string {
  return text.replace(/₹/g, 'Rs.');
}

function padLine(left: string, right: string, width: number = RECEIPT_WIDTH): string {
  const maxLeftLen = Math.max(0, width - right.length - 1);
  const l = left.length > maxLeftLen ? left.slice(0, Math.max(0, maxLeftLen)) : left;
  const gap = Math.max(1, width - l.length - right.length);
  return l + ' '.repeat(gap) + right;
}

/** Renders the shared model as ESC/POS text. */
export function modelToEscPos(lines: ReceiptLine[]): number[] {
  const cmds: number[][] = [escpos.init()];

  lines.forEach(line => {
    switch (line.kind) {
      case 'divider':
        cmds.push(escpos.setAlign('left'));
        cmds.push(escpos.divider('-', RECEIPT_WIDTH));
        break;

      case 'space':
        cmds.push(escpos.feed(1));
        break;

      case 'logo':
        // No text representation exists. In practice this is unreachable for a real
        // print — a logo forces the image path — but modelToEscPos is also used to
        // render the ASCII runs of a hybrid receipt, so the case must be explicit
        // rather than falling through to the text branch and printing an object.
        break;

      case 'row': {
        cmds.push(escpos.setAlign('left'));
        if (line.bold) cmds.push(escpos.setBold(true));
        cmds.push(escpos.textLine(padLine(asciiSafe(line.left), asciiSafe(line.right))));
        if (line.bold) cmds.push(escpos.setBold(false));
        break;
      }

      default: {
        const text = asciiSafe(line.text);
        if (line.large) {
          // Double-width text has half the character budget, so let the printer
          // centre it rather than padding to 32 columns.
          cmds.push(escpos.setAlign('center'));
          cmds.push(escpos.setBold(true));
          cmds.push(escpos.setSize(2, 2));
          cmds.push(escpos.textLine(text));
          cmds.push(escpos.setSize(1, 1));
          cmds.push(escpos.setBold(false));
        } else {
          // Let the printer centre rather than padding with spaces: it costs no
          // characters and stays correct if a printer's line width differs from 32.
          cmds.push(escpos.setAlign(line.align === 'center' ? 'center' : 'left'));
          if (line.bold) cmds.push(escpos.setBold(true));
          cmds.push(escpos.textLine(text));
          if (line.bold) cmds.push(escpos.setBold(false));
        }
        break;
      }
    }
  });

  cmds.push(escpos.cut());
  return cmds.flat();
}

/** Convenience wrapper: build the model and render it as text in one call. */
export function buildThermalReceiptCommands(
  values: JewelleryFormValues,
  ctx: PrintContext,
  lang: MobileLang = 'en'
): number[] {
  return modelToEscPos(buildReceiptModel(values, ctx, lang));
}

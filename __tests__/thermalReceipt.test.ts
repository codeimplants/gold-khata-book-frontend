// receiptBuilder pulls in templates/shared -> imageUtils -> react-native-fs, which ships
// untranspiled Flow syntax. The receipt path never touches the filesystem, so stub it.
jest.mock('react-native-fs', () => ({}), { virtual: true });

import { buildThermalReceiptCommands, RECEIPT_WIDTH } from '../src/print/thermal/receiptBuilder';
import { buildReceiptModel, modelHasNonAscii } from '../src/print/thermal/receiptModel';
import { nonAsciiLines, planHybridReceipt, assembleHybrid } from '../src/print/thermal/hybrid';
import { centerHorizontally } from '../src/print/thermal/raster';
import { JewelleryFormValues, PrintContext } from '../src/types';

/** Renders the ESC/POS byte stream back to plain text so the receipt layout can be
 * asserted without hardware. Control sequences are dropped; only printable text and
 * line breaks survive — which is exactly what the printer puts on paper. */
function renderToText(cmds: number[]): string {
  const out: string[] = [];
  let line = '';
  for (let i = 0; i < cmds.length; i++) {
    const b = cmds[i];
    if (b === 0x1b) {
      // ESC: @ (init) is 1 byte, the rest we emit are 2-byte (a/E/d + arg)
      i += cmds[i + 1] === 0x40 ? 1 : 2;
      continue;
    }
    if (b === 0x1d) {
      i += 2; // GS ! n  /  GS V n
      continue;
    }
    if (b === 0x0a) {
      out.push(line);
      line = '';
      continue;
    }
    line += String.fromCharCode(b);
  }
  if (line) out.push(line);
  return out.join('\n');
}

const values: JewelleryFormValues = {
  invoiceDate: '2026-08-02',
  customerName: 'Ramesh Patel',
  address: 'Pune',
  phone: '9850929634',
  includeGst: true,
  items: [
    {
      id: '1',
      itemName: 'Gold Ring',
      metalType: 'Gold',
      purity: '22K',
      pcs: '1',
      grossWt: '5.500',
      lessWt: '0.000',
      netWt: '5.500',
      ratePerGm: '7000',
      makingChargeType: 'Fixed',
      makingCharges: '500',
      otherChargesDescription: '',
      otherChargesAmount: '0',
      discountType: 'Fixed',
      discount: '0',
      itemTotal: '39000',
    },
  ],
  exchanges: [],
  enableExchange: false,
  subtotal: '39000',
  gst: '1170',
  gstPercentage: 3,
  grandTotal: '40170',
};

const ctx: PrintContext = {
  billNo: 'INV-001',
  billDate: '02/08/2026',
  mode: 'print',
  shopDetails: {
    shopName: 'Shree Jewellers',
    address: 'Thergaon',
    city: 'Pune',
    phone: '9850929634',
    gstNo: '27ABCDE1234F1Z5',
  },
};

describe('thermal receipt', () => {
  const text = renderToText(buildThermalReceiptCommands(values, ctx));

  it('renders the expected receipt layout', () => {
    expect(text).toMatchSnapshot();
  });

  it('never exceeds the printer character width', () => {
    // The double-height shop name is the one intentional exception: it prints at 2x
    // width, so its budget is half the line.
    text.split('\n').forEach(line => {
      expect(line.length).toBeLessThanOrEqual(RECEIPT_WIDTH);
    });
  });

  it('uses an ASCII-safe currency symbol, never the rupee sign', () => {
    expect(text).not.toContain('₹');
    expect(text).toContain('Rs.');
  });

  it('contains no non-ASCII characters the printer cannot render', () => {
    const nonAscii = text.match(/[^\x20-\x7e\n]/g);
    expect(nonAscii).toBeNull();
  });

  it('includes every financial row', () => {
    expect(text).toContain('Subtotal');
    expect(text).toContain('GST (3%)');
    expect(text).toContain('Total');
    expect(text).toContain('40,170.00');
  });
});

describe('text vs image renderer selection', () => {
  it('keeps an all-English bill on the fast text path', () => {
    // The ₹ sign alone must not force the slow raster path — the text renderer
    // substitutes "Rs." for it.
    expect(modelHasNonAscii(buildReceiptModel(values, ctx, 'en'))).toBe(false);
  });

  it('switches to the image path when a customer name is in Devanagari', () => {
    const marathi = { ...values, customerName: 'मकरंद जाधव' };
    expect(modelHasNonAscii(buildReceiptModel(marathi, ctx, 'en'))).toBe(true);
  });

  it('switches to the image path when an item name is in Devanagari', () => {
    const marathi = {
      ...values,
      items: [{ ...values.items[0], itemName: 'सोन्याची अंगठी' }],
    };
    expect(modelHasNonAscii(buildReceiptModel(marathi, ctx, 'en'))).toBe(true);
  });

  it('switches to the image path when the invoice language is Marathi', () => {
    expect(modelHasNonAscii(buildReceiptModel(values, ctx, 'mr'))).toBe(true);
  });

  it('keeps Devanagari intact in the model rather than replacing it with "?"', () => {
    const marathi = { ...values, customerName: 'मकरंद जाधव' };
    const model = buildReceiptModel(marathi, ctx, 'en');
    const names = model.filter(l => l.kind === 'text').map((l: any) => l.text);
    expect(names).toContain('मकरंद जाधव');
  });
});

describe('hybrid text/image receipt', () => {
  const marathi = {
    ...values,
    customerName: 'मकरंद जाधव',
    items: [{ ...values.items[0], itemName: 'सोन्याची अंगठी' }],
  };

  it('rasterises only the lines that actually contain Indic script', () => {
    const model = buildReceiptModel(marathi, ctx, 'en');
    const imageLines = nonAsciiLines(model);

    // The two names, and nothing else — amounts, dates and GSTIN stay text.
    expect(imageLines).toHaveLength(2);
    expect(imageLines.length).toBeLessThan(model.length / 4);
  });

  it('plans one image segment per non-ASCII line, in receipt order', () => {
    const model = buildReceiptModel(marathi, ctx, 'en');
    const segments = planHybridReceipt(model);
    const imageSegments = segments.filter(s => s.kind === 'image');

    expect(imageSegments).toHaveLength(nonAsciiLines(model).length);
    expect(imageSegments.map((s: any) => s.imageIndex)).toEqual([0, 1]);
  });

  it('emits exactly one init and one cut for the whole job', () => {
    const segments = planHybridReceipt(buildReceiptModel(marathi, ctx, 'en'));
    const job = assembleHybrid(segments, () => [0x00]);

    // ESC @ opens the job once...
    expect(job[0]).toBe(0x1b);
    expect(job[1]).toBe(0x40);
    const initCount = job.filter((b, i) => b === 0x1b && job[i + 1] === 0x40).length;
    expect(initCount).toBe(1);

    // ...and GS V 1 closes it once, at the very end.
    const cutCount = job.filter(
      (b, i) => b === 0x1d && job[i + 1] === 0x56 && job[i + 2] === 0x01
    ).length;
    expect(cutCount).toBe(1);
    expect(job.slice(-3)).toEqual([0x1d, 0x56, 0x01]);
  });

  it('keeps every ASCII line on the text path', () => {
    const model = buildReceiptModel(marathi, ctx, 'en');
    const segments = planHybridReceipt(model);
    const textBytes = segments
      .filter(s => s.kind === 'text')
      .flatMap((s: any) => s.commands);
    const asText = String.fromCharCode(...textBytes.filter(b => b >= 0x20 && b <= 0x7e));

    expect(asText).toContain('Subtotal');
    expect(asText).toContain('40,170.00');
    expect(asText).toContain('GSTIN');
  });

  it('produces a far smaller job than rasterising the whole receipt', () => {
    const model = buildReceiptModel(marathi, ctx, 'en');
    const segments = planHybridReceipt(model);
    // A 384px-wide line band is 48 bytes per row; ~32 rows per line.
    const job = assembleHybrid(segments, () => new Array(48 * 32).fill(0));

    // Whole-receipt rastering of this bill measured ~19KB on device.
    expect(job.length).toBeLessThan(6 * 1024);
  });
});

describe('shop logo', () => {
  const withLogo: PrintContext = {
    ...ctx,
    shopDetails: { ...ctx.shopDetails, logo: 'data:image/png;base64,iVBORw0KGgo=' },
  };

  it('places the logo above the shop name', () => {
    const model = buildReceiptModel(values, withLogo, 'en');
    expect(model[0].kind).toBe('logo');
    expect(model[1]).toMatchObject({ kind: 'text', text: 'Shree Jewellers' });
  });

  it('forces the image path even for an otherwise all-English bill', () => {
    expect(modelHasNonAscii(buildReceiptModel(values, withLogo, 'en'))).toBe(true);
    // ...and without a logo that same bill stays on the fast text path.
    expect(modelHasNonAscii(buildReceiptModel(values, ctx, 'en'))).toBe(false);
  });

  it('never emits the logo as text, which would print as garbage', () => {
    const model = buildReceiptModel(values, withLogo, 'en');
    const text = renderToText(buildThermalReceiptCommands(values, withLogo));
    expect(text).not.toContain('data:image');
    expect(text).not.toContain('[object');
    // The logo is the only line that must not survive the text renderer.
    expect(model.filter(l => l.kind === 'logo')).toHaveLength(1);
  });
});

describe('making charges are not double-counted', () => {
  // Reproduces the OrderDetailsScreen mapping, where makingCharges is an already
  // resolved rupee amount. Labelling that 'Per Gram' made getItemComponents multiply
  // it by the weight again — a 19gm item printed Making ~18x too high.
  const resolvedAmount = 26404;
  const item = {
    ...values.items[0],
    netWt: '19',
    grossWt: '19',
    ratePerGm: '13202',
    makingChargeType: 'Fixed' as const,
    makingCharges: String(resolvedAmount),
    itemTotal: '277242',
  };

  it('treats a resolved making amount as the amount, not a per-gram rate', () => {
    const model = buildReceiptModel({ ...values, items: [item] }, ctx, 'en');
    // startsWith, not equality: the row now carries the charge basis in
    // brackets — "Making (Fixed)", "Making (10%)".
    const makingRow = model.find(
      l => l.kind === 'row' && l.left.startsWith('Making'),
    ) as any;

    expect(makingRow).toBeDefined();
    // 26,404 — not 19 x 26,404.
    expect(makingRow.right).toContain('26,404');
    expect(makingRow.right).not.toContain('501,676');
  });

  // The same resolved amount as above, but reaching the receipt through the
  // shape a saved order is mapped into for printing: the arithmetic pair
  // flattened to 'Fixed' + rupees, with the basis the customer agreed to
  // carried alongside for display. The label must report the real basis while
  // the amount stays un-multiplied.
  it('shows the original basis without recomputing from it', () => {
    const withBasis = {
      ...item,
      makingBasisType: 'percentage',
      makingBasisValue: '10',
    };
    const model = buildReceiptModel({ ...values, items: [withBasis] }, ctx, 'en');
    const makingRow = model.find(
      l => l.kind === 'row' && l.left.startsWith('Making'),
    ) as any;

    expect(makingRow.left).toBe('Making (10%)');
    expect(makingRow.right).toContain('26,404');
    expect(makingRow.right).not.toContain('501,676');
  });
});

describe('logo is emitted as its own segment, not via the capture strip', () => {
  const withLogo: PrintContext = {
    ...ctx,
    shopDetails: { ...ctx.shopDetails, logo: 'data:image/png;base64,iVBORw0KGgo=' },
  };
  const marathi = { ...values, customerName: 'मकरंद जाधव' };

  it('excludes the logo from the lines rendered into the capture strip', () => {
    // An off-screen <Image> reports onLoad but never paints on Android, so the logo
    // must not be sourced from the capture.
    const model = buildReceiptModel(marathi, withLogo, 'en');
    expect(model.some(l => l.kind === 'logo')).toBe(true);
    expect(nonAsciiLines(model).some(l => l.kind === 'logo')).toBe(false);
  });

  it('plans a dedicated logo segment in the right position', () => {
    const segments = planHybridReceipt(buildReceiptModel(marathi, withLogo, 'en'));
    // The logo is the first thing on the receipt, so its segment comes first.
    expect(segments[0].kind).toBe('logo');
    expect(segments.filter(s => s.kind === 'logo')).toHaveLength(1);
  });

  it('splices the logo commands into the job', () => {
    const segments = planHybridReceipt(buildReceiptModel(marathi, withLogo, 'en'));
    const marker = [0xaa, 0xbb, 0xcc];
    const job = assembleHybrid(segments, () => [0x00], marker);
    const idx = job.findIndex(
      (b, i) => b === marker[0] && job[i + 1] === marker[1] && job[i + 2] === marker[2],
    );
    expect(idx).toBeGreaterThan(-1);
    // After ESC @, before anything else.
    expect(idx).toBe(2);
  });

  it('still prints the bill when there is no logo', () => {
    const segments = planHybridReceipt(buildReceiptModel(marathi, ctx, 'en'));
    expect(segments.some(s => s.kind === 'logo')).toBe(false);
    expect(assembleHybrid(segments, () => [0x00]).length).toBeGreaterThan(0);
  });
});

describe('logo centring', () => {
  const rowsOf = (img: { width: number; height: number; dark: Uint8Array }, y: number) =>
    Array.from(img.dark.slice(y * img.width, (y + 1) * img.width));

  it('pads a narrow image out to the print width with content centred', () => {
    // A 4px-wide fully-dark image inside a 16px head should sit at columns 6-9.
    const src = { width: 4, height: 1, dark: Uint8Array.from([1, 1, 1, 1]) };
    const out = centerHorizontally(src, 16);

    expect(out.width).toBe(16);
    expect(rowsOf(out, 0)).toEqual([0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0]);
  });

  it('leaves a full-width image untouched', () => {
    const src = { width: 16, height: 1, dark: new Uint8Array(16).fill(1) };
    expect(centerHorizontally(src, 16)).toBe(src);
  });
});

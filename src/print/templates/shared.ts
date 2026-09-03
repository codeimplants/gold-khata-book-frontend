import { Platform } from 'react-native';
import { translations } from '../../localization';
import { JewelleryFormValues, BillItem } from '../../types';
import { getFullImageUrl } from '../../utils/imageUtils';
import { getBillTotals, formatOtherChargesLabel } from '../../utils/calculations';
import { getSharedMakingBasis } from '../../utils/formatter';
import { BILL_PAGE, CUSTOM_MARGIN_MM, DEFAULT_PAPER, PaperPrefs } from '../../constants/bill';

export type MobileLang = keyof typeof translations;

export const fc = (value?: string | number) => {
  const n = value == null ? 0 : typeof value === 'number' ? value : Number(String(value).replace(/[^\d.-]/g, '')) || 0;
  return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const fw = (value?: string | number) => `${Number(value ?? 0).toFixed(3)} gm`;

export const pn = (value?: string | number): number => {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return value;
  return Number(String(value).replace(/[^\d.-]/g, '')) || 0;
};

/**
 * Outstanding balance on an advance order.
 *
 * The backend derives this from the WEIGHT still owed, priced at the rate each
 * payment locked on the day it was taken. Recomputing it here as
 * `grandTotal - cash received` reprices grams the customer has already bought:
 * on a two-payment order taken months apart the two answers differ by tens of
 * thousands of rupees, and that divergence is exactly what made a printed bill
 * and the order screen quote different totals for the same order.
 *
 * So prefer the stored figure and fall back to the cash subtraction only when
 * there isn't one — a final invoice has no locked weight left to honour.
 */
export const advanceBalanceDue = (
  values: {
    grandTotal?: string | number;
    paymentSummary?: { estimatedBalance?: string };
  },
  totalPaid: number,
): number => {
  const stored = pn(values.paymentSummary?.estimatedBalance);
  if (stored > 0) return stored;
  return Math.max(0, pn(values.grandTotal) - totalPaid);
};

/**
 * Looks up a dotted key under a namespace, falling back to English when the
 * chosen language is missing that string.
 */
export const tp = (lang: MobileLang, prefix: string, key: string): string => {
  const keys = `${prefix}.${key}`.split('.');
  const read = (source: any) => {
    let v: any = source;
    keys.forEach(k => { v = v?.[k]; });
    return v;
  };

  const v = read(translations[lang]);
  if (v == null) {
    // fallback to English
    return read(translations['en']) ?? key;
  }
  return v;
};

/** Bill-namespace shorthand — the templates' existing helper, unchanged. */
export const tl = (lang: MobileLang, key: string): string => tp(lang, 'bill', key);

/** Declaration-namespace shorthand. */
export const td = (lang: MobileLang, key: string): string => tp(lang, 'declaration', key);

/** Fills `{placeholder}` tokens in a translated string. */
export const fill = (
  template: string,
  values: Record<string, string | number>,
): string =>
  Object.entries(values).reduce(
    (out, [k, v]) => out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
    template,
  );

/**
 * Escapes user-entered text before it goes into the print HTML.
 *
 * Everything on a declaration is typed by the shopkeeper — a customer name
 * containing `<` or `&` would otherwise corrupt the document layout, and the
 * same string is later rasterized into a PDF where the damage is permanent.
 */
export const esc = (value?: string | number | null): string => {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

/**
 * Style for money and weight cells.
 *
 * Georgia — which `minimal` and the letterhead templates use — renders OLDSTYLE
 * figures by default: 3, 4, 7 and 9 drop below the baseline while 6 and 8 rise
 * above it. Handsome in running prose, wrong in a money column, where a customer
 * is comparing digits down a column and the varying heights read as wobble.
 *
 * Asking for `lnum` alone is not enough. OpenType feature support is unreliable
 * in Android's WebView and the iOS print formatter, and the same bill has to
 * come out of all three — so the numeric cells switch to a face whose figures
 * are lining by default, with the feature flags as belt and braces.
 *
 * `tnum` additionally fixes every digit to one width, so decimal points line up
 * down the column instead of drifting.
 */
export const NUM_FONT =
  "font-family:Arial,'Noto Sans',sans-serif;font-variant-numeric:tabular-nums lining-nums;font-feature-settings:'tnum' 1,'lnum' 1;";

export const imgTag = (src: any, style: string) => {
  const url = getFullImageUrl(src);
  return url ? `<img src="${url}" style="${style}" />` : '';
};

/**
 * How tall a signature prints, and the shortest the line under it may be.
 *
 * The signature used to be poured into a fixed 90x32 box with `object-fit:
 * contain`, which is only right for a long thin scrawl. A real uploaded
 * signature — 500x386, so nearly square — was constrained by the 32px height
 * and came out 42x32, about 11x8.5mm on paper: under half the width reserved
 * for it, and small enough that a shopkeeper reasonably asked whether it was
 * broken.
 *
 * Sizing by height with `width:auto` is what fixes that. The signature keeps
 * its own proportions whatever shape it is, and the box stops dictating them.
 * `max-width` is the only cap, so an unusually wide signature still cannot push
 * the totals column out of line.
 *
 * 58px is ~15mm printed, which is a normal signature on a bill. Nowhere near
 * the resolution limit either: the stored image is 500px wide, good for ~42mm
 * at 300dpi, so there is room to grow this if a shop ever asks.
 */
const SIGNATURE_HEIGHT_PX = 58;
const SIGNATURE_MAX_WIDTH_PX = 240;
const SIGNATURE_LINE_MIN_PX = 170;

/** The same signature on a sheet that cannot afford 15mm of it. See closingTier. */
const SIGNATURE_COMPACT_PX = 34;
const SIGNATURE_MINIMAL_PX = 22;

/**
 * Clear space between the signature and the rule beneath it.
 *
 * Without it the strokes sit directly on the line — a descender or a flourish
 * that dips below the baseline touches it, and the whole thing reads as one
 * smudged mark rather than a signature above a line.
 */
const SIGNATURE_GAP_PX = 8;

/**
 * Blank space above the rule in the minimal tier when no signature is uploaded.
 *
 * Deliberately not a signable 58mm gap — that is the space the sheet does not
 * have. A shopkeeper on a slip this short signs across the rule itself, the way
 * anyone signs a cramped counterfoil.
 */
const SIGNATURE_MINIMAL_BLANK_PX = 12;

/**
 * The signature, the rule beneath it and the "Authorised Signatory" caption.
 *
 * One helper rather than the same markup in seven templates, for the reason
 * `itemPhotoStrip` gives: this is the kind of duplication that ends with six
 * templates fixed and one quietly still wrong.
 *
 * The rule lives on a wrapper rather than on the image, which is what keeps it
 * a consistent length. Border-bottom on the image itself made the line only as
 * wide as the signature, so a narrow one produced a stub of an underline that
 * did not read as a signature line at all.
 *
 * `align` handles the formal tax-invoice layout, where the block sits at the
 * right of its cell rather than the left.
 *
 * `shopName` prints under the caption, which is where a signature is attributed
 * on any Indian bill — the person signing is signing FOR the shop, so the two
 * belong in one block. The six bill templates used to put the shop name at the
 * far end of the closing band instead, opposite the thank-you line, where it
 * read as a second footer note rather than part of the signature.
 *
 * `paper` lets the block size itself to what is left of the sheet — see
 * `closingTier`. Omitting it means A4, which is what the callers that never
 * print on shop stationery want.
 */
export const signatureBlock = (
  signature: any,
  lang: MobileLang,
  opts: {
    rule: string;
    captionSize?: number;
    captionColor?: string;
    align?: 'left' | 'right';
    /** Omit the rule when the surrounding layout already draws one. */
    showRule?: boolean;
    /** Printed under the caption, as the signature's attribution. */
    shopName?: string;
    /** The sheet, so a short one gets a shorter block. */
    paper?: PaperPrefs;
  },
): string => {
  const {
    rule,
    captionSize = 10,
    captionColor = '#333',
    align = 'left',
    showRule = true,
    shopName,
    paper,
  } = opts;

  const tier = closingTier(paper);

  // Beside the totals, this block's height is free: the totals column is the
  // taller of the two, so the row is as deep as the money either way. It gets
  // the full signature and the caption on its own line whatever the tier says —
  // shrinking it there would buy nothing and cost the shopkeeper a legible
  // signature. Only a stacked block, whose height really does push the page
  // down, follows the tier.
  const roomy = tier === 'full' || closingIsSideBySide(paper);

  const sigHeight = roomy
    ? SIGNATURE_HEIGHT_PX
    : tier === 'compact'
      ? SIGNATURE_COMPACT_PX
      : SIGNATURE_MINIMAL_PX;
  const sigGap = roomy ? SIGNATURE_GAP_PX : 5;

  // Centred over its own line, matching the caption underneath. Left-aligned it
  // sat off to one side of a full-width rule while the words below were
  // centred, so the two halves of the same block did not line up with each
  // other. The formal tax invoice is the exception: there the whole block hugs
  // the right of its cell, caption included.
  const img = imgTag(
    signature,
    `display:block;height:${sigHeight}px;width:auto;max-width:${SIGNATURE_MAX_WIDTH_PX}px;` +
      `object-fit:contain;margin-bottom:${sigGap}px;` +
      (align === 'right' ? 'margin-left:auto;' : 'margin-left:auto;margin-right:auto;'),
  );

  // An empty rule when nothing is uploaded: the shopkeeper signs the printed
  // bill by hand, and the line has to be there — and tall enough to sign in.
  // Except in the minimal tier, where the sheet has no height to give: there the
  // gap shrinks to a token strip and the rule itself is what gets signed.
  const blank = !roomy && tier === 'minimal' ? SIGNATURE_MINIMAL_BLANK_PX : sigHeight;
  const inner =
    img || `<div style="height:${blank}px;margin-bottom:${sigGap}px;"></div>`;

  const textAlign = align === 'right' ? 'right' : 'center';

  // Near-black and bold, not the caption's grey: this is the shop's name on its
  // own bill, and it always sits on white here — the closing band it came from
  // was sometimes a coloured strip, which is why it used to carry a per-template
  // colour.
  //
  // It joins the caption only on a minimal block that is genuinely stacked —
  // there the whole block is ~13mm and a line of its own would be a tenth of the
  // sheet spent on the shop's own name. Beside the totals there is no such
  // pressure, and the shop asked for it under the caption, where a signature is
  // attributed.
  const joined = !roomy && tier === 'minimal' && Boolean(shopName);
  const caption = joined
    ? `${tl(lang, 'authorisedSignatory')} · ${esc(shopName)}`
    : tl(lang, 'authorisedSignatory');
  const attribution =
    shopName && !joined
      ? `\n  <div style="font-size:${captionSize + 1.5}px;font-weight:700;color:#111827;text-align:${textAlign};margin-top:2px;">${esc(shopName)}</div>`
      : '';

  return `<div style="min-width:${SIGNATURE_LINE_MIN_PX}px;">
  <div style="${showRule ? `border-bottom:1px solid ${rule};` : ''}margin-bottom:4px;">${inner}</div>
  <div style="font-size:${captionSize}px;color:${captionColor};text-align:${textAlign};">${caption}</div>${attribution}
</div>`;
};

/**
 * The closing band at the foot of a bill — the thank-you line, and the
 * making-charges note under it when the template shows one.
 *
 * Centred, and one helper rather than six copies, because this row is the same
 * row on every bill the shop prints: a customer comparing two bills from the
 * same shop should not find the closing line in a different place on each. The
 * band used to be a `space-between` flex row, so the thank-you sat hard against
 * the left edge with either the note or the shop name pushed to the right.
 *
 * The band's own colours and padding stay with the template — those are what the
 * shopkeeper actually chose between — but the arrangement inside it does not
 * vary, and neither does whether it appears at all.
 *
 * **Empty below the `full` tier**, and the helper emits the container so that it
 * really is empty. Returning only the inner text and leaving the coloured strip
 * to the template would print an 8px band of grey or saffron with nothing in it,
 * which is the kind of thing that gets fixed in five templates and missed in the
 * sixth. See `closingTier` for why a short sheet loses this line first.
 */
/**
 * Narrower than this, the signature and the totals stay stacked.
 *
 * Side by side they need room for both: a signature line has a 170px floor and
 * the totals another 170-190px, so under ~150mm of content box one of them gets
 * crushed. That is the narrow-slip case, where the tiers have already shrunk
 * everything anyway.
 */
const CLOSING_SIDE_BY_SIDE_MIN_WIDTH_MM = 150;

/**
 * Whether the closing block sits beside the totals rather than under them.
 *
 * Exported because `signatureBlock` needs the same answer: side by side, its
 * height is free — the totals column is taller — so the signature stays full
 * size and the shop name keeps its own line. Stacked, every millimetre it takes
 * pushes the page down, and the tier shrinks it.
 */
export const closingIsSideBySide = (paper?: PaperPrefs): boolean =>
  closingTier(paper) !== 'full' &&
  contentBoxMm(paper).widthMm >= CLOSING_SIDE_BY_SIDE_MIN_WIDTH_MM;

/**
 * The bottom of a bill: the totals, the signature, the thank-you band.
 *
 * On a full sheet these stack, exactly as they always have — totals under the
 * items they add up, signature and band pinned to the page foot. On a short one
 * the signature moves UP beside the totals, and the pair drop to the foot
 * together.
 *
 * That is worth ~19mm, which is the difference between a bill fitting a shop's
 * pre-printed slip and spilling its signature onto a second one. Measured on the
 * bill that prompted it: 38.6mm of totals stacked on 19.3mm of closing block
 * becomes one 38.6mm band, because a 202mm sheet has 150mm of empty paper to the
 * left of a totals column that is only ~45mm wide.
 *
 * It is also just the conventional cash-memo layout — signature at the left of
 * the foot, figures at the right — which is why it reads as a bill rather than
 * as a bill that has been squeezed.
 *
 * Preferred over splitting the totals into two columns, which was measured at
 * 10.6mm against a projected 18mm: a long old-gold line wraps to three lines in
 * a half-width column, and the money block is the last part of a bill worth
 * making unfamiliar. See buildTotalsBlock.
 *
 * The templates keep their own paddings and widths and hand them in, because
 * those are the part that differs between a navy header and a saffron one. What
 * they no longer each own is the arrangement.
 */
export const closingSection = (opts: {
  /** Rendered by `buildTotalsBlock`. */
  totals: string;
  /** Rendered by `signatureBlock`. */
  signature: string;
  /** Rendered by `footerBand` — empty below the full tier. */
  band: string;
  /** The template's own totals row: the flex wrapper's padding. */
  totalsRowStyle: string;
  /** Floor for the totals column, e.g. '190px'. */
  totalsWidth: string;
  /** The template's own padding for the signature row. */
  signRowStyle: string;
  /** Anything that must stay inside the pinned block below the band — the
   *  Modern template's gold rule, which outside it would sit at the page edge. */
  after?: string;
  paper?: PaperPrefs;
}): string => {
  const tail = opts.after ?? '';

  const stacked = `<div style="${opts.totalsRowStyle}">
  <div style="min-width:${opts.totalsWidth};">${opts.totals}</div>
</div>

<div class="bill-foot">
  <div class="bill-sign" style="${opts.signRowStyle}">${opts.signature}</div>
  ${opts.band}
  ${tail}
</div>`;

  if (!closingIsSideBySide(opts.paper)) return stacked;

  // `justify-content` and `align-items` come after the template's own style so
  // they win: the signature row is already a flex-start row on every template,
  // and here the two blocks need to push apart and sit on a common baseline.
  return `<div class="bill-foot">
  <div class="bill-sign" style="${opts.signRowStyle}justify-content:space-between;align-items:flex-end;gap:16px;">
    ${opts.signature}
    <div style="min-width:${opts.totalsWidth};">${opts.totals}</div>
  </div>
  ${opts.band}
  ${tail}
</div>`;
};

export const footerBand = (
  lang: MobileLang,
  opts: {
    /** Background, border and padding of the band itself. */
    bandStyle: string;
    thankYouStyle: string;
    noteStyle?: string;
    paper?: PaperPrefs;
  },
): string => {
  if (closingTier(opts.paper) !== 'full') return '';

  return `<div style="${opts.bandStyle}">
  <div style="text-align:center;">
    <div style="${opts.thankYouStyle}">${tl(lang, 'thankYou')}</div>${
      opts.noteStyle
        ? `\n    <div style="${opts.noteStyle}margin-top:3px;">${tl(lang, 'allPricesInclMC')}</div>`
        : ''
    }
  </div>
</div>`;
};

/**
 * Thumbnails of an item's photos, for the item-name cell of a printed bill.
 *
 * Returns an empty string unless the shopkeeper opted in per bill — item photos
 * are a shop-side record by default, and a customer's copy should not sprout
 * pictures because someone happened to photograph the piece at the counter.
 *
 * One helper rather than the same markup in all five templates: this is the
 * kind of duplication that ends with four templates printing photos and one
 * quietly not, which nobody notices until a customer asks.
 *
 * Capped at three and fixed-size, because a bill row is a table row — an
 * uncapped strip would push the money columns out of alignment and, on a long
 * bill, across a page break. Pending (not-yet-uploaded) picks are deliberately
 * ignored: printing a local `file://` URI produces a broken image on the PDF.
 */
export const itemPhotoStrip = (
  item: { photos?: { url: string }[] },
  includeOnBill?: boolean,
  paper?: PaperPrefs,
): string => {
  if (!includeOnBill) return '';
  const photos = (item.photos || []).slice(0, 3);
  if (photos.length === 0) return '';

  // Smaller on a sheet that cannot afford 10mm of pictures, but never dropped:
  // the shopkeeper ticked "include item photos" on this particular bill, and
  // silently ignoring that is not the same kind of decision as leaving off a
  // thank-you line nobody asked for. 20px is still a recognisable thumbnail of
  // a ring, and it buys back 6mm.
  const size = closingTier(paper) === 'full' ? 34 : 20;

  const tags = photos
    .map(photo =>
      imgTag(
        photo.url,
        `width:${size}px;height:${size}px;object-fit:cover;border-radius:4px;border:0.5px solid #e5e7eb;`,
      ),
    )
    .filter(Boolean)
    .join('');

  return tags ? `<div style="display:flex;gap:4px;margin-top:4px;">${tags}</div>` : '';
};

/**
 * Safe printable border, in mm, for the current platform.
 *
 * Web only. Android's print framework scales the PDF to fit the printer's
 * printable area by itself, so it already prints with a border and needs
 * nothing here; iOS takes its inset from the print formatter's printableRect
 * (the `padding` option in pdfService) rather than from CSS. Both stay at 0,
 * leaving their output identical to before.
 *
 * The margin has to live on @page, not on body padding: long invoices paginate,
 * and padding-top only insets the first page, so page 2 would still print flush
 * to the top edge.
 */
const PAGE_MARGIN_MM = Platform.OS === 'web' ? BILL_PAGE.MARGIN_MM : 0;

/**
 * Page size for @page. On web this is the `A4` keyword, not the equivalent
 * `210mm 297mm`.
 *
 * Chrome only matches a *named* page size against the printer's media list.
 * Given an explicit length pair it leaves the printer on whatever its own
 * default happens to be and scales the page to fit that instead — so on a
 * printer defaulting to US Letter (215.9 x 279.4mm, ~18mm shorter than A4)
 * every bill was silently shrunk about 6%.
 *
 * Observed directly in Chrome's print preview: the bill's Paper size read
 * "Letter", while the GST report — same printService path, but already on
 * `size: A4` — read "A4" on the same printer.
 *
 * Native keeps the explicit dimensions: Android and iOS take page geometry
 * from PrintAttributes / printableRect rather than from this rule, and both
 * print correctly today.
 */
const PAGE_SIZE = Platform.OS === 'web' ? 'A4' : `${BILL_PAGE.WIDTH_MM}mm ${BILL_PAGE.HEIGHT_MM}mm`;

/** Trims binary-float noise so the rule reads `104.5mm`, not `104.49999999mm`. */
const mm = (value: number) => `${Math.round(value * 100) / 100}mm`;

/**
 * Callers that predate custom paper pass nothing and get plain A4.
 *
 * Note this deliberately does NOT collapse a4-mode paper to DEFAULT_PAPER: A4
 * still carries a header reserve, because most pre-printed letterhead is
 * ordinary A4. Values are already clamped by sanitisePaper in printPrefsSlice.
 */
export const resolvePaper = (paper?: PaperPrefs): PaperPrefs => paper ?? DEFAULT_PAPER;

/**
 * The `@page` rule, and the whole of the custom-paper geometry.
 *
 * The page stays A4 even when the shop prints on something smaller. That is not
 * a simplification, it is the only thing that works: a printer images relative
 * to the origin implied by the size the DRIVER was told, so the reliable move is
 * to hand it a size it knows and place the content where the real sheet sits.
 * Declaring the true size instead fails twice over — browsers ignore a raw
 * length pair for media matching (see PAGE_SIZE above), and react-native-print
 * hands Android `MediaSize.UNKNOWN_PORTRAIT`, leaving placement driver-decided.
 * That last part is what the shop's first attempt at custom sizes hit, and why
 * their prints came out "half cut depending on where the paper sat in the tray".
 *
 * So the band is positioned purely with @page margins:
 *
 *     +---------------- A4 page ----------------+
 *     |            marginTop = R + S            |
 *     |        +---- the real sheet ----+       |
 *     |  left  |   invoice content      | right |
 *     |        +------------------------+       |
 *     |     marginBottom = (297 - H) + S        |
 *     +-----------------------------------------+
 *
 * Margins rather than a wrapper div because CSS breaks content at the bottom of
 * the page content box on EVERY page. A long invoice therefore paginates at the
 * sheet's height instead of A4's, and the letterhead strip is reserved on sheet
 * two as well — which a `padding-top` on the body could never do.
 *
 * Horizontal placement is the one thing we cannot infer; see PaperPosition.
 * Vertically the sheet's top edge is always the page's top edge, because paper
 * feeds leading-edge first on every printer.
 */
export type PageMarginsMm = { top: number; right: number; bottom: number; left: number };

/** The four @page margins that place the content band on the A4 page. */
export const pageMarginsMm = (paper?: PaperPrefs): PageMarginsMm => {
  const resolved = resolvePaper(paper);

  if (resolved.mode !== 'custom') {
    // Full-width A4, but still honouring a header reserve — a shop printing onto
    // plain-A4 letterhead needs the strip kept clear just as much as one on a
    // smaller sheet. The reserve applies on every platform, unlike PAGE_MARGIN_MM:
    // that margin is a safety fix we rolled out to web first, whereas this is a
    // measurement the shopkeeper entered and would expect to be obeyed anywhere.
    const m = PAGE_MARGIN_MM;
    return { top: m + resolved.headerReserveMm, right: m, bottom: m, left: m };
  }

  // The safe border applies on every platform here, unlike the A4 path: in
  // custom mode the margins are doing positioning, not just padding, and a
  // native build that dropped them would print the band in the wrong place
  // rather than merely closer to the edge.
  const safe = CUSTOM_MARGIN_MM;
  const sideGap = Math.max(0, BILL_PAGE.WIDTH_MM - resolved.widthMm);
  const bottomGap = Math.max(0, BILL_PAGE.HEIGHT_MM - resolved.heightMm);

  const [leftGap, rightGap] =
    resolved.position === 'left'
      ? [0, sideGap]
      : resolved.position === 'right'
        ? [sideGap, 0]
        : [sideGap / 2, sideGap / 2];

  return {
    top: resolved.headerReserveMm + safe,
    right: rightGap + safe,
    bottom: bottomGap + safe,
    left: leftGap + safe,
  };
};

/**
 * The printable area left inside those margins — i.e. the part of the shop's
 * sheet an invoice actually gets, below any pre-printed header. The alignment
 * test page draws its outline at exactly this size.
 */
export const contentBoxMm = (paper?: PaperPrefs) => {
  const m = pageMarginsMm(paper);
  return {
    widthMm: BILL_PAGE.WIDTH_MM - m.left - m.right,
    heightMm: BILL_PAGE.HEIGHT_MM - m.top - m.bottom,
  };
};

/**
 * How much closing block the sheet can afford.
 *
 * The block — signature, rule, "Authorised Signatory", the shop's name, the
 * thank-you band — costs about 50mm at full size. That is nothing on A4, where
 * the content box is 281mm, and more than half the sheet on a pre-printed slip:
 * a shop printing 210 x 139mm stationery with a 45mm letterhead reserve has an
 * 86mm box, so a ONE-ITEM bill overflowed onto a second slip. The overflow was
 * entirely the footer.
 *
 * Deciding from the box rather than from the template is what makes this right
 * in every combination, and there are more of those than the three the picker
 * implies:
 *
 *   - A4 letterhead with a 35mm reserve leaves 250mm. Those shops have all the
 *     room in the world and want the signature — removing the block for the
 *     "pre-printed" templates would have punished them for the 139mm shop's
 *     problem.
 *   - Nothing stops a shop pairing a full-header template with a short custom
 *     sheet, and that overflows identically. Template-based rules miss it.
 *   - Blank A4 and the header-image template both give 281mm, so they keep the
 *     full block without being special-cased at all.
 *
 * What is dropped, and in which order, follows what the line is worth on a bill.
 * The thank-you line and the making-charges note are courtesy and go first; the
 * signature is the point of the document and goes last, shrinking rather than
 * disappearing. The shop's name rides along with the caption.
 *
 * | tier    | box height | signature | caption + shop name | thank-you band |
 * |---------|------------|-----------|---------------------|----------------|
 * | full    | >= 150mm   | 58px      | two lines           | yes            |
 * | compact | >= 100mm   | 34px      | two lines           | no             |
 * | minimal | < 100mm    | 22px      | one line, joined    | no             |
 *
 * ~50mm, ~21mm and ~13mm respectively, footer safe margin included.
 *
 * The thresholds are the block's own cost times three: a closing block has no
 * business taking more than a third of the sheet away from the items, which are
 * the part the customer actually paid for. They are deliberately round numbers —
 * this is a judgement about proportion, not a measurement.
 *
 * NOTE none of this can rescue a bill that is genuinely too long for the paper.
 * 45mm of letterhead on a 139mm slip leaves 86mm, which holds about two items
 * whatever the footer does; past that, paginating is the honest outcome.
 */
export type ClosingTier = 'full' | 'compact' | 'minimal';

export const CLOSING_FULL_MIN_MM = 150;
export const CLOSING_COMPACT_MIN_MM = 100;

export const closingTier = (paper?: PaperPrefs): ClosingTier => {
  const { heightMm } = contentBoxMm(paper);
  if (heightMm >= CLOSING_FULL_MIN_MM) return 'full';
  if (heightMm >= CLOSING_COMPACT_MIN_MM) return 'compact';
  return 'minimal';
};

export const buildPageCss = (paper?: PaperPrefs): string => {
  const m = pageMarginsMm(paper);
  const colourAdjust =
    '* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }';

  return `@page { size: ${PAGE_SIZE}; margin: ${mm(m.top)} ${mm(m.right)} ${mm(m.bottom)} ${mm(m.left)}; }\n${colourAdjust}`;
};

/**
 * Plain-A4 page CSS, for documents that are never printed on shop stationery —
 * the old-gold declaration is a legal form and always wants a full sheet.
 */
export const PAGE_CSS = buildPageCss();

/**
 * Clear space kept under the pinned footer, on top of the page margin.
 *
 * The @page rule already holds content off the sheet edge on web, but that
 * margin is web-only: the native paths take their geometry from Android's
 * PrintAttributes and iOS's printableRect instead, so CSS cannot be relied on
 * to keep the last line off the hardware border. Every inkjet and laser has a
 * 3-5mm strip it physically cannot image (see PRINTING.md §3b), and the signature
 * line is the one thing on a bill that must never be half-printed.
 *
 * 6mm clears that border on every path with room to spare, and still reads as
 * "at the bottom of the page" rather than floating above it.
 *
 * Below the `full` tier it drops to 4mm. "Room to spare" is a luxury of a sheet
 * with room: on an 86mm slip those 2mm are 2% of everything the shop has, and
 * 4mm still clears the 3-5mm hardware border — it is the same figure
 * CUSTOM_MARGIN_MM settles on, for the same reason. In custom mode the @page
 * margin already contributes its own 4mm underneath this, on every platform.
 */
export const FOOTER_SAFE_MM = 6;
const FOOTER_SAFE_TIGHT_MM = 4;

const footerSafeMm = (paper?: PaperPrefs) =>
  closingTier(paper) === 'full' ? FOOTER_SAFE_MM : FOOTER_SAFE_TIGHT_MM;

/**
 * Pins a bill's closing block — authorised signatory and the thank-you line —
 * to the bottom of the page instead of letting it sit directly under the items.
 *
 * A one-item bill used to leave both floating around the middle of the sheet
 * with a third of the page blank beneath them, which reads as an unfinished
 * document rather than a short one.
 *
 * Done with flexbox rather than `position: fixed`, which is the more obvious
 * answer and the wrong one here. Of the four print paths (PRINTING.md §1) the
 * web PDF route rasterises the DOM through html2canvas and ignores paged media
 * entirely, so a fixed footer lands wherever it happens to sit in the document
 * flow — the two paths would disagree, and the one that disagrees is the file
 * the customer is sent. A flex column with `margin-top:auto` is plain layout
 * that every renderer here agrees on.
 *
 * `min-height` is the printable box, less a millimetre. Exactly the box risks a
 * blank second page: sub-pixel rounding in any renderer that makes the body a
 * hair taller than the page spills an empty sheet out of the printer, and a
 * shopkeeper cannot diagnose that.
 *
 * A bill long enough to fill the page is unaffected — with no free space,
 * `margin-top:auto` resolves to zero and the footer simply follows the content.
 *
 * Two mechanisms, because the templates are built differently:
 *
 * `.bill-foot` detaches the closing block and drops it to the bottom. Right for
 * the seven templates whose footer is free-standing.
 *
 * `.bill-grow` + `tr.bill-filler` stretch the ruled items table instead, which
 * is what the formal tax-invoice layout needs. There the signature sits inside
 * a bordered grid that runs unbroken from the item rows down through the
 * amount-in-words and declaration boxes, so detaching the bottom of it would
 * open a gap straight through the middle of the frame — on the one document
 * where the grid IS the layout. Growing an empty last row keeps every rule
 * continuous and lands the closing boxes on the page foot anyway. `height:100%`
 * on that row is what makes it absorb the slack rather than every row growing
 * proportionally and fattening the item lines.
 */
/**
 * Vertical rhythm, compressed, for a sheet that cannot afford the normal one.
 *
 * Shrinking the closing block was not enough on its own. Measured in headless
 * Chrome on the reported sheet — 216 x 139mm, 45mm reserve, an 86mm content box
 * — the letterhead bill came to 76mm with one item and **88.4mm with two**, so
 * it cleared the sheet by 10mm and then missed it by 2.4mm. A 2.4mm overflow
 * still costs a whole second slip, and what lands on it is the signature.
 *
 * The gaps are where that 2.4mm lives, not the words: at two items the bill
 * spends 21mm on three totals lines and 18mm on a closing block whose top
 * padding alone is 18px. This tightens the spacing and touches no font size,
 * because the legibility floor in PRINTING.md §5 is not negotiable — a bill a
 * shopkeeper cannot read is worse than a bill on two sheets.
 *
 * `!important` throughout, which is not the usual sin here: every template sets
 * this spacing inline, and inline styles beat a stylesheet rule that does not
 * carry it. The alternative was threading a density flag through six templates'
 * row markup, which is exactly the duplication `signatureBlock` exists to avoid.
 *
 * Nothing here applies on a full sheet — `closingTier` gates the whole block, so
 * an A4 bill is byte-identical to before.
 */
const denseCss = (paper?: PaperPrefs): string => {
  if (closingTier(paper) === 'full') return '';

  return `
td, th { padding-top: 5px !important; padding-bottom: 5px !important; }
.bill-tot { margin-bottom: 2px !important; }
.bill-tot-grand { padding-top: 4px !important; margin-top: 3px !important; }
.bill-sign { padding-top: 6px !important; padding-bottom: 6px !important; }`;
};

export const footerPinCss = (paper?: PaperPrefs): string => {
  const box = contentBoxMm(paper);
  const safe = footerSafeMm(paper);
  return `${denseCss(paper)}
html { height: auto; }
body { display: flex; flex-direction: column; min-height: ${mm(box.heightMm - 1)}; }
.bill-foot { margin-top: auto; padding-bottom: ${mm(safe)}; }
.bill-foot > :first-child { margin-top: 0; }
.bill-grow { flex: 1 0 auto; display: flex; flex-direction: column; }
.bill-grow > table { flex: 1 0 auto; }
tr.bill-filler { height: 100%; }
tr.bill-filler > td { padding: 0; }
.bill-tail { padding-bottom: ${mm(safe)}; }`;
};

/**
 * "GST (3%)", or a bare "GST" when the rate is not known.
 *
 * Both renderers used to print `values.gstPercentage || 0`, so a bill that
 * carried the GST amount but not the rate said "GST (0%)" next to a four-figure
 * number. That is a confidently wrong tax rate on a document the customer keeps,
 * and it is indistinguishable from a genuine zero-rated line. Dropping the
 * bracket is the honest failure: the amount still prints, and nothing asserts a
 * rate we do not have.
 *
 * Zero is treated as missing rather than as a real rate — callers only reach
 * here when the GST amount is already > 0, so a 0% rate beside it is always the
 * absent value, never a real one.
 */
export const gstLabel = (gstPercentage?: number): string =>
  (gstPercentage ?? 0) > 0 ? `GST (${gstPercentage}%)` : 'GST';

/**
 * One money line on a bill. `label` and `amount` arrive formatted and localised,
 * and `amount` carries its own minus sign for deductions — a renderer should not
 * have to know which lines subtract.
 */
export type BillLine = {
  label: string;
  amount: string;
  /** Emphasised: Total and Balance Due. */
  strong?: boolean;
  /** Deductions — discount, old-gold exchange, advance payments. */
  negative?: boolean;
  /** Only the tax line carries these; the ruled tax invoice gives them columns. */
  rate?: string;
  unit?: string;
};

/**
 * Every money line a bill shows, in order. The single source of truth for WHAT
 * appears on a bill, so the renderers cannot drift apart.
 *
 * They had. The stacked totals block showed old-gold exchanges and advance
 * payments; the ruled tax-invoice table built its own rows and silently omitted
 * both, so on those bills the column did not reconcile with the Total printed
 * directly underneath it.
 *
 * The order mirrors what `calculateFormTotals` actually computes, because the
 * printed bill has to be the arithmetic the app did:
 *
 *     metal + making + other - discount   = itemTotal, per item
 *     sum(itemTotal) - exchange           = subtotal
 *     subtotal x rate                     = GST
 *     subtotal + GST                      = total
 *
 * Note the discount comes off PER ITEM, before tax — both because that is what
 * the app calculates and because a discount shown on the invoice reduces the
 * taxable value. Moving it after GST would change every bill's tax figure.
 */
export const buildBillLines = (
  values: JewelleryFormValues,
  itemsTotal: number,
  lang: MobileLang,
  combinePayments: boolean = false,
): BillLine[] => {
  const showGst = Boolean(values.includeGst && pn(values.gst) > 0);
  const totals = getBillTotals(values.items);
  const lines: BillLine[] = [];

  // The breakdown that reaches the subtotal, printed before it. The PDF used to
  // open at "Subtotal", so a bill could show a Rs.2,000 hallmarking charge and a
  // Rs.100 discount nowhere at all, and the subtotal was a number the customer
  // had no way to arrive at. These rows are informational, not additional:
  // `itemsTotal` already includes them.
  lines.push({ label: tl(lang, 'totalAmount'), amount: fc(totals.metalValue) });

  if (totals.makingCharges > 0) {
    // The basis in brackets, same as the item table's column header.
    const basis = getSharedMakingBasis(values.items, tl(lang, 'makingFixed'));
    lines.push({
      label: basis ? `${tl(lang, 'making')} (${esc(basis)})` : tl(lang, 'making'),
      amount: fc(totals.makingCharges),
    });
  }

  if (totals.otherCharges > 0) {
    // The charge's own name — "Hallmark" — so this is not an unexplained figure
    // on a document the customer keeps.
    lines.push({
      label: esc(formatOtherChargesLabel(tl(lang, 'otherCharges'), values.items)),
      amount: fc(totals.otherCharges),
    });
  }

  if (totals.discount > 0) {
    lines.push({
      label: tl(lang, 'discount'),
      amount: `- ${fc(totals.discount)}`,
      negative: true,
    });
  }

  // Subtotal only earns its line when something comes between it and the total
  // below — an exchange deduction or GST. On a plain cash bill nothing does, so
  // it printed the same figure twice in a row, which reads as though one of the
  // two must mean something different.
  //
  // Not simply "when GST is on": the subtotal here is the pre-exchange figure,
  // so on a bill with an old-gold trade-in it is the jewellery's value before
  // the trade — worth showing whether or not GST applies.
  const hasExchanges = Boolean(values.exchanges?.length);
  if (showGst || hasExchanges) {
    lines.push({ label: tl(lang, 'subtotal'), amount: fc(itemsTotal) });
  }

  if (values.exchanges?.length) {
    values.exchanges.forEach(ex => {
      const netWt = ex.netWt || ex.weight;
      const detailParts = [
        netWt ? fw(netWt) : null,
        ex.purity || null,
        ex.ratePerGm ? `@ ${fc(ex.ratePerGm)}/g` : null,
      ].filter(Boolean);
      const label = ex.itemName
        ? `${ex.itemName} (${ex.type})`
        : `${ex.type} ${tl(lang, 'exchange')}`;
      const detail = detailParts.length ? ` (${detailParts.join(', ')})` : '';
      lines.push({ label: `${label}${detail}`, amount: `- ${fc(ex.amount)}`, negative: true });
    });
  }

  if (showGst) {
    lines.push({
      label: gstLabel(values.gstPercentage),
      amount: fc(values.gst),
      rate: values.gstPercentage ? String(values.gstPercentage) : undefined,
      unit: values.gstPercentage ? '%' : undefined,
    });
  }

  const payments = values.paymentSummary?.payments || [];
  if (payments.length > 0) {
    lines.push({ label: tl(lang, 'total'), amount: fc(values.grandTotal), strong: true });

    const totalPaid = payments.reduce((sum, p) => sum + pn(p.amount), 0);
    if (combinePayments) {
      // Gift bills collapse the instalments into one anonymised line: the
      // recipient must not be able to read back what was paid, or when.
      lines.push({
        label: tl(lang, 'advancePayment'),
        amount: `- ${fc(totalPaid)}`,
        negative: true,
      });
    } else {
      payments.forEach(p => {
        lines.push({
          label: `${tl(lang, 'advancePayment')} (${p.date})`,
          amount: `- ${fc(p.amount)}`,
          negative: true,
        });
      });
    }

    lines.push({
      label: tl(lang, 'balanceDue'),
      amount: fc(advanceBalanceDue(values, totalPaid)),
      strong: true,
    });
  } else {
    lines.push({ label: tl(lang, 'total'), amount: fc(values.grandTotal), strong: true });
  }

  return lines;
};

/**
 * The stacked breakdown used by every template except the ruled tax invoice.
 * Pure rendering — the lines and their order come from `buildBillLines`.
 *
 * Deliberately ONE column on every sheet size. Splitting it in two was tried
 * against the bill that prompted the short-sheet work — one item, GST, a
 * discount and an old-gold exchange, seven money lines, 38.6mm of an 86mm sheet
 * — and measured a 10.6mm saving against a projected 18mm, because an exchange
 * line reads "Old nose ring (Gold) (4.000 gm, 20K - 83.3%, @ Rs 12,000.00/g)"
 * and wraps to three lines in any half-width column. Widening the column and
 * pinning the amounts recovered nothing. `closingSection` saves nearly twice as
 * much by moving the signature up beside this block instead of reshaping it —
 * which is the better trade anyway, because the money column is the last part of
 * a bill worth making unfamiliar.
 */
export const buildTotalsBlock = (
  values: JewelleryFormValues,
  itemsTotal: number,
  lang: MobileLang,
  rowStyle: string,
  grandStyle: string,
  combinePayments: boolean = false,
) =>
  buildBillLines(values, itemsTotal, lang, combinePayments)
    .map(line => {
      const style = line.strong
        ? grandStyle
        : `${rowStyle}${line.negative ? 'color:#dc2626;' : ''}`;
      // Classed so a short sheet can compress the gaps between these rows — the
      // templates set them inline, which nothing but a class + !important can
      // reach. See denseCss.
      const cls = line.strong ? 'bill-tot bill-tot-grand' : 'bill-tot';
      // The amount never wraps. Beside a long label in a narrow column
      // "- Rs 77,000.00" broke across two lines, which on a bill reads as two
      // numbers rather than one.
      return `<div class="${cls}" style="${style}"><span>${line.label}</span><span style="white-space:nowrap;">${line.amount}</span></div>`;
    })
    .join('');


// Fixed A4 page. Invoices are generated once as an A4 PDF and shared/downloaded/
// printed as-is. Short invoices leave blank space at the bottom (acceptable);
// long invoices paginate across A4 pages.
//
// MARGIN_MM is a safe printable border. The templates used to be full-bleed
// (margin 0, content flush to x=0 and x=210mm), which cropped on every real
// printer: inkjets and lasers have a 3-5mm non-printable hardware border, and
// borderless mode is not reachable from these print paths anyway (Android's
// print framework has no borderless concept, and AirPrint exposes no option for
// it). Photos only appear to print edge-to-edge because the desktop driver
// oversprays — the edges really are lost, which is fine for a photo and not for
// a GSTIN digit.
export const BILL_PAGE = {
  WIDTH_MM: 210,
  HEIGHT_MM: 297,
  MARGIN_MM: 8,
};

/**
 * Which edge of the tray the printer registers a sheet against.
 *
 * A printer images relative to the origin implied by the paper size the DRIVER
 * was told, not the sheet actually loaded. So when a shopkeeper feeds their own
 * smaller stationery while the driver still says A4, where the print lands is
 * decided by the tray:
 *
 *  - `left`   side-registered — one guide is fixed (usually the left) and the
 *             other slides in, so the sheet's left edge always sits where A4's
 *             left edge would be. Common on upright/rear feeders and manual slots.
 *  - `center` centre-registered — both guides move symmetrically, so the sheet's
 *             centreline sits where A4's centreline would be. Common on
 *             cassette-fed lasers and office MFPs, hence the default.
 *  - `right`  the mirror of `left`; rare, but it exists.
 *
 * This is the one axis the user has to tell us about. Vertically there is no
 * ambiguity — paper always feeds leading-edge first, so the sheet's top edge is
 * the page's top edge on every printer.
 */
export type PaperPosition = 'left' | 'center' | 'right';

/**
 * The sheet a shop actually prints invoices on.
 *
 * `custom` describes stationery smaller than A4, usually with the shop's details
 * already pre-printed at the top — `headerReserveMm` is the strip left blank for
 * that. The page itself stays A4 regardless (see buildPageCss in
 * print/templates/shared.ts): declaring the real size in CSS does not work,
 * because a raw `@page { size: 95mm 200mm }` is a length pair rather than a
 * named size, and browsers only match named sizes against the printer's media
 * list — given lengths they fall back to the printer's default and scale.
 */
export type PaperPrefs = {
  mode: 'a4' | 'custom';
  widthMm: number;
  heightMm: number;
  /** Blank strip at the top of EVERY sheet, for pre-printed letterhead. */
  headerReserveMm: number;
  position: PaperPosition;
};

export const DEFAULT_PAPER: PaperPrefs = {
  mode: 'a4',
  widthMm: BILL_PAGE.WIDTH_MM,
  heightMm: BILL_PAGE.HEIGHT_MM,
  headerReserveMm: 0,
  position: 'center',
};

/**
 * Safe printable border in custom mode, deliberately smaller than MARGIN_MM.
 *
 * 8mm a side is proportionate on a 210mm sheet and wasteful on a narrow one —
 * it would eat 17% of a 95mm slip. 4mm still clears the 3-5mm non-printable
 * border every inkjet and laser has.
 */
export const CUSTOM_MARGIN_MM = 4;

/**
 * The widest sheet a shop may declare in custom mode.
 *
 * A4's 210mm is not the limit of what a shop can feed: US Letter is 215.9mm and
 * every ordinary home/office printer takes it, so a shop on Letter-width
 * stationery was told "Width must be between 1 and 210 mm" for a sheet its
 * printer handles perfectly well. 216 is that width rounded up to the whole
 * millimetre the settings screen asks for.
 *
 * The PAGE stays A4 regardless (see buildPageCss) — this is the sheet size, not
 * the page size, and the two are deliberately different things. Above 210mm the
 * horizontal gap arithmetic in `pageMarginsMm` floors at zero, so the invoice
 * occupies an A4-width band on the wider sheet: nothing is cropped, the spare
 * ~6mm simply goes unused, and `position` stops mattering because there is no
 * side gap left to distribute.
 */
export const MAX_CUSTOM_WIDTH_MM = 216;

export const GST_RATE = 0.03;

export const METAL_TYPES = ['Gold', 'Silver', 'Others'] as const;

export const GOLD_PURITY_OPTIONS = [
  '24K - 99.5%',
  '23K - 95.8%',
  '22K - 91.6%',
  '21K - 87.5%',
  '20K - 83.3%',
  '18K - 75%',
  '17K - 70.8%',
  '14K - 58.5%',
  '9K - 37.5%',
] as const;

export const SILVER_PURITY_OPTIONS = [
  'Silver',
  'Silver Coin',
] as const;

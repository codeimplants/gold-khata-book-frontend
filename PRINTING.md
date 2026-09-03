# Printing

Everything about how Gold Khata Book puts an invoice on paper: the four print paths, the page-geometry
model, the two bugs that made real printers crop bills, the nine invoice templates and how they are
grouped, and the legibility floor they all have to clear. Written so someone picking this up cold —
human or AI, any machine — can continue without re-deriving it.

**Status as of 2026-08-17:** all merged into `main`. The A4 and margin fixes and the legibility pass
are verified. **The custom-paper geometry has never been printed on the customer's own paper.** See
[What is and is not verified](#7-what-is-and-is-not-verified) before trusting it.

---

## 1. The four print paths

They share templates but not page geometry. This is the single most important thing to internalise:
**a change to one path does not change the others.**

| Path | Entry point | Page geometry comes from |
|---|---|---|
| **Web — Print** | `printService.ts` `printHTML` → `window.open` + `window.print()` | CSS `@page` |
| **Web — Download / Share PDF** | `utils/invoicePdfWeb.web.ts` | **Neither.** html2canvas rasterises the DOM and ignores paged-media rules entirely. Insets applied by hand. |
| **Native — Print / Share / Download** | `printService.ts` → `utils/pdfService.ts` → `react-native-html-to-pdf`, then `RNPrint.print({filePath})` | `PrintAttributes` width/height (Android) and `printableRect` (iOS), **not** CSS |
| **Thermal 58mm** | `print/thermal/` (ESC/POS over BLE/SPP/TCP) | Not applicable — no HTML, no `@page` |

`printBill` is the single entry point for a customer bill. It reads `printPrefs` from the store and
routes to thermal or the A4/PDF flow.

The **GST report** (`print/gstReportTemplate.ts`) goes through the same `printHTML` on web but carries
its own `@page { size: A4; margin: 10mm }`. It is the useful control document: same code path,
different page rule. If a bill misbehaves and the GST report does not, the difference is the `@page`.

---

## 2. Page geometry — the model

All of it lives in one function: **`buildPageCss(paper)`** in `print/templates/shared.ts`.

```
@page { size: A4; margin: <top> <right> <bottom> <left>; }
```

**The page is always A4, even when the shop prints on something smaller.** That is not a
simplification — see §4. The shop's real sheet is represented by *margins*, which push the content
into a band positioned where the sheet physically sits on the A4 page.

Supporting exports in the same file: `resolvePaper`, `pageMarginsMm`, `contentBoxMm`, and `PAGE_CSS`
(plain A4, used by the old-gold declaration which is a legal form and always wants a full sheet).

Geometry constants live in `constants/bill.ts`:

```ts
BILL_PAGE = { WIDTH_MM: 210, HEIGHT_MM: 297, MARGIN_MM: 8 }
CUSTOM_MARGIN_MM = 4          // 8mm would eat 17% of a 95mm slip
MAX_CUSTOM_WIDTH_MM = 216     // Letter width — the widest sheet a home printer feeds
DEFAULT_PAPER: PaperPrefs     // mode 'a4'
type PaperPosition = 'left' | 'center' | 'right'
type PaperPrefs = { mode, widthMm, heightMm, headerReserveMm, position }
```

**A custom sheet may be wider than the page.** The width cap is Letter's 216mm, not A4's 210mm —
the settings screen's own hint offers `Letter (216x279mm)` as a standard size, and until Aug 2026 the
validator rejected it. Above 210mm the side gaps in `pageMarginsMm` floor at zero, so the bill
occupies an A4-width band on the wider sheet: nothing crops, the spare ~6mm is unused, and
`position` has no gap left to distribute. Height is still capped at A4's 297mm — the page the content
is placed on is A4, and there is nothing below 297mm to place anything on.

**`headerReserveMm` applies in BOTH modes.** Most pre-printed letterhead is ordinary A4, so a shop
must be able to reserve the top strip without declaring a custom sheet. It also applies on every
platform, unlike `MARGIN_MM` — that margin is a safety fix rolled out to web first, whereas the
reserve is a measurement the shopkeeper entered and would expect to be obeyed anywhere.

### Why margins rather than a wrapper div

CSS breaks content at the bottom of the page content box on **every** page, which gives three things
a wrapper `<div>` cannot:

1. A long invoice paginates at the **sheet's** height, not A4's.
2. The letterhead strip is reserved on **page two as well**. A `padding-top` on `body` only insets
   page one — page two would print over the shop's letterhead.
3. No template had to change structurally.

### The margin arithmetic

Sheet `W × H`, header reserve `R`, safe border `S`:

| Margin | `left` position | `center` | `right` |
|---|---|---|---|
| left | `S` | `(210−W)/2 + S` | `210−W + S` |
| right | `210−W + S` | `(210−W)/2 + S` | `S` |
| top | `R + S` | same | same |
| bottom | `297−H + S` | same | same |

Measured from the real generated HTML — a 95 × 200 mm sheet, centred, 35 mm reserve:

```
@page { size: A4; margin: 39mm 61.5mm 101mm 61.5mm; }   → content box 87 × 157 mm
```

`87 = 95 − 2×4` and `157 = 200 − 35 − 2×4`.

---

## 3. The two bugs that made bills crop

Both were **web-only**. Android was never broken — see §6.

### 3a. `size: 210mm 297mm` silently shrank every bill ~6%

**Browsers only match a *named* page size against the printer's media list.** Given a raw length
pair, Chrome leaves the printer on its own default and scales the page to fit. On a Letter-default
printer (215.9 × 279.4 mm, ~18 mm shorter than A4) every invoice came out about 6% small.

**Evidence:** in Chrome's print preview on an HP LaserJet Pro MFP M126nw, the bill's Paper size read
**Letter** while the GST report — same path, already on `size: A4` — read **A4**.

**Fix:** emit the `A4` keyword. Web only.

### 3b. `margin: 0` put content where no printer can reach

Every inkjet and laser has a 3–5 mm non-printable hardware border. Worse, **`@page { margin: 0 }`
overrides the print dialog's Margins dropdown**, so a shopkeeper changing that setting saw no effect.

Borderless is not reachable from these paths: Android's print framework has no borderless concept,
and AirPrint exposes no option. **Fix:** `MARGIN_MM = 8` on web.

---

## 4. Custom paper and letterhead

### The physics you have to understand first

**A printer images relative to the origin implied by the paper size the *driver* was told, not the
sheet you loaded.** Where a narrow sheet lands depends on how the tray grips paper:

- **Side-registered** — one fixed guide (usually left); the sheet's left edge always sits where A4's
  left edge would be. Common on upright/rear feeders and manual slots.
- **Centre-registered** — both guides move symmetrically; the sheet's centreline sits where A4's
  centreline would be. Common on cassette-fed lasers and office MFPs.

Deterministic, not random. An earlier attempt shipped and failed — prints came out "half cut
depending on where the paper sat in the tray" — because the bill spanned the full A4 width, so on
either scheme most of it fell off, and the two schemes cut differently.

**Vertically there is no ambiguity.** Paper feeds leading-edge first, so the sheet's top edge is
always the page's top edge. Only the horizontal axis needs a user setting (`PaperPosition`).

### Why declaring the real size does not work

1. On web, `@page { size: 95mm 200mm }` is a raw length pair — the §3a problem.
2. On native, `react-native-print` hands Android `MediaSize.UNKNOWN_PORTRAIT` and iOS AirPrint falls
   back to the dialog's paper choice. Placement stays driver-decided.

Hence: **keep the page A4, move the content.**

### The alignment test print

`print/paperTestPage.ts` draws the exact outline an invoice would occupy, using the same
`buildPageCss` and `contentBoxMm`, with cm rules along the top and left.

This exists because **no API exposes a printer's tray registration.** If the whole box lands on the
sheet the settings are right; if an edge is missing, the rules say by how much.

### Settings

`screens/drawer/PrintSettingsScreen.tsx`, persisted in `store/printPrefs/printPrefsSlice.ts` under
AsyncStorage key `@print_prefs_v1`.

**Adding a field to that slice needs three edits, not one:** the reducer, the listener payload in
`store/index.ts`, and the parse block in `hydratePrintPrefs`. Miss one and the setting silently fails
to persist. `sanitisePaper()` clamps on read — an out-of-range width produces a negative `@page`
margin, which prints **blank**, the hardest failure for a shopkeeper to diagnose.

---

## 5. The templates

Nine invoice templates, grouped in the picker by **who puts the shop's details on the page**. That is
the question the choice actually asks; picking wrong produces a bill with no shop name or GSTIN on it.

### Group 1 — blank paper, we print the header

| Template | File | Notes |
|---|---|---|
| Minimal | `minimal.ts` | Clean black & white |
| Traditional | `traditional.ts` | Saffron gradient header |
| Modern Premium | `modern.ts` | Gold accent |
| Classic | `classic.ts` | Navy header |
| **Professional** | `taxInvoiceColor.ts` | Formal GST layout, colour header band |
| **Professional Bold** | `taxInvoiceBold.ts` | Formal GST layout, pure ink, no fills |

### Group 2 — the shop's own pre-printed stationery

| Template | File | Notes |
|---|---|---|
| Pre-Printed Bill (Shop Header) | `letterhead.ts` | Simple layout, no shop header |
| Pre-Printed Bill (Professional) | `taxInvoiceLetterhead.ts` | Formal GST layout, no shop header |

Both re-emit the invoice number and date themselves. In `minimal.ts` those live *inside* the header
block, so a naive "drop the header" would silently lose the bill number.

### Group 3 — the shop's header image on blank paper

`shopHeader.ts` — prints an uploaded banner at the top.

### Gating

| Template | Locked until |
|---|---|
| Any tax-invoice template | **The user is logged in.** A tax invoice carries a GSTIN and a declaration; guest data lives only on the device and is lost with the app, which is the wrong footing for a bill that may be produced for an assessment. |
| Both Pre-Printed templates | `headerReserveMm > 0`, so we know where the printed header ends |
| Shop Header Banner | A banner is uploaded in Shop Details |

Login takes precedence in the message: telling a guest to set Header Space would not help them.

**Every locked section carries a link to the screen that unlocks it** — "Open Print Settings →" and
"Open Shop Details →". Page size and header space are different fields, and a shopkeeper who had set
the first reasonably believed they had already done what the hint asked. Because the gate reads from
Redux, saving on the other screen returns here with the tile live; leaving without saving returns it
still locked, with no extra wiring.

### The formal tax-invoice layout

Body shared by all three treatments in `taxInvoiceBase.ts` — the differences a shopkeeper picks
between are the header treatment and the colour, and three copies of a table that intricate is how
two of them quietly end up missing a tax row.

Ruled grid with visible cell borders: Sl No. / Description of Goods / HSN/SAC / Quantity / Rate / per
/ Amount, a GST row, a total row, the chargeable amount in words, a declaration, authorised signatory
and a jurisdiction line.

**Colour never carries meaning.** It is confined to the header band and table head. Browsers drop
background graphics by default on web, so a template that only reads correctly in colour prints wrong
for most people — which is also what Tax Invoice (Bold) exists for.

**Deliberately omitted:** bank details and PAN (Shop Details does not collect them, and blank rows on
a tax document are worse than no rows), and the reference bill's tax-summary block (for a single-HSN
jewellery bill it only restates the GST line above it).

**`utils/numberToWords.ts`** renders the amount in Indian crore/lakh/thousand grouping. Checked
against both strings from the customer's reference bill, plus carry cases — `0.995` becomes "One
Only", not "Zero and Ninety Nine paise" beside a printed 1.00. It stays **English in every language**,
as Indian tax invoices do.

### The closing block is the same on every bill

The six bill templates (everything except the three tax-invoice layouts) end identically, and two
helpers in `shared.ts` are what keep them that way:

- **`signatureBlock(signature, lang, { …, shopName, paper })`** — signature, rule, *Authorised
  Signatory*, then the shop's name under the caption as the signature's attribution.
- **`footerBand(lang, { bandStyle, thankYouStyle, noteStyle, paper })`** — the thank-you line
  **centred**, with *All prices incl. making charges* centred beneath it where the template shows
  that note. It emits the coloured band container too, so that when the band is dropped there is no
  empty strip of grey or saffron left behind.

Templates keep their own colours, padding and type sizes for the band — that is what the shopkeeper
picked between — but not its arrangement. Before Aug 2026 each one laid the row out itself as a
`space-between` flex: the thank-you sat hard left with either the note or the shop name pushed to the
far right, so the shop name read as a second footer note rather than as part of the signature, and no
two templates agreed on what the bottom of a bill looks like.

The formal tax-invoice layout (`taxInvoiceBase.ts`) is excluded from the *shop name* part: it prints
*For &lt;Shop Name&gt;* **above** the signature inside the ruled declaration box, which is the
convention on an Indian tax invoice, and it has no thank-you band at all. It does take the tier
below, because "Pre-Printed Bill (Professional)" is that layout on shop stationery and meets the
same short sheets.

### The closing block sizes itself to the sheet — `closingTier(paper)`

At full size the block costs about **50mm**. That is nothing on A4's 281mm content box and more than
half of a pre-printed slip: a shop on 210 × 139mm stationery with a 45mm letterhead reserve has an
**86mm** box, and a *one-item* bill spilled onto a second slip. The overflow was entirely the footer.

`closingTier` reads `contentBoxMm(paper).heightMm` and returns one of three:

| tier | box height | signature | caption + shop name | thank-you band | `FOOTER_SAFE_MM` | cost |
|---|---|---|---|---|---|---|
| `full` | ≥ 150mm | 58px | two lines | yes | 6mm | ~50mm |
| `compact` | ≥ 100mm | 34px | two lines | no | 4mm | ~21mm |
| `minimal` | < 100mm | 22px | one line, joined by `·` | no | 4mm | ~13mm |

In `minimal`, a shop with **no** uploaded signature gets a 12px strip rather than a signable gap —
the sheet does not have one to give, and the rule itself is what gets signed.

**The table above applies only to a STACKED closing block.** When `closingIsSideBySide(paper)` is
true the signature keeps its full 58px and the shop name keeps its own line, whatever the tier says:
beside the totals its height is free, because the totals column is the taller of the two and the row
is as deep as the money either way. Shrinking it there would buy nothing and cost the shopkeeper a
legible signature — which is what the shop asked for after the first paper test came back with a 22px
mark and "Authorised Signatory · Shop Name" crammed onto one line. Measured: the closing band stayed
at 42.6mm and the bill at 81.7mm, unchanged.

**Decide from the box, never from the template.** There are more combinations than the picker's three
groups imply, and template-based rules get them wrong:

- A4 letterhead with a 35mm reserve leaves 250mm. Those shops want the signature; removing the block
  for the "pre-printed" templates would punish them for the 139mm shop's problem.
- Nothing stops a shop pairing a full-header template with a short custom sheet. It overflows
  identically, and a template rule never sees it.
- Blank A4 and the header-image template both give 281mm, so they stay `full` without being
  special-cased at all.

What gets dropped, and in what order, follows what the line is worth on a bill: the thank-you line
and the making-charges note are courtesy and go first, the signature is the point of the document and
shrinks rather than disappears.

### Dense mode, and the measured capacity of a short sheet

Below the `full` tier, `denseCss` also compresses the vertical rhythm: `td`/`th` vertical padding, the
gaps between totals rows (`.bill-tot` / `.bill-tot-grand`), and the signature row (`.bill-sign`). All
`!important`, because every template sets that spacing inline and inline beats a plain rule. **No font
size changes** — the legibility floor above is not negotiable.

Shrinking the closing block alone was not enough, and the numbers say why. Measured in headless
Chrome on the reported sheet (216 × 139mm, 45mm reserve, **86mm** content box), `letterhead.ts`:

| items | before the tiers | tiers only | tiers + dense |
|---|---|---|---|
| 1 | ~103mm → 2 pages | 76mm → 1 page | 76mm → 1 page |
| 2 | → 2 pages | 88.4mm → **2 pages** | 82mm → 1 page |
| 3 | → 2 pages | ~101mm → 2 pages | 93.1mm → 2 pages |

A 2.4mm overflow costs a whole second slip, and what lands on it is the signature — which is exactly
what the shop reported after the tiers shipped.

**So the capacity of that sheet is two items.** An item costs ~10.6mm (two text lines plus padding)
and the fixed furniture — bill-to block, table head, totals, closing block — costs ~70mm. Getting a
third item on would mean cutting type, so it paginates instead.

**No tier rescues a bill that is genuinely too long for the paper.** The lever the shopkeeper controls
is `headerReserveMm`: every mm of reserve is a mm off the bill, so a 45mm reserve measured generously
costs items. Otherwise it needs a taller sheet.

### `closingSection` — the signature moves up beside the totals

The tiers and dense mode were both measured against a synthetic three-line bill. A **real** production
bill (INV-11, one item, GST, a discount and an old-gold exchange) came to **102.4mm in the 86mm box**
and paginated with the signature alone on the second slip. The breakdown says why:

| block | height |
|---|---|
| bill-to / invoice no. | 14.8mm |
| items table | 28.0mm (a 10mm photo strip inside it) |
| **totals** | **38.6mm — seven money lines** |
| closing block | 19.3mm |

Not one of those seven lines can be dropped: every one is money the customer is charged. So
`closingSection` changes the *arrangement* instead. Below the `full` tier — and only when the content
box is at least 150mm wide — the signature moves up beside the totals and the pair drop to the foot
together, turning a 38.6 + 19.3mm stack into one 42.6mm band. **102.4mm → 81.7mm, one page.**

It is also the conventional cash-memo layout: signature at the left of the foot, figures at the right.

**Two columns of totals was tried first and rejected on measurement** — projected 18mm, delivered
10.6mm, because an exchange label reads *"Old nose ring (Gold) (4.000 gm, 20K - 83.3%, @ ₹12,000.00/g)"*
and wraps to three lines in any half-width column. Widening the column and pinning the amounts
recovered nothing. Reshaping the money block is also the change least worth making on a document that
has to reconcile, so the totals stay one column at every size.

The six templates now hand `closingSection` their totals, signature, band and their own paddings
instead of each hand-rolling that area. A4 output is unchanged — the `full` tier returns the stacked
markup byte-for-byte.

### Item photos must be inlined, like every other image on a bill

`prepareShopForPrint` inlines the logo, header and signature as data URIs, and
`prepareDeclarationPhotosForPrint` does the same for a declaration's ornament photos — both because
react-native-html-to-pdf snapshots before a remote image downloads and html2canvas drops cross-origin
images (see `imageUrlToDataUri`).

The bill's **item** photos were the one image type never inlined. They went into the print HTML as raw
ImageKit URLs and failed on every path — and failed *invisibly*, because the `<img>` carries an
explicit width and height, so the strip reserved its ~10mm and printed nothing into it. Reported from
production on INV-11: the switch was ticked, the photo was stored, the paper had a blank gap.

`prepareBillForPrint(values)` now sits beside `prepareShopForPrint(shopDetails)` at all five
print/download/share sites. It requests a 120px rendition (the strip draws at 34px, 20px on a short
sheet) and only inlines the three photos per item that can actually print.

### How to measure this yourself

There is no test for page count — it depends on real layout, which jsdom does not do. Chrome is on
the build machines and settles it in one command:

```sh
chrome --headless=new --print-to-pdf-no-header --print-to-pdf=out.pdf file:///path/bill.html
grep -a -o "/Count [0-9]*" out.pdf | head -1        # page count
```

For a breakdown rather than a verdict, inject a script before `</body>` that walks
`document.body.children`, reports each `offsetHeight`, and rewrites the body with the numbers, then
`--screenshot` it at `--window-size=764,700` — 764px is the 202mm print content width.

### Legibility floor — do not go below this

A shopkeeper circled the column headers, the metal/purity line, the signatory line and the footer
note on his bill and said *"हे दिसूनच येत नाही हे ठळक दिसायला पाहिजे"* — these don't show up at all,
they should be bold. Every one was 8–9px in a light grey. That is not a style preference, it is text
that does not survive a real printer.

Rules for any new or edited template:

- **No text below 10px.** 8px was the old floor and it was invisible on paper.
- **No light greys for text.** `#888`, `#aaa`, `#9ca3af`, `#6b7280` and friends now map to near-black
  slate. Secondary text may be `#333`–`#4b5563`, never lighter.
- **Column headers are weight 700 in near-black.** They were 400/500/600 across templates before.
- **Borders at 1px, not 0.5px.** Hairlines drop out before the text does.
- **Keep letter-spacing under ~0.5px.** It was 1.5px, which is decorative in English and actively
  harmful in Devanagari, where it pulls matras away from the letters they belong to.

Verify at **true A4 content width (194mm ≈ 733px)**, not the preview's wider iframe, and in Marathi —
Devanagari headers are the longest.

### Adding a template

Three edits, all required: the file, the `InvoiceTemplate` union in `types/index.ts`, and the `switch`
in `templates/index.ts`. Registering only in the switch type-checks and then silently falls through
to `minimal` at runtime. Then add a tile in `InvoiceBillSettingsScreen.tsx` and its copy to all four
locale files.

**Templates that suppress the shop header must not fall back to one that renders it** — printing the
shop's details onto pre-printed letterhead is the failure the template exists to avoid.

---

## 6. Platform asymmetry

| Platform | Reads geometry from | Notes |
|---|---|---|
| **Web (print)** | CSS `@page` | The only path where `buildPageCss` fully governs output |
| **Web (PDF)** | Neither | html2canvas ignores `@page` |
| **Android** | `PrintAttributes.MediaSize`, **then scaled by the framework to fit the printable area** | That scaling is why Android already prints with a border despite `margin: 0`, and why Android was never broken |
| **iOS** | `printableRect`, not CSS | Undocumented default ~10 pt per side |

`MARGIN_MM` and `size: A4` are gated to web. **Custom paper is web-first in practice**: Android's
fit-to-printable-area scaling shifts and shrinks a positioned band by ~4%, survivable for `center` but
capable of misaligning `left`. Measure on real hardware before enabling it there.

---

## 7. What is and is not verified

### Verified

- `tsc --noEmit` clean; thermal suite 26/26 with snapshot unchanged.
- `@page` output measured from the real generated HTML for centre, left and A4 modes.
- A4 mode produces `margin: 8mm 8mm 8mm 8mm` — unchanged by the custom-paper work.
- Legibility pass: no overflow and no clipped header cells at 733px, in English **and** Marathi.
- Tax invoice renders correctly in English and Marathi, no untranslated keys, amount in words
  matching the helper's tested output.
- `numberToWords` against both reference-bill strings plus rounding/carry cases.
- Template gating behaves correctly for a guest.
- Cold webpack build compiles and the app renders.

### NOT verified — do not assume

- **Custom paper has never been printed on the customer's actual sheet.** The `position` setting in
  particular cannot be validated without it.
- **Page 2 of a paginating invoice** — the reserve *should* hold on every page by the CSS page model,
  but nobody has looked at a second sheet.
- **The tax invoice's colour header, GSTIN line and jurisdiction line on real data.** Guest mode has
  no shop details, so those blocks never rendered during verification.
- **Android and iOS with custom paper.**
- **The 8 mm margin on the customer's inkjet** (HP Smart Tank 589), the original cropping report.

### Testing on real hardware

1. Print Settings → set width, height, header space → **Print Test Page**, once per position. Start
   with Centre; it is the common case.
2. Whichever outline lands fully on the sheet identifies that printer's registration. Save it.
3. Then a real bill, and one long enough to paginate.
4. Tell the shopkeeper the reliable long-term fix is adding their paper as a **Custom size in the
   printer driver**. Apps that appear to "print on any paper" either use roll/label printers where
   media is fixed, or assume this was done. There is no software-only substitute.

---

## 8. Unresolved incident — HP LaserJet Pro MFP M126nw

Output came out compressed with a garbled duplicate beside it, **and every subsequent job from any
application printed the same way** until the printer was deleted and re-added in Windows.

That the damage survived the job means Windows printer/driver state, not page content. A paper-size
hypothesis was raised and **falsified**: after the reinstall the same bill printed correctly at Letter
as well as A4, and it has not recurred.

**Cause never established.** If it returns, look at the Windows spooler and driver state, not the CSS.

---

## 9. Open items

- **Chrome's "Background graphics" is off by default** and `print-color-adjust: exact` does **not**
  override it. Coloured header bars in `modern` / `classic` / `traditional` are almost certainly not
  printing for anyone on web. Worse, `classic`'s navy and `traditional`'s saffron headers use white
  text on those fills — with backgrounds off, the shop name may be printing as **nothing**. Worth
  checking before anything else on this list.
- **Bank details and PAN** are not collected in Shop Details, so the tax invoice omits them. Add the
  fields there first, then the block in `taxInvoiceBase.ts`.
- **~4.5 MB text-only PDFs on native.** Source images are already downsized server-side, so the bloat
  is created during PDF generation. Ranked suspects: `itemPhotoStrip` rendering raw stored URLs with
  no ImageKit `tr=w-` transform; 600 DPI rasterisation of CSS gradients (`HtmlToPdfModule.kt`
  hardcodes 600); `shopHeader.ts` upscaling a ≤500 px banner to full width; colour-emoji bitmap fonts;
  unrounded floats in the signature SVG. **Measure before fixing.**
- **Feature-gating.** `src/featureFlags/registry.ts` and `useFeatureFlag` exist and are used to ship
  tutorials switched off. Putting custom paper behind a flag until one real printer confirms it would
  be a reasonable default.
- **Stale comment.** `utils/pdfService.ts` still describes the templates as "full-bleed … edge to
  edge", which stopped being true on web when `MARGIN_MM` landed.

---

## 10. File map

```
src/constants/bill.ts                  BILL_PAGE, PaperPrefs, PaperPosition, DEFAULT_PAPER, CUSTOM_MARGIN_MM
src/utils/numberToWords.ts             amount in words, Indian numbering
src/print/
  printService.ts                      printHTML (web) / printBill (single bill entry point)
  paperTestPage.ts                     alignment test page
  gstReportTemplate.ts                 own @page at A4/10mm — the known-good control
  billTemplate.ts                      re-export shim of templates/index
  templates/
    shared.ts                          buildPageCss, page margins, shared helpers, buildTotalsBlock, gstLabel
    index.ts                           template switch; add new templates here AND to the union
    minimal|modern|classic|traditional|shopHeader.ts
    letterhead.ts                      simple layout, no shop header
    taxInvoiceBase.ts                  the formal GST body, shared by the three below
    taxInvoiceColor|taxInvoiceBold|taxInvoiceLetterhead.ts
    declaration.ts                     old-gold legal form; always plain A4
  thermal/                             58mm ESC/POS; no HTML, no @page, unaffected by all of this
src/utils/invoicePdfWeb.web.ts         html2canvas + jsPDF; ignores @page, insets by hand
src/utils/pdfService.ts                native PDF; page size from MM_TO_PT, not CSS
src/screens/drawer/PrintSettingsScreen.tsx        paper size / header space / position / test print
src/screens/drawer/InvoiceBillSettingsScreen.tsx  grouped template picker + preview
src/store/printPrefs/printPrefsSlice.ts           persistence (@print_prefs_v1)
```

`types/index.ts` holds `InvoiceTemplate` and `PrintContext` (which carries the optional `paper`).

---

## 11. Gotchas

- **The in-app preview cannot show page geometry.** `@page` is ignored on screen, and the RN preview
  (`components/InvoicePreviewScreen.tsx`) shares no layout code with the printed HTML. Margins, custom
  paper and the header reserve are invisible until you print. This is why the test page exists.
- **Webpack caches failed module resolutions.** Switching branches under a running dev server can
  leave it stuck on `Module not found` with `Reload prevented` even after the files return. Restart it.
- **No jest for UI or layout** (see `CLAUDE.md`) — verified by looking at real output. The one
  print-adjacent test that exists and must keep passing is `__tests__/thermalReceipt.test.ts`.
- **A zero exit code is not proof for web deploys.** Load the live site and confirm.

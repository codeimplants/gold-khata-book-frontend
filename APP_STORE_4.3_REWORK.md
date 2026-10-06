# App Store 4.3(a) rework: make Gold Khata Book its own product

This is the plan for getting Gold Khata Book through App Review, and the record
of progress against it. It lives in the repo so that a new session, a restarted
machine or another developer can carry on from where the last one stopped.

**If you are picking this up:** read *Resume here*, then the *Hard rules*, then
carry on with the next unchecked task in the *Work plan*. When you stop, update
*Resume here* and add a line to the *Progress log*. Nothing about this work
should exist only in a chat, a temp folder or someone's memory.

---

## Resume here

| | |
| --- | --- |
| **Phase** | 7 (verification and submission). All code work is done and pushed to `main` in both repos (2026-10-06, evening). Pre-submission audit done (section 10, "Pre-submission audit") |
| **Next action** | Owner, in this order:<br>1. **Deploy the backend to dev, then prod** (section 10): the app needs `GET /retailer-account` and `POST /retailer-account/:id/gold`.<br>2. Redeploy the web app (`npm run deploy`) so the public privacy and terms pages match `en.ts`.<br>3. Run the production demo seed (section 9, item 5), `--dry-run` first; then sign in on a phone with 1234567890 / 123456 and check the Khata tab shows the sample retailers.<br>4. On the Mac: `git pull`, then `scripts/release-ios.sh --bump`. The project now records build **2** (already in App Store Connect), so `--bump` makes **3**; confirm 3 is unused. Commit and push the bumped `project.pbxproj` afterwards.<br>5. Real-device checks from `CLAUDE.md` (7.3), including an iPad.<br>6. In App Store Connect: category (Finance, or Business if SoneBill is in Finance), the 9 iPhone and 6 iPad screenshots (numbered 01 to 09), the copy, privacy labels and age rating; then submit with the reply in `store-assets/listing/LISTING.md`. |
| **Blocked on owner** | Steps 1 to 6 above: deploys, the production seed, the Mac build and App Store Connect |
| **Last updated** | 2026-10-06 (night) |

---

## 1. Why this exists

On **2026-09-25** App Review rejected iOS **1.0 (2)** (submission
`4dbd800e-e511-4979-af6d-79f943948ce3`) under **guideline 4.3(a), Spam**: *"the
app shares a similar binary, metadata, and/or concept as other apps you already
submitted."* That other app is **SoneBill**, which this repo was forked from on
2026-09-03. The submission before that was rejected for reusing SoneBill's icon,
and changing the icon did not fix the underlying problem.

The rejection also put the **Code Implants** developer account on **Extended
Review**, with a warning that accounts which keep submitting such apps face
removal from the Apple Developer Program. That account hosts SoneBill and the
company's other live apps. If it is terminated, **every app on it comes off the
App Store**. Getting this wrong again costs more than one app.

What the analysis found on 2026-09-26:

- **Screenshots.** All 21 files in `store-assets/screenshots/` were
  byte-identical to SoneBill's, and the dashboard one shows the name **"Sone
  Bill"** and SoneBill's icon. If those were uploaded to App Store Connect, the
  reviewer saw another app's name on this listing.
- **Code.** Of the 222 source files both apps share, 125 were identical. About
  6,300 of about 58,600 shared lines had changed, plus about 3,700 new lines.
  Roughly 90% of the app was still SoneBill's code.
- **Look and layout.** The domain had been reworked for wholesale (see
  `AGENTS.md`), but the app still looked like SoneBill:
  - the purple-pink gradient header, and a different gradient header colour per tab
  - SoneBill's gradient tab bar and round purple add button
  - the orange "Today's Rates" card and the floating support button
  - orders still numbered `INV-`
  - the same Settings menu (invoice settings, inventory, purchases, sales and GST reports)
  - the login tagline, still "Jewellery Billing Made Simple"

To a reviewer, that is the same app with new labels.

---

## 2. Hard rules

1. **Do not submit to App Review until every item in the Definition of Done
   (section 3) is checked.** Each rejection adds to the account's record.
2. **Never submit this app from a different developer account.** Apple names
   that as a spam signal, and it links accounts, so a ban can reach both.
3. **Nothing from SoneBill goes on this listing:** no screenshots, no copy, no
   icon, no preview video. Every screenshot is captured from this app's current
   build.
4. **Local data:** the local MongoDB has the owner's test data in
   `gold_khata_book_dev`. Do not seed, wipe or migrate it. Screenshots and demo
   work use a separate database, `gold_khata_book_demo` (section 7).
5. **The domain rules in `AGENTS.md` still apply.** Weights are fine gold at
   99.50, dues go through `src/utils/dues.ts`, and `estimatedBalance` is never
   used for dues. This rework is about presentation and scope. It must not
   change any money or weight arithmetic. If a task seems to need that, stop and
   ask.
6. **Restyling is not a reason to delete reasoning.** Comments in this codebase
   explain incidents. Keep them when moving code.
7. **Keep this file current.** Tick tasks as they finish. Write decisions into
   section 8 with the reason.

---

## 3. Definition of done

The app is ready to resubmit when all of these are true:

- [x] **Own visual identity.** None of SoneBill's palette (indigo, violet,
      fuchsia: `#6366F1`, `#6D5EF7`, `#8B5CF6`, `#D946EF`, `#A855F7`, `#4F46E5`
      and their tints). No gradient headers or gradient icon chips. Different
      typography and different header, tab bar, card and button designs.
- [x] **Own structure.** The tabs are Khata, Retailers, a centre New Entry
      button, Day Book and More, not Dashboard, Orders, Customers and Settings.
- [x] **Ledger-first home screen.** It shows what retailers owe in fine gold and
      cash, and the day's activity, not SoneBill's dashboard tiles.
- [x] **Retail inheritance gone from the app.** It is not reachable in the UI,
      and removed from navigation so it is not in the JS bundle. Section 6,
      Phase 4 lists the screens.
- [x] **Own copy.** A new login tagline and a wholesale vocabulary throughout,
      with no billing-app wording left from SoneBill.
- [x] **Own store listing.** *The copy, every screenshot and the green icon are done. Set the category in App Store Connect (section 9, item 1).* A new subtitle, description, keywords and
      promotional text. Screenshots come from the new UI for iPhone 6.9" and
      iPad 13", plus the Play Store sets. The category has been checked against
      SoneBill's (section 9).
- [~] **Review readiness.** *The review notes and the reply are done (`store-assets/listing/LISTING.md`). Still open: the production demo book, one command for the owner (section 9, item 5).* The production demo shop (`1234567890`, see
      section 7) has a realistic wholesale book. The review notes explain the
      app and give the login. A Resolution Center reply explains the difference
      from SoneBill.
- [~] **Verified.** *Done: `tsc` is clean; eslint shows no new errors in changed files (60 at HEAD were inherited, one is now gone); the jest maths tests pass, 49 tests. Still open: an Android phone and a real iPhone.* `npx tsc --noEmit`, eslint and the jest maths tests are
      clean. An Android build has been checked on a phone. An iOS release build
      has been checked on a real iPhone, covering login, a new sale, receiving
      gold and cash, a melt lot, and sharing or printing a statement.

---

## 4. The product, and how it differs from SoneBill

| | SoneBill | Gold Khata Book |
| --- | --- | --- |
| Who uses it | Retail jeweller at the shop counter | Gold wholesaler (supplier, bullion dealer) |
| Who the other party is | Walk-in consumers | Retailers: jewellery shops buying on account |
| Core record | A bill or invoice for one sale | A running account (khata) per retailer |
| Unit of account | Rupees | Grams of fine gold at 99.50, with cash as a second balance |
| Main questions | What do I charge? Print the bill. | Who owes me how much gold and cash? What came in today? |
| Key flows | Invoice, advance order, old-gold purchase, GST invoice | Sale on account, receive gold or cash, melt lot, statement, reminder |
| Output | Retail tax invoice | Retailer statement (fine-gold and cash ledger) |

### Store copy (draft, to finalise in Phase 6)

- **Name:** Gold Khata Book
- **Subtitle (30 max):** `Wholesale gold ledger` (21)
- **Promotional text (170 max):** Know exactly how much fine gold and cash every
  retailer owes you. Record sales on account, receive metal or cash, track melt
  lots, and share statements on WhatsApp.
- **Keywords (100 max, comma separated, no spaces):**
  `khata,wholesale,bullion,fine gold,retailer,ledger,udhar,melt,karigar,statement,dues,jama`
  (check the length before use)
- **Description:** lead with the wholesaler and the retailer account. Cover fine
  gold at 99.50, separate gold and cash balances, purity and wastage, melt lots,
  statements and reminders. Do not use the words "billing app" or "invoice
  maker", which are SoneBill's positioning.

---

## 5. Design spec: the "Ledger" design language

The goal is an app that looks like a bookkeeper's ledger, not a billing app. It
should be flat, quiet and dense with numbers. This is the reverse of SoneBill's
bright gradient style. Since 2026-10-06 it also looks like the trade it serves:
emerald and pearl with a few flat gold jewellery motifs (below).

### Palette (`src/theme/brand.ts`)

| Token | Hex | Use |
| --- | --- | --- |
| `primary` | `#0E4D3C` | Header, active tab, primary buttons (ledger-cloth green) |
| `primaryDark` | `#0A3A2D` | Pressed states, status bar |
| `primarySoft` | `#E7F0EC` | Selected chips, soft fills |
| `gold` | `#87661F` | Fine-gold figures and gold text (5.3:1 on white) |
| `goldFill` | `#9A7425` | The New Entry button and gold fills. Only 4.3:1 on white, so never small text |
| `goldSoft` | `#F5ECD7` | Gold-balance backgrounds |
| `goldLeaf` | `#D9B96A` | The keri on the green band. Decoration, never text |
| `paper` | `#F2F4EF` | App background: pearl. Was warm ivory `#F8F5EE` until 2026-10-06; changed because SoneBill's design-lab work moves SoneBill to warm ivory |
| `card` | `#FFFFFF` | Cards and sheets |
| `line` | `#DCE2D8` | Hairline borders and row dividers (`lineStrong` `#C9D2C5`, `sunken` `#E8ECE5`) |
| `ink` | `#1D1B16` | Primary text |
| `inkMuted` | `#6B665B` | Secondary text |
| `due` | `#B42318` | Money or metal owed to the wholesaler |
| `received` | `#1E7B4F` | Payments and metal received |

Map SoneBill's purples to these, never to another purple. Neutral greys can stay
as they are for now. Hard-coded copies of the old ivory neutrals were remapped
to pearl on 2026-10-06 (86 places).

### Jewellery motifs (`src/components/ledger/Motifs.tsx`)

Flat gold line or fill only. Sparing: one motif per job.

| Motif | Where | Why it is ours |
| --- | --- | --- |
| `KeriMotif`: a keri (paisley) in filigree | Faint, right side of every header; large on the login cover | The mango-necklace shape of Indian jewellery |
| `GemBullet`: a cut stone | Before the heading of the one card a screen is about | |
| `GoldFrame`: a fine inner gold rule | "Owed to you" (Khata) and the statement balance | A hallmark certificate / jewellery box |

A kundan bead chain under every header and a beaded rim on the "+" coin were
tried on 2026-10-06 and **removed the same day: the owner did not like them.**
Headers keep the plain 3px gold rule; the "+" stays a plain gold coin. Do not
bring them back.

**Never:** a jaali lattice, a mandala, a warm-ivory ground, purple, or any
gradient. Those are SoneBill's, live (purple, gradients) or coming
(design-lab: ivory with jaali and mandala). The store images use the same
motifs (`scripts/store-screenshots/motifs.js`).

### Typography

Use the **platform system font** (SF Pro on iOS, Roboto on Android) instead of
SoneBill's Outfit and Space Grotesk. This needs no native font changes, so there
is no risk of an iOS crash or a missing-font fallback. Show figures with
`fontVariant: ['tabular-nums']` so balances line up in columns, as in a ledger.

### Components

- **Header:** solid `primary`, left-aligned title, shop name as a subtitle, and
  plain icon buttons, a faint keri on the right and a thin gold rule along the
  foot. No gradient, no logo tile and no glass pill buttons. It is the same
  on every tab, with no colour per tab.
- **Tab bar:** white with a hairline top border. Icon and label in `inkMuted`,
  active in `primary` with a short gold underline. A raised circular
  **New Entry** button in the centre, in `gold`. No gradient icon chips.
- **Cards:** white, 1px `line` border, radius 10, no drop shadow.
- **Lists:** ledger rows with a hairline divider, name on the left, figures
  right-aligned in tabular numerals. Gold figures in `gold`, cash in `ink`, dues
  in `due`.
- **Buttons:** primary is solid `primary` with white text, radius 8. Secondary
  has a `primary` outline. No gradient buttons anywhere.
- **Rate strip:** today's 99.50 rate is one compact line under the header, tap
  to change. It replaces SoneBill's large orange rate card.
- **Support:** in **More, Help & support**, not a floating button.

### Structure

| Tab | Screen | Built from |
| --- | --- | --- |
| **Khata** (home) | Receivables summary: total fine gold due, total cash due, number of retailers owing. Below it the retailers with balances, highest first, then today's entries. | `DashboardScreen` (rebuilt), `utils/dues.ts` |
| **Retailers** | Directory with gold and cash balances, search and sort, and Add retailer. | `CustomersScreen` (restyled) |
| **+ New Entry** (centre) | Sheet: Sale on account, Receive gold or cash, Melt lot, New retailer. | `NewOrderScreen`, payment flow, `TakeMeltScreen`, `AddCustomerModal` |
| **Day Book** | Every entry in date order (sales, receipts, melt lots), with daily totals for gold in and out and cash in. | New screen. Replaces the Orders tab |
| **More** | Shop profile, today's rate, melt lots, statement and printer settings, language, Face ID, help and support, legal, log out. | `SettingsScreen` (restyled and trimmed) |

The retailer detail screen becomes a **statement**: an opening line, dated
entries with gold and cash columns, a running balance, and share or print.

---

## 6. Work plan

Tick each task when it's done. Each phase leaves the app working.

### Phase 0: Analysis and setup
- [x] 0.1 Compare with SoneBill: code, assets, screenshots and UI (section 1)
- [x] 0.2 Local stack running against a separate demo database, with seed data (section 7)
- [x] 0.3 Screenshot tool in the repo: `scripts/store-screenshots/capture.js`
- [x] 0.4 This document, with pointers to it from `AGENTS.md`, `CLAUDE.md` and the workspace `CLAUDE.md`

### Phase 1: Brand system
- [x] 1.1 `src/theme/brand.ts`, with the palette from section 5 as named tokens, plus `$brand` and `$gold` gluestack scales registered in `App.tsx`
- [x] 1.2 Swap SoneBill's purple, indigo and violet hexes for brand tokens across
      `src/`, about 200 places in about 80 files. Work file by file, not with a
      blind global replace: a purple can be a selected state, a link or a
      button, and each maps to a different token.
      *Done with `scripts/rebrand/remap-colors.js`, which maps by family and
      lightness, so a tint stays a tint and a strong accent stays strong. It
      changed 922 references in 90 files and is idempotent: re-run it after any
      merge from SoneBill. Gradients are flat now: `GradientSurface`, both
      `GradientButton`s, `SoftGradientBackground` and `AddPhotosButton`.
      `src/theme/colors.ts` (SoneBill's `AppColors`) is deleted.*
- [x] 1.3 System font: remove Outfit and Space Grotesk from the theme and global CSS (two files reference Outfit)
- [x] 1.4 Status bar and app background set to the new palette. `LedgerHeader` sets a light status bar, and the web body is flat paper.
- [x] 1.5 `npx tsc --noEmit` is clean; capture and review

### Phase 2: App shell and navigation
- [x] 2.1 New shared header component: `src/components/ledger/LedgerHeader.tsx` (+ `LedgerHeaderAction`). Used by Khata so far; Retailers, Day Book and More still need switching (3.2, 3.4, 3.7).
- [x] 2.2 New tab bar: Khata, Retailers, New Entry (centre), Day Book, More. In `MainTabs.tsx` (`LedgerTabBar`). Route names are unchanged (`Dashboard`, `Customers`, `Orders`, `Settings`); only labels and icons changed. The Day Book tab still shows the old orders list until 3.4.
- [x] 2.3 New Entry action sheet, wired to the existing flows: `src/components/ledger/NewEntrySheet.tsx`, hosted in `MainTabs` along with the add-retailer modal
- [x] 2.4 Support moved into More. Remove the floating support button and the old add button. `GlobalSupportButton.tsx` is deleted and unmounted from `App.tsx`. Help is More, Help & support (`ContactUs`).
- [ ] 2.5 The daily rate prompt and rate strip match the new design. Also fix the
      rate field, whose label overlaps its help text on web.

### Phase 3: Core screens
- [x] 3.1 Khata home screen (section 5). `DashboardScreen.tsx` was rewritten: rate strip, Owed to you, a balances table, and recent entries from the new `src/utils/dayBook.ts`. The floating add button is gone.
- [x] 3.2 Retailers list, restyled as ledger rows (`CustomersScreen.tsx`). Logic is unchanged; Owing is now the first filter after All.
- [x] 3.3 Retailer statement (`CustomerDetailsScreen.tsx`). It shows the balance as of today (gold and cash, via `buildRetailerStatement` and `dues.ts`), what is held for the retailer, New sale, Remind and PDF, the sales with the amount owed on each, and the entries. There is no running-balance column, because computing one client-side would be new arithmetic (rule 5). If the owner wants one, it has to come from the server (`retailerAccount` module).
- [x] 3.4 Day Book (`src/screens/dayBook/DayBookScreen.tsx`) on the `Orders` tab route: sales and receipts by date, with daily totals. The old orders list (trash and restore) is now the pushed `SalesList` route, linked from the Day Book header. Melt lots are not in it yet: before adding them, check how an applied melt credit is recorded so gold in is not counted twice.
- [~] 3.5 New sale, receive payment and melt lot screens restyled. *(Nearly done; what is left is optional and does not block submission.)* Done: the sale screen (`OrderDetailsScreen`) has the Ledger header and an "Owed on this sale" card with Receive at the top, and its cards are flat. Also done: `DocumentActionsRow` colours, and `CommonHeader` is down to its light variant (the "Jewellery Bill" dark variant is gone). Done on 2026-10-06 (night): the Sales list (`OrdersScreen`), with ledger rows, flat search and underlined filters. Its "due" now reads gold and cash through `utils/dues.ts`; it showed `estimatedBalance`, which AGENTS.md forbids for a due. Also the retailer picker (`SelectCustomer`, Ledger header), the add-retailer button (flat), the catalogue title ("Item catalogue") and the shop-details labels (a doubled "*" fixed). Still optional: `NewOrderScreen`, `TakeMelt`/`MeltLots`/`MeltLot`, `ItemsProducts`, `AddShopDetails`, `SelectCustomer` and `AddCustomerModal`.
- [x] 3.6 Login and OTP: new layout (`src/components/ledger/AuthLayout.tsx`) and the tagline "Wholesale gold khata". The keyboard handling follows the `CLAUDE.md` checklist. Guest mode is kept until the owner answers question 3.
- [x] 3.7 More screen (`SettingsScreen.tsx`), trimmed and regrouped. Dropped: Invoice and bill settings, Inventory, Purchases, Sales report, GST report, GST settings, and Video tutorials (wholesale sales hardcode 3% GST and never read GST Settings). Their screens are still registered until Phase 4 removes them.

### Phase 4: Remove what SoneBill was, not what this app is
Remove each from navigation, from every entry point and from imports, so the JS
bundle no longer carries them. Delete files that nothing uses. Before removing
anything, check it isn't on a wholesale path. Note what you find in section 8.
- [x] 4.1 Retail invoice flow: `CreateInvoice`, `InvoiceCreationScreen`, `InvoicePreviewScreen`, `InvoiceSuccessScreen` (deleted)
- [x] 4.2 `BillHistory`, `SalesReport`, `GstReport` (retail reports), plus `MetalRates`. All deleted.
- [x] 4.3 `Purchases` and `GST` (retail GST rates) deleted. **`ItemsProducts` is kept**: it is the catalogue NewOrderScreen fills sale lines from. It is listed in More as "Item catalogue" and still needs restyling.
- [~] 4.4 `InvoiceBillSettings` deleted. The print templates under `src/print/templates/` are still reachable through `usePrintBill`, which the sale screen uses. Check what a wholesale sale prints before removing any.
- [x] 4.5 Retail advance-order flow (`AdvanceOrder`, `AdvanceOrderSuccess`, `CompleteAdvanceOrder`) deleted. **Edit and Complete were removed from the sale screen.** Both opened these retail forms, which know nothing of wastage and would have repriced a wholesale sale on retail rules. A sale completes on its own when receipts clear both accounts. See question 7.
- [x] 4.6 Video tutorials: kept, but off. The `tutorials` flag defaults to false, the fallback catalogue has no videos, and the More row is gone.
- [x] 4.7 `retail` feature flag and `useRetail` removed, along with the hidden retail fields in the item catalogue.
- [ ] 4.8 Optional, needs the backend: a document prefix other than `INV-` for sales

### Phase 5: Copy and localisation
- [x] 5.1 English strings for retail and billing wording fixed, keys kept.
      - `scripts/rebrand/copy.js` holds the new values (61 keys) and `set-strings.js set` applies them.
      - The vocabulary: order, invoice or bill becomes sale; payment becomes receipt; printed bill becomes sale slip.
      - Printed GST documents keep "Tax Invoice" (`bill.*`, `taxInvoice.*`) because that is their legal name.
      - 11 namespaces for deleted screens were removed from all four files (about 1,230 lines) with `remove-namespaces.js`.
      - The legal texts were updated by `legal-copy.js`: the deletion steps now say More instead of Settings, the record lists say sales and receipts, and the Terms no longer say "Jewellery Billing Application".
      - **Redeploy the web build** so the public legal pages (generated from `en.ts`) match.
- [x] 5.2 Same changes in `hi`, `mr` and `gu`.
      - The Gujarati Terms paragraph 2 was corrupted in the SoneBill original (stray "the" and Korean "있다"). It is rewritten.
      - `orders.details.orderDateLabel` does not exist in hi or mr, so those fall back to the code's English text. Minor.
- [x] 5.3 Permission strings in `ios/GoldKhataBook/Info.plist` describe wholesale uses only (photo library, camera, contacts, local network). The camera key stays, because `AddShopDetails` can open the camera.

### Phase 6: Store listing and screenshots
- [x] 6.1 Richer demo book: `gold-khata-book-backend/scripts/seed-store-book.js` (`npm run seed:store`). It seeds 10 retailers, sales and receipts over two weeks with entries dated today, and GST on four retailers so there are cash balances. It goes through the API, so all figures come from server pricing. No melt lots, because melt is off by default.
- [x] 6.2 `scripts/store-screenshots/store.js` walks the app per device profile in two walks, each from a fresh login.
- [x] 6.3 Captioned frames (`frame.js`): iPhone 6.9" 1320 × 2868 and iPad 13" 2064 × 2752, Play phone 1080 × 1920 and tablets 1600 × 2560 and 1200 × 1920. They are JPEG, because Play rejects a PNG with alpha. Play feature graphic: `feature.js`.
- [x] 6.4 Every file in `store-assets/screenshots/` replaced: 32 images across five sizes. `scripts/store-screenshots/verify.js` checks each size and compares against all 291 images in the SoneBill checkout. It passes.
- [x] 6.5 Store copy, review notes and the Resolution Center reply are in `store-assets/listing/LISTING.md`, with limits checked: subtitle 21/30, promo 145/170, keywords 99/100, Play short description 64/80.
- [~] 6.6 Production demo shop. Approved; the script is ready and the dry run passed. The owner runs one command (section 9, item 5).
- [x] 6.7 Icon recoloured to ledger green everywhere. The Android icons and the Play icon were still SoneBill's and are now replaced (section 9, item 2).

### Phase 7: Verification and submission
- [x] 7.1 `npx tsc --noEmit` is clean, eslint shows no new errors in changed files, and jest passes (49 tests).
- [ ] 7.2 Test on an Android device (`scripts/run-android-device.ps1`)
- [ ] 7.3 iOS on a Mac: `scripts/release-ios.sh --bump`. Run the real-device checks in `CLAUDE.md`.
- [ ] 7.4 Owner reviews the screenshots and listing in App Store Connect before submitting
- [ ] 7.5 Submit, and send the Resolution Center reply

---

## 7. Running it locally

Everything below runs on this Windows machine from the workspace folder
`C:\RN\gold-khata-book`. It survives restarts because nothing lives in a temp
folder. The commands are for Git Bash.

**Quickest way:** double-click `start.cmd` in the frontend repo and choose
**4) demo**. It starts MongoDB, the backend on the demo book
(`gold_khata_book_demo`) and the web app on http://localhost:8081. Option 3
does the same on the owner's own local data (`gold_khata_book_dev`). Steps 1
to 4 below do the same thing by hand.

**1. MongoDB** (portable build in `..\.mongodb`, port 27017):
```
cd /c/RN/gold-khata-book
./.mongodb/bin/mongod.exe --dbpath .mongodb/data --bind_ip 127.0.0.1 --port 27017 \
  --logpath .mongodb/log/mongod.log --logappend &
```

**2. Backend on the demo database** (port 7100). Setting `DEV_DB_URL` in the
environment overrides `.env`, because dotenv never overwrites a variable that is
already set. That is what keeps the owner's `gold_khata_book_dev` untouched:
```
cd /c/RN/gold-khata-book/gold-khata-book-backend
DEV_DB_URL=mongodb://localhost:27017/gold_khata_book_demo NODE_ENV=dev npm run dev &
```

**3. Seed the demo book.** This wipes the target database every time, so pass
the same `DEV_DB_URL`:
```
DEV_DB_URL=mongodb://localhost:27017/gold_khata_book_demo NODE_ENV=dev npm run seed:demo
```

**4. Web build** (port 8081), pointed at that backend:
```
cd /c/RN/gold-khata-book/gold-khata-book-frontend
API_BASE_URL=http://localhost:7100/api/ npm run dev &
```

**5. Store screenshots** (the full pipeline; re-run it after any UI change):
```
# backend: a two-week wholesale book, 10 retailers, on the demo database
DEV_DB_URL=mongodb://localhost:27017/gold_khata_book_demo NODE_ENV=dev npm run seed:store
# frontend, in scripts/store-screenshots:
node store.js      # raw captures: raw/iphone69, raw/ipad13, raw/tablet (gitignored)
node frame.js      # captioned images into store-assets/screenshots/ (old ones deleted first)
node feature.js    # Play feature graphic: store-assets/graphics/play-feature-graphic.jpg
```
Captions live in `frame.js` (`SHOTS`). Store copy, review notes and the reply
to App Review are in `store-assets/listing/LISTING.md`.

**6. Capture review screens:**
```
cd scripts/store-screenshots
npm install            # once
node capture.js ../../screenshots/review --tabs "Orders,Retailers,Settings"
```
The repo-root `screenshots/` folder is gitignored scratch space for review
captures. Store-ready output goes in `store-assets/screenshots/`.

**Login:** phone `1234567890`, OTP `123456`. This is the **App Review demo
account**, and it works in **every** environment including production
(`DEFAULT_PHONE` in the backend's `login.controller.ts`, and `DEMO_ACCOUNT_PHONE`
in `dukandar.service.ts`). Any other number sends a real SMS.

**Checks:**
```
npx tsc --noEmit
npm run lint
npx jest __tests__/thermalReceipt.test.ts __tests__/itemPlausibility.test.ts
```

**On a phone.** A phone build always talks to a hosted backend
(`API_BASE_URL` only exists for the web build), so a phone never sees the demo
book on this machine.
- Android, with live reload: `powershell -File scripts\run-android-device.ps1`
  (USB or wireless adb; `-AppEnv` defaults to `dev`). It builds the working
  tree, so nothing has to be committed first.
- Android, a standalone APK: `scripts\build-test-apk.ps1 -AppEnv dev -SkipPull`.
  Without `-SkipPull` it runs `git pull --ff-only` first.
- iPhone: on the Mac, `scripts/run-ios-device.sh --device` (7.3).

On 2026-10-06 the demo account on **dev** was empty: no shop details, no
retailers, no sales. To give it the same book as the screenshots, run this from
the backend. It only adds, never deletes; try it with `--dry-run` first:
```
SEED_API=https://dev.api.goldkhatabook.codeimplants.com/api node scripts/seed-store-book.js --api-only
```

iOS cannot be built on this machine. Phase 7.3 needs the Mac.

---

## 8. Decisions

| Date | Decision | Why |
| --- | --- | --- |
| 2026-10-05 | Make Gold Khata Book a separate product rather than merge it into SoneBill | Owner's decision |
| 2026-10-06 | Pearl ground and gold jewellery motifs (keri, gem, frame). A bead chain and beaded coin rim were tried and removed the same day at the owner's request | The owner asked for a premium jewellery look still unlike SoneBill. SoneBill's design-lab moves to ivory with jaali and mandala, so this moved away from ivory and uses a different motif family. |
| 2026-10-05 | Ledger design language: deep green, antique gold and ivory, flat, system font | It is as far from SoneBill's bright purple gradients as possible, and fits a ledger. A green ledger is the bookkeeper's convention, and green keeps red free to mean "due". |
| 2026-10-05 | System font rather than a new bundled font | No native font registration to get wrong, and it can't be checked on iOS from Windows |
| 2026-10-05 | Remove retail screens from navigation and imports, not just hide them behind flags | Hidden code still ships in the JS bundle, and the binary is one of the things 4.3(a) compares |
| 2026-10-05 | Screenshots captured from the web build (react-native-web) at store pixel sizes | It renders the same components as the app. There is no iOS simulator on Windows. Spot-check on a real iPhone before upload. |
| 2026-10-05 | The Khata home leaves trashed orders (`deletedAt`) out of dues | The Retailers list and the retailer screen already excluded them. The old dashboard counted them, so a trashed pending sale inflated the home totals and nowhere else. It still goes through `utils/dues.ts`. |
| 2026-10-05 | The balances table sorts by gold first under "All" | Fine gold is the unit of account (`AGENTS.md`). The old dashboard sorted by cash first. |
| 2026-10-05 | Translation keys stay where they are. Only values change (`tabs.dashboard` now reads "Khata") | Keys are code. Renaming them touches every screen for no user-visible gain. New screens get their own namespaces (`newEntry`, `khata`). |
| 2026-10-05 | Edit and Complete removed from the sale screen | They opened SoneBill's retail forms (AdvanceOrder, CreateInvoice, CompleteAdvanceOrder), which have no wastage or purity uplift and would reprice a wholesale sale on retail rules. Completion already happens on receipt. Owner to confirm (question 7). |
| 2026-10-05 | Deleted 33 retail files (screens, components, helpers, 2 tests of deleted helpers). `scripts/rebrand/unreachable.js` lists what is left unbundled | Code Metro does not bundle does not reach the binary, but deleting it stops it being wired back by mistake. Kept: `PhotoField` and `AddPhotosButton` (melt photos are planned), config files, `AuthNavigator` and `rateForPurity`. |
| 2026-10-06 | Owner: go with the recommendations | Section 9 records where each one landed |
| 2026-10-06 | Demo phone numbers use the 98765432xx dummy pattern | The earlier seed numbers could be real people's. They show in store screenshots and behind the demo account's WhatsApp Remind button. |
| 2026-10-06 | The Outfit and Space Grotesk font files are kept for now | Unused since the system-font switch, and identical in any app that bundles them. Removing them means editing the Xcode project, which cannot be checked from Windows. Drop them on the Mac. |
| 2026-10-05 | Demo work uses `gold_khata_book_demo` | It keeps the owner's local test data in `gold_khata_book_dev` safe from the seeder, which wipes |

---

## 9. Owner decisions

On 2026-10-06 the owner said to go with the recommendations. Where each one
landed:

1. **App Store category: Finance**, or Business if SoneBill is already in
   Finance. A different category from SoneBill is the point. *Set this in App
   Store Connect; it cannot be set from the code.*
2. **Icon: done.** Same artwork, recoloured from purple to ledger green with
   `scripts/rebrand/recolor-icon.py`. It regenerates the iOS icon set, the store
   icons, the in-app logo, the favicon, and the Android launcher icons. The
   purple original is kept as `scripts/rebrand/icon-purple-original.png`.
   **Found while doing it:** the Android launcher icons and
   `android/app/src/main/ic_launcher-playstore.png` were still SoneBill's
   artwork (a rupee sign among jewellery). Only iOS had been changed. They are
   now drawn from the Gold Khata Book art.
3. **Guest mode: removed** from Login and OTP. `GuestModeModal` is deleted.
   `loginAsGuest` stays in the auth store, so an existing guest session on a
   device keeps working.
4. **Retail billing: removed.** The `retail` feature flag, `useRetail`, and the
   hidden making charges, discount, HUID, pieces and stock fields in the item
   catalogue are gone. The print and calculation code that still knows making
   charges was left alone, because it is money arithmetic (rule 5).
5. **Production demo data: approved, not yet done.** The seeder has a safe mode
   for it: it only adds, never deletes, uses no database access, and skips
   retailers that already exist. A dry run against production on 2026-10-06
   found the demo account empty (no shop details, retailers or sales). The real
   run was blocked by the session's permission guard for production writes, so
   **the owner runs it once**, from `gold-khata-book-backend`:
   ```
   SEED_API=https://api.goldkhatabook.codeimplants.com/api node scripts/seed-store-book.js --api-only
   ```
   Add `--dry-run` first to see what it will add. Then sign in on a phone with
   1234567890 / 123456 and check the Khata tab shows the ten retailers.
6. **`INV-` numbering: unchanged.** No recommendation was made. It stays.
7. **Editing a sale: accepted.** Edit and Complete stay removed. A wholesale edit
   mode is a possible follow-up, not part of this resubmission.

---

## 10. Owner requests of 2026-10-06 (afternoon)

The owner reviewed the app on web and asked for three things:

1. **Retailer-account cases (DONE).** "A retailer owes gold, pays cash, and
   asks to hold it until the rate suits him" and "a retailer pays an advance
   in gold or cash for future purchases". Shown in the demo data too.
2. **Item-name search (DONE).** SoneBill's `ItemTypePicker`: the item-name
   field searches the shop's saved items and a master list of ornaments (in
   four languages), or saves a new one. The list is the shared npm package
   `@codeimplants/jewellery-catalog`, whose README names gold-khata-book as a
   user. Port the LOGIC; draw the UI in the Ledger design, not SoneBill's.
   Done: `components/catalog/ItemPicker.tsx` (search, groups, the shop's
   catalogue first, "Use what I typed", "Add to the list" with a group of
   its own), `ItemNameField.tsx` on New sale (replaces the dropdown plus text
   box), a search button on the Item catalogue's name, `hooks/useShopTaxonomy.ts`
   (the shop's own ornaments, on the device as in SoneBill), strings in
   `itemPicker.*` via `scripts/rebrand/add-keys.js`.
3. **A premium jewellery look (DONE)**, still unlike SoneBill. SoneBill's
   `design-lab` branch (approved 2026-09-25/26) is moving to warm ivory with a
   gold jaali lattice and mandala watermark, gold accents, and its OWN Khata
   and Day Book screens. So GKB must avoid ivory+jaali/mandala and use a
   different motif family. If SoneBill ships Khata and Day Book screens, the
   two apps converge again: tell the owner.
   Done: pearl ground, gold-leaf colour and three motifs (section 5), New sale
   on the Ledger header, and the store set recaptured (below).

### Using held money in one tap, in full or in part (owner, 2026-10-06)

- **Gold held:** "Use" (statement and sale screen) opens `UseGoldSheet`: **Full**
  (the smaller of held and owed) is filled in, so a full payment is one more
  tap; **Half** or a typed weight is a part payment. On the statement it goes
  oldest sale first; on a sale, against that sale. What is not used stays held.
- **Cash held:** Fix rate (`FixRateSheet`) has the same **Full** / **Half**
  choices. The rate is still asked, because fixing it is the whole point; Full
  follows the rate when it changes.
- Tested end to end on web: a 10 g advance at 99.9 (10.040 gm), half used
  (due 37.533 to 32.513 gm), half the cash fixed at 14,900 (due to 22.446 gm).

### Pre-submission audit (2026-10-06, night)

Checked for the reasons App Review gives, and fixed what code can fix:

| Area | Result |
| --- | --- |
| `npm run check:store:ios` | 23 passed, 0 failed. Two warnings, both expected: build-number uniqueness (the guard cannot see App Store Connect; see step 4) and local networking (needed for Wi-Fi thermal printers) |
| 2.1 placeholder text | "Tutorials coming soon" reworded in four languages. The screen is not reachable anyway: the tutorials flag is off in the build and the video catalogue is empty |
| 4.3 identical files | SoneBill's Outfit and Space Grotesk fonts (unused since the system font) removed from both apps: files, Xcode project, Info.plist `UIAppFonts`, link manifests, `react-native.config.js`. 17 identical files remain, all React Navigation's own library icons, which every app using it ships |
| ITMS-90062 build number | Build 2 (the rejected upload) is recorded in the project: the Mac pushed it as 2b7d04a. `release-ios.sh --bump` makes 3 |
| Firebase | Both platform files are this app's own project (`goldkhatabook`, `com.goldkhatabook.app`) |
| Payments (3.1) | None in the app. The terms only reserve the right to charge later |
| Permissions (5.1.1) | Every purpose string names a real use in plain words |
| Account deletion (5.1.1(v)) | More, Delete Account |
| "SoneBill" text | Only in code comments, which do not ship |
| The reply to App Review | **Corrected.** SoneBill's own main branch has a **Day Book** and a **supplier khata** (what the shop owes its suppliers in rupees and gold), so the reply no longer says SoneBill has none of this. It now says what is true: SoneBill is the retail shop's software, this app is the wholesaler's |

What code cannot remove: both apps now use the words "khata" and "day book",
for opposite sides of the trade. The listing, screenshots and reply lead with
what only a wholesaler does (fine-gold accounts per retailer, rate fixing on
held cash, advances). No change can guarantee an approval.

### Store images (recaptured 2026-10-06)

`store.js` now walks Raj Gold House (cash held, Fix rate) for the statement
and the sale, and adds the Fix rate sheet and the item list. `frame.js` puts
them in listing order and numbers the files that way: 01 khata, 02 statement,
03 fix-rate, 04 daybook, 05 item-list, 06 sale, 07 new-entry, 08 retailers,
09 welcome (phones get nine, tablets the first six). Captions sit on emerald
with the keri and a plain gold rule; the Play feature graphic matches. `verify.js`:
all sizes correct, none identical to SoneBill's 301 images. The listing copy
(`store-assets/listing/LISTING.md`) gained the item list, cash held with the
rate fixed later and advances, in the description, the reviewer notes and the
reply to App Review.

### How the retailer account works now

The server already kept, per retailer, `heldCash` (rupees, rate not fixed)
and `meltCredit` (grams of 99.50 held), with entries behind both. What was
added:

| | Server (gold-khata-book-backend) | App |
| --- | --- | --- |
| Gold advance | `POST /retailer-account/:id/gold` {weight, purity}: entry `gold-received`, credited with `priceInboundMetal` (same rule as gold paid on a sale). Lands in `meltCredit`, which now means "gold held" | Receive sheet, Gold advance tab, with a credit preview from the app's mirror of the same rule |
| Cash held | (existed) `POST /:id/cash` | Receive sheet, Cash tab ("fix rate later") |
| Fix rate | (existed) `POST /:id/cash/allocate` {orderId, amount, goldRate} | Fix rate sheet: asks the rate (default today's), oldest sale first (`utils/heldMoney.ts`). On a sale: its own Fix rate |
| Use gold held | (existed) `POST /:id/melt/apply` | One tap on the statement (oldest first) or on a sale; on New sale, "From gold held" is no longer behind the melt flag |
| Cash advance on a new sale | | New sale: "From cash held", converted at the sale's own rate |
| All accounts | `GET /retailer-account` | Khata home "Held for retailers", row notes "Holds …", Retailers list, Day Book |
| Day Book | Payments drawn from held money are `paymentType: "credit"` (also allowed on invoices); overpayment credits carry `orderId` and the payment's date | `utils/dayBook.ts`: held cash and gold advances are receipts that day; settlements from them are grey transfers, never added to the day's totals |

Bug fixed on the way: the sale screen's "Use credit" converted held cash at
the sale's FIRST PAYMENT rate (`balanceRatePerGram`). Held cash exists so it
is NOT converted at an old rate, and the server's allocate route always
required the rate explicitly. Now it asks.

Verified: backend `tsc`; `verify:pricing`, `verify:ledger`, `verify:dues`,
`verify:order` pass; `verify:balance` fails IDENTICALLY at HEAD (an existing
mismatch, not from this work); an 18-check API test of the new routes; app
`tsc`; lint shows no new errors against HEAD.

Demo data (`seed-store-book.js`, now 12 retailers): Raj Gold House (gold due,
Rs 3,00,000 held, rate not fixed), Kalyan Retail (held, then fixed at day 3's
rate), Shubh Laxmi Jewellers (50 g bar at 99.9 as an advance, part used on a
sale), Siddhivinayak Gold (Rs 2,50,000 cash advance, no sale). The local seed
also refuses any database not ending in `_demo`.

**Before any app build that ships:** deploy the backend to dev and prod. An
app on an old backend shows no held amounts on the home screen (the list call
fails quietly) and the gold advance save fails with an error.

## 11. Progress log

Newest first. One entry per working session: what changed and what comes next.

- **2026-10-06 (night).** Full / Half one-tap use of held gold and cash. Pre-submission audit (section 10): SoneBill's fonts removed, build recorded as 2, placeholder reworded, the reply to Apple corrected (SoneBill has its own Day Book and supplier khata). Store images recaptured. Both repos committed and pushed to `main` for the Mac.
- **2026-10-06 (evening).** The owner's three requests are done (section 10).
  - Item-name picker on New sale and the Item catalogue (`@codeimplants/jewellery-catalog`, SoneBill's search logic, this app's own UI).
  - Premium look: pearl ground, gold-leaf colour, keri, gem bullets, gold frame (section 5). The owner then asked to remove the bead chain under the headers and the beaded "+" coin: removed, headers back to the plain gold rule, store images recaptured again. New sale moved onto the Ledger header.
  - The sale screen's held-money box moved up under "Owed on this sale", where it is seen.
  - Store images recaptured and reordered (01 to 09); verify.js passes; listing copy updated.
  - Checks: app `tsc` clean; lint shows no new errors against HEAD; backend `tsc` clean.
  - Next for the owner: deploy the backend (dev, then prod) BEFORE any build that ships; review on web; commit; then the phone and Mac steps.
- **2026-10-06 (afternoon).** Retailer-account cases built (section 10).

- **2026-10-06 (late morning).** A wrong OTP no longer shows a full-screen error.
  - The owner logged in on web with their own number and typed 123456, which only works for the demo number 1234567890. The app put a full-screen "NETWORK ERROR / Something Went Wrong / Bad Request" overlay over the OTP screen. An App Reviewer who mistypes the code would get the same.
  - The cause dates from SoneBill. Every API call goes through `withCoreRetry` (`src/api/request.ts`), which shows that overlay for any failure, including a 400. The backend's message is in `msg`, which app-core's error normaliser does not read, so the overlay showed the HTTP status text.
  - Fix, in `authService.verifyOtp` only: the backend's own rejections (any 4xx, and its 504 "code expired" body) now go back to the OTP screen as "Invalid OTP. Please try again." shown inline. Transport failures still retry and show the overlay. Other screens are unchanged.
  - Verified on web with the OTP calls faked, so no SMS was sent. Both demo login and `tsc` pass.

- **2026-10-06 (morning).** Local testing before a phone.
  - `start.cmd` gained **4) demo**: MongoDB, the backend on the demo book and the web app, in one go.
  - `seed-store-book.js` now refuses to wipe a database whose name does not end in `_demo`. With `DEV_DB_URL` unset it fell back to `.env`, which is the owner's `gold_khata_book_dev`.
  - `public/index.html`: `theme-color` is Ledger green (was black), the background is paper (was grey), and the description says what the app is.
  - A production web build (`npm run build`, output to a scratch folder) compiles, with only webpack's size warnings. `dist/` was not touched; nothing was deployed.
  - Smoke test on http://localhost:8081: login, the Khata home and the Day Book all work on the demo book.
  - The demo account on the dev server is empty (dry run). Section 7, "On a phone", has the command to fill it.

- **2026-10-06 (late night).** Polish pass.
  - The Sales list was restyled. Its rows now show the real dues through `dues.ts`, not `estimatedBalance`.
  - The retailer picker header, the add-retailer button, the catalogue title and the shop-detail labels were fixed.
  - `capture.js` gained `first:` and `label:` steps.
  - `tsc` is clean. Lint versus HEAD: 0 new errors, 3 inherited ones fixed. jest: 49 passed.
  - `same-as-sonebill.js` finds only library images and the unused fonts. `verify.js` passes.
  - Nothing is committed.

- **2026-10-06 (night).** The owner's go-ahead is applied (section 9).
  - The icon is green everywhere; this caught the SoneBill Android icons.
  - Guest mode and retail billing are removed.
  - Demo phone numbers are dummies.
  - The seeder has a production-safe `--api-only` mode. The production dry run passed; the real run was blocked by the permission guard and is left for the owner as one command.
  - Screenshots are regenerated.
  - `scripts/rebrand/same-as-sonebill.js` reports any asset still byte-identical to SoneBill's. Only library images and the unused fonts remain.

- **2026-10-06 (later).** Phase 6 done, apart from the items that need the owner.
  - Store book seeder added.
  - Screenshots for all five store sizes and the Play feature graphic are in `store-assets/`, and `verify.js` passes.
  - Store copy, review notes and the reply to App Review are in `store-assets/listing/LISTING.md`.
  - Lint is clean for new errors, `tsc` passes, and jest passes.
  - **Nothing is committed yet.** About 120 files changed or were added across the two repos. Ask the owner before committing.
  - The local stack is still running: MongoDB, the backend on `gold_khata_book_demo` and the web build on 8081. Restart it with section 7 after a reboot.

- **2026-10-06.** Phase 5 done and 3.5 partly done.
  - Copy pass in four languages, legal texts updated, unused string namespaces removed.
  - iOS permission prompts reworded.
  - Sale screen: Ledger header and an "Owed on this sale" card with Receive.
  - Retail strings are gone from the bundle.
  - `tsc` is clean.
  - Next: finish 3.5 (the remaining flow screens), then Phase 6.

- **2026-10-05 (night).** 3.3, 3.6 and most of Phase 4 done.
  - The retailer statement and the sign-in screens were rebuilt.
  - Retail routes are unregistered and their files deleted; Edit and Complete are gone from the sale screen.
  - `tsc` is clean, and the jest maths tests pass (49 tests, snapshot unchanged).
  - `capture.js` gained `--steps` for inner screens. Run each path in its own process: browser back does not map one-to-one onto app back.
  - Next: the sale screen (3.5), then copy (Phase 5).

- **2026-10-05 (evening).** 2.4, 3.2, 3.4 and 3.7 done.
  - `EntryRow` is shared by the Khata home and the Day Book.
  - `LedgerHeader` gained `onBack` for pushed screens.
  - `scripts/rebrand/add-strings.js` adds new string namespaces in four languages and is idempotent.
  - `tsc` is clean.
  - Line endings: the working tree is CRLF (git `autocrlf=true`), and files written fresh are LF. Git normalises both on commit. Scripted edits must match `\r?\n`.
- **2026-10-05 (later).** Phase 1 done. Phase 2 tasks 2.1 to 2.3 and task 3.1 done.
  - Palette and system font are in; 922 colour literals were remapped by `scripts/rebrand/remap-colors.js`; all gradients are flat.
  - The new tab bar has a centre New Entry sheet.
  - The Khata home was rebuilt.
  - Strings were added in four languages (`tabs`, `newEntry`, `khata`).
  - `tsc` is clean.
  - Review captures are in `screenshots/phase2/` (gitignored).
  - Nothing is committed yet. Ask the owner before committing.
  - Next: 2.4, then 3.2, 3.4 and 3.7.

- **2026-10-05.** Phase 0 done.
  - Compared the app with SoneBill: screenshots identical, about 90% of code shared, same UI.
  - Captured the current screens from the local web build. They show SoneBill's gradient headers, tab bar, add button, rate card and Settings menu.
  - Confirmed the only SoneBill mentions left in `src/` are code comments.
  - Set up MongoDB, the backend on `gold_khata_book_demo` (seeded) and the web build.
  - Added `scripts/store-screenshots/`.
  - Wrote this plan.
  - Next: Phase 1.

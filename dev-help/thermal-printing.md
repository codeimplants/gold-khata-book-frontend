# Thermal Receipt Printing — How It Works

Plain-English guide to printing bills on a 58mm thermal receipt printer: which printers work on
which phones, how a shopkeeper sets one up, how the app decides what to send, and the handful of
mistakes that keep resurfacing if you edit this carelessly.

For a step-by-step spec to build this in another app, see
[`ai/thermal-printing-implementation.md`](ai/thermal-printing-implementation.md).

---

## Why the feature exists

Many jewellery shops cannot justify an A4 printer — cost, counter space, or they want something
portable. A 58mm Bluetooth receipt printer costs a fraction of that and is what most small shops
already use. This feature lets a shop **choose** thermal printing without disturbing the existing
A4 / PDF flow, which remains the default and is untouched.

## Which printers work

"Bluetooth" is really two incompatible technologies sharing a name, and this matters more than
anything else in this document.

| Printer type | Android | iOS | Notes |
|---|---|---|---|
| **Bluetooth Low Energy (4.0+)** | ✅ | ✅ | What mid-range printers use. The Seznik Veer B41 this was built against supports it |
| **Bluetooth Classic (SPP/RFCOMM)** | ✅ | ❌ **never** | What most sub-₹2,000 printers use. Apple forbids classic Bluetooth outside the MFi programme, and cheap printers are not enrolled |
| **WiFi / network (TCP port 9100)** | ✅ | ✅ | Counter-mounted units, generally pricier |
| **USB** | ❌ | ❌ | Not implemented. Dead end on iOS for this hardware class |

The iOS gap for classic Bluetooth is a platform restriction, not something we can engineer around.
The UI says so in plain language rather than letting an iPhone user hunt for a printer that can
never appear.

## What the shopkeeper does

1. **First time they tap Print**, a sheet asks "How do you print bills?" — Regular (A4) or Thermal
   (58mm). This is the only realistic way the feature gets discovered; Print Settings is otherwise
   never visited. Asked once, then never again.
2. Choosing Thermal opens **Settings → Print Settings → Thermal Printer**, which lists nearby
   printers and offers a WiFi IP box.
3. Every print after that just prints. Under the Print button sits `Printing to: <printer> · Change`
   — informed, not interrogated. A confirmation dialog on every bill would add a tap to the most
   repeated action in the app.
4. If the printer is off or out of range they get **Try again / Use regular printer / Cancel**.
   "Use regular printer" applies to that print only and deliberately does not rewrite their saved
   preference — a flat printer battery must not silently reconfigure the shop.

**The words "BLE" and "Classic" appear nowhere in the UI.** One "Nearby printers" list merges BLE
scan results with OS-bonded classic devices; the app works out which transport to use. A shopkeeper
has no reason to know or care.

Older classic printers must first be paired in the **phone's own** Bluetooth settings (PIN usually
0000) — they are not discovered in-app. The screen says this on Android.

## How a receipt is built

The receipt is built once as a structured list of lines (`receiptModel.ts`), then rendered one of
two ways. **Which one is decided per receipt, automatically — not by a setting.**

- **Text** (~1KB, near-instant) whenever every line is ASCII.
- **Image** whenever anything is not: a Marathi customer name, a Gujarati item name, a Devanagari
  label, or a shop logo.

This matters because the printer has no Devanagari or Gujarati glyphs in firmware — non-Latin text
sent as text prints as `?????`. Rasterising is not a workaround; it is what every ESC/POS library in
this space does for Indic scripts.

Only the lines that actually need it become images. On a typical Marathi bill that is 5 or 6 lines
out of 26 — everything else (amounts, dates, GSTIN, English labels) still prints as fast text. This
keeps the cost proportional to *how much non-Latin text a bill contains*, not to how many items it
has.

The `₹` sign is a deliberate exception: it does **not** force the image path, because the text
renderer substitutes `Rs.` for it. An English bill should not pay for the slow path over a currency
symbol.

## Speed

Measured on a Seznik Veer B41, one-item Marathi bill, as fixes landed:

| | Total | Notes |
|---|---|---|
| First working version | **54,062 ms** | BLE MTU never applied — 408 × 20-byte writes |
| After MTU + hybrid raster | 1,957 ms | |
| After native image decode | **592 ms** (BLE) | |
| Same over SPP | 2,012 ms | 1,432 ms of it was RFCOMM connect |
| SPP, first print | 3,213 ms | 2,643 ms of it was connect |
| SPP, repeat print | **529 ms** | Socket reused; connect 0 ms |

The connection is also opened **when a bill screen loads**, so RFCOMM setup happens while the user
is reading the bill rather than after they tap Print. That makes a first print behave like a repeat
one, provided they print within the 20s idle window.

If a print ever feels slow again, the timing breakdown is built in: **dev and preprod builds show a
popup after every thermal print** with per-stage milliseconds. It is gated on `APP_ENV !== 'prod'`,
so a Play Store build never shows it. It reports in-app rather than via `console.log` because
release builds strip console output — and the release APK is what gets tested.

## Known limits

- **Classic Bluetooth printers will never work on iPhone.** Apple's restriction.
- **1-bit output.** Thermal printing has no greys. A logo with a dark background prints as a mostly
  solid black block; line-art on white reproduces well.
- **Logos cost ~60ms and ~96 dots of paper** on every receipt, and force the image path even for an
  all-English bill (a logo has no text form).
- **The printer is held for ~20s after an SPP print** so the next one skips reconnecting. A shop
  sharing one printer between two phones will find it briefly unavailable to the second.
- **iOS is unverified.** Everything except SPP is written for both platforms, but it has not been
  tested on an iPhone.

## Mistakes that keep coming back

Every one of these was a real bug here, and most cost a build cycle.

**BLE `Device` objects are immutable.** `discoverAllServicesAndCharacteristics()` and `requestMTU()`
*return* an updated `Device`; they do not mutate in place. Discard the return value and `device.mtu`
stays at the 23-byte default forever — an 8KB receipt becomes 408 acknowledged writes and takes 53
seconds. Reassign: `device = await device.requestMTU(517)`.

**MTU is per-connection.** Negotiating it when pairing achieves nothing, because every print opens a
fresh connection. Do it on the write path.

**The TurboModule spec must keep its exact call shape.** RN's codegen matches literally on
`TurboModuleRegistry.get<Spec>('Name')`. Wrapping it — even `TurboModuleRegistry?.get(...) ?? null`
— fails the Android build with *"Unused NativeModule spec"*. To make it web-safe, add a
`.web.ts` variant; do not guard the shared file.

**The print path is shared with the web build.** Any native package imported from it needs a mock
alias in `webpack.config.js`, or the browser bundle crashes on load. This has bitten the project
more than once. Verify with an actual `npm run build`, not a type check.

**Non-ASCII characters sneak in via separators.** A `·` used between item details printed as `?`
*and* dragged every English bill onto the slow raster path. Tests catch this.

**Off-screen `<Image>` never paints on Android.** It fires `onLoad`, and captures blank — the image
backend detaches drawables for views it treats as invisible. Text renders fine, which makes it
confusing. Decode images natively instead of capturing them.

**Resolved amounts labelled as rates get multiplied twice.** `makingCharges` holds an already
computed rupee amount, so its type must be `'Fixed'`. Labelled `'Per Gram'` it was multiplied by the
weight again and printed ~18× too high.

## Where the code lives

```
src/print/thermal/
  transport.ts        SavedPrinter union + PrinterTransport interface
  bleTransport.ts     Bluetooth LE (both platforms)
  sppTransport.ts     Bluetooth Classic (Android only)
  tcpTransport.ts     WiFi, TCP port 9100
  receiptModel.ts     Builds the receipt as structured lines
  receiptBuilder.ts   Lines -> ESC/POS text
  hybrid.ts           Interleaves text runs and image bands
  raster.ts           Image -> 1-bit -> GS v 0 raster
  escpos.ts           Low-level command bytes
  perf.ts             Per-stage timing (dev/preprod only)
src/hooks/usePrintBill.tsx        One entry point for all three bill screens
android/.../classicbluetooth/     SPP + native image decoding (our own TurboModule)
```

`escpos.ts` and `receiptModel.ts` are transport-agnostic by design: adding a fourth transport should
never require touching receipt rendering.

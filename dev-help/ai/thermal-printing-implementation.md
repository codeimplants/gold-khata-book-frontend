# Build Instructions — Thermal Receipt Printing in React Native

Direct instructions for adding 58mm ESC/POS thermal printing to a React Native app, covering
Bluetooth LE, Bluetooth Classic (SPP), WiFi, and non-Latin scripts (Devanagari / Gujarati).

**This exists so you do not repeat the trial and error.** Every warning below is a bug that actually
happened in this project, with what it cost. Getting the same result from scratch took roughly a
hundred build-and-test cycles; following this should take a handful.

**Fastest route: copy the reference implementation.** `gold-khata-book-frontend/src/print/thermal/` and
`android/app/src/main/java/com/goldkhatabook/app/classicbluetooth/` are working, tested code. Copy them,
then read §2 (what to adapt) and §9 (verification). The rest explains *why* each piece is the way it
is, which matters when something breaks.

Final result for reference: **54,062 ms → 529 ms** per print, printing Marathi correctly.

---

## 1. Decide scope in five minutes

| Printer | Android | iOS | Who has one |
|---|---|---|---|
| Bluetooth LE (4.0+) | ✅ | ✅ | Mid-range |
| Bluetooth Classic (SPP) | ✅ | ❌ **impossible** | Most sub-₹2,000 printers |
| WiFi (TCP 9100) | ✅ | ✅ | Counter-mounted |

**iOS cannot ever use Bluetooth Classic** with a non-MFi accessory. No entitlement, no workaround.
Cheap printers are not MFi enrolled. If your users have cheap printers, Classic is Android-only and
your UI must say so.

**Cheap printers have no Devanagari/Gujarati/Tamil fonts.** Non-Latin text sent as text prints as
`?????`. The only route is rasterising to a bitmap. This is what every ESC/POS library does
(`escpos-php` #481, DantSu's Android library, Flutter `textRaster()`), not a hack.

## 2. Files to copy, and what to adapt

```
src/print/thermal/
  transport.ts        SavedPrinter union + PrinterTransport interface   — copy as-is
  escpos.ts           ESC/POS command bytes                            — copy as-is
  raster.ts           image -> 1-bit -> GS v 0                          — copy as-is
  base64.ts           binary-safe base64                                — copy as-is
  hybrid.ts           interleave text runs + image bands                — copy as-is
  bleTransport.ts     Bluetooth LE                                      — copy as-is
  sppTransport.ts     Bluetooth Classic                                 — copy as-is
  tcpTransport.ts     WiFi                                              — copy as-is
  perf.ts             stage timing                                      — copy as-is
  receiptModel.ts     builds the receipt lines            ← ADAPT: your bill fields
  receiptBuilder.ts   lines -> ESC/POS text                             — copy as-is
  ReceiptImageView.tsx lines -> RN views for capture      ← ADAPT: fonts/sizes if needed
  useReceiptCapture.tsx off-screen capture                              — copy as-is
android/.../classicbluetooth/
  ClassicBluetoothModule.kt   SPP + native image decode    ← ADAPT: package name
  ClassicBluetoothPackage.kt  module registration          ← ADAPT: package name
src/specs/NativeClassicBluetooth.ts       TurboModule spec  ← ADAPT: package name
src/specs/NativeClassicBluetooth.web.ts   web stub                      — copy as-is
```

Only `receiptModel.ts` contains business logic. Everything else is domain-independent.

Dependencies:
```bash
npm i react-native-ble-plx react-native-tcp-socket react-native-view-shot upng-js
```

## 3. Preconditions — check these first, they invalidate everything else

**New Architecture flag must be on for every platform.**
```properties
# android/gradle.properties
newArchEnabled=true
```
A library shipping TurboModules only registers its codegen task when this is true. With it off,
autolinking still emits a CMake `add_subdirectory` for codegen output that was never generated, and
the build dies with `codegen/jni ... not an existing directory` — an error that points nowhere near
the cause. Keep it in step with iOS's `RCTNewArchEnabled`. *Cost when missed: 3 failed builds.*

**Validate the printer before building anything.** Install the BLE library alone, build to a real
device, scan, connect, send `ESC @` + a line + cut. If nothing prints, stop.

**Library choices — take these, do not re-evaluate:**

| Need | Use | Do not use, because |
|---|---|---|
| BLE | `react-native-ble-plx` | ESC/POS wrapper libs are years stale, no New Arch |
| Classic/SPP | **Your own Kotlin TurboModule** | `react-native-bluetooth-classic`: last published Nov 2025, still RN 0.73-labelled |
| WiFi | `react-native-tcp-socket` | — (write `Uint8Array`; RN has no global `Buffer`) |
| Text→image | `react-native-view-shot` | Skia needs bundled fonts + shaping config, +6–10 MB |
| Image decode | Native `BitmapFactory` | JS decoders: PNG only, 10× slower |
| ESC/POS commands | ~150 lines of your own | Wrappers add risk, the command set is tiny and stable |

## 4. Architecture — one rule

Build the receipt **once** as structured lines, render it two ways. This is what stops the text and
image paths drifting apart.

```ts
type ReceiptLine =
  | { kind: 'text'; text: string; align?; bold?; large? }
  | { kind: 'row'; left: string; right: string; bold? }
  | { kind: 'logo'; uri: string }
  | { kind: 'divider' } | { kind: 'space' };
```

Choose the renderer **per line**, automatically — never as a user setting:

```ts
const needsImage = (s: string) => /[^\x20-\x7e₹]/.test(s);
```

`₹` is excluded deliberately: the text renderer substitutes `Rs.`, so an English bill must not take
the slow path over a currency symbol.

Rasterising the *whole* receipt makes cost scale with **bill size** instead of with how much
non-Latin text it has — a six-item bill with one Marathi name would take ~9 s. Per-line, a typical
Marathi bill rasterises 5 lines of 26.

ESC/POS interleaves text and raster freely. **Emit `ESC @` and the cut once per job**, not per run.

Transports sit behind one interface so adding a third never touches receipt rendering:
```ts
interface PrinterTransport {
  write(printer: SavedPrinter, data: number[], timer?: TransportTimer): Promise<void>;
  isSupported(): boolean;
  warmUp?(printer: SavedPrinter): Promise<void>;
}
```

## 5. The bugs that cost the most — read before writing transport code

### BLE `Device` objects are immutable — worth 53 seconds

```ts
let device = await manager.connectToDevice(id, { autoConnect: false });
device = await device.discoverAllServicesAndCharacteristics();   // RETURNS a new Device
if (Platform.OS === 'android') {
  try { device = await device.requestMTU(517); } catch {}        // RETURNS a new Device
  try { device = await device.requestConnectionPriority(High); } catch {}
}
```
Discard those return values and `device.mtu` stays at 23 forever → 20-byte chunks → an 8 KB receipt
becomes **408 acknowledged writes and takes 53 s**. Worst on iOS: there is no `requestMTU` there
(CoreBluetooth negotiates during connection and reports it on the device object), so a stale object
leaves iOS permanently at 20 bytes with no recourse.

**MTU and connection priority are per-connection.** Setting them at pairing time does nothing,
because every print opens a fresh connection. Do it on the write path.

Also: prefer **unacknowledged writes** where the characteristic allows (read the flag live from the
connection so already-paired printers benefit), and **discover the writable characteristic** rather
than hardcoding UUIDs.

### The TurboModule spec call shape is load-bearing

```ts
export default TurboModuleRegistry.get<Spec>('ClassicBluetooth');   // exactly this
```
RN codegen matches **literally**. Anything else — including `TurboModuleRegistry?.get(...) ?? null`
— fails the Android build with *"Unused NativeModule spec"*. To make it web-safe, add a `.web.ts`
variant exporting `null`; do **not** guard the shared file. *Cost when missed: a broken build pushed
to main.*

### Off-screen `<Image>` never paints on Android

It fires `onLoad` and captures blank — the image backend detaches drawables for views it treats as
invisible. Text renders through a different path, so text works and images do not, which is
maddening to diagnose. **Decode images natively and emit them as their own raster band**; never
route a logo through view capture.

### SPP specifics, each a real failure

- **Cancel discovery before connecting** — an in-progress scan starves the attempt and is the usual
  cause of an inexplicable connect timeout.
- **Chunk writes with a small pause** — cheap buffers overflow into *garbled output*, not an error.
  512 B / 5 ms. (256 B / 20 ms wasted ~1.5 s per receipt purely sleeping.)
- **Sleep ~120 ms before closing** or the tail of the receipt is lost.
- **Socket I/O off the bridge thread**, single-threaded executor so prints serialise.

## 6. Speed — the four fixes that matter

Measured, one-item Marathi bill, Seznik Veer B41:

| Fix | Before | After |
|---|---|---|
| BLE MTU reassignment + unacked writes | 52,928 ms | ~150 ms |
| Per-line raster instead of whole-receipt | 19 KB | 8 KB |
| Native `BitmapFactory` decode | 851 ms | 62 ms |
| SPP socket reuse (repeat print) | 2,643 ms connect | 0 ms |
| **Total** | **54,062 ms** | **529 ms** |

**Socket reuse** — hold it after a print, close after ~20 s idle. Three things it must get right:
a cached socket can report `isConnected` after the printer has gone, so **retry once on a fresh
connection**; a held socket makes the printer unavailable to other phones, hence the idle timeout;
close it in `invalidate()` before the executor shuts down.

**Pre-connect on screen open** — RFCOMM setup is the entire cost of a *first* print. Warm the
connection when the bill screen mounts so it happens while the user reads the bill. Must be silent:
they may never print, and a printer that is off right now is not an error.

**Instrument before optimising.** Report **in-app**, not `console.log` — release builds strip console
output and the release build is what you test. Gate on `APP_ENV !== 'prod'`. The first
instrumentation pass here **missed 72% of the time** because only one transport was instrumented, and
native calls are one opaque number from JS unless the native side reports its own split.

## 7. Permissions

**Android** (`AndroidManifest.xml`):
```xml
<uses-permission android:name="android.permission.BLUETOOTH_SCAN"
    android:usesPermissionFlags="neverForLocation" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"
    android:maxSdkVersion="30" />
<uses-feature android:name="android.hardware.bluetooth_le" android:required="false" />
```
Request `BLUETOOTH_SCAN`/`BLUETOOTH_CONNECT` **when the scan screen opens** — not at launch, not on
toggling a setting.

**iOS** (`Info.plist`):
```xml
<key>NSBluetoothAlwaysUsageDescription</key><string>…connect to your receipt printer.</string>
<key>NSLocalNetworkUsageDescription</key><string>…printers on your WiFi network.</string>
```
A permission-gated call with no matching usage string **hard-crashes iOS with no JS error**. Add the
key in the same commit as the first call. Do not add keys for capabilities you do not use.

## 8. Web builds

If the print path is shared with a `react-native-web` build, every native package imported from it
needs a mock alias in `webpack.config.js` or the bundle crashes on load. For the TurboModule spec use
a `.web.ts` variant (§5), and map the same path in `jest.config.js` — jest does not honour `.web.ts`.

**Verify with a real `npm run build`** and confirm the native module name appears zero times in the
output bundle. A type check will not catch this.

## 9. Verification

Automated:
- [ ] Every line fits the character width
- [ ] No non-ASCII survives the text renderer; `₹` → `Rs.`
- [ ] Non-Latin input selects the image path; plain English does not
- [ ] Exactly one `ESC @` and one cut per job
- [ ] ASCII rows stay on the text path in a hybrid receipt
- [ ] Resolved amounts are not re-multiplied by weight

On hardware (a simulator cannot do Bluetooth at all):
- [ ] Print over each transport supported
- [ ] Print twice in a row — exercises socket reuse
- [ ] Printer off / out of range → clear message, no hang
- [ ] Permission denied → clear message
- [ ] **Compare every figure against the on-screen bill.** Totals disagreeing with the screen was
      the single most common defect here and no unit test catches it
- [ ] Judge non-Latin legibility *on paper* — 203 dpi is unforgiving of matras and conjuncts

## 10. UX decisions worth copying

- **Ask once, at the first Print tap**, how the shop prints. A settings screen is never visited, so
  the feature is otherwise undiscoverable.
- **Never prompt again.** Print immediately; show `Printing to: X · Change` under the button. A
  dialog on every bill adds a tap to the most repeated action in the app.
- **Merge BLE and Classic into one list**, deduplicated by name. Never show those words to a user.
- **On failure offer Try again / Use regular printer / Cancel.** "Use regular printer" applies to
  that print only and must **not** rewrite the saved preference — a flat battery must not silently
  reconfigure the shop.
- **Put a refresh button on the scan screen.** If scanning starts only on screen focus, a printer
  switched on afterwards can never be found.

## 11. Non-obvious traps, collected

- A `·` separator between item details is **non-ASCII** — it printed `?` and dragged every English
  bill onto the slow raster path.
- A `GS v 0` raster **always starts at the left margin**; no alignment command applies. Centre by
  padding the bitmap to full width.
- Give strip cells **fixed declared heights** so bands slice arithmetically instead of needing layout
  measurement.
- Position the capture host at a **modest** off-screen offset (`top: -2000`, not `-100000`) with
  `collapsable={false}` — Android skips drawing subtrees at extreme offsets.
- Wait for real `onLayout` plus a frame before capturing, never a guessed timeout.
- Round raster width **down to a byte boundary** — `GS v 0` addresses whole bytes.
- Migrate persisted printers when adding a transport discriminator, or saved devices match no
  transport and fail silently.
- If a value is a **resolved amount**, its type must say so. `makingCharges` holding a computed total
  but labelled `'Per Gram'` was multiplied by weight again and printed ~18× too high.

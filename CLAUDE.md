# Gold Khata Book Mobile — Claude Context

## What this app is
Jewellery billing SaaS for Indian gold/silver shops. Handles invoices, advance orders (layaway), customer management, GST, metal rates, and print/share. React Native app for Android and iOS.

## Pre-deploy verification — RUN THROUGH THIS BEFORE EVERY BUILD

These are bugs that have historically cost a **full deployment cycle** each (build → upload → store review →
reject/report → fix → repeat), despite each having a one-line fix. Store review turnaround makes a 30-second
check worth days. Verify every item below before producing a release artifact — do not assume "it worked last time".

### 1. Keyboard and text input (most frequent offender)
Symptom users report: *"the input is blocked / I can't type / tapping the field does nothing."*
Almost always one of these, not an actual disabled input:

- **`keyboardShouldPersistTaps="handled"` on every ScrollView/FlatList that contains an input.**
  Without it, the first tap only dismisses the keyboard and the second tap registers — indistinguishable
  from a dead field. This is the single most common cause. Also required for a button *below* an input to
  be tappable while the keyboard is open (otherwise the first tap is swallowed and the button "does nothing").
- **`KeyboardAvoidingView` with the right `behavior` per platform** — `padding` on iOS, always `"height"` on
  Android. `android/gradle.properties` has `edgeToEdgeEnabled=true` (required for Android 15+ compliance),
  which makes Android stop honoring `windowSoftInputMode="adjustResize"` as a native resize — so
  `behavior={undefined}` on Android silently does nothing and the keyboard covers the field. Never use
  `undefined`/none on Android, even though that used to work before edge-to-edge was enabled. Manifest
  still correctly sets `windowSoftInputMode="adjustResize"`; do not change it — it's just no longer
  sufficient on its own.
- **Inputs inside a `Modal`** need their own `KeyboardAvoidingView` — the parent screen's does not apply
  across the modal boundary. Check `AddCustomerModal`, `AdminImpersonateModal`, `DatePickerModal`.
- **The last field in a long form** — scroll to the bottom with the keyboard open and confirm it is reachable
  and the submit button is tappable.
- **`keyboardType`** — numeric fields (amounts, weights, rates, GST, phone) must not open the alphabetic
  keyboard. On iOS `numeric`/`decimal-pad` have no return key, so provide a way to dismiss.

Current known gaps (13 of 21 input-bearing files lack `keyboardShouldPersistTaps`): `LoginScreen`,
`OtpScreen`, `AddCustomerModal`, `GSTSettings`, `CustomerDetailsScreen`, `SelectCustomerScreen`,
`OrderDetailsScreen`, `BillHistoryScreen`, `CustomersScreen`, `OrdersScreen`, `AdminDashboardScreen`,
`AdminUserDetailScreen`, `AdminImpersonateModal`. **`LoginScreen`/`OtpScreen` are the highest risk — a
blocked login blocks the entire app and is an automatic store rejection.**

### 2. Safe area and physical device shape
- Bottom action buttons must clear the **home indicator** (iPhone with no home button) — use
  `react-native-safe-area-context`, never a hardcoded bottom padding.
- Headers must clear the **notch / Dynamic Island**. The codebase convention is
  `SafeAreaView edges={['top']}`; screens with a bottom CTA need `edges={['top','bottom']}`.
- Check the **smallest supported device**, not just the simulator default — long labels (Marathi/Hindi
  strings are longer than English) wrap or clip differently.

#### Android navigation-bar clipping — every bottom sheet, every time

**Any new bottom-anchored sheet MUST get its bottom padding from
`useSheetBottomInset()` (`src/hooks/useSheetBottomInset.ts`). A constant will be wrong.**

`android/gradle.properties` sets `edgeToEdgeEnabled=true` (required for Android 15+), so the app
draws *behind* the system navigation bar. On a phone with the three-button navigation bar the
bottom ~48dp of any sheet sits underneath those buttons: the control renders, looks enabled, and
cannot be tapped. This shipped — "Choose Photo" in the photo sheet and the Cancel button in Add
Customer were both unreachable on a real OnePlus, and it was invisible on every gesture-navigation
device and in the emulator default.

```tsx
const bottomInset = useSheetBottomInset(24);   // 24 = this sheet's own design padding
<Box style={[styles.sheet, { paddingBottom: bottomInset }]}>
```

- The **argument is a minimum, not the bar height** — it is the padding to keep when there is no
  system inset (gesture navigation reports ~0). Pass whatever the sheet's existing padding was, so
  nothing shifts on devices that were already fine.
- The **dynamic part is `insets.bottom`**, measured by the OS: ~48dp three-button, ~24dp gesture,
  34dp iOS home indicator, 0 on web. Never hardcode any of those numbers, and never branch on
  `Platform.OS` to pick between them — one `Math.max` covers all four.
- `useSafeAreaInsets()` **does** work inside a React Native `Modal`. The provider is above these
  screens in the React tree and context crosses the Modal boundary even though the native view
  hierarchy does not. An older comment in `PhotoSourceSheet` claimed otherwise and hardcoded
  `Platform.OS === 'ios' ? 34 : 20` because of it — that is what caused the bug.
- Centred dialogs (`justifyContent: 'center'`, e.g. `ValidationErrorModal`) are **not** affected —
  only sheets pinned to the bottom edge.
- Testing: an emulator with gesture navigation will not reproduce this. Check on a device with the
  three-button bar enabled, or switch the emulator's navigation mode before believing a sheet is fine.

### 3. Permissions — an iOS crash, not a warning
On iOS, invoking a permission-gated API with **no matching `NS*UsageDescription` in Info.plist
hard-crashes the app instantly**, with no JS error. Whenever a native capability is added, add the string
in the same commit.
- Currently declared: `NSFaceIDUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSContactsUsageDescription`,
  `NSCameraUsageDescription`, `NSBluetoothAlwaysUsageDescription`, `NSLocalNetworkUsageDescription`.
- `NSCameraUsageDescription` was added for the old-gold declaration's optional ornament photos
  (`components/oldGold/OrnamentPhotoPicker.tsx` — the only `launchCamera` caller). It must stay as long as
  that call exists; removing it crashes the app on tap with no JS error.
- On **Android** the CAMERA permission is deliberately NOT declared. `react-native-image-picker`'s
  `launchCamera` goes through an intent that needs no permission — but *declaring* it in the manifest makes
  a runtime request mandatory, and would also need a `store-guard.config.json` `allowedPermissions` update.
- Do not declare keys for capabilities the app does not use — an unjustified permission invites App Store
  Guideline 5.1.1 (data minimization) scrutiny. An empty-string purpose value is worse than no key at all.

### 4. Release builds differ from debug — test the actual artifact
A debug build passing proves little. At minimum, install the release artifact and exercise login → create
invoice → PDF → print → share.
- `console.log` is stripped and Hermes optimizes differently; timing-dependent bugs appear only in release.
- Android R8/ProGuard can strip reflectively-referenced classes.
- **iOS ATS blocks plaintext `http://` in release** — `NSAllowsArbitraryLoads` is `false`, so every API URL
  in `src/config/environments/*.ts` must be `https://`.
- Confirm `APP_ENV` actually baked in — a "prod" build silently pointing at dev is a shipped outage.
  See the `APP_ENV` note under "Building release artifacts".

### 5. Version numbers
- Android: bump `versionCode` (Play rejects a reused code) and `versionName`.
- iOS: bump `CURRENT_PROJECT_VERSION` before **every** upload, even a re-upload of identical code, or
  App Store Connect rejects with `ITMS-90062`. `MARKETING_VERSION` only when user-visible.
- Keep the Android and iOS user-facing versions in step so support conversations reference one number.

### 6. iOS-only, checked on real hardware
The Simulator cannot validate these, and they are core flows for this app:
- **Printing** (`react-native-print`) — needs a real AirPrint printer.
- **Share to WhatsApp** (`react-native-share`) — share targets do not exist on Simulator.
- **Face ID** (`react-native-biometrics`) — Simulator has no Secure Enclave, so key generation and
  signing behave differently from hardware.
- PDF generation file paths and sandbox behaviour.
- App **launches at all** — a missing/misconfigured `GoogleService-Info.plist` crashes Firebase on init
  at startup, which reads as "the app is broken" and is an automatic Guideline 2.1 rejection.

### 7. The artifact must ship *this build's* JavaScript
Symptom: the app shows **old UI, an old logo, or is missing a feature you can see in the source** —
while native-side changes (launcher icon, permissions, native modules) *are* present. It looks like a
bad merge. It usually is not.

**This cost ~3 months of Android releases in 2026.** A prebuilt `index.android.bundle` was committed to
`android/app/src/main/assets/` in April and last refreshed 2026-05-02. React Native's Gradle plugin
bundles into `android/app/build/generated/assets/react/<variant>/`, and `mergeReleaseAssets` merges
`src/main/assets/` **over** it — so the committed file won every time. Every release APK/AAB from May 2
to Aug 3 shipped 2 May JavaScript. Builds exited 0. Play accepted the uploads. Git was never wrong:
`main` contained everything, every merge was verified additive with zero lost changes.

Rules:
- **Never commit or hand-place a JS bundle under `android/app/src/main/assets/`.** It is gitignored now.
  Anything there shadows the generated bundle silently — no warning, no build failure.
- Both Android build scripts enforce this via `scripts/lib/js-bundle.ps1`:
  `Assert-NoStrayJsBundle` refuses to build if the file reappears, and
  `Assert-ArtifactShipsGeneratedBundle` unzips the finished APK/AAB and fails the build unless the
  bundle inside is byte-identical to the one Gradle just generated. A build that prints
  `JS bundle verified:` has proven it. **Do not bypass these to "just get a build out".**
- **When someone reports "my change isn't in the app", check the artifact before you check git.**
  Cheapest possible test — grep the shipped bundle for a string only your new code contains:
  ```
  unzip -p android/app/build/outputs/apk/release/app-release.apk assets/index.android.bundle | grep -c YourNewSymbol
  ```
  Zero means the bundle is stale, and no amount of history archaeology will explain it.
- The same class of bug hits the **web** build: `dist/` is never cleaned by webpack and
  `firebase deploy` uploads the whole folder, so old content-hashed chunks and a stale `index.html`
  stay live. `scripts/deploy-web.ps1` now wipes `dist/` before every build. `-SkipBuild` deliberately
  does not — it exists to redeploy an existing `dist/`.

### 8. NEVER ship an empty `VITE_VC_API_KEY` — this has already cost a release
`src/config/secrets.ts` is gitignored and holds the Nexus (version-control) API key. It is created
from `secrets.example.ts`, whose default is `''`. **An empty key is a valid build, and nothing at
runtime complains.**

This shipped. On 2026-07-31 commit `4fd4864` moved the key out of git — correct on its own, and done
to satisfy a store-guard rule about committed secrets. But the release built afterwards compiled the
empty template value in. 1.0.15 went to Play with no key. For twelve days:
- every `/sdk/version/check` returned `401`, so **force-update and the kill switch did not work** —
  the one mechanism that exists to fix a bad release was itself the thing broken;
- `platformAnalytics.isEnabled()` was `false`, so the app never even attempted to send telemetry;
- and none of it was visible, because version-check failures are swallowed by design and disabled
  telemetry looks identical to telemetry with nothing to say.

**Rules for anyone — human or AI — touching this:**
- **Never** replace a real key with `''`, a placeholder, or `process.env.X` "for safety" without
  confirming the build still resolves a real value. Removing a secret from source is only half the
  job; the other half is proving the release still gets one.
- **Never** commit `src/config/secrets.ts`. It is gitignored deliberately. Set it locally.
- Run `npm run check:store:android` before any release. Rule `both.version-control-key-present`
  fails the build on an empty key. **Do not** disable, skip, or `--force` past that rule.
- If a build must go out without a key, know exactly what you lose: version control still works
  (Nexus falls back to the package name, which the SDK detects natively), but **all engagement
  telemetry is dead** and cannot be recovered for that release.

The key is **not** a secret in the security sense — it ships inside every binary and only identifies
which app is calling. Treat it as a required build input, not a credential to be protected.

Since 1.0.16 both the backend URL and key also come from `/api/platform/config` (see
`src/utils/versionControlConfig.ts`), cached on device, with the compiled values as first-run
fallback. That means a *future* key change needs no release — but the compiled value still has to be
right, because it is what a fresh install uses before its first config fetch.

## Building release artifacts
- "Build the APK" (phone testing) → run `scripts/build-test-apk.ps1 -AppEnv dev` (arm64-v8a only, signed).
  **Always pass `-AppEnv` explicitly** (`dev`, `preprod`, or `prod`) when running this non-interactively —
  without it the script prompts interactively (`Read-Host`) for which backend to target, which will hang
  a scripted/automated invocation. Default to `dev` unless the user asks for a different backend.
- "Build for Play Store" → run `scripts/build-playstore-aab.ps1` (all ABIs, AAB, signed, always APP_ENV=prod).
  **Always pass `-BumpVersion yes` or `-BumpVersion no` explicitly** when running this non-interactively —
  without it the script prompts (`Read-Host`) whether to auto-increment `versionCode`/`versionName` in
  `android/app/build.gradle`, which will hang a scripted/automated invocation. Default to `yes` unless the
  user says otherwise (Play Console rejects re-uploading an already-used version code). After a bump,
  commit + push the `build.gradle` change.
- Both scripts run `git pull --ff-only` first, so they always build the latest committed code. If it
  fails (local changes conflict, or history diverged), surface the error — don't force-push/reset to fix it.
- "Release/deploy/upload/publish the iOS app" or "upload to App Store Connect" → run
  `scripts/release-ios.sh --bump`. **Always pass `--bump` or `--no-bump` explicitly** when running this
  non-interactively — given neither, an interactive run *asks* (default yes, like the Android scripts),
  while a non-interactive one skips the question and does not bump, which then fails at upload with
  ITMS-90062. Default to `--bump` unless the user says otherwise. After a bump, commit + push the
  `ios/GoldKhataBook.xcodeproj/project.pbxproj` change.
  This is the single script covering the whole iOS release: it runs
  `git pull --ff-only`, verifies toolchain/signing/API key, runs App Store guideline + store-guard
  checks, `pod install`, archives, exports the `.ipa`, validates, and uploads to App Store Connect via
  `xcrun altool`. It replaced the old manual Xcode Organizer flow. See README.md >
  "Publishing an iOS Release (App Store Connect)" for the full flag reference and one-time per-machine
  setup (App Store Connect API key). Do not hand-roll `xcodebuild`/`altool` commands or use Xcode
  Organizer while this script works. `--check` and `--dry-run` are safe, no-op verification modes.
- Do NOT run `gradlew clean` unless a build is broken — a plain clean forces a multi-hour full native rebuild across all ABIs.
  To force a fresh **JS bundle** without touching compiled native code (~1–2 min), delete just the asset
  outputs instead — this is what `Reset-ReleaseBundleIfEnvChanged` does and what to reach for if you ever
  suspect a stale bundle:
  ```
  Remove-Item -Recurse -Force android\app\build\intermediates\assets\release
  Remove-Item -Recurse -Force android\app\build\intermediates\merged_assets\release
  Remove-Item -Recurse -Force android\app\build\generated\assets\react\release
  ```
- Both Android scripts verify the finished artifact contains the bundle Gradle just generated (see
  "The artifact must ship *this build's* JavaScript" above). If a build fails with
  `Artifact ships a JS bundle that this build did not generate`, the artifact is not shippable — find
  what is overriding the bundle, do not re-run with the check removed.
- Signing keystore and credentials are machine-local (not committed). See README.md > "Generating a Release Build".
- "Write the release notes" / "what's new for the Play Store / App Store" → run
  `npm run release-notes:play` or `npm run release-notes:ios` (both `--generate`, both cap-checked).
  Do NOT hand-write store copy by skimming `git log` — the range is easy to get wrong and the character
  caps are enforced silently. See README.md > "Writing store release notes". Key points:
  - Run it **after** the version bump, not before. The bump commit is what marks the release boundary:
    we don't tag releases, so the range starts at the commit that set the *previous* `versionCode`
    (Play) or `CURRENT_PROJECT_VERSION` (iOS).
  - **Android and iOS get different ranges** and must get different text. iOS ships less often, so its
    range is normally wider. Never paste the same note into both stores — Play is written to a hard
    500-character cap, the App Store to 4000.
  - The command prints `Assuming <version> has not been uploaded yet…` with a suggested `--from`.
    That assumption is right immediately after a bump and wrong for a platform sitting mid-cycle on an
    already-shipped build (iOS usually is). If the version in the repo already went out, use the
    offered `--from`.
  - Verify the character count it reports rather than asserting the note fits. Exit 1 means it does not.
- Backend environment (dev/preprod/prod API URLs, test vs. real OTP) is defined in
  `src/config/environments/{development,preprod,production}.ts` and selected via the `APP_ENV` build-time
  variable (see README.md > "Controlling which backend a build talks to").
- `APP_ENV` is baked into the JS bundle but is NOT a tracked Gradle input, and the release bundle is
  shared by the test-APK and Play Store paths. So on an incremental build, just changing the env would
  reuse the previously baked bundle (e.g. a `dev` APK still hitting `prod`). The build scripts handle this
  via `scripts/lib/app-env.ps1`: they write the chosen env to a gitignored `.env` (read by `babel.config.js`
  with `override:true` for native, beating a stale Gradle-daemon env) and, when the env differs from
  `android/app/build/last-app-env.txt`, delete the JS-bundle outputs + Metro cache to force a re-bundle
  (~1–2 min, NOT a native `clean`). Don't hand-edit `.env` or the marker to switch env — always go through
  the scripts (or pass `-AppEnv`), otherwise the two can drift.

## Testing policy — deliberately minimal, do not chase coverage

**Do not write tests to raise coverage, and do not write tests for UI.** No
render/component tests, no snapshotting screens, no "add tests for this file".
In a React Native app those need constant native-module mocking, break on every
library bump, and cost far more to maintain than they ever return. No release
script runs jest, so coverage gates nothing.

Proof of how bad that path is: `App.test.tsx` renders the app and has been
failing for a long time. Fixing it means whitelisting every ESM dependency
`App.tsx` reaches, one error at a time — safe-area-context, then gluestack,
then the next. **Delete it rather than repair it.**

**The one carve-out: pure money and weight maths.** Write an executable check
only when

1. a bug has actually reached a customer, and
2. the logic is pure — no rendering, no native modules, no network.

That layer is cheap to check, never flaky, and it is where mistakes cost real
rupees. Two production bugs in Aug 2026 came from it (a Rs.5 rounding drift and
a Rs.4,500 rate divergence between the order screen and the printed bill), and
the checks below are what caught a third, introduced while fixing the second.

What exists, and all that should:
- `__tests__/thermalReceipt.test.ts` — receipt layout, 25 cases + a snapshot.
- `gold-khata-book-backend`: `npm run verify:balance` — runs the real Order pre-save
  hook with no database and fails if the order screen, the printed bill and the
  stored `estimatedBalance` disagree. Run it after touching anything in
  `order.model.ts` or `order.service.ts`.

Everything else is verified on a real device (see "Debugging UI issues on a
physical device") and by the pre-deploy checklist at the top of this file.

## In-app video tutorials

Server-driven, so a video can be swapped, re-ordered or retired **without a store
release**. That indirection is the whole point: YouTube has no "replace file", so a
new recording is always a new video id — if that id lived in the binary, every
re-recording would be a store submission.

- Content: `GET /api/tutorials` (public, unauthenticated — it must work in guest
  mode). Admin writes are behind `authMiddleware + requireAdmin`. Backend module:
  `gold-khata-book-backend/src/modules/tutorial/`.
- **Deliberately NOT part of `/api/platform/config`.** That document is on the
  launch critical path and carries the version-control `backendUrl`/`apiKey` that
  drive force-update and the kill switch. Tutorials are fetched *lazily*, when a
  screen that needs them mounts — never at launch.
- Resolution order mirrors `versionControlConfig.ts`: remote → AsyncStorage cache
  (`tutorials.catalog.v1`, 6h TTL) → bundled `TUTORIAL_FALLBACK`. See
  `src/utils/tutorialsCatalog.ts` and `src/tutorials/catalog.ts`.
- Editing: the **Tutorials tab in `gold-khata-book-web`'s `AdminDashboard.tsx`**. Without
  it, "update anytime, no deploy" means hand-crafted API calls, which is how a
  broken library reaches production. This is the first admin content editor in the
  product.
- Entry points, in order of how many users they actually reach: empty-state links
  (`WatchTutorialLink`), the contextual `?` in a screen header (`HelpIconButton` /
  `CommonHeader helpTopic`), the support FAB, then the Settings row. A Help menu
  alone is opt-in and misses the people who phone instead.
- Per-language videos with an English fallback, surfaced honestly ("In English")
  rather than silently switching. Most users read Marathi/Hindi/Gujarati; a silent
  switch reads as a broken video.
- `minAppVersion`/`maxAppVersion` per tutorial handle a **redesigned screen**, which
  swapping a video does not: after a redesign one video cannot be right for both
  the new build and the users still on the old one. Filtered in the app, not the
  server, so a cached library stays correct across an app update.

**YouTube operational rules** (these break the feature if ignored):
- **Unlisted, never Private.** Private videos cannot be embedded — the player just
  errors.
- After swapping a video, leave the old one Unlisted for **~1 week**. Devices cache
  the library for up to 6h and an offline device far longer; deleting immediately
  gives those users "Video unavailable", which reads as the app being broken.
- One Google account owning **one Brand Account (channel) per product** — not one
  Gmail per product. Keeps a strike or a mistaken bulk delete on one product from
  taking out every app's help system at once.
- The channel structure is invisible to the app (only the 11-character id is
  stored), so a restructure is a config edit, never a release.

## Printing
See `PRINTING.md` — read it before changing anything under `src/print/`, `@page`
CSS, or page size. The four print paths share templates but NOT page geometry, so
a fix to one does not fix the others. Covers the model (`buildPageCss`), the two
bugs that made real printers crop bills, custom paper / pre-printed letterhead and
the tray-registration problem behind it, what is and is not verified on hardware,
and the open items (printed text too small, Chrome dropping background graphics,
4.5MB native PDFs).

## Face ID / biometric app-lock
See `FACE_ID_UNLOCK.md` — architecture, a real-device infinite re-verify loop
bug and its fix (unverified on hardware yet, has a device test checklist),
known open gaps, and a reusable recipe for implementing the same pattern in
another app.

## Debugging UI issues on a physical device
- **iOS: use `scripts/run-ios-device.sh`, never `npm run ios` or the Xcode Run button.** `APP_ENV`
  is baked into the JS bundle by babel and defaults to `prod` when unset, and neither of those sets
  it — so a debug build off a developer's machine silently talks to the production backend and
  writes to real shop data. This is not theoretical: a simulator debugging session on 26 Aug 2026
  was unknowingly pointed at prod for its whole duration. The script pins `APP_ENV` (default `dev`)
  by writing the gitignored `.env` that babel loads with `override:true`. `--device` installs on a
  connected iPhone, `--standalone` builds Release so the phone runs unplugged, `--list` shows
  targets. See README.md > "iOS".
- Don't reach for an Android emulator or a release-APK build to visually check a UI fix — use
  `scripts/run-android-device.ps1` (installs a debug build with Metro/Fast Refresh on a connected
  device, USB or wireless adb) and `scripts/screenshot-device.ps1` (captures the screen to
  `screenshots/*.png` so it can be read/viewed directly) instead. See README.md > "Debugging on a
  Physical Device over Wi-Fi" for one-time wireless-adb pairing steps.
- `-AppEnv` on `run-android-device.ps1` defaults to `dev` (unlike `build-test-apk.ps1`, which
  requires it explicitly) — plain `npm run android`/`react-native run-android` never sets `APP_ENV`
  and silently falls back to `prod`, so always let this script set it rather than running
  `react-native run-android` directly for a debug session.
- For a Wi-Fi-connected device, pass `-ConnectAddress <ip>:<port>` (the phone's Wireless debugging
  "connect" address) so the script reconnects automatically if the Wi-Fi adb session dropped.

## Deploying the web app (Firebase Hosting)
- This repo also builds a web app (react-native-web + webpack) hosted on Firebase (project `PLACEHOLDER-firebase-project`).
- "Deploy" / "deploy the web app" / "push to Firebase" → run `npm run deploy` (or `scripts/deploy-web.ps1`).
  It wipes `dist/`, runs `npm run build` (→ `dist/`), then `firebase deploy --only hosting`.
- The `dist/` wipe is deliberate and must stay: webpack overwrites what it re-emits but never deletes
  what it no longer emits, and `firebase deploy` uploads the entire folder — so orphaned content-hashed
  chunks and a stale `index.html` from earlier builds otherwise stay live indefinitely.
- **A zero exit code does not mean the deploy is correct.** Load the live site and confirm the change is
  actually there — a web bundle can build and deploy cleanly while being wrong (stale `dist/` contents,
  or a native-only import that blanks the page at runtime).
- Auth is a service-account key via the `GOOGLE_APPLICATION_CREDENTIALS` env var. Do NOT run `firebase login`.
  If that env var is unset the script fails fast with setup instructions — surface them, don't try to log in.
- See README.md > "Deploying the web app to Firebase Hosting".

## Tech stack
| Layer | Choice |
|---|---|
| Framework | React Native 0.83 + TypeScript |
| UI components | @gluestack-ui/themed v1 (Box, Text, Pressable, HStack, VStack, etc.) |
| State | Redux Toolkit — `src/store/` |
| Navigation | React Navigation v7 (native-stack + bottom-tabs) |
| i18n | `useTranslation()` hook — `src/hooks/useTranslation.ts` |
| Icons | lucide-react-native |
| Forms | Formik + Yup |
| SVG | react-native-svg (includes SvgXml for rendering SVG strings) |
| Images | react-native-image-picker |
| Print | react-native-print |
| PDF | react-native-html-to-pdf |
| Share | react-native-share |
| Analytics | @codeimplants/analytics |

## Project structure
```
src/
  navigation/
    RootNavigator.tsx   ← switches between AuthNavigator and MainTabs based on auth
    AuthNavigator.tsx   ← Login → Otp stack
    MainTabs.tsx        ← Dashboard / Orders / Customers / Settings bottom tabs
    AppNavigation.tsx   ← DEAD CODE, not mounted. Register screens in RootNavigator.tsx.
    types.ts            ← RootStackParamList, AuthStackParamList
  screens/
    auth/
      LoginScreen.tsx
      OtpScreen.tsx
    dashboard/
      DashboardScreen.tsx
      DashboardHeader.tsx
    dashboardPages/
      OrdersScreen.tsx
      CustomersScreen.tsx
      SettingsScreen.tsx
      AdvanceOrderScreen.tsx
      BillHistoryScreen.tsx
      MetalRatesScreen.tsx
      SalesReportScreen.tsx
    drawer/
      AddShopDetailsScreen.tsx   ← shop details + logo + signature (draw or upload)
      GstScreen.tsx
      ItemsProductsScreen.tsx
      PrintSettingsScreen.tsx
      LanguageScreen.tsx
      AboutUsScreen.tsx
      PrivacyPolicyScreen.tsx
      ContactScreen.tsx
      TermsScreen.tsx
      TutorialsScreen.tsx      ← video tutorial library, content from /api/tutorials
      TutorialDetailScreen.tsx ← YouTube player (WebView native / iframe web)
    invoice/
      CreateInvoiceScreen.tsx
    orders/
      OrderDetailsScreen.tsx      ← advance order detail + payment history + add payment
      SelectCustomerScreen.tsx    ← customer picker used before creating an order
      AdvanceOrderSuccessScreen.tsx
      CompleteAdvanceOrderScreen.tsx
    customers/
      CustomerDetailsScreen.tsx   ← customer profile, stats, order history tabs, edit
  components/
    SignatureModal.tsx      ← draw-your-own signature (PanResponder + SVG paths)
    GuestModeModal.tsx
    LogoutModal.tsx
    OrderTypeModal.tsx
    AddCustomerModal.tsx
    InvoiceCreationScreen.tsx
    InvoicePreviewScreen.tsx
    InvoiceSuccessScreen.tsx
    BillPreview.tsx
    CommonHeader.tsx
    GradientButton.tsx
    StaticPageLayout.tsx
    common/
      DatePickerModal.tsx
      BrandLoader.tsx
      GlobalLoader.tsx
  store/
    index.ts              ← Redux store
    hooks.ts              ← useAppSelector, useAppDispatch
    auth/authSlice.ts     ← phone, isGuest, loading, error, requestOtp, verifyOtp, loginAsGuest
    data/dataSlice.ts     ← orders, customers, shopDetails, metalRates + all thunks
    ui/uiSlice.ts
  hooks/
    useTranslation.ts     ← t() helper
  context/
    LanguageProvider.tsx
  print/
    billTemplate.ts       ← HTML template for invoices
    printService.ts
  utils/
    pdfService.ts
    imageUtils.ts         ← getFullImageUrl()
```

## Navigation pattern
React Navigation with two stacks:
- **Auth stack**: `Login` → `Otp`
- **Main stack (bottom tabs + modal screens)**:
  - Bottom tabs: `Dashboard`, `Orders`, `Customers`, `Settings`
  - Stack screens pushed over tabs: `OrderDetails`, `CustomerDetails`, `SelectCustomer`, `CompleteAdvanceOrder`, etc.

To navigate: `navigation.navigate('OrderDetails', { orderId })`
To go back: `navigation.goBack()`

All screen params are typed in `src/navigation/types.ts` (`RootStackParamList`).

## State — Redux store
Two main slices:

**authSlice** (`store/auth/authSlice.ts`):
- State: `phone`, `isGuest`, `loading`, `error`, `otpRequestedAt`
- Thunks: `requestOtp(phone)`, `verifyOtp({phone, otp})`, `loginAsGuest()`

**dataSlice** (`store/data/dataSlice.ts`):
- State: `orders`, `customers`, `shopDetails`, `metalRates`, `loading`
- Thunks: `fetchOrders`, `fetchCustomers`, `fetchShopDetails`, `addCustomer`, `updateCustomer`, `updateShopDetails`, `addPaymentToAdvanceOrder`, `updateOrderStatus`

Usage:
```ts
const dispatch = useAppDispatch();
const orders = useAppSelector(s => s.data.orders);
dispatch(fetchOrders());
```

## Component patterns
- Use `@gluestack-ui/themed` primitives: `Box`, `Text`, `Pressable`, `HStack`, `VStack`, `ScrollView`, `Input`, `InputField`, `Icon`, `Badge`, etc.
- `SafeAreaView` from `react-native-safe-area-context` with `edges={['top']}`
- Translation: `const { t } = useTranslation()` then `t('key') || 'Fallback'`
- Image URLs: wrap server URLs with `getFullImageUrl(value)` from `utils/imageUtils`
- SVG rendering: `import { SvgXml } from 'react-native-svg'` for SVG string display
- Lucide icons via `import { ArrowLeft } from 'lucide-react-native'` — use as `<ArrowLeft size={20} color="#6B7280" />`

## Signature in AddShopDetailsScreen
The shop details screen supports two ways to set a signature:
- **Draw** — opens `SignatureModal` (PanResponder + SVG), saves SVG XML string
- **Upload** — opens image picker via `launchImageLibrary`, saves image asset

When displaying: check `typeof sig === 'string' && sig.startsWith('<svg')` → use `<SvgXml>`, otherwise use `<Image>`.

## Feature parity with web (reference: mobile is source of truth)
Both platforms must have the same screens. Current status:
| Screen | Mobile | Web |
|---|---|---|
| Login + OTP | ✅ dedicated screens | ✅ inline steps in LoginScreen |
| Guest mode modal | ✅ GuestModeModal | ✅ inline Dialog in LoginScreen |
| Logout confirm | ✅ LogoutModal | ✅ inline Dialog in SettingsPage |
| Dashboard | ✅ | ✅ |
| Orders list | ✅ | ✅ |
| Order details + payment history | ✅ OrderDetailsScreen | ✅ PendingOrders.tsx |
| Select customer (for orders) | ✅ SelectCustomerScreen | ✅ inline in order creation forms |
| Invoice create/preview/success | ✅ | ✅ |
| Advance order create/success/complete | ✅ | ✅ |
| Customer list | ✅ | ✅ |
| Customer details | ✅ CustomerDetailsScreen | ✅ CustomerDetail in CustomerList.tsx |
| Bill history | ✅ | ✅ |
| Sales report | ✅ | ✅ |
| GST settings | ✅ | ✅ |
| Items management | ✅ | ✅ |
| Metal rates | ✅ | ✅ |
| Print settings | ✅ | ✅ |
| Language settings | ✅ | ✅ |
| Shop details | ✅ | ✅ |
| About | ✅ | ✅ |
| Privacy policy | ✅ | ✅ |
| Contact us | ✅ | ✅ |
| Terms & Conditions | ✅ TermsScreen | ✅ TermsAndConditions.tsx |
| Help / Support | ✅ ContactScreen | ✅ HelpPage.tsx |
| Video tutorials | ✅ TutorialsScreen + TutorialDetailScreen | ❌ mobile-only by design |
| Signature capture (draw) | ✅ SignatureModal | ✅ SignatureModal.tsx |

## Reminders
- Platform-specific UX differences (dedicated screen vs inline component) are acceptable — functionality must match
- When adding a new stack screen, register it in **`RootNavigator.tsx`** AND add its params to
  `RootStackParamList` in `navigation/types.ts`. **Not `AppNavigation.tsx`** — that file is dead code
  that nothing imports. Registering there type-checks and builds fine, then fails at runtime with
  *"The action 'NAVIGATE' … was not handled by any navigator"*. This instruction previously named the
  wrong file and cost a build-and-test cycle.
- The app uses `@codeimplants/*` internal packages — do not replace them

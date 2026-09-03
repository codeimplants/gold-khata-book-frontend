# Gold Khata Book Mobile (React Native) - Jewelry Sales Platform

> **Forked from [sonebill-mobile](https://github.com/codeimplants/sonebill-mobile) on 3 Sep 2026.**
> Same codebase, re-pointed at a new product aimed at wholesale users. History
> is not carried over. What deliberately differs from SoneBill:
>
> | Area | Change |
> | --- | --- |
> | Identity | `com.goldkhatabook.app` on both platforms; iOS project, target and scheme renamed `GoldKhataBook`; Android package `com/goldkhatabook/app`. |
> | Version | Reset to 1.0.0 / build 1. SoneBill's 1.0.19 history is not this app's. |
> | Backend | `*.api.goldkhatabook.codeimplants.com`. **These hosts do not exist yet** — see below. |
> | OTP | Dev now sends real SMS, matching prod (the backend's dev-only bypass was removed). |
> | Firebase | Placeholder config. SoneBill's project was **not** inherited, so analytics is off in all environments until a Gold Khata Book project exists. |
> | App Store id | Cleared. It was SoneBill's live listing id, which would have sent every iOS "Update"/"Rate" tap to SoneBill. |
> | Nexus key | `src/config/secrets.ts` is empty; version-control/update checks will not authenticate until it is filled. |
> | Store-guard | Attestations reset to `{}` — SoneBill's sign-offs do not attest anything about this app. Rule *provenance* notes still name SoneBill, on purpose: they record where those rules came from. |
>
> ### Before this app can run end to end
> 1. Provision the backend hosts, or point `src/config/environments/*.ts` at a local one.
> 2. Create a Gold Khata Book Firebase project and replace `android/app/google-services.json`, `ios/GoldKhataBook/GoogleService-Info.plist` and `src/config/firebaseWeb.ts`, then re-enable `ANALYTICS_ENABLED`.
> 3. Generate a fresh release keystore — SoneBill's was not copied.
> 4. UI copy still says "Gold Khata Book" over SoneBill's retail-jeweller wording; the wholesale rework is not done here.


Gold Khata Book Mobile is a high-performance React Native application for shop floor jewelry staff. It's built for high-speed, mobile-first business operations like managing advance orders, customer purchases, and real-time metal rates.

## 🚀 Key App Modules & Features

### 🛍️ Comprehensive Order Management
The mobile app is the primary interface for managing the jewelry order lifecycle:
- **Advance Payments**: Flexible initial payment capture for custom jewelry requests.
- **Dynamic Calculation**: Real-time calculation of remaining weights and estimated balances based on the latest gold rates.
- **Order Tracking**: Visual status updates for `pending`, `completed`, or `cancelled` orders.
- **Unified Completion UI**: Simplified, one-click interface for staff to finalize payments and generate invoices instantly.

### 📄 Professional Billing & Invoicing
- Highly detailed jewelry invoices with support for **Gold**, **Silver**, and other metals.
- Support for **Ornament Exchange** calculations directly on the invoice.
- Auto-generation of **GST (3%)**, **Making Charges**, and **Net Weights**.
- Integration with native share dialogs to send PDF invoices via WhatsApp, Email, or SMS.

### 👥 Customer CRM & History
- Track every customer interaction and purchase history.
- Search and filter customers by name or phone number.
- Attach invoices and orders directly to customer profiles.

### 💹 Market Sync (Metal Rates)
- Staff can quickly update or reference current gold and silver market rates to ensure consistent pricing for every transaction.

---

## 🔑 Environment & Configuration

Which backend a build talks to (dev / preprod / prod, including whether OTP is real or a test code) is
controlled by profile files in `src/config/environments/`, selected by the `APP_ENV` build-time variable:

| Profile | `APP_ENV` | API base URL | OTP |
|---|---|---|---|
| `development.ts` | `dev` | `https://dev.api.goldkhatabook.codeimplants.com/api/` | test/fixed |
| `preprod.ts` | `preprod` | `https://preprod.api.goldkhatabook.codeimplants.com/api/` | test/fixed |
| `production.ts` | `prod` | `https://api.goldkhatabook.codeimplants.com/api/` | **real SMS** |

`APP_ENV` is read by `babel.config.js` (`transform-define` plugin) at bundle time and baked into the JS
bundle — it must be set **before** running Metro/webpack/Gradle, not changed at runtime. `src/config/index.ts`
picks the matching profile and exports `Config`/`API_BASE_URL` from it; defaults to `prod` if unset.

**How to control it when generating a build:**
- `scripts\build-test-apk.cmd` **prompts you interactively** to pick dev/preprod/prod each time you run it
  (defaults to `dev` on Enter) — see [Local phone testing](#local-phone-testing-apk) below.
- To skip the prompt (scripting/CI/AI), pass it explicitly: `scripts\build-test-apk.cmd -AppEnv preprod`.
- `scripts\build-playstore-aab.cmd` always builds `prod` — Play Store releases should never point elsewhere.
- For the web app (`npm run build` / `npm run dev`), set `APP_ENV` in a `.env` file (see [.env.example](.env.example)).

**Why switching env needs a JS re-bundle (and how the scripts handle it):**
`APP_ENV` is baked into the JS bundle at bundle time, but it is *not* a tracked Gradle input, and the
release bundle (`android/app/build/generated/assets/react/release/index.android.bundle`) is shared by
`assembleRelease` (test APK) and `bundleRelease` (Play Store, always `prod`). On an incremental build
(no `gradlew clean`), Gradle treats the JS-bundle task as up-to-date and **reuses the previously baked
bundle** — so just picking a different env would ship the *old* env (e.g. a `dev`-selected APK still
hitting `prod` and sending real OTPs). To make env selection deterministic, the build scripts
(`build-test-apk.ps1`, `build-playstore-aab.ps1`, `run-android-device.ps1`) now:
- write the chosen `APP_ENV` to a gitignored `.env`, which `babel.config.js` reads with `override:true`
  for native builds — so the value is baked correctly even if a reused Gradle daemon spawns the bundler
  with a stale environment; and
- via [scripts/lib/app-env.ps1](scripts/lib/app-env.ps1), compare the requested env against
  `android/app/build/last-app-env.txt` and, **only when it changed**, delete the JS-bundle outputs and
  the Metro cache to force a fresh bundle (a ~1–2 min re-bundle — native code stays compiled, this is
  *not* a full `gradlew clean`). Repeat builds of the same env stay fast.

---

## 🛠️ Technical Stack & Dependencies

### Core
- **Framework**: React Native 0.83.2
- **State Management**: Redux Toolkit for central data flow and state persistence.
- **Forms**: Formik for robust, multi-step jewelry forms.
- **Validation**: Yup for real-time decimal and weight validation.
- **Navigation**: React Navigation 7.x with native-stack and bottom-tab support.

### UI & Aesthetics
- **Design System**: @gluestack-ui for high-quality, modern, and accessible components.
- **Icons**: Lucide React Native for a crisp, modern look.
- **Typography**: Custom fonts configured for premium jewelry branding.

### Native Integration
- **Image Handling**: `react-native-image-picker` for capturing shop and product photos.
- **PDF & Printing**: Support for high-quality PDF generation and thermal printer connectivity.
- **Storage**: `@react-native-async-storage` for secure local session persistence.

---

## 📁 Detailed App Directory Plan

```
gold-khata-book-frontend/
├── src/
│   ├── api/            # API services, interceptors, and endpoint wrappers
│   ├── components/     # Reusable UI atoms, molecules, and organisms
│   ├── config/         # App configuration profile management
│   ├── navigation/     # App routing stack and navigation logic
│   ├── screens/        # Main application screens (Dashboard, Orders, Invoice, CRM)
│   ├── store/          # Redux Toolkit store, slices, and selectors
│   ├── utils/          # Formatting helpers (Currency, Weights, Date)
│   └── theme/          # Global gluestack-ui theme and custom styling
├── android/            # Native Android codebase and build configs
├── ios/                # Native iOS codebase and build configs
├── .env.example
├── app.json
└── package.json
```

## 🏃 Build & Setup

### 📦 Install 
```bash
npm install
```

### 📱 Android
```bash
# Start Metro bundler
npm start

# Run on emulator/connected device
npm run android
```

### 🍎 iOS
```bash
# Install pods
cd ios && pod install && cd ..

# Run on a simulator or a connected iPhone, against the dev backend
./scripts/run-ios-device.sh              # simulator
./scripts/run-ios-device.sh --device     # connected iPhone
```

**Use the script rather than `npm run ios` / the Xcode Run button.** `APP_ENV` is baked into the
JS bundle by babel and **defaults to `prod` when unset** — neither `npm run ios` nor Xcode sets it,
so a debug build off your machine silently talks to the production backend and writes to real shop
data. `run-ios-device.sh` always pins it, and defaults to `dev`.

| Flag | Effect |
|---|---|
| `--app-env dev\|preprod\|prod` | Which backend to bake in. Default `dev`. |
| `--device [UDID]` | Install on a connected iPhone. Auto-detects if the UDID is omitted. |
| `--sim ["NAME"]` | Install on a simulator (default `iPhone 17`). |
| `--standalone` | Build Release, so the JS is baked in and **the phone runs unplugged**. |
| `--list` | Show connected devices and booted simulators. |

`--standalone` is what decides whether the phone can leave your desk. A normal debug build fetches
its JavaScript from Metro at launch, so this machine has to stay reachable. `--standalone` bakes the
JS into the app — cable out, Metro closed, still works — and is also the only mode that reflects
release behaviour (`console.log` stripped, Hermes optimizations, ATS enforced).

---

## 🔌 Debugging on a Physical Device over Wi-Fi

For iterating on a UI bug (e.g. visually checking layout) it's faster and more reliable to run a
**debug** build with Metro/Fast Refresh on your actual phone than to use an Android emulator or a
full signed release build. This works over Wi-Fi (wireless adb), so no USB cable/driver is needed -
useful on machines where USB is locked down (e.g. an office PC).

> **For AI assistants:** use `scripts\run-android-device.ps1` (installs the debug build with Fast
> Refresh) and `scripts\screenshot-device.ps1` (captures the current screen to `screenshots/` for
> visual inspection) instead of an emulator or the release-APK scripts when debugging a UI issue.
> `-AppEnv` defaults to `dev` here (opposite of `build-test-apk.ps1`, which requires it explicitly).

### One-time setup (per phone, Android 11+)
1. On the phone: Settings → About phone → tap "Build number" 7× to unlock Developer options.
2. Settings → System → Developer options → enable **Wireless debugging**.
3. Tap into "Wireless debugging" → **Pair device with pairing code** → note the IP:port and 6-digit
   code shown (this is a separate, one-time-use port - different from the main screen's port).
4. On the PC:
   ```powershell
   adb pair <pairing-ip>:<pairing-port>
   ```
   Enter the 6-digit code when prompted. You should see `Successfully paired to ...`.
5. Back on the phone's main "Wireless debugging" screen, note the **connect** IP:port (a different,
   longer-lived port than the pairing one), then:
   ```powershell
   adb connect <connect-ip>:<connect-port>
   ```
6. `adb devices` should now list the device as `device` (not `unauthorized`/`offline`).
7. If the Wi-Fi network has client isolation (common on corporate/guest SSIDs - devices can't reach
   each other even on the same Wi-Fi), pair over a personal mobile hotspot instead.

Wireless adb connections drop when idle or if the phone's Wi-Fi reconnects - re-run `adb connect
<connect-ip>:<connect-port>` (no need to re-pair) when that happens. Pass the address to
`run-android-device.ps1 -ConnectAddress` to have it reconnect automatically each run.

### Debug loop
```powershell
# Install + launch the debug build with Fast Refresh (idempotent - safe to re-run)
scripts\run-android-device.cmd -ConnectAddress 192.168.0.107:38951

# Capture the current screen for visual inspection
scripts\screenshot-device.cmd
```
Edit code, let Fast Refresh apply it, then re-run `screenshot-device.cmd` to see the result - no
rebuild/reinstall needed unless native code changed.

---

## 📦 Generating a Release Build (APK / AAB)

> **For AI assistants / automation:** when asked to "build the APK", run `scripts/build-test-apk.ps1`.
> When asked to "build for the Play Store", run `scripts/build-playstore-aab.ps1`. Do **not** hand-write
> the raw `gradlew` commands or run `gradlew clean` unless a build is actually broken — a plain `clean`
> forces a full native rebuild for every CPU architecture, which can take hours.

There are two build targets, each with a one-command script (Windows PowerShell):

| Goal | Command | Output | ABIs | Typical time |
|---|---|---|---|---|
| **Install on a physical Android phone** | `scripts\build-test-apk.cmd` | `android/app/build/outputs/apk/release/app-release.apk` | `arm64-v8a` only | ~2 min incremental, ~15 min cold |
| **Upload to Google Play Store** | `scripts\build-playstore-aab.cmd` | `android/app/build/outputs/bundle/release/app-release.aab` | all 4 | slower (all ABIs) |

Both scripts run `git pull --ff-only` before building (so you always build the latest committed code),
then produce a **signed** release build and append a line (duration + size) to `build-times.log`.
Pass `-SkipPull` to skip the pull (e.g. offline, or intentionally testing an older commit).

### Local phone testing (APK)
```powershell
# from the project root
scripts\build-test-apk.cmd
# or:  powershell -File scripts\build-test-apk.ps1
```
Prompts you to pick which backend to build against:
```
Which backend should this test APK point to?
  1) dev      - https://dev.api.goldkhatabook.codeimplants.com (test OTP)
  2) preprod  - https://preprod.api.goldkhatabook.codeimplants.com (test OTP)
  3) prod     - https://api.goldkhatabook.codeimplants.com (REAL OTP - real users)
Enter 1-3 (default: 1/dev)
```
Press Enter for `dev` (the common case), or pass `-AppEnv preprod`/`-AppEnv prod` to skip the prompt entirely.

Then copy `app-release.apk` to your phone and tap it to install (enable "Install from unknown sources" if prompted).
Only `arm64-v8a` is built because every modern Android phone uses it — this is the single biggest build-time saver.

### Play Store release (AAB)
```powershell
scripts\build-playstore-aab.cmd -Clean
```
Upload the resulting `app-release.aab` in the [Google Play Console](https://play.google.com/console).
Use `-Clean` before a real store upload to guarantee a fresh build. All four ABIs are included so every device is covered.

### One-time signing setup (required for release builds)
Release builds are signed with a keystore that is **deliberately not committed** (it's a secret).
Each developer / CI machine needs two things locally:

1. **The keystore file** at `android/app/goldkhatabook-release.keystore` (ignored by git — obtain it from the team, or for local testing only, generate your own):
   ```powershell
   & "C:\Program Files\Java\jdk-17\bin\keytool.exe" -genkeypair -v -storetype PKCS12 `
     -keystore android\app\goldkhatabook-release.keystore -alias goldkhatabook-key `
     -keyalg RSA -keysize 2048 -validity 10000
   ```
   > ⚠️ A **newly generated** keystore can only be used for local testing. Publishing an update to an
   > existing Play Store listing requires the **original** keystore — losing it means you cannot update the app.

2. **Signing credentials** in your machine-local `~/.gradle/gradle.properties` (outside the repo, never committed):
   ```properties
   MYAPP_UPLOAD_STORE_FILE=goldkhatabook-release.keystore
   MYAPP_UPLOAD_KEY_ALIAS=goldkhatabook-key
   MYAPP_UPLOAD_STORE_PASSWORD=your-store-password
   MYAPP_UPLOAD_KEY_PASSWORD=your-key-password
   # Optional: pin the JDK if it isn't on your PATH
   # org.gradle.java.home=C:/Program Files/Java/jdk-17
   ```

### Build performance notes
- `org.gradle.parallel` and `org.gradle.caching` are enabled in [android/gradle.properties](android/gradle.properties) — incremental rebuilds are typically 1–2 minutes.
- The project targets React Native's New Architecture, so the native C++ layer is compiled per ABI. Building all four ABIs (as the AAB does) is inherently slower than the single-ABI test APK.

---

## 🍎 Publishing an iOS Release (App Store Connect)

> **For AI assistants / automation:** when asked to "release/deploy/upload the iOS app" or "publish to
> the App Store", run `scripts/release-ios.sh --bump` — pass `--bump` (or `--no-bump`) **explicitly**,
> since a non-interactive run skips the question rather than asking it, and skipping means no bump.
> It pulls latest, bumps the build number, runs
> the App Store guideline + store-guard checks, builds, and uploads to App Store Connect in one command.
> The only steps left after that are inside App Store Connect itself (screenshots, release notes,
> "Add for Review"). Do not use Xcode Organizer by hand, and do not hand-roll `xcodebuild`/`altool`
> commands, unless this script is broken.

`scripts/release-ios.sh` is the **single script that runs the whole process**: it replaced the old
manual Xcode Organizer flow (which burned two builds on validation errors for 1.0.10). One command does:
`git pull --ff-only` → verify toolchain/signing/API key → App Store guideline + store-guard checks →
`pod install` → archive → export `.ipa` → validate → upload.

### One-time setup (per machine)
1. Copy the config template and fill in your App Store Connect API key:
   ```bash
   cp scripts/release-ios.config.example.sh scripts/release-ios.config.sh
   ```
2. Create an API key in **App Store Connect → Users and Access → Integrations → App Store Connect API →
   Team Keys**. Role must be **App Manager** — Developer is not sufficient to upload builds.
3. The `.p8` file downloads **once** and can never be re-downloaded. Save it to:
   ```bash
   ~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8
   chmod 600 ~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8
   ```
4. Fill in `APP_STORE_KEY_ID` and `APP_STORE_ISSUER_ID` in `scripts/release-ios.config.sh` (both shown
   on the same API Keys page).
5. Make sure Xcode is signed in (**Xcode → Settings → Accounts**) — signing is cloud-managed for this
   project, so no local certificate/provisioning profile setup is needed.
6. If CocoaPods fails, see `POD_RUBY_BIN` in `release-ios.config.sh` — since Expo was added the
   Podfile needs Ruby 2.7+, so it points at Homebrew's Ruby, not macOS system Ruby.

### Sequence: take latest and ship a release
```bash
# 1. (optional) confirm the machine is ready — toolchain, signing, API key.
#    Also pulls latest, so it doubles as "is main safe to build from right now?"
./scripts/release-ios.sh --check

# 2. (optional) see exactly what a real run would do, without doing it
./scripts/release-ios.sh --dry-run

# 3. Ship it: pulls latest, asks whether to bump the build number (default yes),
#    builds, uploads to App Store Connect
./scripts/release-ios.sh

#    Or answer the question up front — required when running this non-interactively:
./scripts/release-ios.sh --bump

# If the user-facing version number also changed (not just the build):
./scripts/release-ios.sh --version 1.0.14 --bump
```
Steps 1–2 are sanity checks, not required — step 3 alone does the entire pull-through-upload sequence.

Then, in **App Store Connect** (deliberately not automated — these are judgement calls):
1. Wait for the build to finish processing (10–60 min).
2. Attach the build to the version — check the build **number**, it can default to an older one.
3. Add screenshots and release notes.
4. **Add for Review.**

### Flags
| Flag | Effect |
|---|---|
| `--check` | Verify prerequisites only (also pulls latest). Builds/uploads nothing. |
| `--bump` | Increment the build number (`CURRENT_PROJECT_VERSION`). Almost always wanted — Apple rejects a reused build number (`ITMS-90062`). Not the silent default because it edits a tracked file: with neither `--bump` nor `--no-bump`, an interactive run **asks** (default yes), the way `build-playstore-aab.ps1` asks about `versionCode`. |
| `--no-bump` | Archive the build number as it stands, without being asked. Pass this or `--bump` explicitly when scripting: with no terminal on stdin the question is skipped, and skipping means no bump. |
| `--version <x>` | Also set the marketing version, e.g. `1.0.14`. Must be higher than the live App Store version. |
| `--no-upload` | Stop after producing the `.ipa` (for manual upload via Xcode Organizer). |
| `--skip-pods` | Skip `pod install` — faster when native deps haven't changed. |
| `--skip-preflight` | Skip the App Store guideline / store-guard checks. Only when a specific failure has been judged acceptable for this submission. |
| `--skip-pull` | Skip the leading `git pull --ff-only`; build whatever is on disk as-is. |
| `--dry-run` | Print every step that would run; make no changes. |

### Troubleshooting
- **`git pull failed`** — local changes conflict with incoming commits. Commit or stash them
  (`git stash push -u`), then re-run — or pass `--skip-pull` to build the working tree as-is.
- **CocoaPods fails parsing the Podfile / `undefined method 'filter_map'`** — CocoaPods is running
  under macOS system Ruby (2.6.10). `use_expo_modules!` needs Ruby 2.7+, so `POD_RUBY_BIN` in
  `release-ios.config.sh` must point at Homebrew's Ruby (`/opt/homebrew/bin`). Install with
  `brew install cocoapods`. Note the script runs a bare `pod`, not `bundle exec` — the bundled gems
  are stranded under system Ruby and `Gemfile.lock` pins Bundler 1.17.2, which cannot run on Ruby 3.2+.
- **`store-guard` fails (hardcoded credential / API key found)** — run `npm run check:store:ios` for
  the exact file and line. Fix the leak before shipping; treat as a real blocker, not a false positive,
  unless you've specifically verified otherwise.
- **`ITMS-90062` (build number already used)** — you answered `n` at the bump prompt (or passed
  `--no-bump`), ran non-interactively without `--bump` so the question was skipped, or re-ran after an
  interrupted upload reused the same number. Re-run with `--bump`.
- **No local signing identities, but not using cloud-managed signing** — sign into Xcode
  (**Xcode → Settings → Accounts**) or check the identity in Keychain Access.

---

## 📝 Writing store release notes

Both stores want a "what's new" text with every release, and both punish getting it wrong: Google Play
**silently refuses to save** more than 500 characters, and finding that out costs a round trip to the
console. `scripts/release-notes` works out what shipped since the last release and turns it into copy
you can paste, checked against the cap before you see it.

```bash
npm run release-notes           # what shipped since the last release, nothing else
npm run release-notes:play      # Play Store notes, written and cap-checked
npm run release-notes:ios       # App Store notes, written and cap-checked
```

Run it **after** the version bump — i.e. after `build-playstore-aab.ps1 -BumpVersion yes` or
`release-ios.sh --bump` — because the bump is what marks the release boundary (see below).

### How it knows what "since the last release" means

We don't tag releases, so the boundary is inferred from the version number, which is the one thing a
release always changes. In order: an explicit `--from`, then a release-shaped git tag, then the commit
that set the **previous** version — `versionCode` in `android/app/build.gradle` for Play,
`CURRENT_PROJECT_VERSION` in the Xcode project for iOS. (If we ever start tagging releases, tags simply
start winning; nothing needs changing.)

Only the *build code* counts, never the user-facing name: both stores force the code to change on every
upload, while `versionName`/`MARKETING_VERSION` moves for other reasons. So the two platforms usually
get **different ranges** — iOS ships less often, so its range is normally the wider one.

Git records the version bump but never the upload, so the command assumes the version currently in the
repo has not shipped yet, and says so:

```
Assuming 1.0.15 (9) has not been uploaded yet. If it has, the range is too
wide — start where it was set instead: --from f9190b1
```

That holds if you bump-then-write. It does **not** hold for a platform sitting mid-cycle on a build that
already went out — which iOS normally is between releases. If the version in the repo has shipped, take
the `--from` the command offers you.

### What is automated and what isn't

The script does the mechanical half: resolve the range, pull the commits and their bodies, drop merges,
split real changes from `ci:`/`build:`/`chore:`/version-bump noise, and lay it out as a brief carrying
that store's rules. The prose is left to a model, because pattern-matching commit subjects produces notes
that read like `fix(customers): exclude deleted orders from stats` at a jeweller.

`--generate` pipes the brief through your local `claude` CLI, so it needs no API key of its own. Without
it, the brief goes to stdout and you can paste it into any model. Either way the result is measured
against the store's cap, and an over-length draft is sent back to be trimmed before you ever see it.

The two stores get deliberately different instructions — Play is written to the 500-character wall, the
App Store is written to fill its 4000 — so **don't paste the same text into both**.

### Also useful

```bash
npm run release-notes -- --check whats-new.txt   # count a note you wrote by hand
npm run release-notes -- --from <ref> --ios      # override the range
npm run release-notes -- --json                  # range + classified commits, for scripting
```

Exit codes: `0` clean, `1` nothing to release or still over the cap, `2` bad usage. It is read-only —
safe to run against a dirty tree mid-release. Full reference: `scripts/release-notes/README.md`.

---

## 🌐 Deploying the web app to Firebase Hosting

This repo also builds a **web** version (via `react-native-web` + webpack) that is hosted on
**Firebase Hosting** (project `PLACEHOLDER-firebase-project`). `npm run build` compiles the web bundle into `dist/`,
which is what [firebase.json](firebase.json) serves.

> **For AI assistants / automation:** to deploy the web app, run `npm run deploy`
> (requires `GOOGLE_APPLICATION_CREDENTIALS` set — see setup below). Do **not** run `firebase login`.

### Deploy (one command)
```powershell
npm run deploy
# or the friendlier wrapper (prints the live URL, checks credentials first):
scripts\deploy-web.cmd
# deploy the already-built dist/ without rebuilding:
scripts\deploy-web.cmd -SkipBuild
```
Both build the web bundle and deploy it. On success the app is live at **https://PLACEHOLDER-firebase-project.web.app**.

### One-time setup — service account (no browser login)
Deployment authenticates with a Firebase **service-account key** via an environment variable, so you
never run the interactive `firebase login`. Set this up once per machine:

1. **Firebase Console** → ⚙️ Project settings → **Service accounts** → **Generate new private key**
   (log in with the *code implants* account). This downloads a JSON key.
   - For least privilege you can instead create a dedicated service account in GCP IAM with the
     **Firebase Hosting Admin** role and download its key.
2. Save the JSON **outside the repo**, e.g. `C:\Users\<you>\.firebase\goldkhatabook-deploy.json`.
   > ⚠️ Never commit this key. `.gitignore` already blocks common key filename patterns as a safety net.
3. Point the Firebase CLI at it with a persistent user environment variable:
   ```powershell
   setx GOOGLE_APPLICATION_CREDENTIALS "C:\Users\<you>\.firebase\goldkhatabook-deploy.json"
   ```
   Open a **new** terminal afterward (so the variable is loaded), then `npm run deploy` works unattended.

The Firebase CLI (`firebase-tools`) is pinned as a dev dependency, so `npm install` provides it — no
global install needed.

---

## 📜 Authors & Copyright
- **Creators**: Code Implants Software Technologies Pvt. Ltd.
- **Contact**: codeimplants@gmail.com

© 2026 Gold Khata Book. All rights reserved.

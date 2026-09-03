# Testing on a Real Device

Some bugs (Face ID, printing, WhatsApp share, PDF file paths — see `CLAUDE.md` > "iOS-only, checked on
real hardware") cannot be reproduced on a simulator/emulator. This doc covers connecting a physical
iPhone or Android phone and running a debug build on it.

## iOS (Face ID, printing, share, etc.)

### One-time setup per phone
1. Connect the iPhone via USB.
2. On the phone, tap **Trust This Computer** if prompted, and enter the passcode.
3. Enable Developer Mode: **Settings → Privacy & Security → Developer Mode** → toggle on. The phone will
   ask to restart — do that, then unlock the phone again. Without this, Xcode times out trying to reach
   the device with `Developer Mode disabled` as the error.
4. In Xcode, open `ios/GoldKhataBook.xcworkspace` once and make sure your Apple ID / signing team is selected
   under the `GoldKhataBook` target's **Signing & Capabilities** tab, so the debug build can be signed for
   your device.

### Find the device ID
```sh
xcrun xctrace list devices
```
Look under `== Devices ==` for your phone, e.g.:
```
Prasad (26.5.2) (00008140-0004302E2111801C)
```
The value in parentheses is the UDID.

### Run a debug build
From the `gold-khata-book-frontend` repo root, with the phone connected and unlocked:
```sh
npx react-native run-ios --udid <UDID>
```
This builds, installs, and launches a debug build with Metro/Fast Refresh attached, so `console.log`
and reloads work live. If Metro doesn't auto-start (headless/CI-like shells), start it separately in
another terminal:
```sh
npm start
```

### Common build failure
`xcodebuild: error: Timed out waiting for all destinations... Developer Mode disabled` → go back to
step 3 above.

### Face ID specifics
- The Simulator has no Secure Enclave — key generation/signing behave differently there, so Face ID
  bugs must be tested on real hardware, not the Simulator.
- `NSFaceIDUsageDescription` must be present in `ios/GoldKhataBook/Info.plist` or the app hard-crashes the
  instant a biometric API is called, with no JS error.
- Relevant code: `src/hooks/useBiometric.ts`, `src/screens/security/BiometricLockScreen.tsx`,
  `src/store/security/securitySlice.ts`, `src/components/BiometricsEnableModal.tsx`,
  `src/utils/biometricPromptState.ts`.

## Android

Use the existing scripts instead of plain `npm run android` — they set `APP_ENV=dev` correctly (plain
`react-native run-android` silently falls back to `prod`):
```sh
scripts/run-android-device.ps1
scripts/screenshot-device.ps1   # captures screen to screenshots/*.png
```
These require PowerShell (`pwsh`) and `adb` on your machine. For wireless debugging setup and the
`-ConnectAddress` flag, see `README.md` > "Debugging on a Physical Device over Wi-Fi".

## Do not test biometrics/printing/share/PDF via a release build for iteration

Release builds strip `console.log` and take much longer to produce. Use the debug-on-device flow above
while iterating; only fall back to a release-artifact install (see `CLAUDE.md` > "Building release
artifacts") to confirm the final fix in the actual shipped configuration before deploying.

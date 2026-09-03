# Store listing assets

Screenshots and graphics submitted to the App Store and Google Play, kept in the
repo so the listing can be traced back to the release it was taken from.

**Not the same as `screenshots/` at the repo root.** That one is gitignored and
holds throwaway captures from `scripts/screenshot-device.ps1` for visual
debugging. This folder is committed. `.gitignore` re-includes it explicitly,
because the `screenshots/` pattern otherwise matches at any depth.

```
store-assets/
  screenshots/
    ios/
      iphone-6.9/     Required. Apple scales these down for smaller iPhones.
      ipad-13/        Required — store-guard profile has supportsTablet: true.
    android/
      phone/          Required.
      tablet-7/       Required if the Play listing declares tablet support.
      tablet-10/      Required if the Play listing declares tablet support.
  graphics/           Play feature graphic, and any promo art.
```

## Sizes

Store requirements change. **Verify against the links before a submission**
rather than trusting this table — it was written 2026-08-17.

| Target | Portrait pixels |
|---|---|
| iPhone 6.9" | 1290 × 2796 or 1320 × 2868 |
| iPad 13" | 2048 × 2732 or 2064 × 2752 |
| Android phone/tablet | each side 320–3840, and the long side at most **2×** the short side |
| Play feature graphic | 1024 × 500 |

- Apple: https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/
- Play: https://support.google.com/googleplay/android-developer/answer/9866151

Apple no longer requires the older 6.5" and 5.5" sets — 6.9" is scaled down to
cover smaller devices. iPad is separate and is **not** covered by that scaling.

Play's two constraints that bite: the 2× rule above (9:16 is a recommendation,
not the limit — but a modern phone capture is taller than 2:1 and *is* rejected),
and **"JPEG or 24-bit PNG (no alpha)"**, which rules out a raw RGBA capture.

## Deriving the Android set from the iOS one

Both platforms run the same React Native screens, so the Play set is generated
from the committed iOS captures rather than shot separately:

```powershell
powershell -File store-assets\make-play-screenshots.ps1
```

It crops the iOS status bar (Dynamic Island included) off the top and the
home-indicator gap off the bottom, which both removes the only iOS-specific
pixels in the frame *and* brings 1320 × 2868 down to 1320 × 2628 — under Play's
2× cap. Everything is redrawn into a 24bpp surface over white to drop the alpha
channel. iPad 13" is already 4:3, so it only loses the status bar and the
rounded-corner arcs; the same file goes into both Play tablet slots.

Re-run it after re-capturing iOS, and check one output by eye — the crop
constants are tuned to the current header height, not measured per image.

## Capturing

iOS, from a booted simulator at the right device size:

```bash
xcrun simctl io booted screenshot store-assets/screenshots/ios/iphone-6.9/01-dashboard.png
```

Use a simulator whose native resolution already matches the table above
(iPhone 17 Pro Max for 6.9", iPad Pro 13" for iPad) so nothing needs resizing.
`xcrun simctl list devices` shows what is installed.

Android, from a connected device:

```powershell
powershell -File scripts\screenshot-device.ps1 -OutFile store-assets\screenshots\android\phone\01-dashboard.png
```

## Before capturing

The debug overlay and any test data end up in the image, so:

- Build **release**, or at least dismiss the "Open debugger to view warnings" toast
- Use realistic shop data — not `test`, `asdf`, or a 2000-entry generated phone book
- Turn off the update modal path, or dismiss it before capturing
- Check the status bar: full signal and battery look deliberate, `11:47` does not matter

## Naming

`NN-screen.png`, numbered in the order they should appear in the listing:

```
01-dashboard.png
02-create-invoice.png
03-old-gold.png
04-customers.png
05-photos.png
```

## History

- **1.0.16** (Aug 2026) — submitted with the pre-redesign screenshots still in
  place. 1.0.16 changed photo upload, the update modal and contact selection, so
  the live listing is behind the app until these are refreshed. This folder was
  created to stop that recurring.

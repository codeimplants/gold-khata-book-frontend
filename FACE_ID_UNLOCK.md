# Face ID unlock loop — resolved

**Superseded.** The full, current documentation now lives in:

- [`dev-help/biometric-app-lock.md`](dev-help/biometric-app-lock.md) — how the feature works,
  the expected-behaviour contract, and the rules for editing it
- [`dev-help/ai/ios-biometric-lock-implementation.md`](dev-help/ai/ios-biometric-lock-implementation.md)
  — portable implementation spec for reusing app lock in other apps

This file is kept only to record what was tried, because the failed attempt is the
most useful part of the history.

## What was wrong

Presenting the Face ID sheet drives the app `active → inactive → active`. The resume
handler in `App.tsx` treated *any* `inactive → active` transition as "the user left and
came back", so dismissing the unlock sheet re-locked the app, which remounted
`BiometricLockScreen`, which re-prompted — forever, on both success and the passcode
fallback. The original diagnosis of the mechanism (the sheet's dismissal animation emits
its `active` *after* LAContext has already resolved the JS promise) was correct.

## What did NOT work

Delaying the clear of `promptInFlight` by a grace period (`TRAILING_BLIP_GRACE_MS`,
1500ms) so the late event would land while the flag was still set.

**This was tried and verified NOT to work on a physical iPhone.** The trailing event
still escaped. Do not retry it, and do not tune the delay upward: the trailing event has
no bounded upper delay, and the passcode fallback widens the gap by however long the user
takes to type. Any fixed window is a guess that loses the race on some device.

## What actually fixed it

Re-locking is now gated on the app having genuinely reached the **`background`** state,
tracked by a `hasBackgrounded` ref in `App.tsx`. The biometric sheet only ever reaches
`inactive`; every real hand-off — home swipe, app switcher, screen off — passes through
`background`. This is a state check rather than a timing guess, so it cannot race.

`biometricPromptState.ts` was returned to a plain synchronous flag. It remains as a
secondary guard that suppresses wasted resume work while a sheet is up, and is
explicitly *not* what prevents the loop.

A broader trigger was also found during testing: **any system permission dialog**
(Bluetooth, photos, contacts) produces the same `inactive → active` transition and could
re-lock the app. The `background` gate covers that whole class too.

## Gaps from the original document — now closed

- **Cold launch did not lock** (gap #3 in the original). Fixed: a once-per-launch effect
  in `App.tsx` activates the lock after both the auth and security slices hydrate.

## Verification status

Verified on a physical iPhone (Face ID): background resume via face and via passcode
fallback, cancel, force-quit cold start, phone lock/unlock, and the Settings toggle.

**Android is unverified.** The code is shared, but Android reports no `inactive` state and
its credential fallback launches a separate activity that RN reports as a real
`background` — see the Android caveat in `dev-help/biometric-app-lock.md` before testing.

# Biometric App Lock (Face ID / Touch ID / Fingerprint) — How It Works

Plain-English guide to the app-lock feature: what it does, which phones support what, how the
pieces fit together, and the one bug that keeps coming back if you edit it carelessly.

For a step-by-step spec to implement this in another app, see
[`ai/ios-biometric-lock-implementation.md`](ai/ios-biometric-lock-implementation.md).

---

## What the feature does

If the user turns on app lock, then **leaves the app and comes back**, they must pass Face ID /
fingerprint (or the phone's passcode) before seeing their data again. It protects a session that is
already logged in — it is not a login method, and it never talks to our backend.

## Expected behaviour

This is the contract. If any row of this table stops holding, it is a bug.

| The user does this | App lock should… | Why |
|---|---|---|
| Force-quits the app, reopens it | **Prompt**, before any data is visible | Otherwise the lock is bypassed by closing and reopening |
| Swipes home / switches to another app, comes back | **Prompt** | The phone left their hands |
| Locks the phone with the app open, unlocks the phone | **Prompt** | Same — the session was exposed |
| Passes the prompt (face, fingerprint, or passcode) | **Unlock and stay unlocked** | Re-prompting here is the loop bug — see below |
| Cancels the prompt | **Stay locked**, show "Try Again" | Never auto-retry; it burns the OS attempt budget |
| Turns the toggle on in Settings | **Not** lock immediately | Locking them out of the screen they're standing on |
| Briefly peeks at the app switcher and comes straight back | Does **not** prompt | Deliberate trade-off — see "Known trade-off" |
| Has a phone with no biometric hardware | Falls back to device passcode/PIN | Nobody may be locked out of their own data |

## Platform status

The implementation is **shared** — there is no `Platform.OS === 'ios'` branch anywhere in the
biometric code. Both platforms run the same logic, guarded only against web.

- **iOS — verified** on a physical iPhone (Face ID), all rows above.
- **Android — not yet verified.** The code is live there, but see "Android caveat" at the bottom of
  this document before assuming it behaves identically. One path carries real risk.

---

## "Face unlock" and older iPhones — which phones have what

This is worth understanding, because "Face ID" is not available everywhere and the feature is
**not** Face-ID-specific.

| Phone | Biometric hardware | What our app shows |
|---|---|---|
| iPhone X and newer (X, XR, XS, 11, 12, 13, 14, 15, 16, 17…) | **Face ID** | Face scan |
| iPhone 8 / 8 Plus and older, back to 5s | **Touch ID** (fingerprint home button) | Fingerprint |
| iPhone SE — all generations (2016, 2020, 2022) | **Touch ID** | Fingerprint |
| iPhone 5 / 5c and older | none | Passcode only |
| Most Android phones | fingerprint, sometimes face | Fingerprint / device PIN |

Key points:

- **Face ID arrived with the iPhone X in 2017.** Anything older uses the Touch ID fingerprint
  sensor in the home button instead. The budget SE line kept Touch ID for years after, so a
  recently-bought phone is not automatically a Face ID phone.
- **We never hard-code Face ID.** `useBiometric().checkAvailability()` asks the OS what the device
  actually has and returns a label — `Face ID`, `Fingerprint`, or `Device PIN` — so each user sees
  wording that matches their phone.
- **Phones with no biometrics still work.** We pass `allowDeviceCredentials: true`, so the OS falls
  back to the device passcode/PIN. This is also what saves a Face ID user wearing a mask, sitting
  in the dark, or with a wet fingerprint — without it, a user could be permanently locked out of
  their own app.
- **If the device has no biometric hardware at all**, we silently mark the one-time "enable app
  lock?" modal as seen so it never shows a dead-end prompt the user cannot act on.

So: nobody gets locked out, and no phone is unsupported. The difference is only *which* prompt the
OS shows.

---

## The moving parts

| File | Role |
|---|---|
| [`src/store/security/securitySlice.ts`](../src/store/security/securitySlice.ts) | Redux state: is lock enabled, has the user been asked, is the lock currently showing |
| [`src/hooks/useBiometric.ts`](../src/hooks/useBiometric.ts) | Thin wrapper over `react-native-biometrics` — "what hardware is there" + "show the prompt" |
| [`src/screens/security/BiometricLockScreen.tsx`](../src/screens/security/BiometricLockScreen.tsx) | The full-screen lock overlay; prompts once on mount, offers "Try Again" on failure |
| [`src/components/BiometricsEnableModal.tsx`](../src/components/BiometricsEnableModal.tsx) | One-time "turn on app lock?" modal after login |
| [`src/utils/biometricPromptState.ts`](../src/utils/biometricPromptState.ts) | A flag saying "a prompt is on screen right now" |
| [`App.tsx`](../App.tsx) | Watches app foreground/background and decides when to re-lock |

Only **two** preferences are saved to storage (`@security_prefs_v1`): whether lock is enabled, and
whether we already asked. Whether the lock is *currently showing* is deliberately not saved.

---

## ⚠️ The bug that keeps coming back — read before editing App.tsx

**Symptom:** you unlock with your face (or the correct passcode), and it immediately asks you to
verify again. Forever. You cannot get into the app.

**Why it happens:** iOS reports app lifecycle states, and showing the Face ID sheet *itself* makes
the app go:

```
active  →  inactive  →  active
```

That looks identical to "the user left and came back" — which is exactly the trigger for re-locking.
So dismissing the unlock prompt instantly re-locked the app, which showed the prompt again, and
round it went. The passcode path was hit hardest, because the seconds spent typing widen the gap.

**The fix:** the app only re-locks if it reached the **`background`** state. The Face ID sheet never
gets there — it only ever reaches `inactive`. Anything that genuinely hands the phone away (home
swipe, switching apps, screen turning off) always passes through `background`.

In [`App.tsx`](../App.tsx) this is the `hasBackgrounded` ref:

```ts
if (hasBackgrounded.current && sec.biometricLockEnabled && (auth.isLoggedIn || auth.isGuest)) {
  store.dispatch(activateLock());
}
```

**Rules if you touch this code:**

- Set `hasBackgrounded` **only** on the literal state `'background'` — never on `'inactive'`.
- Do **not** "simplify" the condition back to `inactive|background`. That is precisely the bug.
- Do **not** try to solve it with a `setTimeout` / delay around the prompt. We tried a 1-second
  grace window first and **it did not work** — the trailing event still slipped through on a real
  phone. Timing guesses lose this race; the state check does not.
- There is exactly **one** place in the codebase that dispatches `activateLock`. Keep it that way —
  it makes this class of bug a one-line search.

---

## Known trade-off

Briefly flicking to the app switcher and straight back **does not** re-lock, because iOS reports
only `inactive` for that, never `background`. This is the deliberate price of the reliable check.
Actually leaving the app, switching to another app, or the screen turning off all lock normally.

## Cold start also locks

Force-quitting the app and reopening it **does** prompt. This matters: without it the lock is
trivially bypassed by closing and reopening the app, and it would not match the
fingerprint-on-launch behaviour users expect from Android.

This is handled by a separate `coldStartLockChecked` effect in [`App.tsx`](../App.tsx) — the
AppState listener above only ever sees *resumes*, so it cannot cover a fresh launch. The effect
waits for **both** the auth and security slices to be hydrated (so it sees the restored session,
not the empty initial state) and fires **once per launch**.

That once-per-launch guard is not optional: without it, switching the toggle on in Settings would
immediately throw up the lock screen over the screen the user is standing on.

---

## Testing it

**Must be on a real phone.** The iOS Simulator has no Secure Enclave, so biometrics do not behave
faithfully there — a Simulator pass proves nothing. See
[`testing-on-real-device.md`](testing-on-real-device.md) for connecting a device and installing a
debug build.

Run all of these, in this order:

1. Enable app lock → background the app (swipe home) → reopen → **correct face/finger** → unlocks
   and **stays** unlocked.
2. Background → reopen → **fail biometrics** → enter **correct passcode** → unlocks and **stays**
   unlocked.
3. Background → reopen → **cancel** the prompt → stays locked, shows "Try Again".
4. Turn the screen off and on → locks, then unlocks normally.
5. **Force-quit the app → reopen** → prompts before the dashboard is visible.
6. **Toggle app lock off and on in Settings** → does *not* lock immediately.

**Steps 1 and 2 are the regression tests for the loop above — 2 is the one that catches it first.**
Step 6 guards the once-per-launch ref; it is easy to break while editing the cold-start effect.

---

## Android caveat — read before testing Android

Android's app lifecycle is reported differently, and it interacts with this fix:

- Android has **no `inactive` state** — React Native reports only `active` / `background` there. So
  the original loop likely never appeared on Android in the same form.
- The **fingerprint dialog** does not pause the activity, so it should not report `background`.
- **But the PIN / pattern / password fallback launches a separate system activity**, which *does*
  pause ours — and React Native reports that as a genuine `background`.

If that happens, the branch in [`App.tsx`](../App.tsx) that records a backgrounding *during* a
prompt (there so that swiping home mid-prompt still re-locks) will treat it as the user leaving, and
**Android may loop on the PIN-fallback path specifically**. Fingerprint success would be unaffected.

**So the Android test that matters most is step 2 above: fail the fingerprint until it offers PIN,
then enter the correct PIN.**

If it does loop, the fix is to clear the "has backgrounded" record when an unlock succeeds, so
nothing recorded during the prompt can survive it. Do **not** reach for a delay or timer — that
approach was already tried and failed on iOS.

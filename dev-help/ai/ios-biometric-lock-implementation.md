# Implementation Spec: Biometric App Lock (Face ID / Touch ID / Fingerprint)

**Audience: an AI agent implementing this feature in a React Native app.**
This is a portable spec — it assumes nothing about the host app beyond React Native + Redux Toolkit.
Reference implementation: `gold-khata-book-frontend` (React Native 0.83, `react-native-biometrics` ^3.0.1).

---

## 0. The one thing that will break this

**An AppState-driven auto-lock and a native biometric prompt fight each other, and the naive
implementation produces an infinite prompt loop.**

Presenting the native Face ID / passcode sheet drives the app through:

```
active → inactive → active          (Face ID sheet shown, then dismissed)
```

It **never reaches `background`**. So the extremely common resume check:

```ts
// WRONG — matches the Face ID sheet's own dismissal
if (appState.current.match(/inactive|background/) && next === 'active') {
  dispatch(activateLock());
}
```

…re-locks the app the instant the sheet is dismissed, which remounts the lock screen, which
auto-prompts again → **infinite loop, on both success and passcode-fallback**. The user cannot get
into the app at all.

**Correct discriminator: require the app to have genuinely reached `background` before re-locking.**
Every real hand-off — home swipe, app switcher, screen off — passes through `background`. The
biometric sheet never does. This is a state check, not a timing guess, so it cannot race.

> Do **not** try to fix this with a timer/delay around the prompt alone. The trailing `active` fires
> when the sheet's *dismissal animation* ends, which lands after the auth promise has already
> resolved — and the passcode fallback widens that gap by however long the user takes to type. Any
> fixed grace window is a guess that fails on slow devices. A timer is acceptable only as a
> secondary guard (see §4), never as the primary mechanism.

---

## 1. Native prerequisites

### iOS — `Info.plist`
```xml
<key>NSFaceIDUsageDescription</key>
<string>&lt;App Name&gt; uses Face ID to unlock the app securely.</string>
```
**Mandatory.** On iOS, calling a permission-gated API with no matching `NS*UsageDescription`
**hard-crashes the app instantly, with no JS error.** Add this in the same commit as the feature.
An empty-string value is worse than no key at all (App Store Guideline 5.1.1 scrutiny).

### Android — `AndroidManifest.xml`
```xml
<uses-permission android:name="android.permission.USE_BIOMETRIC" />
```

### Dependencies
```
react-native-biometrics
@react-native-async-storage/async-storage   # persisting the user's preference
```

---

## 2. Redux state (`store/security/securitySlice.ts`)

```ts
export type SecurityState = {
  biometricLockEnabled: boolean;  // persisted — user's preference
  biometricPromptSeen: boolean;   // persisted — one-time enable modal already offered
  isLockActive: boolean;          // transient — lock screen currently showing
  hydrated: boolean;              // transient — prefs loaded from storage yet?
};
```

Reducers: `setBiometricLockEnabled`, `setBiometricPromptSeen`, `activateLock`, `deactivateLock`.
Plus a `hydrateSecurity` thunk that reads the persisted pair from AsyncStorage and sets
`hydrated = true` in **both** `fulfilled` and `rejected` (otherwise a storage error hangs the app
on a loader forever).

**Persist only the two preference booleans**, never `isLockActive`. Use a listener middleware
matching `isAnyOf(setBiometricLockEnabled, setBiometricPromptSeen)` so persistence is automatic
and no caller can forget it.

**Only one place in the entire codebase may dispatch `activateLock`.** If a bug appears, that
single call site is the whole search space. Grep to enforce this.

---

## 3. The biometric hook (`hooks/useBiometric.ts`)

```ts
const checkAvailability = async (): Promise<BiometryInfo> => {
  try {
    const rnBiometrics = new ReactNativeBiometrics({ allowDeviceCredentials: true });
    const { available, biometryType } = await rnBiometrics.isSensorAvailable();
    let label = 'Device PIN';
    if (biometryType === 'FaceID') label = 'Face ID';
    else if (biometryType === 'TouchID' || biometryType === 'Biometrics') label = 'Fingerprint';
    return { available, biometryType: biometryType ?? null, label };
  } catch {
    return { available: false, biometryType: null, label: 'Device PIN' };
  }
};

const prompt = async (promptMessage: string): Promise<BiometricPromptResult> => {
  setBiometricPromptInFlight(true);
  try {
    const rnBiometrics = new ReactNativeBiometrics({ allowDeviceCredentials: true });
    const { success } = await rnBiometrics.simplePrompt({ promptMessage });
    return { success };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Authentication failed' };
  } finally {
    setBiometricPromptInFlight(false);
  }
};
```

- `allowDeviceCredentials: true` gives the passcode/PIN fallback. Without it, a user whose face
  isn't recognised (mask, dark room, sunglasses) is **permanently locked out of their own app**.
- Use `simplePrompt`, not `createSignature` — no server-side challenge is being verified here, and
  signature flows add Secure Enclave key management for no gain.
- `checkAvailability` must swallow errors and return `available: false`, never throw.

---

## 4. The in-flight flag (`utils/biometricPromptState.ts`)

A module-level (not React state — the AppState listener must read it synchronously) flag marking
that a prompt is on screen, so the resume handler can ignore the sheet's own blip:

```ts
let promptInFlight = false;

export function setBiometricPromptInFlight(value: boolean) {
  promptInFlight = value;
}

export function isBiometricPromptInFlight() { return promptInFlight; }
```

This is a **secondary** guard — it suppresses wasted resume work (data refetches, loader resets)
while the sheet is up. It is **not** what prevents the loop; §5 is. Do not delete §5 because this
exists, and do not attempt to make this flag carry the fix on its own.

> The reference implementation first tried exactly that: clearing the flag on a 1-second timer
> instead of synchronously, to "cover" the dismissal animation. **It did not fix the loop** — the
> trailing `active` still escaped on a real device. That timer was removed once §5 landed. If you
> find yourself tuning a delay here, you are working around the wrong layer.

---

## 5. The AppState listener — the critical part

```ts
const appState = useRef(AppState.currentState);
const hasBackgrounded = useRef(false);   // did we reach a REAL background?

AppState.addEventListener('change', (nextAppState) => {
  if (isBiometricPromptInFlight()) {
    // Still record a genuine backgrounding: the user can swipe home while the
    // sheet is up, and that must re-lock on return rather than being swallowed.
    if (nextAppState === 'background') hasBackgrounded.current = true;
    appState.current = nextAppState;
    return;
  }

  if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
    // ...other resume work (refetch, reset loaders)...

    const sec = store.getState().security;
    const auth = store.getState().auth;
    if (hasBackgrounded.current && sec.biometricLockEnabled && (auth.isLoggedIn || auth.isGuest)) {
      store.dispatch(activateLock());
    }
    hasBackgrounded.current = false;          // reset AFTER the check, on every resume
  } else if (nextAppState.match(/inactive|background/)) {
    if (nextAppState === 'background') hasBackgrounded.current = true;
    // ...other pause work...
  }
  appState.current = nextAppState;
});
```

Invariants to preserve when editing:
- `hasBackgrounded` is set **only** on the literal string `'background'`, never on `'inactive'`.
- It is reset **after** the lock check, and on every resume (not only locking ones).
- The lock is gated on the user being authenticated — never lock a logged-out user behind a
  biometric wall they cannot clear.
- Registered with `[]` deps and reads state via `store.getState()`, not closure variables, so the
  listener is never re-subscribed and never reads a stale snapshot.

---

## 6. The lock screen (`screens/security/BiometricLockScreen.tsx`)

Full-screen `<Modal visible transparent={false} statusBarTranslucent>` so it covers navigation and
cannot be dismissed by gesture. On mount it fires the prompt once:

```ts
const triggerAuth = useCallback(async () => {
  setStatus('prompting');
  const result = await prompt('Unlock <App Name>');
  if (result.success) dispatch(deactivateLock());
  else { setStatus('failed'); setErrorMessage('Authentication failed. Please try again.'); }
}, [dispatch, prompt]);

useEffect(() => { triggerAuth(); }, []);   // [] is deliberate — see below
```

- `useEffect(..., [])` is **intentional**: `useBiometric()` returns fresh function identities every
  render, so a dependency array containing `prompt`/`triggerAuth` would re-fire the prompt on every
  render — a second, independent infinite loop.
- On failure show a **manual "Try Again" button**, never an automatic retry. Auto-retry both burns
  the OS biometric attempt budget and makes the loop in §0 indistinguishable from normal behaviour
  while debugging.
- Render it as a sibling overlay gated on `isLockActive && isAuthenticated`, so app state below is
  preserved and the user returns exactly where they were:
  ```tsx
  {!isWeb && isLockActive && isAuthenticated && <BiometricLockScreen />}
  ```

---

## 7. Opt-in flow

Show a one-time enable modal after login, gated on
`isAuthenticated && securityHydrated && !biometricPromptSeen && !isLockActive`.

Set `biometricPromptSeen = true` in a `finally`, so a thrown error or a declined prompt cannot
resurface the modal on every launch. If `checkAvailability()` reports no hardware, silently mark it
seen rather than rendering a dead-end modal the user cannot act on.

Guard the handler with an `enrolling` flag — a double-tap otherwise stacks two native prompts.

---

## 8. Gating first paint

Block render until security prefs are hydrated:

```ts
if (!isReady || !authHydrated || (!isWeb && !securityHydrated)) return <Loader />;
```

Without this the app paints its authenticated content for a frame before the lock screen mounts —
a visible flash of exactly the data the lock exists to protect.

---

## 9. Web / platform guards

Every biometric branch must be `Platform.OS !== 'web'` guarded if the codebase shares code with
react-native-web. `react-native-biometrics` has no web implementation and will throw at import or
call time.

Do **not** add `Platform.OS === 'ios'` branches. The design above is platform-agnostic and both
platforms should run identical logic — guard against web only. Platform differences belong in §9a,
not in scattered conditionals.

## 9a. Android lifecycle differences — verify separately

The §5 fix is written against iOS lifecycle semantics. Android reports differently, and the
difference lands exactly on this code:

| | iOS | Android |
|---|---|---|
| States reported | `active`, `inactive`, `background` | `active`, `background` only (**no `inactive`**) |
| Biometric sheet | `active → inactive → active` | fingerprint dialog usually causes **no** transition |
| Credential fallback | same in-process sheet | **launches a separate system activity** |

Consequence: because Android has no `inactive`, the §0 loop likely does not manifest there in the
same form. But the **PIN / pattern / password fallback launches `ConfirmDeviceCredential` as its own
activity**, pausing yours — which React Native reports as a genuine `background`. The §5 branch that
deliberately records a backgrounding *while a prompt is in flight* (so swiping home mid-prompt still
re-locks) will treat that as the user leaving, and **Android can loop on the credential-fallback
path**.

**Test this explicitly on Android: fail the biometric until it offers PIN, then enter the correct
PIN.** If it loops, clear the `hasBackgrounded` record when an unlock succeeds, so nothing recorded
during a prompt survives it. Do not introduce a timer — see §4.

Do not assume an iOS pass covers Android, or the reverse.

---

## 10. Verification — must be done on real hardware

**The iOS Simulator cannot validate this.** It has no Secure Enclave; key generation and signing
behave differently, and the AppState transitions around the sheet are not faithful. A Simulator
pass proves nothing about this feature.

Test matrix — all four must pass:

| # | Scenario | Expected |
|---|---|---|
| 1 | Background (home swipe) → reopen → **correct face** | Unlocks, stays unlocked |
| 2 | Background → reopen → **fail face** → **correct passcode** | Unlocks, stays unlocked |
| 3 | Background → reopen → cancel prompt | Stays locked, "Try Again" button shown |
| 4 | Screen off → screen on | Locks, then unlocks normally |
| 5 | **Force-quit → reopen** | Prompts before any data is visible (§12) |
| 6 | Enable the toggle in Settings | Does **not** lock immediately (§12 ref guard) |

Scenarios 1 and 2 are the loop regression tests — **2 is the more sensitive of the pair**, because
passcode typing time widens the race the naive implementation loses. Scenario 2 is also the one most
likely to fail on Android, for a different reason (§9a).

Run the full matrix per platform. In the reference implementation, rows 1–6 are **verified on a
physical iPhone**; Android runs the same code but is **not yet verified**.

---

## 11. Known behavioural trade-off — state explicitly, do not "fix" silently

Because re-locking requires a genuine `background`, **a brief app-switcher peek that returns
without leaving the app will not re-lock**, since iOS reports only `inactive` for it.

This is the deliberate cost of the only reliable discriminator. If a product owner requires locking
on that too, it needs a **separate** mechanism (e.g. an explicit "lock now" on `inactive` that the
lock screen's own prompt is exempt from by identity, not by timing). Reverting the `background`
gate to `inactive` **reintroduces the infinite loop** — never do that.

---

## 12. Cold start — required, and easy to miss

The AppState listener in §5 only ever observes **resumes**. It cannot cover a fresh launch, so on
its own it leaves the lock trivially bypassable: force-quit, reopen, and the restored session opens
straight to the authenticated UI. Users also expect a launch prompt, because that is how Android
fingerprint locks behave.

Add a separate once-per-launch effect:

```ts
const coldStartLockChecked = useRef(false);
useEffect(() => {
  if (isWeb || coldStartLockChecked.current) return;
  if (!authHydrated || !securityHydrated) return;   // both, or you read empty initial state
  coldStartLockChecked.current = true;
  const sec = store.getState().security;
  const auth = store.getState().auth;
  if (sec.biometricLockEnabled && (auth.isLoggedIn || auth.isGuest)) {
    dispatch(activateLock());
  }
}, [isWeb, authHydrated, securityHydrated, dispatch]);
```

Three details that are each a bug if dropped:

- **Gate on both hydration flags.** Fire before the auth slice is restored and it sees a logged-out
  state and skips locking.
- **Guard with a ref so it runs once per launch.** Otherwise enabling the toggle in Settings locks
  the user out of the screen they are on, mid-interaction.
- **Do not persist `isLockActive` instead.** It is transient state; persisting it strands a user
  behind a lock screen if the app is killed mid-prompt.

Keep the first paint gated on hydration (§8) so this dispatch lands while the loader is still up,
rather than flashing the dashboard for a frame before the lock overlay mounts.

---

## Implementation checklist

- [ ] `NSFaceIDUsageDescription` in `Info.plist` (missing ⇒ instant hard crash, no JS error)
- [ ] `USE_BIOMETRIC` in `AndroidManifest.xml`
- [ ] `securitySlice` with the 4 fields; only the 2 preference booleans persisted
- [ ] Exactly **one** `activateLock` call site in the codebase
- [ ] `hasBackgrounded` ref set only on literal `'background'`
- [ ] Lock gated on `hasBackgrounded && biometricLockEnabled && isAuthenticated`
- [ ] `allowDeviceCredentials: true` (passcode fallback — lockout risk without it)
- [ ] Lock screen `useEffect` has `[]` deps; failure shows manual "Try Again"
- [ ] First paint blocked until `securityHydrated`
- [ ] All four rows of the §10 matrix pass **on a physical device**

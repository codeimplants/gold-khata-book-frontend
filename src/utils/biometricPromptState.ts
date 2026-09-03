/**
 * Presenting the native Face ID sheet makes iOS emit a transient
 * active -> inactive -> active AppState blip around its animated
 * presentation (Touch ID / Android fingerprint resolve near-instantly
 * and rarely produce an observable blip). Without this flag, App.tsx's
 * AppState listener treats that blip as "app was backgrounded and
 * reopened" and re-activates the lock screen mid-prompt, which
 * re-triggers the biometric prompt and loops. Callers set this around
 * any `simplePrompt` invocation so that listener can ignore the blip.
 *
 * This flag alone cannot prevent that loop, and must not be relied on to:
 * the trailing "active" fires when the sheet's dismissal *animation* ends,
 * which can land after the auth promise already resolved and cleared this.
 * The actual fix is that App.tsx only re-locks after a real `background`
 * state — see the biometric lock note in its AppState listener.
 *
 * A 1500ms grace period on clearing this flag was tried first, in place of
 * that fix, and was verified NOT to work on a physical iPhone — the late
 * event still escaped. Tuning the delay is not the answer: the trailing
 * event has no bounded upper delay, and the passcode fallback widens it by
 * however long the user takes to type. Do not reintroduce a timer here.
 */
let promptInFlight = false;

export function setBiometricPromptInFlight(value: boolean) {
  promptInFlight = value;
}

export function isBiometricPromptInFlight() {
  return promptInFlight;
}

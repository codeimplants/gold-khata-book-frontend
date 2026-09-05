# Analytics — gold-khata-book-frontend

Two independent telemetry systems run in this app, on purpose. Don't merge
them or add a screen/feature event to only one — see "which system for which
signal" below.

## 1. Firebase Analytics (GA4) — usage behavior

Wrapped by the internal package `@codeimplants/analytics` (published,
`GA4Adapter` over `@react-native-firebase/analytics`). This is the system of
record for screen views, session engagement, retention, and device/OS
breakdown — do not duplicate any of that into system 2 below.

- Native config already provisioned: `android/app/google-services.json`,
  `ios/GoldKhataBook/GoogleService-Info.plist`, both for Firebase project
  `goldkhatabook` (package `com.goldkhatabook.app`).
- Gradle wiring: `android/build.gradle` (Google Services classpath),
  `android/app/build.gradle` (`apply plugin: 'com.google.gms.google-services'`).
- **Web build (`npm run build` → `bundle.web.js`, deployed to Firebase Hosting)
  is a THIRD real target, not covered by the native config above.**
  `@react-native-firebase/*` is native-bridge-only and cannot run in a browser
  at all — `webpack.config.js` aliases both `@react-native-firebase/app` and
  `@react-native-firebase/analytics` to `src/mocks/firebase.js`. That file used
  to be a true no-op (silently swallowed by `@codeimplants/analytics`'s
  always-catch error handling, so it never surfaced as a crash or even a
  warning) — meaning the web build shipped for a long time collecting **zero**
  Firebase data despite looking fully wired. It's now a real shim backed by
  the Firebase JS SDK (`firebase/app` + `firebase/analytics`, matching RNFB's
  own `analytics()` callable-default-export shape so `GA4Adapter` needs no
  changes). Config lives in `src/config/firebaseWeb.ts` — **fill in the actual
  Web app config from Firebase Console → goldkhatabook → Project settings →
  Your apps → Web app** (register one if it doesn't exist yet); until that's
  done the shim safely no-ops instead of sending real data.
- Init: `App.tsx:33,57,61-67` —
  `Analytics.init({ appName: 'gold-khata-book', environment, appVersion, enableAnalytics })`.
- Screen tracking: `App.tsx:530-555`, on every `NavigationContainer`
  `onStateChange`/`onReady` — `Analytics.screen(route.name)`. New screens get
  tracked automatically; don't add manual `Analytics.screen()` calls per-screen.
- User identity: `Analytics.setUser(userId)` / `Analytics.clearUser()` around
  `App.tsx:330-341`, alongside login/logout.
- Custom events: `Analytics.track('EVENT_NAME', payload?)` — example at
  `App.tsx:309` (`OFFLINE_DETECTED`). Add new ones the same way, at the call
  site of the behavior you're tracking.

To see this data: Firebase Console → project `goldkhatabook` → Analytics.
Nexus (the internal admin platform) also pulls real numbers from this same
GA4 property server-side via the Google Analytics Data API — see
`nexus-backend/ANALYTICS.md` — once `goldkhatabook`'s GA4 property grants
Nexus's shared reporting service account Viewer access.

## 2. Nexus SDK — device/admin telemetry

`src/utils/platformAnalytics.ts` talks directly to Nexus
(`https://api.nexus.codeimplants.com`, `x-api-key` = `VITE_VC_API_KEY`, base
URL per environment in `src/config/environments/*.ts`). This is what feeds
Nexus's admin console: device counts, the Engagement/Leads pages, and Bulk
Cleanup targeting. It is **not** a second usage-analytics pipeline — Nexus
deliberately does not persist screen views or custom events (they're
accepted by `/sdk/events` but intentionally dropped after touching
`lastActiveAt`, since Firebase already owns that signal).

- `POST /sdk/device` — device registration (`registerDevice()`).
- `POST /sdk/user/identify` — links the device to the app's own user id
  (`setPlatformUser()`/`clearPlatformUser()`, called alongside
  `Analytics.setUser`/`clearUser` in `App.tsx:330-341`).
- `POST /sdk/events` — batched (`FLUSH_INTERVAL_MS = 15_000`, `MAX_BATCH = 20`,
  plus immediate flush on app-background). Only `app_open`/`app_background`
  are meaningfully consumed server-side (session open/close →
  `DailyUsage`). `login_success`/`logout`/`screen_view` are sent but only
  touch `EndUser.lastActiveAt` on the Nexus side — expected, not a bug.
- Device payload helper: `src/utils/deviceInfo.ts` (`getDevicePayload`).

## Which system for which signal

| Question | Answer lives in |
|---|---|
| How many people opened screen X this week? | Firebase (GA4 screen_view reports) |
| What's our D7 retention? | Firebase (GA4 cohort reports) |
| How long do sessions last, on average? | Firebase |
| Which of our users are inactive and eligible for cleanup? | Nexus (Engagement page, `inactiveDays`) |
| What's this specific shopkeeper's phone number, for outreach? | Nexus (Leads page, federated from `gold-khata-book-backend`'s `dukandar` module) |
| Should we bulk-delete a batch of stale accounts? | Nexus (Bulk Cleanup — runs `gold-khata-book-backend`'s own delete process, then clears Nexus's copy) |

**Rule of thumb**: if it's "what are users doing in the app," it's Firebase's
job — add an `Analytics.track()`/`Analytics.screen()` call, don't touch
`platformAnalytics.ts`. If it's "who is this user and should an admin act on
them," that's Nexus's job via the federation config in `gold-khata-book-backend`,
not a new event type.

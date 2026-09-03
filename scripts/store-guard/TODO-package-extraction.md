# TODO: publish store-guard as `@codeimplants/store-guard`, bare RN + Expo/EAS

**Status:** not started. Deliberately deferred — see "Do not start before" below.
**Written:** 2026-08-15.

An agent picking this up should read this whole file first. The packaging is the
easy part and is *not* the work; the Expo support is.

---

## Context — why do this at all

store-guard currently lives only in `sonebill-mobile/scripts/store-guard/`. There
is a second app that ships to both stores — `C:\RN\sonetaran\sonetaran-mobile`
(`com.sonetaran.app` / `com.sonetaran`, Expo SDK 57 + expo-router + EAS) — and it
has no store-guard at all.

Two reasons to package rather than copy:

1. **`rules/catalog.json` is a policy clock.** It carries `reviewed: 2026-07-20`,
   and `TARGET_SDK_FLOOR` in `rules/checks/android.js` is a number Play raises on
   a schedule. Two copies means two places to update when Play moves the floor,
   and realistically one gets updated and one does not. This is the strongest
   reason — stronger than code reuse.

2. **Copy-paste drift is already measured in this tree, not hypothetical.**
   `sonebill-mobile/scripts` and `sonetaran-mobile/scripts` already hand-duplicate
   nine files. `screenshot-device.ps1` is byte-identical; `build-playstore-aab.ps1`
   has drifted to 7449 vs 5726 bytes and `run-android-device.ps1` to 4777 vs
   10132 — same ancestor, forked and diverged. Copying store-guard puts it on
   exactly that trajectory.

---

## Do not start before

- [ ] The attestation migration is done (`npm run attest:store:ios`,
      `npm run attest:store:android`) **and** the validity model in
      `lib/validity.js` has survived one real release cycle.

Rationale: the validity model landed 2026-08-15 and has never run through a live
submission. Extracting a design you might still revise multiplies the cost of
revising it — every tweak becomes edit → version bump → publish → bump the
consumer, instead of edit → done.

---

## The blocker: Expo apps read stale native dirs

**This is the reason a naive "publish it and add it to sonetaran" is worse than
doing nothing.** Verified 2026-08-15 in `sonetaran-mobile`:

| Source | Version |
|---|---|
| `app.json` (`expo.version`, Expo's source of truth) | **2.0.1** |
| `android/app/build.gradle` (what store-guard reads today) | **versionName "1.5", versionCode 5** |
| `ios/SoneTaran.xcodeproj/project.pbxproj` | 2.0.1 (coincidentally current) |

The checked-in `android/`+`ios/` are stale prebuild output — present, not
gitignored, and far behind. Point today's store-guard at that repo and
`play.version-code` compares the next release against `versionCode 5`: it passes
cleanly while Play rejects the upload. **A compliance tool that is confidently
wrong is worse than no tool, because it gets trusted.**

Second complication, equally important: `sonetaran-mobile/eas.json` sets
`"appVersionSource": "remote"` with `"autoIncrement": true`. Version codes are
managed **by EAS servers**, not by any file in the repo. So for such apps the
correct behaviour is *not* to find the number somewhere else — it is to report
"managed remotely by EAS, cannot verify locally" and neither pass nor fail
silently. Do not invent a local answer.

---

## Decisions already made — do not re-litigate

- **Home:** `digital-libraries/packages/node/store-guard`. The root
  `package.json` workspaces glob already includes `packages/node/*`, and
  `@codeimplants/authkit` (`packages/node/auth`) is the existing non-RN Node
  precedent. No root config change needed.
- **Name / registry:** `@codeimplants/store-guard`, public npmjs.org, same as the
  other seven packages. Consumers add a `"^1.0.0"` range exactly as they already
  do. No private registry, no `.npmrc`, no auth work.
- **Stay plain JavaScript. Do not convert to TypeScript.** Every other package
  there is `tsc`-built, but store-guard has **zero dependencies** by design and
  `lib/plist.js` documents that it parses XML by hand specifically so the tool
  works in a repo where `npm install` was skipped. A build step reintroduces the
  publish-drift failure mode this repo already suffers from (see Risks).
- **Per-app files stay per-app.** `store-guard.config.json` and
  `.store-guard/attestations.json` remain in each app repo. That split is already
  correct — do not move them into the package.
- **`rules/catalog.json` ships inside the package.** Centralising it is the point.

---

## Task 1 — extract the package (mechanical)

- [ ] Copy `sonebill-mobile/scripts/store-guard/` → `digital-libraries/packages/node/store-guard/`.
      Contents: `bin/store-guard.js`, `lib/{android,attest,config,engine,plist,report,scan,validity,xcode}.js`,
      `rules/catalog.json`, `rules/checks/{android,common,ios}.js`,
      `store-guard.config.example.json`, `README.md`. Leave `TODO-package-extraction.md` behind.
- [ ] Edit its `package.json`: `name` → `@codeimplants/store-guard`, drop
      `"private": true`, add `"publishConfig": { "access": "public" }`,
      `"repository"`, `"description"`, `"keywords"`. Keep `bin`, `main`, `files`,
      `engines`, and the empty `dependencies`.
- [ ] **`bin` is new ground here — no package in digital-libraries has ever had
      one.** Confirm `bin/store-guard.js` keeps its `#!/usr/bin/env node` shebang
      and that the file mode is executable in git
      (`git update-index --chmod=+x`), or `npx store-guard` breaks on macOS/Linux
      while appearing fine on Windows.
- [ ] `npm publish --access public` from the repo root workspace.
- [ ] In `sonebill-mobile`: delete `scripts/store-guard/`, add
      `"@codeimplants/store-guard": "^1.0.0"` to devDependencies, and repoint the
      seven npm scripts in `package.json` from
      `node scripts/store-guard/bin/store-guard.js` to `store-guard`.
- [ ] Repoint the three other callers:
      `scripts/build-playstore-aab.ps1` (~line 96), `scripts/release-ios.sh`
      (~line 205), `.github/workflows/android-release-check.yml`.

## Task 2 — Expo/EAS support (the actual work)

Add a project-kind detection layer so the readers ask the right files. Suggested
shape: a new `lib/project.js` that classifies the repo as `bare` or `expo` and
resolves version/identity accordingly, consumed by `engine.js buildContext()`.

- [ ] **Detect:** `expo` when `app.json`/`app.config.{js,ts}` has an `expo` key,
      or `package.json` depends on `expo`. Otherwise `bare`.
- [ ] **Resolve identity from `app.json` when Expo**, not from native dirs:
      `expo.version`, `expo.ios.bundleIdentifier`, `expo.android.package`.
      Note sonetaran's ios/android ids legitimately differ
      (`com.sonetaran.app` vs `com.sonetaran`) — the config already has separate
      `bundleId` / `androidPackage` fields, so this is fine.
- [ ] **`ctx.version`** currently comes from `MARKETING_VERSION || versionName`
      in `lib/engine.js:62-64`. For Expo it must come from `expo.version`. This
      matters beyond the version rules — `ctx.version` is the key attestations
      are recorded against, so getting it wrong silently splits the attestation
      history.
- [ ] **EAS remote versioning:** when `eas.json` has
      `"appVersionSource": "remote"`, the version-code rules must report
      *unverifiable*, not pass. Consider a new report status or reuse `warn` with
      an explicit message. Do not guess a number.
- [ ] **Stale prebuild output:** when Expo and `android/`/`ios/` exist, treat
      them the way `mergedManifestPath()` already treats a missing merged
      manifest — usable but flagged provisional in the header. If
      `app.json` and the native dir disagree on version, say so loudly; that
      disagreement is itself a finding.
- [ ] **Permissions:** for Expo, `expo.android.permissions` in `app.json` is the
      declared set; the merged manifest still wins when a prebuild exists.
      `lib/android.js resolveSdkVersion()` already has an Expo fallback (it reads
      `expo-modules-core`'s `ProjectConfiguration.kt`) — follow that precedent.
- [ ] **iOS usage descriptions:** for Expo these come from
      `expo.ios.infoPlist` in `app.json`, not `ios/<scheme>/Info.plist`. This
      feeds the `iosUsageDescriptions` fingerprint in `lib/validity.js`, so it
      must be right or attestations churn every release.
- [ ] Rules that are meaningless for Expo (e.g. anything reading
      `project.pbxproj` build settings directly) should `skip` with a reason,
      the way `config.js applies()` already skips on profile flags — not fail.

## Task 3 — adopt in sonetaran-mobile

- [ ] `npx store-guard init`, then fill in `profile`, `liveVersions`, and a
      curated `allowedPermissions` with notes — copy the *shape* of
      `sonebill-mobile/store-guard.config.json`, not its values.
- [ ] Add the npm scripts, run `attest:store` once to seed attestations.
- [ ] Wire into whatever the EAS release path is (`eas build` / `eas submit`) —
      sonetaran has no CI, so this is likely a local pre-submit script.

---

## Verification

- [ ] **Behaviour is unchanged for sonebill.** Before extracting, capture
      `node scripts/store-guard/bin/store-guard.js check --ios --json` and
      `--android --json`. After, `npx store-guard check --ios --json` must be
      identical except any path strings. This is the regression test that matters.
- [ ] **Expo path produces true answers.** Against `sonetaran-mobile`, confirm
      the report shows version **2.0.1** (from `app.json`), not 1.5, and that the
      version-code rule reports unverifiable rather than passing against
      `versionCode 5`.
- [ ] **Fingerprints are stable across runs** — run `store-guard attestations`
      twice on each app; nothing should flip between "carried forward" and "due".
      A churning fingerprint silently restores the every-release re-asking that
      `lib/validity.js` exists to eliminate.
- [ ] **`npx` works from a clean install** on a machine without the repo checked
      out — this is what the `bin` + shebang + executable-bit work is for.
- [ ] Both callers still gate correctly: `build-playstore-aab.ps1` and
      `release-ios.sh` must still exit non-zero on an unattested gate.

---

## Risks / gotchas in digital-libraries

- **No CI, no git tags, no changelogs, no changesets.** Publishing is a manual
  `npm publish` from one laptop's npm token (`C:\Users\maga0721\.npmrc`).
- **It already drifts:** `@codeimplants/app-review` is `1.1.0` in-tree but
  `1.0.1` on npm — two commits unpublished. Expect the same here unless someone
  publishes deliberately after each rule change. This is the concrete cost of
  moving out of the app repo, and the reason for "stay plain JS, no build step".
- **Turbo config is inconsistent:** root `turbo.json` uses the 1.x `"pipeline"`
  key (installed turbo is 1.13.4) while three per-package `turbo.json` files use
  the 2.x `"tasks"` key without `"extends": ["//"]`. Do not copy those as a
  template.
- **Do not use `packages/core/app-core` as a package template** — its
  `.npmignore` excludes `dist/` while its `files` includes it. `app-review` is
  the cleanest model (plain `tsc`, `node:test`, own README).
- Seven packages carry stale nested `package-lock.json` files that npm workspaces
  ignores. Do not add another.

## Related

- `lib/validity.js` — the attestation staleness model; its header explains why
  gates carry forward. The `screens` / `sdks` / `androidPermissions` fingerprints
  are the parts most likely to behave differently under Expo.
- `README.md` in this directory — "When a manual gate comes back" documents the
  model that must keep working after extraction.

# store-guard

Checks an app against App Store and Play Store requirements **before** a build
goes out, so rejections are found in seconds rather than after a review cycle.

Zero dependencies, plain Node. Runs on macOS and Windows, so the same check
covers the iOS build on a Mac and the Android build from the PowerShell scripts.

## The idea

`rules/catalog.json` is the **reference** — one entry per store requirement,
each citing the guideline it comes from. Every rule is one of two kinds:

| mode | meaning |
|---|---|
| `auto` | Decidable from the repo. A function in `rules/checks/` enforces it. |
| `manual` | Cannot be read from the repo — a store-console or judgement item. Raised as a gate a person must attest. |

That split is the whole design. Purpose strings, permissions, SDK levels and
version codes are read from the files. Privacy labels, the Data safety form,
screenshots, content rating and the reviewer demo account cannot be, so they are
not silently skipped — they are surfaced and must be answered.

## When a manual gate comes back

Attestations used to reset on every version bump, so a patch release re-asked
all ten store-console questions verbatim. That reads as diligence and is the
opposite: ten identical questions train a reflex `y`. The proof is in this
repo's own history — 1.0.15's five Play gates were recorded at 04:23:53,
04:23:59, 04:24:03, 04:24:07 and 04:24:13. Five compliance confirmations in
twenty seconds, every note empty.

So each manual rule now declares a `validity` block saying what makes its answer
go stale, and the answer is carried forward until that actually happens:

| mode | carried forward until |
|---|---|
| `always` | the version changes. For gates that rot with no commit involved — a demo account dies when a backend redeploys. |
| `signal` | one of its fingerprints changes. Privacy labels do not go stale because a version moved; they go stale when a permission, a usage-description key or an SDK appears. |
| `expiry` | it is simply old. For near-static gates where nothing in the repo predicts drift but a periodic re-read still earns its keep. |

`signals` and `expiresDays` apply in every mode; `mode` only decides whether the
attested version must match. A rule with no `validity` block behaves as
`always`, so a gate added without thinking about staleness fails safe.

Available signals, all deliberately coarse — a fingerprint that moved on every
commit would put us straight back to asking every release:

| signal | fingerprints | deliberately ignores |
|---|---|---|
| `androidPermissions` | permission names + `maxSdkVersion` from the manifest, tagged `merged:` or `source:` | everything else in the manifest |
| `iosUsageDescriptions` | the set of `NS*UsageDescription` **keys** | the purpose strings themselves — rewording one changes nothing |
| `sdks` | `dependencies` **names** from package.json | versions, so a routine bump does not re-open privacy questions |
| `screens` | file **paths** under `screens/`, `pages/` or `views/` | file contents — adding a screen dates a screenshot set, editing one usually does not |
| `profile` | every flag in `store-guard.config.json` `profile` | — |

The `merged:` / `source:` tag on `androidPermissions` matters: an attestation
made against the merged manifest must never compare equal to a run that could
only read the source one. Different provenance reports "cannot be compared", not
"changed", so nobody goes hunting a change that never happened.

Two commands make this inspectable, because carrying answers forward silently
would just be a quieter rubber stamp:

- `store-guard attestations` — every manual gate, whether it is carried forward
  or due, why, and what would re-open it.
- Every question `store-guard attest` asks arrives with `asked because: …`
  (`Android permissions changed since 1.0.14`, `attested 400 days ago, valid for
  365`). A question that says why it is back gets read.

Use `store-guard attest --all` to re-answer a gate that is still carried forward
— for when something changed that no fingerprint covers, such as a listing
edited by hand or a support URL retired.

**Migration:** attestations made before this model carry no fingerprints, so
there is nothing to compare a later build against. Each gate is asked once more,
recorded with its fingerprints, and from then on carries forward.

## Usage

```bash
npm run check:store              # both stores
npm run check:store:ios          # App Store rules only
npm run check:store:android      # Play rules only
npm run attest:store             # answer the manual gates that are actually due
npm run attest:store:ios         # only the App Store gates
npm run attest:store:android     # only the Play gates
npm run attestations             # what is carried forward, and until when
npx store-guard attest --all     # also re-answer gates still carried forward
npx store-guard rules            # print the whole reference catalog
```

Exit code is 1 if anything failed or any manual gate is unattested, so it can
gate a build. `--warn` reports without failing. `--json` for CI.

## Configuring an app

`store-guard.config.json` in the repo root. `npx store-guard init` writes a
starter.

The `profile` flags decide which rules apply at all — an app with no accounts is
never asked about account deletion, and one that sells nothing is never asked
about In-App Purchase. Set them honestly; they are the difference between a
useful report and noise.

`liveVersions` is what is currently live on each store. Without it the tool
cannot tell you that a version code will be refused, and says so rather than
passing quietly. **Update it after every release** — it is the single highest-value
field in the file.

`allowedPermissions` lists the Android permissions you have justified. Anything
in the manifest that is not listed gets flagged, which is how a permission
injected by an autolinked library gets noticed before Play notices it.

`ignore` maps a rule id to a reason. A reason is required — an ignore list
without one becomes a place where rules go to be forgotten.

## The merged manifest

Android checks prefer `android/app/build/.../merged_manifests/release/AndroidManifest.xml`
because that is what actually ships. Autolinked libraries inject permissions at
merge time that never appear in the manifest you wrote. When no merged manifest
exists the tool reads the source one **and says so in the header** — treat that
run as provisional and re-run after a build for the real permission list.

## Adding a rule

1. Add an entry to `rules/catalog.json` with its guideline reference and URL.
2. If `auto`, add the function to `rules/checks/{ios,android,common}.js` and
   point `check` at it as `file/functionName`.
3. If `manual`, write a `prompt` that says exactly where to look in the console,
   and a `validity` block. Deciding when a gate comes back is as much a part of
   writing it as deciding what it asks — a gate that returns every release when
   nothing it depends on has changed will be answered without being read.

Prefer `severity: "warn"` when a pattern can reasonably be wrong. A checker that
cries wolf gets skipped, and a skipped checker catches nothing.

## Keeping it honest

`catalog.json` carries a `reviewed` date and every rule carries its source URL.
Store policies change — re-read the sources and bump the date at least twice a
year. `TARGET_SDK_FLOOR` in `rules/checks/android.js` is a number Play raises on
a schedule and carries its own review date.

The tool can only check what is in the repo. It does not sign in to App Store
Connect or Play Console, and it cannot see your store listing. That is precisely
what the manual gates are for — do not treat a clean `auto` run as a clean
submission.

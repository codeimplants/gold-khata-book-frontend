# release-notes

Turns the commits since the last release into store copy for Google Play and the
App Store.

```
npm run release-notes                      # what shipped since the last release
npm run release-notes -- --play            # Play brief (500 char cap)
npm run release-notes -- --ios             # App Store brief (4000 char cap)
npm run release-notes -- --play --generate # write the notes, with the claude CLI
npm run release-notes -- --check notes.txt # count a written note against the caps
```

## How it finds "the last release"

This repo does not tag releases, so the boundary is inferred from the version
number, which is the one thing a release reliably changes:

1. `--from <ref>` if you pass one.
2. The newest release-shaped git tag reachable from `--to` (`v1.0.14`, `1.0.14`,
   `android-v1.0.14`). Adopting tags later needs no change here — they simply
   start winning.
3. Otherwise, the commit that set the **previous** version:
   `versionCode`/`versionName` in `android/app/build.gradle` for Play,
   `CURRENT_PROJECT_VERSION`/`MARKETING_VERSION` in the Xcode project for iOS.

Step 3 is what runs today. For 1.0.15 it resolves to `15cb0a4` — the commit that
set 1.0.14 — giving the exact 42-commit range that this release ships.

Only the **build code** marks a release, not the user-facing name: both stores
force the code to change on every upload (Play rejects a reused `versionCode`,
App Store Connect rejects a reused build with `ITMS-90062`), while the name moves
for other reasons. Comparing the name too would read a marketing-only bump as a
release and hide work that never shipped.

Which manifest is consulted follows `--platform`, so `--ios` measures from the
last iOS build number even when Android has shipped more often since.

### The one thing it has to assume

Git records the version bump but never the upload, so the range assumes the
version in the repo has **not** shipped yet. That holds when you follow the
normal order — bump as part of the release build, then write the notes — and
the command says the assumption out loud:

```
Assuming 1.0.15 (15) has not been uploaded yet. If it has, the range is too
wide — start where it was set instead: --from c830797
```

A platform sitting mid-cycle on an already-shipped build is exactly when that
matters. iOS is in that state today: build 9 went out with 1.0.13, so App Store
notes for the next build want `--from f9190b1`, not the inferred baseline.

## What it does and does not do

It does the mechanical half: resolve the range, pull the commits and their
bodies, split user-facing work from `ci:`/`build:`/`chore:`/version-bump noise,
and lay all of that out as a brief carrying the store's own rules.

The two stores get deliberately different briefs, because their constraints are
different by a factor of eight:

- **Play** is written to the 500-character wall. Four to six lines, no opening
  sentence, merge aggressively, and drop the smallest changes rather than
  compress everything into an unreadable list. The most important change goes
  first, because Play only shows about two lines in the collapsed card.
- **App Store** is written to be generous: an opening sentence on what the
  release is about, short plain section headings, a full sentence per change,
  and coverage of every user-facing change including the small ones. It targets
  2500–3500 characters — full, without crowding the 4000 cap.

It does not write prose by pattern-matching commit subjects — that produces the
kind of note that lists "fix(customers): exclude deleted orders from stats" at a
shop owner. The writing is left to a model:

- `--generate` pipes the brief through the local `claude` CLI, so it needs no API
  key of its own. Override the binary with `CLAUDE_BIN`.
- Without `--generate` the brief goes to stdout; paste it into any model.

Either way the output is checked against the store's character cap before you
see it. Character budgets are the one thing a model reliably misses on the first
try and the one thing the store enforces absolutely, so an over-length draft is
sent back with its exact overage to be trimmed, up to twice, before you see it:

```
4052/4000 characters — asking for a trim (1/2)…
OK  the App Store: 3888/4000 characters
```

If it is still over after that, the command exits 1 rather than handing you
something that cannot be pasted. Play silently refuses to save more than 500
characters, and finding that out otherwise costs a round trip to the console.

## Options

| Option | Effect |
| --- | --- |
| `--platform play\|ios`, `--play`, `--ios` | Which store to write for. Omitted, you get the commit range only. |
| `--generate`, `-g` | Write the notes with the `claude` CLI instead of printing the brief. |
| `--from <ref>` | Start the range here instead of the inferred baseline. |
| `--to <ref>` | End the range here (default `HEAD`). |
| `--out <file>`, `-o` | Write generated notes to a file instead of stdout. |
| `--commits` | Just the classified commit list. |
| `--check <file>` | Count an already-written note against the caps. `-` reads stdin. |
| `--json` | Machine-readable range, versions and classification. |

Exit codes: `0` clean, `1` nothing to release or a note over the cap, `2` bad
usage.

## Notes

- Read-only. It never writes to the repo, so it is safe to run against a dirty
  tree mid-release.
- Merges are dropped — a merge subject restates the commits it brings in.
- Commit *bodies* are included in the brief, trailers stripped. They carry the
  "why", which is what store copy actually needs; a subject alone rarely explains
  what a shop owner gains.

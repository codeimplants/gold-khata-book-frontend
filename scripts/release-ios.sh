#!/usr/bin/env bash
#
# Builds and uploads an iOS release to App Store Connect.
#
# Replaces the manual Xcode Organizer sequence: npm install, pod install,
# archive, export, upload — each of which was done by hand for 1.0.10, where two
# builds were burned on validation errors that this script now catches locally.
#
# Usage:
#   ./scripts/release-ios.sh                         # asks whether to bump, then builds and uploads
#   ./scripts/release-ios.sh --check                 # verify prerequisites, build nothing
#   ./scripts/release-ios.sh --bump                  # pull latest, bump build number, archive, export, upload
#   ./scripts/release-ios.sh --bump --no-upload      # everything except upload (produces the .ipa)
#   ./scripts/release-ios.sh --version 1.0.11 --bump # also set the marketing version
#   ./scripts/release-ios.sh --dry-run               # print every step, run none
#
# Flags:
#   --check          Verify toolchain, signing and API key. Changes nothing.
#   --bump           Increment CURRENT_PROJECT_VERSION before archiving.
#                    Apple rejects a reused build number with ITMS-90062, so this
#                    is almost always wanted. Deliberately NOT the silent default:
#                    it edits a tracked file. Given neither --bump nor --no-bump,
#                    an interactive run ASKS (default yes), the way
#                    build-playstore-aab.ps1 asks about versionCode/versionName.
#   --no-bump        Archive the build number as it stands, without being asked.
#                    Pass this or --bump explicitly when running non-interactively:
#                    with no terminal on stdin the question is skipped rather than
#                    asked, and skipping means no bump — so a scripted run that
#                    wanted one would upload a reused number and fail at ITMS-90062.
#   --version <x>    Set MARKETING_VERSION (e.g. 1.0.11). Must be higher than the
#                    live App Store version or the submission is rejected.
#   --no-upload      Stop after producing the .ipa.
#   --skip-pods      Skip pod install. Ignored (with a warning) when a dependency
#                    ships a podspec that Podfile.lock does not have yet — a
#                    missing native module fails silently at runtime.
#   --skip-preflight Skip the App Store guideline checks. Only when you have
#                    judged a specific preflight failure acceptable.
#   --skip-pull      Skip the leading `git pull --ff-only`; build whatever is on disk.
#   --dry-run        Show what would run; make no changes.
#
# Pulls latest via `git pull --ff-only` before doing anything else, so a release
# always ships the latest committed code. Aborts if local changes would conflict —
# commit/stash them first, or pass --skip-pull to build the working tree as-is.
#
# NOT automated on purpose:
#   - Screenshots. Capturing them needs an authenticated session and populated
#     data; a script would produce empty-state images.
#   - Submitting for review. Uploading a build is reversible; submitting starts a
#     human review and should stay a deliberate click.

set -euo pipefail

RED=$'\033[0;31m'; GRN=$'\033[0;32m'; YEL=$'\033[1;33m'; CYA=$'\033[0;36m'; NC=$'\033[0m'
info() { printf '%s%s%s\n' "$CYA" "$*" "$NC"; }
ok()   { printf '%s%s%s\n' "$GRN" "✓ $*" "$NC"; }
warn() { printf '%s%s%s\n' "$YEL" "! $*" "$NC"; }
die()  { printf '%s%s%s\n' "$RED" "ERROR: $*" "$NC" >&2; exit 1; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="$ROOT/scripts/release-ios.config.sh"

# BUMP_SET records whether the operator actually chose, so that "no flag" can be
# told apart from "--no-bump" and turned into a question below.
CHECK_ONLY=0; BUMP=0; BUMP_SET=0; NO_UPLOAD=0; SKIP_PODS=0; DRY_RUN=0; SKIP_PREFLIGHT=0; SKIP_PULL=0; NEW_VERSION=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --check)      CHECK_ONLY=1; shift ;;
    --bump)       BUMP=1; BUMP_SET=1; shift ;;
    --no-bump)    BUMP=0; BUMP_SET=1; shift ;;
    --version)    NEW_VERSION="${2:-}"; shift 2 ;;
    --no-upload)  NO_UPLOAD=1; shift ;;
    --skip-pods)  SKIP_PODS=1; shift ;;
    --skip-preflight) SKIP_PREFLIGHT=1; shift ;;
    --skip-pull)  SKIP_PULL=1; shift ;;
    --dry-run)    DRY_RUN=1; shift ;;
    -h|--help)    sed -n '2,49p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)            die "Unknown argument: $1  (try --help)" ;;
  esac
done

[[ -f "$CONFIG" ]] || die "Missing $CONFIG
  cp scripts/release-ios.config.example.sh scripts/release-ios.config.sh"
# shellcheck source=/dev/null
source "$CONFIG"

PBXPROJ="$ROOT/$XCODE_PROJECT/project.pbxproj"
ARCHIVE="$ROOT/$BUILD_DIR/$SCHEME.xcarchive"
EXPORT_DIR="$ROOT/$BUILD_DIR/export"
IPA="$EXPORT_DIR/$SCHEME.ipa"

run() {
  if [[ $DRY_RUN -eq 1 ]]; then printf '%s  would run: %s%s\n' "$YEL" "$*" "$NC"; else "$@"; fi
}

# --- read a build setting straight from the pbxproj ---------------------------
# Reads the first occurrence; Debug and Release are kept in sync by --bump.
read_setting() { grep -m1 -E "^\s+$1 = " "$PBXPROJ" | sed -E 's/.*= *([^;]+);.*/\1/' | tr -d '"'; }

# ================================== SYNC =======================================
if [[ $SKIP_PULL -eq 0 ]]; then
  info "Pulling latest changes (git pull --ff-only)..."
  if [[ $DRY_RUN -eq 1 ]]; then
    printf '%s  would run: git -C %s pull --ff-only%s\n' "$YEL" "$ROOT" "$NC"
  elif ! git -C "$ROOT" pull --ff-only; then
    die "git pull failed. If local changes conflict with incoming updates, commit/stash them first,
  or re-run with --skip-pull to build the working tree as-is."
  fi
else
  warn "Skipping git pull (--skip-pull) — building whatever is currently on disk."
fi

# =============================== PREREQUISITES ================================
info "Checking prerequisites..."

command -v xcodebuild >/dev/null || die "xcodebuild not found. Install Xcode and run:
  sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer"
XCODE_PATH="$(xcode-select -p)"
[[ "$XCODE_PATH" == *"Xcode.app"* ]] \
  || die "xcode-select points at '$XCODE_PATH', not Xcode.
  sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer"
ok "Xcode: $(xcodebuild -version | head -1)"

command -v node >/dev/null || die "node not found"
ok "node $(node -v)"

# CocoaPods runs under Homebrew Ruby, and deliberately NOT under bundler.
#
# This used to be the other way round: gems were installed under system Ruby
# 2.6.10, so /usr/bin had to lead PATH and `bundle exec` was mandatory. Adding
# expo-contacts reversed it. `use_expo_modules!` brings in Expo's CocoaPods
# plugin, which calls Array#filter_map — added in Ruby 2.7 — so system Ruby now
# fails while merely *parsing* the Podfile, before any pod is resolved.
#
# Bundler cannot be the way out: the gem set is still stranded under 2.6.10 in
# vendor/bundle/ruby/2.6.0/, and Gemfile.lock pins BUNDLED WITH 1.17.2, which
# cannot run on Ruby 3.2+ at all (it calls the removed String#untaint).
# Gemfile.lock is left alone on purpose — the Gemfile pins xcodeproj < 1.26.0
# and excludes known-bad CocoaPods versions, so regenerating it under a new Ruby
# is not a change to make without testing a full archive.
#
# Probe here rather than discovering it 10 minutes into a build.
POD_RUBY_BIN="${POD_RUBY_BIN:-/opt/homebrew/bin}"
POD_VERSION="$(cd "$ROOT/ios" 2>/dev/null && PATH="$POD_RUBY_BIN:$PATH" \
  LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod --version 2>/dev/null | tail -1)"
if [[ -z "$POD_VERSION" ]]; then
  die "CocoaPods is not runnable under $POD_RUBY_BIN.
  Check:  $POD_RUBY_BIN/ruby -v   (Expo's Podfile needs 2.7+)
          $POD_RUBY_BIN/pod --version
  Install it with:  brew install cocoapods
  or point POD_RUBY_BIN in $CONFIG at a Ruby new enough to parse the Podfile."
fi
ok "CocoaPods $POD_VERSION (ruby $("$POD_RUBY_BIN/ruby" -v 2>/dev/null | awk '{print $2}'))"

[[ -f "$ROOT/$EXPORT_OPTIONS" ]] || die "Missing $EXPORT_OPTIONS"
ok "ExportOptions.plist present"

# Signing identity. Cloud-managed certificates do not appear in the local
# keychain, so an empty list is a warning rather than a failure — the export
# step resolves signing via -allowProvisioningUpdates.
IDENTITIES="$(security find-identity -v -p codesigning 2>/dev/null | grep -c "Apple Distribution\|Apple Development" || true)"
if [[ "$IDENTITIES" -eq 0 ]]; then
  warn "No local signing identities. Fine if you use cloud-managed signing (Gold Khata Book does),"
  warn "but Xcode must be signed in: Xcode > Settings > Accounts."
else
  ok "$IDENTITIES local signing identit$([[ "$IDENTITIES" == 1 ]] && echo y || echo ies)"
fi

# API key — the actual blocker for CLI upload.
UPLOAD_READY=1
if [[ -z "${APP_STORE_KEY_ID:-}" || -z "${APP_STORE_ISSUER_ID:-}" ]]; then
  UPLOAD_READY=0
  warn "APP_STORE_KEY_ID / APP_STORE_ISSUER_ID not set in $CONFIG — cannot upload."
else
  KEY_FILE="$HOME/.appstoreconnect/private_keys/AuthKey_${APP_STORE_KEY_ID}.p8"
  if [[ ! -f "$KEY_FILE" ]]; then
    UPLOAD_READY=0
    warn "Key file not found: $KEY_FILE"
    warn "The .p8 downloads only once when the key is created; it cannot be re-downloaded."
  else
    ok "App Store Connect API key $APP_STORE_KEY_ID"
  fi
fi

VERSION="$(read_setting MARKETING_VERSION)"
BUILD_NO="$(read_setting CURRENT_PROJECT_VERSION)"
info "Current: $VERSION ($BUILD_NO)"

if [[ $CHECK_ONLY -eq 1 ]]; then
  echo
  if [[ $UPLOAD_READY -eq 1 ]]; then ok "Ready to build and upload."
  else warn "Can build, but NOT upload. Create an API key — see $CONFIG for steps."; fi
  exit 0
fi

# ================================ VERSIONING ==================================
# Neither --bump nor --no-bump: ask, the way build-playstore-aab.ps1 asks about
# versionCode/versionName. Asked here rather than at the top so the numbers shown
# are the ones `git pull` just brought in, and after the --check exit so a
# verification run stays silent.
#
# Only when a human is present. Android's script calls Read-Host unconditionally,
# which is why CLAUDE.md has to warn that omitting -BumpVersion hangs an automated
# invocation; testing stdin removes the trap instead of documenting it. A
# non-interactive run therefore behaves exactly as it did before this prompt
# existed — no bump, with the warning below saying so.
if [[ $BUMP_SET -eq 0 ]]; then
  if [[ -t 0 ]]; then
    echo
    warn "Bump the build number before this App Store build?"
    echo "  y) Yes - CURRENT_PROJECT_VERSION $BUILD_NO -> $((BUILD_NO + 1)) (avoids Apple's ITMS-90062, 'build number already used')"
    echo "  n) No  - archive ${NEW_VERSION:-$VERSION} ($BUILD_NO) exactly as it stands"
    if [[ -z "$NEW_VERSION" ]]; then
      echo "     Either way MARKETING_VERSION stays $VERSION; --version <x> is what changes it."
    fi
    if ! read -r -p "Enter y/n (default: y): " choice; then
      die "No answer on stdin. Re-run with --bump or --no-bump."
    fi
    if [[ "$choice" == "n" || "$choice" == "N" ]]; then BUMP=0; else BUMP=1; fi
  else
    warn "Neither --bump nor --no-bump given, and stdin is not a terminal — not bumping."
    warn "Pass one of them explicitly for a scripted release."
  fi
fi

if [[ -n "$NEW_VERSION" ]]; then
  info "MARKETING_VERSION $VERSION -> $NEW_VERSION"
  run sed -i '' "s/MARKETING_VERSION = .*/MARKETING_VERSION = $NEW_VERSION;/g" "$PBXPROJ"
  VERSION="$NEW_VERSION"
fi

if [[ $BUMP -eq 1 ]]; then
  NEXT=$((BUILD_NO + 1))
  info "CURRENT_PROJECT_VERSION $BUILD_NO -> $NEXT  (Apple rejects reused build numbers, ITMS-90062)"
  run sed -i '' "s/CURRENT_PROJECT_VERSION = .*/CURRENT_PROJECT_VERSION = $NEXT;/g" "$PBXPROJ"
  BUILD_NO="$NEXT"
else
  warn "Not bumping the build number. If $BUILD_NO was already uploaded, this fails with ITMS-90062."
fi

# ================================ PREFLIGHT ===================================
# Guideline and metadata checks, run AFTER the version bump so they see the
# numbers that will actually ship. Placed before the archive because every
# failure it catches is cheaper here than 40 minutes later in App Review.
if [[ $SKIP_PREFLIGHT -eq 0 ]]; then
  info "Preflight (App Store guideline + metadata checks)"
  if [[ $DRY_RUN -eq 1 ]]; then
    printf '%s  would run: ./scripts/preflight-ios.sh%s\n' "$YEL" "$NC"
  elif ! "$ROOT/scripts/preflight-ios.sh"; then
    die "Preflight failed — see above. Fix, or re-run with --skip-preflight if you
have judged a specific failure acceptable for this submission."
  fi

  # store-guard covers the same ground as preflight-ios.sh plus the rules that
  # are not iOS-specific — hardcoded secrets, dev endpoints, privacy policy — and
  # the store-console gates that cannot be read from the repo at all.
  info "store-guard (App Store rule catalog)"
  if [[ $DRY_RUN -eq 1 ]]; then
    printf '%s  would run: npm run check:store:ios%s\n' "$YEL" "$NC"
  elif ! node "$ROOT/scripts/store-guard/bin/store-guard.js" check --ios; then
    die "store-guard failed — see above. Fix, or re-run with --skip-preflight if you
have judged a specific failure acceptable for this submission."
  fi
else
  warn "Skipping preflight (--skip-preflight)."
fi

# ================================== BUILD =====================================
info "Building $VERSION ($BUILD_NO)"

run npm --prefix "$ROOT" install

# --- --skip-pods is only honoured while it is actually safe -------------------
#
# A pod that is missing does not break anything you can see. xcodebuild archives
# happily, the upload succeeds, review passes, and the native module is simply
# undefined at runtime. @codeimplants/version-control shipped that way to every
# published iOS build: NativeModules.VCAppInfo did not exist, version detection
# quietly fell through to a wrong source, and every install was told to update
# forever. Nothing in any build log mentioned it.
#
# npm install runs immediately above, so a dependency can gain native code in the
# very run that skips linking it — which makes "faster when native deps are
# unchanged" a question the operator usually cannot answer.
#
# So check rather than ask: every dependency shipping a podspec must appear in
# Podfile.lock. If one does not, run pod install anyway and say why. Overriding
# beats aborting — someone passing --skip-pods wants speed, not a broken build,
# and aborting only invites a re-run without the flag.
#
# A podspec whose internal s.name differs from its filename would trigger a pod
# install that was not strictly needed: slower, never wrong. False negatives are
# the only dangerous direction here, and this has none.
if [[ $SKIP_PODS -eq 1 ]]; then
  # react-native's own podspecs are excluded: the Podfile pulls React core in
  # through use_react_native!, not through autolinking, and several of them are
  # opt-in variants (React-Core-prebuilt, ReactNativeDependencies) that correctly
  # never appear in Podfile.lock. Left in, they would flag on every single build
  # — and a warning that always fires is one nobody reads, which would cost
  # exactly the signal this check exists to give. React core going missing is
  # also not the failure being guarded against: that breaks the build loudly,
  # long before anything ships.
  podspecs="$(find "$ROOT/node_modules" -maxdepth 3 -name '*.podspec' \
    -not -path '*/node_modules/react-native/*' 2>/dev/null)"

  missing_pods=()
  while IFS= read -r podspec; do
    [[ -n "$podspec" ]] || continue
    pod_name="$(basename "$podspec" .podspec)"
    grep -q -- "- $pod_name " "$ROOT/ios/Podfile.lock" 2>/dev/null || missing_pods+=("$pod_name")
  done <<< "$podspecs"

  if [[ ${#missing_pods[@]} -gt 0 ]]; then
    warn "--skip-pods ignored: ${#missing_pods[@]} pod(s) are not in Podfile.lock yet:"
    printf '    %s\n' "${missing_pods[@]}"
    warn "Skipping would archive without them, and a missing native module fails silently at runtime."
    SKIP_PODS=0
  else
    ok "--skip-pods honoured: every podspec in node_modules is already in Podfile.lock."
  fi
fi

if [[ $SKIP_PODS -eq 0 ]]; then
  # LANG must be UTF-8 or CocoaPods aborts on this project's Devanagari paths.
  # PATH leads with POD_RUBY_BIN so a Ruby new enough for Expo's Podfile wins
  # over whatever a login shell put first. Bare `pod`, not `bundle exec` — see
  # the probe near the top for why bundler is not usable here any more.
  info "pod install (ruby: $POD_RUBY_BIN, LANG forced to UTF-8)"
  if [[ $DRY_RUN -eq 1 ]]; then
    printf '%s  would run: (cd ios && PATH=%s:$PATH LANG=en_US.UTF-8 pod install)%s\n' \
      "$YEL" "$POD_RUBY_BIN" "$NC"
  else
    (cd "$ROOT/ios" && PATH="$POD_RUBY_BIN:$PATH" \
      LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install)
  fi
fi

info "Archiving..."
run rm -rf "$ARCHIVE" "$EXPORT_DIR"
run xcodebuild -workspace "$ROOT/$WORKSPACE" -scheme "$SCHEME" -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$ARCHIVE" \
  -allowProvisioningUpdates archive

if [[ $DRY_RUN -eq 0 ]]; then
  [[ -d "$ARCHIVE" ]] || die "Archive not produced"
  # Verify the JS bundle made it in. A release build without main.jsbundle
  # launches to a white screen and the failure is silent at build time.
  APP="$ARCHIVE/Products/Applications/$SCHEME.app"
  [[ -f "$APP/main.jsbundle" ]] || die "main.jsbundle missing from the archive — the app would launch blank"
  ok "Archive OK, main.jsbundle $(du -h "$APP/main.jsbundle" | cut -f1)"
fi

info "Exporting .ipa..."
run xcodebuild -exportArchive -archivePath "$ARCHIVE" -exportPath "$EXPORT_DIR" \
  -exportOptionsPlist "$ROOT/$EXPORT_OPTIONS" -allowProvisioningUpdates

if [[ $DRY_RUN -eq 0 ]]; then
  [[ -f "$IPA" ]] || die "No .ipa produced at $IPA"
  ok "$(du -h "$IPA" | cut -f1) -> $IPA"
fi

# ================================== UPLOAD ====================================
if [[ $NO_UPLOAD -eq 1 ]]; then
  ok "Built $VERSION ($BUILD_NO). Skipped upload (--no-upload)."
  exit 0
fi

[[ $UPLOAD_READY -eq 1 ]] || die "Cannot upload: no API key configured.
The .ipa is ready at $IPA — upload it via Xcode Organizer, or set up a key (see $CONFIG)."

info "Validating with App Store Connect before upload..."
run xcrun altool --validate-app -f "$IPA" -t ios \
  --apiKey "$APP_STORE_KEY_ID" --apiIssuer "$APP_STORE_ISSUER_ID"

info "Uploading..."
run xcrun altool --upload-app -f "$IPA" -t ios \
  --apiKey "$APP_STORE_KEY_ID" --apiIssuer "$APP_STORE_ISSUER_ID"

ok "Uploaded $VERSION ($BUILD_NO)"
echo
info "Next, in App Store Connect (deliberately not automated):"
info "  1. Wait for processing (10-60 min)"
info "  2. Attach the build to the version — check the build NUMBER, it can default to an older one"
info "  3. Screenshots and release notes"
info "  4. Add for Review"

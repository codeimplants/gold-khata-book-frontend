#!/usr/bin/env bash
#
# Checks an iOS build against the App Store rejections and upload errors this
# project has actually hit. Reads only — changes nothing.
#
# Every check here exists because something was rejected or an upload failed.
# None of them is speculative:
#
#   Guideline 5.1.1(ii)  Sone Taran 2.0.0 was rejected for shipping Expo's
#                        default purpose strings ("Allow $(PRODUCT_NAME) to
#                        access your camera").
#   ITMS-90062           A reused build number. Builds 1 and 2 were consumed by
#                        failed attempts and build 3 was rejected on upload.
#   ITMS-90023           iPad enabled with no iPad icons in the asset catalog.
#   ITMS-90474           iPad enabled without all four orientations declared.
#   ITMS-90048           Non-ASCII CFBundleExecutable (the Devanagari app name).
#
# Usage:
#   ./scripts/preflight-ios.sh            # check, exit non-zero on any failure
#   ./scripts/preflight-ios.sh --warn     # report but always exit 0
#   ./scripts/preflight-ios.sh --no-remote  # skip the App Store Connect query
#
# Exit codes: 0 all passed (or --warn), 1 at least one FAIL.
#
# Warnings vs failures: a FAIL is something Apple will reject or refuse to
# accept. A WARN is something that needs human judgement — it cannot be decided
# from the file alone, so the script surfaces it rather than guessing.

set -uo pipefail   # deliberately not -e: every check must run, not just the first

RED=$'\033[0;31m'; GRN=$'\033[0;32m'; YEL=$'\033[1;33m'; CYA=$'\033[0;36m'; NC=$'\033[0m'

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="$ROOT/scripts/release-ios.config.sh"

WARN_ONLY=0; NO_REMOTE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --warn)      WARN_ONLY=1; shift ;;
    --no-remote) NO_REMOTE=1; shift ;;
    -h|--help)   sed -n '2,30p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)           echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

FAILURES=0; WARNINGS=0
pass() { printf '%s  ✓ %s%s\n' "$GRN" "$*" "$NC"; }
fail() { printf '%s  ✗ %s%s\n' "$RED" "$*" "$NC"; FAILURES=$((FAILURES + 1)); }
warn() { printf '%s  ! %s%s\n' "$YEL" "$*" "$NC"; WARNINGS=$((WARNINGS + 1)); }
head_() { printf '\n%s%s%s\n' "$CYA" "$*" "$NC"; }

[[ -f "$CONFIG" ]] && source "$CONFIG"
SCHEME="${SCHEME:-GoldKhataBook}"
PLIST="$ROOT/ios/$SCHEME/Info.plist"
PBXPROJ="$ROOT/ios/$SCHEME.xcodeproj/project.pbxproj"
PRIVACY="$ROOT/ios/$SCHEME/PrivacyInfo.xcprivacy"

[[ -f "$PLIST" ]]   || { printf '%sERROR: no Info.plist at %s%s\n' "$RED" "$PLIST" "$NC" >&2; exit 2; }
[[ -f "$PBXPROJ" ]] || { printf '%sERROR: no project.pbxproj at %s%s\n' "$RED" "$PBXPROJ" "$NC" >&2; exit 2; }

# Always read plists with `-o -`. `plutil -extract KEY json FILE` WRITES BACK to
# FILE and destroys it — that mistake cost a rebuild earlier in this project.
pl() { plutil -extract "$1" raw -o - "$PLIST" 2>/dev/null; }
setting() { grep -m1 -E "^\s+$1 = " "$PBXPROJ" | sed -E 's/.*= *([^;]+);.*/\1/' | tr -d '"'; }

# ============================ PURPOSE STRINGS =================================
# The Sone Taran rejection. A permission string that does not describe
# user-facing functionality in the app's own words is a 5.1.1(ii) violation.
head_ "Permission purpose strings (Guideline 5.1.1(ii))"

KEYS="$(plutil -p "$PLIST" 2>/dev/null | grep -oE '"NS[A-Za-z]*UsageDescription"' | tr -d '"' | sort -u)"
if [[ -z "$KEYS" ]]; then
  pass "no permission strings declared (nothing to justify)"
else
  while read -r key; do
    [[ -z "$key" ]] && continue
    val="$(pl "$key")"
    if [[ -z "$val" ]]; then
      # An empty string still shows the system prompt, with no explanation.
      fail "$key is EMPTY — Apple rejects a permission with no justification"
    elif [[ "$val" == *'$(PRODUCT_NAME)'* ]]; then
      fail "$key contains the literal \$(PRODUCT_NAME) — this is the Expo/RN default that got Sone Taran rejected"
    elif echo "$val" | grep -qiE "expo|development server|dev launcher|localhost"; then
      fail "$key describes developer tooling, not user functionality: \"${val:0:70}...\""
    elif [[ ${#val} -lt 40 ]]; then
      warn "$key is only ${#val} chars — reviewers want the specific reason: \"$val\""
    else
      pass "$key (${#val} chars)"
    fi
  done <<< "$KEYS"
fi

# Dev-server plumbing must never ship in a Release build.
if plutil -p "$PLIST" 2>/dev/null | grep -q "_expo._tcp"; then
  fail "NSBonjourServices advertises _expo._tcp — Expo dev-server discovery in a shipping build"
else
  pass "no Expo dev-server Bonjour services"
fi

if [[ "$(pl NSAllowsLocalNetworking)" == "true" ]]; then
  # Not auto-fail: RN debug builds legitimately need this, and some apps use it.
  warn "NSAllowsLocalNetworking is true — confirm the shipping app actually needs local networking"
fi

# ============================ PRIVACY MANIFEST ================================
head_ "Privacy manifest"

if [[ ! -f "$PRIVACY" ]]; then
  fail "PrivacyInfo.xcprivacy missing — required for App Store submission"
else
  pass "PrivacyInfo.xcprivacy present"
  # The stock template ships an empty array. An app that transmits names, phone
  # numbers and photos and declares it collects nothing contradicts its own
  # App Store Connect nutrition labels.
  COLLECTED="$(plutil -extract NSPrivacyCollectedDataTypes raw -o - "$PRIVACY" 2>/dev/null | tr -d '[:space:]')"
  if [[ -z "$COLLECTED" || "$COLLECTED" == "0" ]]; then
    fail "NSPrivacyCollectedDataTypes is EMPTY — this app collects names, phone numbers and photos; the manifest must match the App Store Connect privacy labels"
  else
    pass "NSPrivacyCollectedDataTypes declares $COLLECTED entr$([[ "$COLLECTED" == 1 ]] && echo y || echo ies)"
  fi
fi

# ============================== ENCRYPTION ====================================
head_ "Export compliance"
if [[ -z "$(pl ITSAppUsesNonExemptEncryption)" ]]; then
  # Without this, every single upload stops and waits for a manual answer.
  fail "ITSAppUsesNonExemptEncryption not declared — every upload will block on the encryption question"
else
  pass "ITSAppUsesNonExemptEncryption = $(pl ITSAppUsesNonExemptEncryption)"
fi

# ============================ NAME AND ENCODING ===============================
head_ "Bundle naming (ITMS-90048)"
PRODUCT_NAME="$(setting PRODUCT_NAME)"
if LC_ALL=C grep -q '[^[:print:]]' <<< "$PRODUCT_NAME"; then
  fail "PRODUCT_NAME '$PRODUCT_NAME' is not ASCII — the executable name must be ASCII"
else
  pass "PRODUCT_NAME '$PRODUCT_NAME' is ASCII"
fi
# The display name SHOULD be localized/Devanagari — that is the user-visible one.
[[ -n "$(pl CFBundleDisplayName)" ]] && pass "CFBundleDisplayName '$(pl CFBundleDisplayName)'"

# ============================== IPAD SUPPORT ==================================
head_ "iPad (ITMS-90023, ITMS-90474)"
FAMILY="$(setting TARGETED_DEVICE_FAMILY)"
if [[ "$FAMILY" == *"2"* ]]; then
  pass "iPad enabled (TARGETED_DEVICE_FAMILY = $FAMILY)"

  # `raw` does not enumerate arrays — it yields nothing and every build looks
  # broken. `json` is the only format that reliably lists the elements.
  IPAD_ORIENT="$(plutil -extract 'UISupportedInterfaceOrientations~ipad' json -o - "$PLIST" 2>/dev/null | grep -o 'UIInterfaceOrientation[A-Za-z]*' | sort -u | wc -l | tr -d ' ')"
  if [[ "${IPAD_ORIENT:-0}" -lt 4 ]]; then
    fail "iPad declares ${IPAD_ORIENT:-0}/4 orientations — Apple requires all four, including PortraitUpsideDown"
  else
    pass "all four iPad orientations declared"
  fi

  # 152/167 are the iPad-specific sizes missing from an iPhone-only catalog.
  ICONSET="$ROOT/ios/$SCHEME/Images.xcassets/AppIcon.appiconset"
  if [[ -d "$ICONSET" ]]; then
    # Match whitespace flexibly: Xcode writes `"size": "76x76"` but some tools
    # write `"size" : "76x76"`. A pattern that assumes one spacing silently
    # reports every icon as missing. The dots in 83.5 must also be escaped.
    MISSING=""
    for sz in 76x76 83.5x83.5; do
      pat="\"size\"[[:space:]]*:[[:space:]]*\"${sz//./\\.}\""
      grep -Eq "$pat" "$ICONSET/Contents.json" 2>/dev/null || MISSING="$MISSING $sz"
    done
    [[ -n "$MISSING" ]] && fail "iPad icon sizes missing from asset catalog:$MISSING" \
                        || pass "iPad icon sizes present"
  else
    warn "no AppIcon.appiconset found at $ICONSET"
  fi
else
  pass "iPhone only (TARGETED_DEVICE_FAMILY = $FAMILY) — iPad checks skipped"
fi

# ============================== VERSIONING ====================================
head_ "Versioning (ITMS-90062)"
VERSION="$(setting MARKETING_VERSION)"
BUILD_NO="$(setting CURRENT_PROJECT_VERSION)"
pass "project declares $VERSION ($BUILD_NO)"

# Debug and Release each carry their own copy; a bump that edits only one
# produces a build whose version depends on which configuration was used.
V_COUNT="$(grep -c "MARKETING_VERSION = " "$PBXPROJ")"
B_COUNT="$(grep -c "CURRENT_PROJECT_VERSION = " "$PBXPROJ")"
V_UNIQ="$(grep "MARKETING_VERSION = " "$PBXPROJ" | sed -E 's/.*= *([^;]+);.*/\1/' | sort -u | wc -l | tr -d ' ')"
B_UNIQ="$(grep "CURRENT_PROJECT_VERSION = " "$PBXPROJ" | sed -E 's/.*= *([^;]+);.*/\1/' | sort -u | wc -l | tr -d ' ')"
[[ "$V_UNIQ" == 1 ]] && pass "MARKETING_VERSION consistent across $V_COUNT configs" \
                     || fail "MARKETING_VERSION differs between build configurations"
[[ "$B_UNIQ" == 1 ]] && pass "CURRENT_PROJECT_VERSION consistent across $B_COUNT configs" \
                     || fail "CURRENT_PROJECT_VERSION differs between build configurations"

# Ask App Store Connect what already exists, rather than trusting local state.
if [[ $NO_REMOTE -eq 0 && -n "${APP_STORE_KEY_ID:-}" && -n "${APP_STORE_ISSUER_ID:-}" ]]; then
  APPS="$(xcrun altool --list-apps --apiKey "$APP_STORE_KEY_ID" --apiIssuer "$APP_STORE_ISSUER_ID" 2>/dev/null)"
  if [[ -n "$APPS" ]]; then
    LIVE="$(echo "$APPS" | awk '/Bundle ID: com.goldkhatabook.app/{f=1} f&&/Version String:/{print $NF}' | head -20)"
    if echo "$LIVE" | grep -qx "$VERSION"; then
      warn "version $VERSION already exists in App Store Connect — a new upload needs a higher build number, or a new version"
    else
      pass "version $VERSION is not yet in App Store Connect"
    fi
  else
    warn "could not query App Store Connect (network or credentials) — build-number uniqueness unverified"
  fi
else
  warn "skipping App Store Connect check — build-number uniqueness unverified"
fi

# ========================== USER-VISIBLE PLACEHOLDERS =========================
# Guideline 2.1: a reviewer who taps something and gets "Coming soon" treats the
# app as incomplete.
head_ "Placeholder content (Guideline 2.1)"
PLACEHOLDER="$(grep -rniE "coming soon|lorem ipsum|placeholder text" "$ROOT/src/localization" 2>/dev/null | head -5)"
if [[ -n "$PLACEHOLDER" ]]; then
  warn "placeholder strings in localization — a reviewer reaching these reads the app as unfinished:"
  echo "$PLACEHOLDER" | sed 's/^/      /'
else
  pass "no placeholder strings in localization"
fi

# ========================== ACCOUNT DELETION (5.1.1(v)) =======================
head_ "Account deletion (Guideline 5.1.1(v))"
if grep -rq "dukandar/me\|deleteOwnAccount\|deleteAccount" "$ROOT/src" 2>/dev/null; then
  pass "account deletion code present"
  # The 1.0.10 submission deliberately shipped the endpoint with the UI removed.
  # That is defensible only while the app also has no account CREATION in-app.
  grep -rqiE "delete.*account|account.*delete" "$ROOT/src/screens" 2>/dev/null \
    && pass "deletion appears reachable from a screen" \
    || warn "deletion code exists but no screen references it — if the app creates accounts, 5.1.1(v) requires a reachable deletion path"
else
  warn "no account deletion found — required if the app supports account creation"
fi

# ================================= SUMMARY ====================================
printf '\n%s%s%s\n' "$CYA" "────────────────────────────────────────" "$NC"
if [[ $FAILURES -eq 0 && $WARNINGS -eq 0 ]]; then
  printf '%sAll preflight checks passed.%s\n' "$GRN" "$NC"
elif [[ $FAILURES -eq 0 ]]; then
  printf '%s%d warning(s), 0 failures — review the warnings above, then proceed.%s\n' "$YEL" "$WARNINGS" "$NC"
else
  printf '%s%d FAILURE(S), %d warning(s).%s\n' "$RED" "$FAILURES" "$WARNINGS" "$NC"
  printf '%sEach failure above is something Apple will reject or refuse to accept.%s\n' "$RED" "$NC"
fi

[[ $WARN_ONLY -eq 1 ]] && exit 0
[[ $FAILURES -gt 0 ]] && exit 1
exit 0

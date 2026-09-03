#!/usr/bin/env bash
#
# Capture App Store screenshots from the iOS simulators Apple requires.
#
# Boots the right device, waits for it, then hands control back to you: navigate
# the app yourself and name each shot as you take it. Driving the navigation
# from a script was considered and rejected — it depends on login state, seeded
# data and screen order, so it breaks constantly and fails silently by capturing
# the wrong screen. A human at the keyboard is both faster and more reliable
# here, and the tedious parts (right device, right resolution, right folder,
# sequential numbering) are what this automates.
#
# Usage:
#   ./scripts/screenshot-ios.sh                    both required targets
#   ./scripts/screenshot-ios.sh --target ipad-13   just one
#   ./scripts/screenshot-ios.sh --list             show devices and exit
#   ./scripts/screenshot-ios.sh --keep             add to existing shots
#
# Apple scales the 6.9" iPhone set down for smaller iPhones, so those are the
# only iPhone shots needed. iPad is NOT covered by that scaling and is required
# separately whenever the listing is iPad-enabled — see store-assets/README.md.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_BASE="$ROOT/store-assets/screenshots/ios"
BUNDLE_ID="com.goldkhatabook.app"

RED=$'\033[0;31m'; GRN=$'\033[0;32m'; YEL=$'\033[0;33m'; CYN=$'\033[0;36m'; NC=$'\033[0m'
info() { printf '%s%s%s\n' "$CYN" "$1" "$NC"; }
ok()   { printf '%s✓ %s%s\n' "$GRN" "$1" "$NC"; }
warn() { printf '%s! %s%s\n' "$YEL" "$1" "$NC"; }
die()  { printf '%s✗ %s%s\n' "$RED" "$1" "$NC" >&2; exit 1; }

# target | simulator name | accepted portrait resolutions (Apple allows either)
TARGETS=(
  "iphone-6.9|iPhone 17 Pro Max|1320x2868 1290x2796"
  "ipad-13|iPad Pro 13-inch (M5)|2064x2752 2048x2732"
)

ONLY=""; KEEP=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --target) ONLY="${2:-}"; shift 2 ;;
    --keep)   KEEP=1; shift ;;
    --list)
      info "Simulators available for the required sizes:"
      for row in "${TARGETS[@]}"; do
        IFS='|' read -r t name _ <<< "$row"
        line="$(xcrun simctl list devices available 2>/dev/null | grep -F "$name (" | head -1 || true)"
        [[ -n "$line" ]] && printf '  %-12s %s\n' "$t" "$(echo "$line" | sed 's/^ *//')" \
                         || printf '  %-12s %sMISSING — install via Xcode > Settings > Components%s\n' "$t" "$YEL" "$NC"
      done
      exit 0 ;;
    -h|--help) sed -n '2,25p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "Unknown option: $1" ;;
  esac
done

command -v xcrun >/dev/null || die "xcrun not found — Xcode command line tools required."

capture_target() {
  local target="$1" device="$2" sizes="$3"
  local out="$OUT_BASE/$target"

  local udid
  udid="$(xcrun simctl list devices available 2>/dev/null \
          | grep -F "$device (" | head -1 \
          | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/' || true)"
  [[ -n "$udid" ]] || { warn "No simulator named '$device' — skipping $target."; return 0; }

  info "── $target — $device"
  mkdir -p "$out"

  if [[ $KEEP -eq 0 ]]; then
    # Stale shots left beside new ones is how a listing ends up mixing two
    # designs, which is exactly what this folder exists to prevent.
    local existing
    existing="$(find "$out" -maxdepth 1 -name '*.png' | wc -l | tr -d ' ')"
    if [[ "$existing" != "0" ]]; then
      read -r -p "  $existing existing shot(s) in $target. Delete them? [y/N] " reply
      [[ "$reply" =~ ^[Yy]$ ]] && rm -f "$out"/*.png && ok "cleared" || info "  keeping them; new shots continue the numbering"
    fi
  fi

  xcrun simctl bootstatus "$udid" -b >/dev/null 2>&1 || xcrun simctl boot "$udid" >/dev/null 2>&1 || true
  xcrun simctl bootstatus "$udid" -b >/dev/null 2>&1 || true
  open -a Simulator --args -CurrentDeviceUDID "$udid" >/dev/null 2>&1 || true
  ok "booted"

  if xcrun simctl get_app_container "$udid" "$BUNDLE_ID" >/dev/null 2>&1; then
    xcrun simctl launch "$udid" "$BUNDLE_ID" >/dev/null 2>&1 || true
    ok "launched $BUNDLE_ID"
  else
    warn "$BUNDLE_ID is not installed on this simulator."
    echo "    Install it first, then re-run:"
    echo "      npx react-native run-ios --udid $udid"
    read -r -p "  Continue anyway (capture whatever is on screen)? [y/N] " reply
    [[ "$reply" =~ ^[Yy]$ ]] || return 0
  fi

  echo
  echo "  Navigate to a screen, type a short name, press Enter to capture."
  echo "  Empty name finishes this device.   Suggested: dashboard, create-invoice,"
  echo "  old-gold, customers, photos"
  echo
  warn "Release build, realistic shop data, no debug toast — see store-assets/README.md"
  echo

  local n
  n="$(find "$out" -maxdepth 1 -name '*.png' | wc -l | tr -d ' ')"
  while true; do
    read -r -p "  [$target] name (Enter to finish): " name || break
    [[ -z "$name" ]] && break

    name="$(echo "$name" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-')"
    [[ -n "$name" ]] || { warn "  name had no usable characters, try again"; continue; }

    n=$((n + 1))
    local file
    file="$(printf '%s/%02d-%s.png' "$out" "$n" "$name")"
    xcrun simctl io "$udid" screenshot "$file" >/dev/null 2>&1 \
      || { warn "  capture failed"; n=$((n - 1)); continue; }

    local w h got
    w="$(sips -g pixelWidth  "$file" 2>/dev/null | awk '/pixelWidth/{print $2}')"
    h="$(sips -g pixelHeight "$file" 2>/dev/null | awk '/pixelHeight/{print $2}')"
    got="${w}x${h}"

    if [[ " $sizes " == *" $got "* ]]; then
      ok "  $(basename "$file")  $got"
    else
      # Worth stopping for: App Store Connect rejects the upload outright, and
      # finding out at submission time means recapturing the whole set.
      warn "  $(basename "$file")  $got — App Store expects one of: $sizes"
      warn "  wrong device, or the simulator is rotated/scaled"
    fi
  done

  local total
  total="$(find "$out" -maxdepth 1 -name '*.png' | wc -l | tr -d ' ')"
  ok "$target: $total shot(s) in store-assets/screenshots/ios/$target"
  echo
}

did_any=0
for row in "${TARGETS[@]}"; do
  IFS='|' read -r target device sizes <<< "$row"
  [[ -n "$ONLY" && "$ONLY" != "$target" ]] && continue
  capture_target "$target" "$device" "$sizes"
  did_any=1
done

[[ $did_any -eq 1 ]] || die "No target matched '$ONLY'. Known: iphone-6.9, ipad-13"

info "Done. Review them, then commit — store-assets/ is tracked on purpose."

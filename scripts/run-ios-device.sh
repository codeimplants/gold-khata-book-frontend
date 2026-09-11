#!/usr/bin/env bash
#
# Install and run a development build on an iPhone or a simulator.
#
# The iOS counterpart to run-android-device.ps1, and it exists for the same
# reason that script does: APP_ENV is baked into the JS bundle by babel
# (babel.config.js) and DEFAULTS TO 'prod' when unset. Running
# `react-native run-ios` or building from Xcode directly never sets it, so a
# debug build off a developer's machine silently talks to the production
# backend and writes to real shop data. This script always pins it, and
# defaults to dev.
#
# Usage:
#   ./scripts/run-ios-device.sh                      simulator, dev backend
#   ./scripts/run-ios-device.sh --device             connected iPhone, dev backend
#   ./scripts/run-ios-device.sh --device --standalone  installs a build that runs unplugged
#   ./scripts/run-ios-device.sh --sim "iPhone 17 Pro"
#   ./scripts/run-ios-device.sh --app-env preprod
#   ./scripts/run-ios-device.sh --list               show devices and exit
#
# --standalone is the flag that decides whether the phone can leave your desk.
# A normal debug build fetches its JavaScript from Metro at launch, so the phone
# must stay reachable from this machine. --standalone builds Release, which
# bakes the JS into the app, so it runs with the cable out and Metro closed.
# It is also the only mode that reflects release behaviour (console.log
# stripped, Hermes optimizations, ATS enforced) - see CLAUDE.md.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCHEME="GoldKhataBook"
WORKSPACE="$ROOT/ios/GoldKhataBook.xcworkspace"
BUNDLE_ID="com.goldkhatabook.app"
DERIVED="$ROOT/ios/build/run"
ENV_MARKER="$DERIVED/last-app-env.txt"

RED=$'\033[0;31m'; GRN=$'\033[0;32m'; YEL=$'\033[0;33m'; CYN=$'\033[0;36m'; NC=$'\033[0m'
info() { printf '%s%s%s\n' "$CYN" "$1" "$NC"; }
ok()   { printf '%s✓ %s%s\n' "$GRN" "$1" "$NC"; }
warn() { printf '%s! %s%s\n' "$YEL" "$1" "$NC"; }
die()  { printf '%s✗ %s%s\n' "$RED" "$1" "$NC" >&2; exit 1; }

APP_ENV="dev"; TARGET="sim"; SIM_NAME="iPhone 17"; DEVICE_UDID=""; STANDALONE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --app-env)    APP_ENV="${2:-}"; shift 2 ;;
    --device)     TARGET="device"; shift
                  if [[ "${1:-}" != "" && "${1:-}" != --* ]]; then DEVICE_UDID="$1"; shift; fi ;;
    --sim)        TARGET="sim"; shift
                  if [[ "${1:-}" != "" && "${1:-}" != --* ]]; then SIM_NAME="$1"; shift; fi ;;
    --standalone) STANDALONE=1; shift ;;
    --list)       TARGET="list"; shift ;;
    -h|--help)    sed -n '2,28p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)            die "Unknown option: $1" ;;
  esac
done

if [[ "$TARGET" == "list" ]]; then
  info "Connected devices:"
  xcrun devicectl list devices 2>/dev/null || warn "devicectl unavailable (needs Xcode 15+)"
  info ""; info "Booted simulators:"
  xcrun simctl list devices booted
  exit 0
fi

case "$APP_ENV" in
  dev|preprod|prod) ;;
  *) die "--app-env must be dev, preprod or prod (got '$APP_ENV')" ;;
esac
[[ "$APP_ENV" == "prod" ]] && warn "APP_ENV=prod - this build writes to REAL shop data."

# Authoritative for babel: it loads this with override:true, so it beats any
# stale APP_ENV left in the shell or inherited by Xcode's build environment.
# .env is gitignored and rewritten every run so it always matches this build.
printf 'APP_ENV=%s' "$APP_ENV" > "$ROOT/.env"
export APP_ENV
ok "APP_ENV pinned to $APP_ENV"

# Metro caches transforms with the env already baked in, and APP_ENV is not part
# of its cache key - so a switch has to invalidate it or the app keeps the old
# backend. Same reasoning as Reset-ReleaseBundleIfEnvChanged on the Android side.
LAST_ENV=""; [[ -f "$ENV_MARKER" ]] && LAST_ENV="$(cat "$ENV_MARKER")"
RESET_CACHE=0
[[ "$LAST_ENV" != "$APP_ENV" ]] && RESET_CACHE=1

CONFIG="Debug"; [[ $STANDALONE -eq 1 ]] && CONFIG="Release"

if [[ "$TARGET" == "device" ]]; then
  command -v xcrun >/dev/null || die "Xcode command line tools not found."
  if [[ -z "$DEVICE_UDID" ]]; then
    # Pick the identifier by its shape, not its column: both the name and the
    # model columns contain spaces, so counting fields lands on the wrong one.
    DEVICE_UDID="$(xcrun devicectl list devices 2>/dev/null | awk '
      /connected/ {
        for (i = 1; i <= NF; i++)
          if ($i ~ /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/) { print $i; exit }
      }')" || true
    [[ -z "$DEVICE_UDID" ]] && die "No connected device found. Unlock the iPhone, tap Trust, then re-run (or pass a UDID; --list shows them)."
  fi
  info "Building $CONFIG for device $DEVICE_UDID..."
  DESTINATION="id=$DEVICE_UDID"
else
  info "Building $CONFIG for simulator '$SIM_NAME'..."
  xcrun simctl boot "$SIM_NAME" 2>/dev/null || true
  DESTINATION="platform=iOS Simulator,name=$SIM_NAME"
fi

# The log is filtered, but the STATUS must come from xcodebuild rather than from
# grep at the end of the pipe. Getting that wrong meant a failed build still
# found the previous run stale .app on disk and cheerfully reported success.
LOG="$DERIVED/last-build.log"
mkdir -p "$DERIVED"
set +e
xcodebuild -workspace "$WORKSPACE" -scheme "$SCHEME" -configuration "$CONFIG" \
  -destination "$DESTINATION" -derivedDataPath "$DERIVED" \
  -allowProvisioningUpdates ONLY_ACTIVE_ARCH=YES > "$LOG" 2>&1
BUILD_STATUS=$?
set -e
grep -E "^(.*)error:|BUILD (SUCCEEDED|FAILED)" "$LOG" | tail -20 || true
if [[ $BUILD_STATUS -ne 0 ]]; then
  die "Build failed (full log: $LOG)"
fi

# Addressed exactly, never "first match". Products/ accumulates one directory
# per configuration+platform and nothing prunes them, so a plain find happily
# returned a Debug-iphonesimulator build left over from an earlier run and fed a
# simulator binary to a phone - which fails as an invalid code signature, and
# reads as a signing problem rather than the wrong-file problem it is.
PLATFORM_DIR="iphoneos"; [[ "$TARGET" == "sim" ]] && PLATFORM_DIR="iphonesimulator"
APP="$DERIVED/Build/Products/$CONFIG-$PLATFORM_DIR/$SCHEME.app"
[[ -d "$APP" ]] || die "Build reported success but $CONFIG-$PLATFORM_DIR/$SCHEME.app is missing - see $LOG"
mkdir -p "$DERIVED"; printf '%s' "$APP_ENV" > "$ENV_MARKER"
ok "Built $APP"

if [[ "$TARGET" == "device" ]]; then
  info "Installing on device..."
  xcrun devicectl device install app --device "$DEVICE_UDID" "$APP" >/dev/null \
    || die "Install failed. Check the device is unlocked and trusted."
  ok "Installed"
  xcrun devicectl device process launch --device "$DEVICE_UDID" "$BUNDLE_ID" >/dev/null \
    || warn "Could not launch automatically - open the app from the home screen."
else
  xcrun simctl install booted "$APP"
  xcrun simctl launch booted "$BUNDLE_ID" >/dev/null
fi

ok "Running ($APP_ENV backend, $CONFIG build)"
if [[ $STANDALONE -eq 1 ]]; then
  ok "Standalone build - the JS is baked in. Unplug and test anywhere."
else
  info ""
  warn "Debug build: the app loads its JavaScript from Metro, so this machine must stay reachable."
  if [[ $RESET_CACHE -eq 1 ]]; then
    info "APP_ENV changed since the last run - start Metro with:  npx react-native start --reset-cache"
  else
    info "Start Metro if it is not already running:  npx react-native start"
  fi
  [[ "$TARGET" == "device" ]] && info "To go cable-free on the same Wi-Fi, shake the phone > Configure Bundler > this Mac's LAN IP, port 8081."
fi

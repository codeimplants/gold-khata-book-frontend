# Installs and launches a DEBUG build on a connected Android device (USB or
# wireless adb) with Metro/Fast Refresh, for visually iterating on UI bugs -
# without an emulator and without a full signed release build.
#
# Run from anywhere:
#   powershell -File scripts\run-android-device.ps1
#   powershell -File scripts\run-android-device.ps1 -ConnectAddress 192.168.0.107:38951
#   powershell -File scripts\run-android-device.ps1 -AppEnv preprod
#
# Unlike build-test-apk.ps1/build-playstore-aab.ps1, this script does NOT run
# `git pull` first - it's meant for iterating on uncommitted working-tree
# changes, which is the whole point of avoiding the release-APK path.
#
# -AppEnv defaults to "dev" here (the opposite of the release scripts, which
# require -AppEnv explicitly and otherwise prompt). Plain `npm run android` /
# `react-native run-android` never sets APP_ENV, and it falls back to "prod"
# (see src/config/index.ts + babel.config.js's transform-define) - so this
# script always sets $env:APP_ENV explicitly to avoid silently pointing a UI
# debug session at the production backend.
#
# -ConnectAddress is the device's Wi-Fi adb "connect" address (from the phone's
# main Wireless debugging screen, e.g. 192.168.0.107:38951). Wireless adb
# connections drop when idle, so passing this re-connects automatically each
# run. One-time pairing (adb pair) must be done manually first - see README.
#
# NOTE: this builds via `gradlew.bat` directly + `adb install`/`adb shell am start`,
# instead of `npx react-native run-android`. On Node 24 (and other Node versions
# with the child_process.spawn Windows .bat/.cmd hardening backported), the RN
# CLI's own gradlew.bat invocation fails with "'gradlew.bat' is not recognized"
# because spawn() no longer auto-shells .bat files - even though running
# gradlew.bat directly (as this script and build-test-apk.ps1 do) works fine.

param([string]$AppEnv = "dev", [string]$ConnectAddress)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "lib\adb-device.ps1")
. (Join-Path $PSScriptRoot "lib\app-env.ps1")

$validEnvs = @("dev", "preprod", "prod")
if ($validEnvs -notcontains $AppEnv) {
    Write-Host "ERROR: -AppEnv must be one of: $($validEnvs -join ', ') (got '$AppEnv')" -ForegroundColor Red
    exit 1
}

# Pin APP_ENV via process env + authoritative .env. Debug loads JS from Metro
# (started below with --reset-cache), so no gradle bundle reset is needed here.
Set-AppEnv -Root $root -AppEnv $AppEnv
Write-Host "APP_ENV=$AppEnv" -ForegroundColor Cyan
if ($AppEnv -eq "prod") {
    Write-Host "WARNING: running a debug build against PRODUCTION - real OTPs will be sent." -ForegroundColor Red
}

$serial = Get-ReadyAdbDevice -ConnectAddress $ConnectAddress
Write-Host "Using device: $serial" -ForegroundColor Cyan

function Test-MetroUp {
    (Test-NetConnection -ComputerName "127.0.0.1" -Port 8081 -WarningAction SilentlyContinue -InformationLevel Quiet)
}

if (Test-MetroUp) {
    Write-Host "Metro already running on :8081, reusing it." -ForegroundColor Yellow
} else {
    Write-Host "Starting Metro bundler in a new window..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root'; npx react-native start --reset-cache"

    $waited = 0
    while (-not (Test-MetroUp) -and $waited -lt 30) {
        Start-Sleep -Seconds 1
        $waited++
    }
    if (-not (Test-MetroUp)) {
        Write-Host "ERROR: Metro did not come up on port 8081 within 30s. Check the Metro window for errors." -ForegroundColor Red
        exit 1
    }
    Write-Host "Metro is up." -ForegroundColor Green
}

$apk = Join-Path $root "android\app\build\outputs\apk\debug\app-debug.apk"

Push-Location (Join-Path $root "android")
try {
    & .\gradlew.bat assembleDebug "-PreactNativeArchitectures=arm64-v8a" --parallel
    $exit = $LASTEXITCODE
} finally {
    Pop-Location
}

if ($exit -ne 0 -or -not (Test-Path $apk)) {
    Write-Host "`nBUILD FAILED (exit $exit)." -ForegroundColor Red
    exit 1
}

# Debug builds load JS from Metro at runtime rather than bundling it - `adb
# reverse` lets the device reach Metro at localhost:8081 regardless of
# transport (works for wireless adb too, not just USB).
& adb -s $serial reverse tcp:8081 tcp:8081 | Out-Null

Write-Host "Installing on $serial..." -ForegroundColor Cyan
& adb -s $serial install -r $apk
if ($LASTEXITCODE -ne 0) {
    Write-Host "`nERROR: adb install failed." -ForegroundColor Red
    exit 1
}

& adb -s $serial shell am start -n com.goldkhatabook.app/.MainActivity | Out-Null

Write-Host "`nInstalled and launched on $serial (APP_ENV=$AppEnv)." -ForegroundColor Green
Write-Host "Next: powershell -File scripts\screenshot-device.ps1" -ForegroundColor Green
exit 0

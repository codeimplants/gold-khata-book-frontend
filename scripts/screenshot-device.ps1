# Captures the current screen of a connected Android device (USB or wireless
# adb) to a PNG file, so it can be inspected (e.g. via Claude Code's Read tool)
# without needing to install/screenshot manually.
#
# Run from anywhere:
#   powershell -File scripts\screenshot-device.ps1
#   powershell -File scripts\screenshot-device.ps1 -OutFile screenshots\tabbar.png
#
# Requires a device already connected - run scripts\run-android-device.ps1
# first (or `adb connect <ip>:<port>` for an already-installed app).

param([string]$OutFile)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "lib\adb-device.ps1")

$serial = Get-ReadyAdbDevice

$shotsDir = Join-Path $root "screenshots"
if (-not (Test-Path $shotsDir)) {
    New-Item -ItemType Directory -Path $shotsDir | Out-Null
}

if (-not $OutFile) {
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $OutFile = Join-Path $shotsDir "device-$timestamp.png"
}

$devicePath = "/sdcard/tmp_screenshot.png"

& adb -s $serial shell screencap -p $devicePath
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: screencap failed on device $serial." -ForegroundColor Red
    exit 1
}

& adb -s $serial pull $devicePath $OutFile | Out-Null
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $OutFile)) {
    Write-Host "ERROR: failed to pull screenshot from device $serial." -ForegroundColor Red
    exit 1
}

& adb -s $serial shell rm $devicePath | Out-Null

Write-Host "Screenshot saved: $OutFile" -ForegroundColor Green

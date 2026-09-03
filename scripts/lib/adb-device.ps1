# Shared helper: resolve exactly one ready (authorized, online) adb device,
# or exit with a clear error. Dot-source this from other scripts:
#   . (Join-Path $PSScriptRoot "lib\adb-device.ps1")
#   $serial = Get-ReadyAdbDevice -ConnectAddress $ConnectAddress

function Get-ReadyAdbDevice {
    param([string]$ConnectAddress)

    if ($ConnectAddress) {
        Write-Host "Connecting to $ConnectAddress..." -ForegroundColor Cyan
        & adb connect $ConnectAddress | Out-Null
    }

    $lines = & adb devices | Select-Object -Skip 1 | Where-Object { $_.Trim() -ne "" }

    $devices = @()
    foreach ($line in $lines) {
        $parts = $line -split "\s+"
        $devices += [PSCustomObject]@{ Serial = $parts[0]; State = $parts[1] }
    }

    if ($devices.Count -eq 0) {
        Write-Host "ERROR: No device connected. See README > 'Debugging on a physical device over Wi-Fi' to pair/connect, then re-run." -ForegroundColor Red
        exit 1
    }

    $unauthorized = $devices | Where-Object { $_.State -eq "unauthorized" }
    if ($unauthorized) {
        Write-Host "ERROR: Device(s) unauthorized: $($unauthorized.Serial -join ', '). Accept the debugging prompt on the phone, or re-pair (see README), then re-run." -ForegroundColor Red
        exit 1
    }

    $offline = $devices | Where-Object { $_.State -eq "offline" }
    if ($offline) {
        Write-Host "ERROR: Device(s) offline: $($offline.Serial -join ', '). Wi-Fi adb connections drop when idle - run 'adb connect <ip>:<port>' again, then re-run." -ForegroundColor Red
        exit 1
    }

    $ready = $devices | Where-Object { $_.State -eq "device" }
    if ($ready.Count -eq 0) {
        Write-Host "ERROR: No device in a ready state. Raw 'adb devices' output:" -ForegroundColor Red
        & adb devices
        exit 1
    }
    if ($ready.Count -gt 1) {
        Write-Host "ERROR: Multiple devices connected: $($ready.Serial -join ', '). Disconnect all but one and re-run." -ForegroundColor Red
        exit 1
    }

    return $ready[0].Serial
}

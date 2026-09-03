# Shared helpers for pinning which backend (dev/preprod/prod) gets baked into a
# build. Dot-source from other scripts:
#   . (Join-Path $PSScriptRoot "lib\app-env.ps1")
#   Set-AppEnv -Root $root -AppEnv $AppEnv                 # every script
#   Reset-ReleaseBundleIfEnvChanged -Root $root -AppEnv $AppEnv   # release builds only
#   ... run gradle ...
#   Save-BuiltAppEnv -Root $root -AppEnv $AppEnv           # only on build success
#
# WHY: APP_ENV is baked into the JS bundle at bundle time by babel transform-define
# (babel.config.js), defaulting to 'prod' when unset. Two things break naive env
# switching on incremental builds:
#   1. The Gradle release-bundle task ignores APP_ENV (not a tracked input) and is
#      UP-TO-DATE-skipped, so the APK is repackaged with the previously baked bundle.
#   2. A reused Gradle daemon may spawn node with a stale environment, so the shell's
#      $env:APP_ENV never reaches babel and it falls back to 'prod'.
# Set-AppEnv fixes (2) by writing an authoritative .env (babel loads it with
# override:true). Reset-ReleaseBundleIfEnvChanged fixes (1) by deleting the cheap
# JS-bundle outputs (NOT a full `gradlew clean`) + Metro cache when the env changes.

# Pin APP_ENV for this process AND write .env so babel bakes it deterministically,
# regardless of whether a reused Gradle daemon propagates the process environment.
function Set-AppEnv {
    param(
        [Parameter(Mandatory)] [string]$Root,
        [Parameter(Mandatory)] [string]$AppEnv
    )
    $env:APP_ENV = $AppEnv
    $envFile = Join-Path $Root ".env"
    # .env is gitignored; overwrite it every run so it always matches this build.
    Set-Content -Path $envFile -Value "APP_ENV=$AppEnv" -Encoding utf8 -NoNewline
}

# The marker records which env the last successful release bundle was built with.
function Get-BuiltAppEnvMarkerPath {
    param([Parameter(Mandatory)] [string]$Root)
    Join-Path $Root "android\app\build\last-app-env.txt"
}

# When the requested env differs from the last release build (or is unknown),
# delete the release JS-bundle outputs so Gradle re-bundles, and clear the Metro
# transform cache so it can't serve a stale env-baked transform. Leaves compiled
# native code untouched, so it's a ~1-2 min re-bundle, not a multi-hour clean.
function Reset-ReleaseBundleIfEnvChanged {
    param(
        [Parameter(Mandatory)] [string]$Root,
        [Parameter(Mandatory)] [string]$AppEnv
    )

    $marker = Get-BuiltAppEnvMarkerPath -Root $Root
    $last = if (Test-Path $marker) { (Get-Content $marker -Raw).Trim() } else { $null }

    if ($last -eq $AppEnv) {
        Write-Host "APP_ENV unchanged since last build ($AppEnv) - keeping cached JS bundle." -ForegroundColor DarkGray
        return
    }

    Write-Host "APP_ENV changed ($last -> $AppEnv) - forcing JS re-bundle (native build stays cached)..." -ForegroundColor Yellow

    $buildDir = Join-Path $Root "android\app\build"
    $bundlePaths = @(
        (Join-Path $buildDir "generated\assets\react\release"),
        (Join-Path $buildDir "generated\res\react\release"),
        (Join-Path $buildDir "intermediates\assets\release"),
        (Join-Path $buildDir "intermediates\merged_assets\release")
    )
    foreach ($p in $bundlePaths) {
        if (Test-Path $p) { Remove-Item -Recurse -Force $p }
    }

    # Metro persistent caches live in TEMP and key off source/config content, not
    # the resolved APP_ENV value, so clear them when the env changes.
    if ($env:TEMP) {
        Get-ChildItem -Path $env:TEMP -Filter "metro-*" -Force -ErrorAction SilentlyContinue |
            ForEach-Object { Remove-Item -Recurse -Force $_.FullName -ErrorAction SilentlyContinue }
    }
}

# Record the env of a successful build so future builds can detect a change.
function Save-BuiltAppEnv {
    param(
        [Parameter(Mandatory)] [string]$Root,
        [Parameter(Mandatory)] [string]$AppEnv
    )
    $marker = Get-BuiltAppEnvMarkerPath -Root $Root
    $dir = Split-Path -Parent $marker
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    Set-Content -Path $marker -Value $AppEnv -Encoding utf8 -NoNewline
}

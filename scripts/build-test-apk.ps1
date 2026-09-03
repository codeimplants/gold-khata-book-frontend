# Builds a signed release APK for LOCAL PHONE TESTING (arm64-v8a only = fast).
# Install the resulting .apk directly on any modern Android phone.
#
# Run from anywhere:
#   powershell -File scripts\build-test-apk.ps1       # prompts for dev/preprod/prod
#   (or double-click / run scripts\build-test-apk.cmd)
#
# Add -Clean to force a full rebuild (only if a build is broken).
# Pass -AppEnv explicitly (dev/preprod/prod) to skip the interactive prompt
# (used by automation/AI - see CLAUDE.md).
# Add -SkipPull to build without pulling latest from git first (e.g. offline,
# or intentionally testing an older commit).

# Backend environment baked into the JS bundle (dev / preprod / prod).
# See src/config/environments/*.ts for what each one points to.
param([switch]$Clean, [string]$AppEnv, [switch]$SkipPull)

$ErrorActionPreference = "Stop"
$root    = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "lib\app-env.ps1")
. (Join-Path $PSScriptRoot "lib\js-bundle.ps1")
$logFile = Join-Path $root "build-times.log"
$apk     = Join-Path $root "android\app\build\outputs\apk\release\app-release.apk"
$validEnvs = @("dev", "preprod", "prod")

if (-not $SkipPull) {
    Write-Host "Pulling latest changes (git pull --ff-only)..." -ForegroundColor Cyan
    & git -C $root pull --ff-only
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: git pull failed. If local changes conflict with incoming updates, commit/stash them first." -ForegroundColor Red
        Write-Host "If history has diverged, resolve manually (merge/rebase) and re-run, or pass -SkipPull to build as-is." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Skipping git pull (-SkipPull) - building whatever is currently on disk." -ForegroundColor Yellow
}

if (-not $AppEnv) {
    Write-Host ""
    Write-Host "Which backend should this test APK point to?" -ForegroundColor Yellow
    Write-Host "  1) dev      - https://dev.api.goldkhatabook.codeimplants.com (test OTP)"
    Write-Host "  2) preprod  - https://preprod.api.goldkhatabook.codeimplants.com (test OTP)"
    Write-Host "  3) prod     - https://api.goldkhatabook.codeimplants.com (REAL OTP - real users)"
    $choice = Read-Host "Enter 1-3 (default: 1/dev)"
    $AppEnv = switch ($choice) {
        "2" { "preprod" }
        "3" { "prod" }
        "preprod" { "preprod" }
        "prod" { "prod" }
        "dev" { "dev" }
        default { "dev" }
    }
}

if ($validEnvs -notcontains $AppEnv) {
    Write-Host "ERROR: -AppEnv must be one of: $($validEnvs -join ', ') (got '$AppEnv')" -ForegroundColor Red
    exit 1
}

# Pin APP_ENV (process env + authoritative .env) and, if the env changed since the
# last build, force the JS bundle to regenerate so the selected backend is actually
# baked in - see scripts/lib/app-env.ps1 for why this is necessary.
Set-AppEnv -Root $root -AppEnv $AppEnv
Reset-ReleaseBundleIfEnvChanged -Root $root -AppEnv $AppEnv

# Refuse to build if a prebuilt bundle sits in src/main/assets - it would silently
# shadow the generated one and ship old JavaScript. See scripts/lib/js-bundle.ps1.
Assert-NoStrayJsBundle -Root $root

if ($AppEnv -eq "prod") {
    Write-Host "WARNING: building a TEST apk against PRODUCTION - real OTPs will be sent." -ForegroundColor Red
}

Write-Host "Building TEST APK (arm64-v8a, APP_ENV=$AppEnv, clean=$($Clean.IsPresent))..." -ForegroundColor Cyan
$start = Get-Date

Push-Location (Join-Path $root "android")
try {
    # $ErrorActionPreference is 'Stop' above, and Windows PowerShell 5.1 turns
    # anything a native command writes to stderr into an ErrorRecord — which
    # under 'Stop' is terminating. Gradle writes plenty there without failing;
    # the React Native config alone opens every build with
    #
    #     The NODE_ENV environment variable is required but was not specified
    #
    # which is a notice about which .env files were read, not an error. It was
    # enough to abort the build before a single module compiled. The exit code
    # is what actually reports whether Gradle succeeded, and it is already
    # captured and checked below.
    $previousEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        if ($Clean) {
            & .\gradlew.bat clean assembleRelease "-PreactNativeArchitectures=arm64-v8a" --parallel
        } else {
            & .\gradlew.bat assembleRelease "-PreactNativeArchitectures=arm64-v8a" --parallel
        }
        $exit = $LASTEXITCODE
    } finally { $ErrorActionPreference = $previousEap }
} finally { Pop-Location }

$mins = [math]::Round(((Get-Date) - $start).TotalMinutes, 1)

if ($exit -eq 0 -and (Test-Path $apk)) {
    # Prove the APK ships the bundle this build generated, so a "the fix isn't in the
    # app" debugging session can never again be a stale bundle in disguise.
    try {
        Assert-ArtifactShipsGeneratedBundle -Root $root -Artifact $apk -Variant "release"
    } catch {
        Add-Content $logFile ("{0} | APK  | FAILED (stale JS bundle) | arm64-v8a | {1} min" -f $start.ToString("yyyy-MM-dd HH:mm:ss"), $mins) -Encoding utf8
        Write-Host "`nBUILD REJECTED after $mins min - $_" -ForegroundColor Red
        Write-Host "The .apk exists but ships the wrong JavaScript. Do NOT install it." -ForegroundColor Red
        exit 1
    }

    Save-BuiltAppEnv -Root $root -AppEnv $AppEnv
    $sizeMb = [math]::Round((Get-Item $apk).Length / 1MB, 1)
    Add-Content $logFile ("{0} | APK  | SUCCESS | arm64-v8a | {1} min | {2} MB" -f $start.ToString("yyyy-MM-dd HH:mm:ss"), $mins, $sizeMb) -Encoding utf8
    Write-Host "`nBUILD SUCCESSFUL in $mins min ($sizeMb MB)" -ForegroundColor Green
    Write-Host "APK: $apk" -ForegroundColor Green
    Write-Host "Copy it to your phone and tap to install." -ForegroundColor Green
} else {
    Add-Content $logFile ("{0} | APK  | FAILED (exit {1}) | arm64-v8a | {2} min" -f $start.ToString("yyyy-MM-dd HH:mm:ss"), $exit, $mins) -Encoding utf8
    Write-Host "`nBUILD FAILED (exit $exit) after $mins min" -ForegroundColor Red
}
exit $exit

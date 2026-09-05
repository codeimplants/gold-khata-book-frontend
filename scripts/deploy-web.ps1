# Builds the web app and deploys it to Firebase Hosting (project goldkhatabook).
#
# Auth: uses a Firebase service-account key referenced by the GOOGLE_APPLICATION_CREDENTIALS
# environment variable (no interactive `firebase login` needed). One-time setup is in
# README.md > "Deploying the web app to Firebase Hosting".
#
# Run from the project root:
#   scripts\deploy-web.cmd
#   powershell -File scripts\deploy-web.ps1
#   scripts\deploy-web.cmd -SkipBuild   # deploy the existing dist/ without rebuilding

param([switch]$SkipBuild)

$ErrorActionPreference = "Stop"
$root      = Split-Path -Parent $PSScriptRoot
$project   = "goldkhatabook"
$hostUrl   = "https://$project.web.app"
$dist      = Join-Path $root "dist"

# --- Pre-flight: fail fast (with instructions) instead of popping a browser login ---
# Known-good fallback locations, checked BEFORE the env var: first inside this repo's
# own .firebase folder, then one level out - the shared .firebase folder alongside the
# gold-khata-book-frontend/-web/-backend repo checkouts. This repo-specific path is preferred
# over GOOGLE_APPLICATION_CREDENTIALS on purpose: this machine also deploys other
# projects (nexus, sonetaran, ...) that each point the SAME shared env var at their own
# key, so whichever project was deployed most recently silently "wins" for everyone
# else if the env var takes priority. Checking our own known-good path first makes this
# script's deploy correct regardless of what the shared env var currently holds.
$fallbackInner = Join-Path $root ".firebase\goldkhatabook-deploy.json"
$fallbackOuter = Join-Path (Split-Path -Parent $root) ".firebase\goldkhatabook-deploy.json"
$cred = $null
if (Test-Path $fallbackInner) { $cred = $fallbackInner }
elseif (Test-Path $fallbackOuter) { $cred = $fallbackOuter }

if (-not $cred) {
    $envCred = $env:GOOGLE_APPLICATION_CREDENTIALS
    if (-not [string]::IsNullOrWhiteSpace($envCred) -and (Test-Path $envCred)) {
        Write-Host "WARNING: using GOOGLE_APPLICATION_CREDENTIALS ($envCred) - neither known goldkhatabook key path was found:" -ForegroundColor Yellow
        Write-Host "    $fallbackInner (not found)" -ForegroundColor Yellow
        Write-Host "    $fallbackOuter (not found)" -ForegroundColor Yellow
        Write-Host "  Double-check this is actually the goldkhatabook key, not another project's." -ForegroundColor Yellow
        $cred = $envCred
    } else {
        Write-Host "ERROR: Firebase service-account credentials not found." -ForegroundColor Red
        Write-Host "  Checked:" -ForegroundColor Red
        Write-Host "    $fallbackInner (not found)" -ForegroundColor Red
        Write-Host "    $fallbackOuter (not found)" -ForegroundColor Red
        if ($envCred) {
            Write-Host "    GOOGLE_APPLICATION_CREDENTIALS = $envCred (no file there)" -ForegroundColor Red
        } else {
            Write-Host "    GOOGLE_APPLICATION_CREDENTIALS is not set." -ForegroundColor Red
        }
        Write-Host ""
        Write-Host "To fix and continue:" -ForegroundColor Yellow
        Write-Host "  Already have the service-account JSON key? Place it at: $fallbackInner   (auto-detected next run)" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  Don't have a key yet? Generate one:" -ForegroundColor Yellow
        Write-Host "    1. Firebase Console > Project settings > Service accounts > Generate new private key."
        Write-Host "    2. Save the JSON as: $fallbackInner"
        Write-Host ""
        Write-Host "Then re-run this script." -ForegroundColor Yellow
        exit 1
    }
}
$env:GOOGLE_APPLICATION_CREDENTIALS = $cred
Write-Host "Using service account: $cred" -ForegroundColor DarkGray

<#
.SYNOPSIS
  Runs a native command and fails only on a non-zero exit code.

.DESCRIPTION
  Windows PowerShell 5.1 turns anything a native executable writes to stderr
  into an ErrorRecord, and with $ErrorActionPreference = 'Stop' (set at the top
  of this script, deliberately, so a real failure cannot be walked past) that
  ErrorRecord becomes a *terminating* error. The exit-code check below it never
  runs, and the catch reports DEPLOY FAILED on a command that succeeded.

  That is not hypothetical. On 2026-08-26 `npm run build` printed

      Browserslist: browsers data (caniuse-lite) is 6 months old

  to stderr, webpack then compiled cleanly with only asset-size warnings, and
  the deploy aborted anyway - after dist/ had already been wiped, so the run
  ended with no build and a message saying the build had failed. Two runs in a
  row, and the fix both times was to build by hand and deploy with -SkipBuild.

  Toolchains write plenty to stderr without failing: npm notices, deprecation
  warnings, firebase progress. The exit code is the only thing that actually
  says whether a command worked, and it is what this checks.
#>
function Invoke-Native {
    param(
        [Parameter(Mandatory)][scriptblock]$Command,
        [Parameter(Mandatory)][string]$What
    )
    # Scoped to this call, so 'Stop' is still in force for everything else.
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & $Command
    } finally {
        $ErrorActionPreference = $previous
    }
    if ($LASTEXITCODE -ne 0) { throw "$What failed (exit $LASTEXITCODE)" }
}

$start  = Get-Date
$failed = $false
Push-Location $root
try {
    if (-not $SkipBuild) {
        # Wipe dist/ first. Webpack overwrites the files it emits but never removes ones
        # it no longer emits, and `firebase deploy` uploads the whole directory - so
        # renamed/content-hashed chunks and images from previous builds accumulate and
        # stay live. dist/ was carrying orphaned July chunks and a month-old index.html
        # in Aug 2026. It is gitignored build output; nothing here is worth keeping.
        if (Test-Path $dist) {
            Write-Host "Removing stale dist/ before building..." -ForegroundColor DarkGray
            Remove-Item -Recurse -Force $dist
        }

        Write-Host "Building web bundle (npm run build)..." -ForegroundColor Cyan
        Invoke-Native { & npm run build } "Web build"
    } else {
        Write-Host "Skipping build; deploying existing dist/ - it may contain stale files from an older build." -ForegroundColor Yellow
    }

    if (-not (Test-Path (Join-Path $dist "index.html"))) {
        throw "dist/index.html not found - nothing to deploy. Run without -SkipBuild."
    }

    Write-Host "Deploying to Firebase Hosting ($project)..." -ForegroundColor Cyan
    Invoke-Native { & npx firebase deploy --only hosting --project $project --non-interactive } "Firebase deploy"
} catch {
    Write-Host "`nDEPLOY FAILED: $_" -ForegroundColor Red
    $failed = $true
} finally {
    Pop-Location
}

if ($failed) { exit 1 }

$mins = [math]::Round(((Get-Date) - $start).TotalMinutes, 1)
Write-Host "`nDEPLOY SUCCESSFUL in $mins min" -ForegroundColor Green
Write-Host "Live at: $hostUrl" -ForegroundColor Green

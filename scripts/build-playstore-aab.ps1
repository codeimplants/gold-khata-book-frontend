# Builds a signed release AAB (Android App Bundle) for PLAY STORE UPLOAD.
# Includes all CPU architectures (armeabi-v7a, arm64-v8a, x86, x86_64) -> slower.
# Upload the resulting .aab at https://play.google.com/console
#
# Run from anywhere:
#   powershell -File scripts\build-playstore-aab.ps1
#   (or double-click / run scripts\build-playstore-aab.cmd)
#
# Add -Clean for a guaranteed-fresh release build (recommended before a real upload).
# Add -SkipPull to build without pulling latest from git first (not recommended
# for a real Play Store upload).
# Pass -BumpVersion yes/no to auto-increment versionCode/versionName in
# android/app/build.gradle before building (or skip the bump), avoiding Play
# Console's "Version code N has already been used" error. Omit it to be asked
# interactively (default: yes). Always pass it explicitly for automation/AI -
# without it, Read-Host will hang a non-interactive invocation (see CLAUDE.md).
# Add -SkipStoreGuard to bypass the Play policy checks, only when you have judged
# a specific failure acceptable for this upload.

param([switch]$Clean, [switch]$SkipPull, [string]$BumpVersion, [switch]$SkipStoreGuard)

$ErrorActionPreference = "Stop"
$root    = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "lib\app-env.ps1")
. (Join-Path $PSScriptRoot "lib\js-bundle.ps1")
$logFile = Join-Path $root "build-times.log"
$aab     = Join-Path $root "android\app\build\outputs\bundle\release\app-release.aab"

# --- Signing preflight ---------------------------------------------------------
# Checked here, before the pull, the version bump and the ten-minute build,
# because every way this can go wrong is expensive and none of them is obvious
# from the error you eventually get.
#
# android/app/build.gradle falls back to DEBUG signing when
# GOLDKHATABOOK_UPLOAD_STORE_FILE is absent. That fallback exists for test APKs
# and is exactly wrong here: a debug-signed .aab uploads and is then rejected by
# Play with a message about the certificate fingerprint that never says "you
# built this with the wrong signing config".
#
# The property name is GOLDKHATABOOK_-prefixed, not the generic MYAPP_UPLOAD_*
# this repo inherited from the SoneBill fork. ~/.gradle/gradle.properties is
# shared by every React Native project on the machine and its MYAPP_UPLOAD_*
# entry belongs to SoneBill — building against that prefix would sign Gold Khata
# Book with SoneBill's upload key. Play binds an app to the first upload
# certificate it accepts, so that is not undoable by rebuilding.
$gradleProps = Join-Path $env:USERPROFILE ".gradle\gradle.properties"
$storeFileName = $null
if (Test-Path $gradleProps) {
    $match = Select-String -Path $gradleProps -Pattern '^\s*GOLDKHATABOOK_UPLOAD_STORE_FILE\s*=\s*(.+?)\s*$' |
             Select-Object -First 1
    if ($match) { $storeFileName = $match.Matches[0].Groups[1].Value }
}

if (-not $storeFileName) {
    Write-Host ""
    Write-Host "ERROR: no upload keystore configured for Gold Khata Book." -ForegroundColor Red
    Write-Host ""
    Write-Host "Without it this build would be signed with the DEBUG key and rejected by Play." -ForegroundColor Red
    Write-Host ""
    Write-Host "Create the keystore once (keep the passwords somewhere you will not lose them —" -ForegroundColor Yellow
    Write-Host "losing them means you can no longer update the app):" -ForegroundColor Yellow
    Write-Host ""
    Write-Host '  keytool -genkeypair -v -storetype PKCS12 \' -ForegroundColor Gray
    Write-Host '    -keystore android\app\gold-khata-book-keystore.jks \' -ForegroundColor Gray
    Write-Host '    -alias goldkhatabook -keyalg RSA -keysize 2048 -validity 10000' -ForegroundColor Gray
    Write-Host ""
    Write-Host "Then add to $gradleProps :" -ForegroundColor Yellow
    Write-Host ""
    Write-Host '  GOLDKHATABOOK_UPLOAD_STORE_FILE=gold-khata-book-keystore.jks' -ForegroundColor Gray
    Write-Host '  GOLDKHATABOOK_UPLOAD_KEY_ALIAS=goldkhatabook' -ForegroundColor Gray
    Write-Host '  GOLDKHATABOOK_UPLOAD_STORE_PASSWORD=...' -ForegroundColor Gray
    Write-Host '  GOLDKHATABOOK_UPLOAD_KEY_PASSWORD=...' -ForegroundColor Gray
    Write-Host ""
    Write-Host "Do NOT reuse MYAPP_UPLOAD_* — that is SoneBill's key." -ForegroundColor Red
    Write-Host ""
    exit 1
}

# storeFile is resolved by Gradle relative to android/app.
$storePath = Join-Path $root "android\app\$storeFileName"
if (-not (Test-Path $storePath)) {
    Write-Host ""
    Write-Host "ERROR: keystore '$storeFileName' is configured but not present at:" -ForegroundColor Red
    Write-Host "  $storePath" -ForegroundColor Red
    Write-Host ""
    Write-Host "The .jks is gitignored, so a fresh clone will not have it. Restore it from" -ForegroundColor Yellow
    Write-Host "wherever you backed it up — it cannot be regenerated." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "Signing with: $storeFileName" -ForegroundColor DarkGray

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

if (-not $BumpVersion) {
    Write-Host ""
    Write-Host "Bump versionCode/versionName before this Play Store build?" -ForegroundColor Yellow
    Write-Host "  y) Yes - increment (avoids Play Console's 'Version code already used' error)"
    Write-Host "  n) No  - build with whatever is currently in build.gradle"
    $choice = Read-Host "Enter y/n (default: y)"
    $BumpVersion = if ($choice -eq "n") { "no" } else { "yes" }
}

if ($BumpVersion -eq "yes") {
    $buildGradle = Join-Path $root "android\app\build.gradle"
    $content = Get-Content $buildGradle -Raw
    if ($content -notmatch 'versionCode\s+(\d+)') {
        Write-Host "ERROR: could not find versionCode in $buildGradle" -ForegroundColor Red
        exit 1
    }
    $newCode = [int]$Matches[1] + 1
    if ($content -notmatch 'versionName\s+"([^"]+)"') {
        Write-Host "ERROR: could not find versionName in $buildGradle" -ForegroundColor Red
        exit 1
    }
    $oldCode = $newCode - 1
    $nameParts = $Matches[1] -split '\.'
    $oldName = $Matches[1]
    $nameParts[$nameParts.Length - 1] = "$newCode"
    $newName = $nameParts -join '.'

    $content = $content -replace 'versionCode\s+\d+', "versionCode $newCode"
    $content = $content -replace 'versionName\s+"[^"]+"', "versionName `"$newName`""
    # Set-Content -Encoding utf8 writes a BOM on Windows PowerShell 5.1, which breaks
    # Gradle's Groovy parser ("Unexpected character: '?'"). Write BOM-less UTF-8 instead.
    [System.IO.File]::WriteAllText($buildGradle, $content, (New-Object System.Text.UTF8Encoding($false)))

    Write-Host "Bumped versionCode $oldCode -> $newCode (versionName $oldName -> $newName)" -ForegroundColor Cyan
    Write-Host "Remember to commit + push this change in android/app/build.gradle." -ForegroundColor Cyan
} else {
    Write-Host "Skipping version bump (-BumpVersion no) - building with current versionCode/versionName." -ForegroundColor Yellow
}

# Play Store is always prod. Pin it (process env + .env) and force a JS re-bundle
# if the last build targeted a different env, so a prior dev/preprod test build's
# bundle can't be reused - see scripts/lib/app-env.ps1.
Set-AppEnv -Root $root -AppEnv "prod"
Reset-ReleaseBundleIfEnvChanged -Root $root -AppEnv "prod"

# Refuse to build if a prebuilt bundle sits in src/main/assets - it would silently
# shadow the generated one and ship old JavaScript. See scripts/lib/js-bundle.ps1.
Assert-NoStrayJsBundle -Root $root

# Play policy checks run after the version bump so they see the versionCode that
# will actually ship, and before the build because a rejected upload costs a
# whole review cycle. -SkipStoreGuard to override.
if ($SkipStoreGuard) {
    Write-Host "Skipping store-guard (-SkipStoreGuard)." -ForegroundColor Yellow
} else {
    & node (Join-Path $root "scripts\store-guard\bin\store-guard.js") check --android
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "store-guard failed - see above. Each failure is something Play will" -ForegroundColor Red
        Write-Host "reject or refuse to accept. Fix, or re-run with -SkipStoreGuard if you" -ForegroundColor Red
        Write-Host "have judged a specific failure acceptable." -ForegroundColor Red
        exit 1
    }
}

Write-Host "Building PLAY STORE AAB (all ABIs, APP_ENV=prod, clean=$($Clean.IsPresent))... this takes a while." -ForegroundColor Cyan
$start = Get-Date

Push-Location (Join-Path $root "android")
try {
    # See the identical block in build-test-apk.ps1: under $ErrorActionPreference
    # 'Stop', Windows PowerShell 5.1 makes Gradle's ordinary stderr output — the
    # "NODE_ENV environment variable is required" notice among it — a terminating
    # error, aborting a release build that had not yet compiled anything. The
    # exit code below is the real verdict.
    $previousEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        if ($Clean) {
            & .\gradlew.bat clean bundleRelease "-PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64" --parallel
        } else {
            & .\gradlew.bat bundleRelease "-PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64" --parallel
        }
        $exit = $LASTEXITCODE
    } finally { $ErrorActionPreference = $previousEap }
} finally { Pop-Location }

$mins = [math]::Round(((Get-Date) - $start).TotalMinutes, 1)

if ($exit -eq 0 -and (Test-Path $aab)) {
    # Prove the AAB actually ships the bundle this build generated before anyone
    # uploads it to Play - a wrong-JS upload costs a whole review cycle.
    try {
        Assert-ArtifactShipsGeneratedBundle -Root $root -Artifact $aab -Variant "release"
    } catch {
        Add-Content $logFile ("{0} | AAB  | FAILED (stale JS bundle) | all-abis | {1} min" -f $start.ToString("yyyy-MM-dd HH:mm:ss"), $mins) -Encoding utf8
        Write-Host "`nBUILD REJECTED after $mins min - $_" -ForegroundColor Red
        Write-Host "The .aab exists but ships the wrong JavaScript. Do NOT upload it." -ForegroundColor Red
        exit 1
    }

    Save-BuiltAppEnv -Root $root -AppEnv "prod"
    $sizeMb = [math]::Round((Get-Item $aab).Length / 1MB, 1)
    Add-Content $logFile ("{0} | AAB  | SUCCESS | all-abis | {1} min | {2} MB" -f $start.ToString("yyyy-MM-dd HH:mm:ss"), $mins, $sizeMb) -Encoding utf8
    Write-Host "`nBUILD SUCCESSFUL in $mins min ($sizeMb MB)" -ForegroundColor Green
    Write-Host "AAB: $aab" -ForegroundColor Green
    Write-Host "Upload this file to the Google Play Console." -ForegroundColor Green
} else {
    Add-Content $logFile ("{0} | AAB  | FAILED (exit {1}) | all-abis | {2} min" -f $start.ToString("yyyy-MM-dd HH:mm:ss"), $exit, $mins) -Encoding utf8
    Write-Host "`nBUILD FAILED (exit $exit) after $mins min" -ForegroundColor Red
}
exit $exit

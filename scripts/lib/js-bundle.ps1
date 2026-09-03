# Guards against shipping a stale JavaScript bundle in a release APK/AAB.
# Dot-source from the build scripts:
#   . (Join-Path $PSScriptRoot "lib\js-bundle.ps1")
#   Assert-NoStrayJsBundle -Root $root                    # BEFORE gradle
#   ... run gradle ...
#   Assert-ArtifactShipsGeneratedBundle -Root $root -Artifact $apk   # AFTER gradle, on success
#
# WHY THIS EXISTS
# React Native's Gradle plugin bundles JS into
#   android/app/build/generated/assets/react/<variant>/index.android.bundle
# and Gradle's mergeReleaseAssets task then merges that with the static assets in
# android/app/src/main/assets/. If an index.android.bundle also exists in src/main/assets,
# it is a *source* asset and wins the merge - Gradle happily packages it and never reports
# a problem.
#
# That is exactly what happened here: a prebuilt bundle was committed to
# android/app/src/main/assets/index.android.bundle in April 2026 and last refreshed on
# 2026-05-02. From then until 2026-08-03 every release APK/AAB shipped 2 May JavaScript.
# Native code (app icons, Kotlin modules, Info.plist) kept updating, so the app looked
# "partly updated": new launcher icon, old UI, no thermal printing, no Face ID fix. The
# builds all exited 0. Nothing in git was ever overwritten - only the packaged JS was stale.
#
# The file is now deleted and gitignored. These two checks make a silent recurrence
# impossible rather than merely unlikely.

$script:JsBundleName = "index.android.bundle"

# Path of the stray copy that must never exist.
function Get-StrayJsBundlePath {
    param([Parameter(Mandatory)] [string]$Root)
    Join-Path $Root "android\app\src\main\assets\$script:JsBundleName"
}

# Path Gradle's bundle task actually writes to (see @react-native/gradle-plugin
# TaskConfiguration.kt: jsBundleDir = buildDir/generated/assets/react/<variant>).
function Get-GeneratedJsBundlePath {
    param(
        [Parameter(Mandatory)] [string]$Root,
        [string]$Variant = "release"
    )
    Join-Path $Root "android\app\build\generated\assets\react\$Variant\$script:JsBundleName"
}

# PRE-BUILD. A prebuilt bundle under src/main/assets shadows the generated one, so refuse
# to build at all rather than produce an artifact full of old JavaScript. Also drops the
# merged-asset caches, which may already hold the stray copy from an earlier build.
function Assert-NoStrayJsBundle {
    param([Parameter(Mandatory)] [string]$Root)

    $stray = Get-StrayJsBundlePath -Root $Root
    if (-not (Test-Path $stray)) {
        Write-Host "JS bundle guard: no stray bundle in src/main/assets - Gradle will bundle fresh." -ForegroundColor DarkGray
        return
    }

    $age = (Get-Item $stray).LastWriteTime
    Write-Host ""
    Write-Host "ERROR: a prebuilt JS bundle is present at:" -ForegroundColor Red
    Write-Host "    $stray" -ForegroundColor Red
    Write-Host "  (last modified $age)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Gradle merges src/main/assets OVER its own freshly generated bundle, so this" -ForegroundColor Red
    Write-Host "file would ship instead of your current code - the build would succeed and the" -ForegroundColor Red
    Write-Host "app would run that old JavaScript. This exact file cost months of releases in 2026." -ForegroundColor Red
    Write-Host ""
    Write-Host "Fix: delete it (it is gitignored and never needed - React Native generates the" -ForegroundColor Yellow
    Write-Host "bundle into android/app/build/generated/assets/react/<variant>/):" -ForegroundColor Yellow
    Write-Host "    git rm --cached android/app/src/main/assets/$script:JsBundleName   # only if tracked" -ForegroundColor Yellow
    Write-Host "    Remove-Item '$stray'" -ForegroundColor Yellow
    throw "Stray prebuilt JS bundle in src/main/assets - refusing to build."
}

# Reads one entry out of a zip (APK and AAB are both zips) and returns its SHA256.
# Returns $null when the entry is not present.
function Get-ZipEntrySha256 {
    param(
        [Parameter(Mandatory)] [string]$ZipPath,
        [Parameter(Mandatory)] [string]$EntrySuffix
    )

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
    try {
        $entry = $zip.Entries | Where-Object { $_.FullName -like "*$EntrySuffix" } | Select-Object -First 1
        if (-not $entry) { return $null }

        $stream = $entry.Open()
        try {
            $mem = New-Object System.IO.MemoryStream
            $stream.CopyTo($mem)
            $bytes = $mem.ToArray()
            $mem.Dispose()
        } finally { $stream.Dispose() }

        $sha = [System.Security.Cryptography.SHA256]::Create()
        try {
            return ([System.BitConverter]::ToString($sha.ComputeHash($bytes))).Replace("-", "")
        } finally { $sha.Dispose() }
    } finally { $zip.Dispose() }
}

# POST-BUILD. Proves the artifact ships the bundle Gradle generated on this machine for
# this variant, byte for byte. Catches the stray-asset case, a poisoned merged_assets
# cache, and any future path change in the RN Gradle plugin (missing generated bundle
# fails loudly instead of silently falling back to something older).
function Assert-ArtifactShipsGeneratedBundle {
    param(
        [Parameter(Mandatory)] [string]$Root,
        [Parameter(Mandatory)] [string]$Artifact,
        [string]$Variant = "release"
    )

    $generated = Get-GeneratedJsBundlePath -Root $Root -Variant $Variant
    if (-not (Test-Path $generated)) {
        Write-Host ""
        Write-Host "ERROR: Gradle produced no JS bundle at:" -ForegroundColor Red
        Write-Host "    $generated" -ForegroundColor Red
        Write-Host "  The bundle task did not run, so whatever JavaScript is inside the artifact did" -ForegroundColor Red
        Write-Host "  not come from this build. Do not ship it." -ForegroundColor Red
        throw "No generated JS bundle - refusing to trust this artifact."
    }

    $generatedHash = (Get-FileHash -Path $generated -Algorithm SHA256).Hash
    $shippedHash   = Get-ZipEntrySha256 -ZipPath $Artifact -EntrySuffix "assets/$script:JsBundleName"

    if (-not $shippedHash) {
        Write-Host ""
        Write-Host "ERROR: no assets/$script:JsBundleName inside $Artifact." -ForegroundColor Red
        throw "Artifact contains no JS bundle."
    }

    if ($shippedHash -ne $generatedHash) {
        Write-Host ""
        Write-Host "ERROR: the artifact does NOT contain the bundle Gradle just generated." -ForegroundColor Red
        Write-Host "    generated : $generatedHash" -ForegroundColor Red
        Write-Host "                $generated" -ForegroundColor Red
        Write-Host "    shipped   : $shippedHash" -ForegroundColor Red
        Write-Host "                $Artifact" -ForegroundColor Red
        Write-Host ""
        Write-Host "Something is overriding the generated bundle - most likely a file under" -ForegroundColor Yellow
        Write-Host "android/app/src/main/assets/, or a stale merged-assets cache. Clear it with:" -ForegroundColor Yellow
        Write-Host "    Remove-Item -Recurse -Force android\app\build\intermediates\assets\$Variant" -ForegroundColor Yellow
        Write-Host "    Remove-Item -Recurse -Force android\app\build\intermediates\merged_assets\$Variant" -ForegroundColor Yellow
        Write-Host "then rebuild. DO NOT upload this artifact - it ships the wrong JavaScript." -ForegroundColor Yellow
        throw "Artifact ships a JS bundle that this build did not generate."
    }

    $built = (Get-Item $generated).LastWriteTime
    $sizeMb = [math]::Round((Get-Item $generated).Length / 1MB, 1)
    Write-Host "JS bundle verified: artifact ships this build's bundle ($sizeMb MB, generated $built)." -ForegroundColor Green
    Write-Host "  sha256 $generatedHash" -ForegroundColor DarkGray
}

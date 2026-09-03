# Converts the committed iOS store screenshots into Play-compliant Android ones.
#
# Two things stop the iOS files being uploaded as-is:
#   1. Play requires the long side to be at most 2x the short side. iPhone 6.9"
#      is 1320 x 2868 = 2.17x, so it fails. Cropping the iOS status bar off the
#      top and the home-indicator gap off the bottom fixes the ratio AND removes
#      the only iOS-specific pixels in the frame.
#   2. Play wants "JPEG or 24-bit PNG (no alpha)". The captures are RGBA, so
#      every output is redrawn into a 24bpp surface over white.
# iPad is 2064 x 2752 (4:3) and already passes the ratio rule; it only needs the
# status-bar crop and the alpha flatten.

Add-Type -AssemblyName System.Drawing

$root = "C:\RN\gold-khata-book\gold-khata-book-frontend\store-assets\screenshots"

function Convert-Shot {
    param([string]$Src, [string]$Dst, [int]$CropTop, [int]$CropBottom)

    $img = [System.Drawing.Image]::FromFile($Src)
    try {
        $w = $img.Width
        $h = $img.Height - $CropTop - $CropBottom
        $fmt = [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
        $bmp = New-Object System.Drawing.Bitmap -ArgumentList $w, $h, $fmt
        try {
            $g = [System.Drawing.Graphics]::FromImage($bmp)
            $g.Clear([System.Drawing.Color]::White)
            $dstRect = New-Object System.Drawing.Rectangle -ArgumentList 0, 0, $w, $h
            $srcRect = New-Object System.Drawing.Rectangle -ArgumentList 0, $CropTop, $w, $h
            $g.DrawImage($img, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
            $g.Dispose()
            $bmp.Save($Dst, [System.Drawing.Imaging.ImageFormat]::Png)
        } finally { $bmp.Dispose() }
    } finally { $img.Dispose() }

    $ratio = [math]::Round($h / $w, 3)
    Write-Host ("  {0}  {1} x {2}  (long/short = {3})" -f (Split-Path $Dst -Leaf), $w, $h, $ratio)
}

# --- phone: 1320 x 2868 -> 1320 x 2628 (1.991x, under Play's 2x cap) ---
$phoneOut = Join-Path $root "android\phone"
Write-Host "phone (from iphone-6.9):" -ForegroundColor Cyan
Get-ChildItem (Join-Path $root "ios\iphone-6.9") -Filter *.png | ForEach-Object {
    Convert-Shot -Src $_.FullName -Dst (Join-Path $phoneOut $_.Name) -CropTop 185 -CropBottom 55
}

# --- tablet: 2064 x 2752 -> 2064 x 2702, same file in both Play tablet slots ---
Write-Host "tablet-7 and tablet-10 (from ipad-13):" -ForegroundColor Cyan
Get-ChildItem (Join-Path $root "ios\ipad-13") -Filter *.png | ForEach-Object {
    Convert-Shot -Src $_.FullName -Dst (Join-Path $root "android\tablet-10\$($_.Name)") -CropTop 62 -CropBottom 26
    Copy-Item (Join-Path $root "android\tablet-10\$($_.Name)") (Join-Path $root "android\tablet-7\$($_.Name)") -Force
}

Write-Host "done" -ForegroundColor Green

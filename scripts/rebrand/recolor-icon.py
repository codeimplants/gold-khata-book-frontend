"""
Recolours Gold Khata Book's icon from purple to the ledger green, keeping the
artwork (the khata book, coins and lettering) exactly as drawn.

The purple background sat in the same colour family as SoneBill's icon and UI.
That was open question 2 in APP_STORE_4.3_REWORK.md, decided 2026-10-06: keep
the art, move it to the brand green (src/theme/brand.ts).

How: only purple pixels change (hue about 225 to 340 degrees, with soft edges
so anti-aliased borders blend). Their hue is compressed into a narrow green
band. Their lightness is set so each pixel keeps its perceived brightness: a
plain hue swap would turn the dark purple into neon, because green reads about
five times brighter than purple at the same RGB value. Gold, white and grey
pixels are untouched.

    python scripts/rebrand/recolor-icon.py preview      writes a preview only
    python scripts/rebrand/recolor-icon.py write        rewrites every icon file

`write` regenerates, from the recoloured 1024 master:
  - ios/GoldKhataBook/Images.xcassets/AppIcon.appiconset/*.png (each at its own size, RGB, no alpha)
  - store-assets/graphics/app-icon-1024.png and app-icon-512.png
  - assets/logo.png (the in-app logo)
  - public/favicon.ico
and recolours the Android launcher WebPs in place (keeping their alpha), and
sets the adaptive icon background colour.
"""
import os
import re
import sys

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
MASTER = os.path.join(ROOT, 'store-assets', 'graphics', 'app-icon-1024.png')
# The purple original, kept outside store-assets/ so it is never uploaded by
# mistake, and so a re-run always recolours from the untouched art.
ORIGINAL = os.path.join(ROOT, 'scripts', 'rebrand', 'icon-purple-original.png')
BRAND_GREEN = '#0E4D3C'

# Target band and brightness. 158 to 171 degrees is the ledger green family.
GREEN_CENTRE = 160.0
HUE_SQUEEZE = 0.22
SAT_SCALE = 0.86
# Slightly lighter than the purple it replaces, so the art still reads on a
# small home-screen icon.
LUMINANCE_GAIN = 1.25


def _srgb_to_linear(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def _luminance(rgb):
    lin = _srgb_to_linear(rgb)
    return 0.2126 * lin[..., 0] + 0.7152 * lin[..., 1] + 0.0722 * lin[..., 2]


def _rgb_to_hsv(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = rgb.max(-1)
    mn = rgb.min(-1)
    d = mx - mn
    h = np.zeros_like(mx)
    nz = d > 1e-9
    rc = np.where(nz, (mx - r) / np.where(nz, d, 1), 0)
    gc = np.where(nz, (mx - g) / np.where(nz, d, 1), 0)
    bc = np.where(nz, (mx - b) / np.where(nz, d, 1), 0)
    h = np.where(r == mx, bc - gc, np.where(g == mx, 2.0 + rc - bc, 4.0 + gc - rc))
    h = (h / 6.0) % 1.0
    h = np.where(nz, h, 0.0)
    s = np.where(mx > 1e-9, d / np.where(mx > 1e-9, mx, 1), 0)
    return h * 360.0, s, mx


def _hsv_to_rgb(h, s, v):
    h = (h % 360.0) / 60.0
    i = np.floor(h).astype(int) % 6
    f = h - np.floor(h)
    p = v * (1 - s)
    q = v * (1 - s * f)
    t = v * (1 - s * (1 - f))
    choices_r = [v, q, p, p, t, v]
    choices_g = [t, v, v, q, p, p]
    choices_b = [p, p, t, v, v, q]
    r = np.choose(i, choices_r)
    g = np.choose(i, choices_g)
    b = np.choose(i, choices_b)
    return np.stack([r, g, b], -1)


def _ramp(x, lo, hi):
    return np.clip((x - lo) / (hi - lo), 0.0, 1.0)


def recolor_rgb(rgb):
    """rgb: float array in 0..1, shape (..., 3). Returns the recoloured array."""
    h, s, v = _rgb_to_hsv(rgb)
    # Weight: 1 inside the purple band, easing to 0 at its edges and for
    # low-saturation pixels (greys and the white highlights). The band runs
    # through magenta to red, wrapping past 360: the spine's thin rim
    # highlights are magenta, and left purple-pink they showed as a pink line
    # on the green book. It stops at 12 degrees, short of the gold, which
    # starts around 15.
    h_wrapped = np.where(h < 12, h + 360.0, h)
    w_hue = np.minimum(_ramp(h_wrapped, 215, 235), 1 - _ramp(h_wrapped, 352, 372))
    h = np.where(w_hue > 0, h_wrapped, h)
    w_sat = _ramp(s, 0.08, 0.20)
    w = (w_hue * w_sat)[..., None]

    new_h = GREEN_CENTRE + (h - 262.0) * HUE_SQUEEZE
    new_s = np.clip(s * SAT_SCALE, 0, 1)
    # First pass at the same value, then rescale value to hit the target
    # luminance. Linear-light luminance scales close to v**2.2 at fixed hue
    # and saturation, so one correction step lands within a few percent.
    trial = _hsv_to_rgb(new_h, new_s, v)
    target = _luminance(rgb) * LUMINANCE_GAIN
    current = np.maximum(_luminance(trial), 1e-6)
    factor = np.clip((target / current) ** (1 / 2.2), 0, 4)
    new_v = np.clip(v * factor, 0, 1)
    out = _hsv_to_rgb(new_h, new_s, new_v)
    return rgb * (1 - w) + out * w


def recolor_image(im):
    """Recolours a PIL image, keeping its mode and any alpha channel."""
    has_alpha = im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info)
    rgba = im.convert('RGBA')
    arr = np.asarray(rgba).astype(np.float64) / 255.0
    rgb = recolor_rgb(arr[..., :3])
    out = np.concatenate([rgb, arr[..., 3:4]], -1)
    res = Image.fromarray(np.clip(np.round(out * 255), 0, 255).astype(np.uint8), 'RGBA')
    return res if has_alpha else res.convert('RGB')


def main(mode):
    if not os.path.exists(ORIGINAL):
        Image.open(MASTER).save(ORIGINAL)
    original = Image.open(ORIGINAL).convert('RGB')
    green = recolor_image(original)

    if mode == 'preview':
        out = os.path.join(ROOT, 'screenshots', 'icon-preview.png')
        os.makedirs(os.path.dirname(out), exist_ok=True)
        side = Image.new('RGB', (2048 + 48, 1024), (248, 245, 238))
        side.paste(original, (0, 0))
        side.paste(green, (1024 + 48, 0))
        side.save(out)
        print('preview:', out)
        return

    # App Store and the in-app logo: RGB, no alpha (Apple rejects an icon with one).
    green.save(MASTER)
    green.resize((512, 512), Image.LANCZOS).save(os.path.join(ROOT, 'store-assets', 'graphics', 'app-icon-512.png'))
    green.save(os.path.join(ROOT, 'assets', 'logo.png'))

    iconset = os.path.join(ROOT, 'ios', 'GoldKhataBook', 'Images.xcassets', 'AppIcon.appiconset')
    for name in sorted(os.listdir(iconset)):
        if not name.endswith('.png'):
            continue
        size = Image.open(os.path.join(iconset, name)).size
        img = green if size == (1024, 1024) else green.resize(size, Image.LANCZOS)
        img.convert('RGB').save(os.path.join(iconset, name))
    print('ios iconset rewritten')

    green.save(os.path.join(ROOT, 'public', 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])

    write_android(green)


def _edge_colour(img, ring=10):
    """Average colour of the art's outer ring, so a flat fill meets it without a seam."""
    a = np.asarray(img.convert('RGB')).astype(np.float64)
    mask = np.zeros(a.shape[:2], bool)
    mask[:ring, :] = mask[-ring:, :] = mask[:, :ring] = mask[:, -ring:] = True
    r, g, b = a[mask].mean(0)
    return int(round(r)), int(round(g)), int(round(b))


def _feathered(art, size, feather=0.07):
    """The art at `size`, with its outer edge faded to transparent so it melts
    into the background layer instead of showing a square seam."""
    art = art.convert('RGBA').resize((size, size), Image.LANCZOS)
    n = size
    idx = np.arange(n, dtype=np.float64)
    dist = np.minimum(idx, n - 1 - idx) / max(1.0, feather * n)
    edge = np.clip(np.minimum.outer(dist, dist), 0, 1)
    alpha = (np.asarray(art)[..., 3].astype(np.float64) / 255.0) * edge
    out = np.asarray(art).copy()
    out[..., 3] = np.round(alpha * 255).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def write_android(green):
    """Android launcher icons, generated from the Gold Khata Book art.

    These were still SoneBill's artwork (a rupee sign among jewellery) when the
    rework began: the earlier icon change covered iOS and the in-app logo only.
    So they are drawn fresh from the master, not recoloured in place.

    - ic_launcher (legacy, square): the art, full bleed.
    - ic_launcher_round (legacy, round): the art at 86% on a disc of the art's
      edge colour, so the lettering at the bottom stays inside the circle.
    - ic_launcher_foreground (adaptive, 108dp canvas): the art at 55% in the
      centre, inside the 66dp safe zone that every launcher mask keeps,
      feathered at its edges. The background layer is the art's edge colour,
      so circle, squircle and square masks all show one continuous field.
    """
    # Android Studio's Play Store copy of the icon. It was still SoneBill's
    # (byte-identical) until 2026-10-06. Play rejects alpha, so RGB.
    green.resize((512, 512), Image.LANCZOS).convert('RGB').save(
        os.path.join(ROOT, 'android', 'app', 'src', 'main', 'ic_launcher-playstore.png'))

    res = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
    edge = _edge_colour(green)
    edge_hex = '#%02X%02X%02X' % edge
    for folder in sorted(os.listdir(res)):
        if not folder.startswith('mipmap-') or folder.endswith('anydpi-v26'):
            continue
        d = os.path.join(res, folder)
        for name in os.listdir(d):
            if not (name.startswith('ic_launcher') and name.endswith('.webp')):
                continue
            path = os.path.join(d, name)
            w, h = Image.open(path).size
            if name == 'ic_launcher.webp':
                img = green.resize((w, h), Image.LANCZOS).convert('RGB')
            elif name == 'ic_launcher_round.webp':
                img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
                disc = Image.new('L', (w * 4, h * 4), 0)
                from PIL import ImageDraw
                ImageDraw.Draw(disc).ellipse((0, 0, w * 4 - 1, h * 4 - 1), fill=255)
                disc = disc.resize((w, h), Image.LANCZOS)
                fill = Image.new('RGBA', (w, h), edge + (255,))
                img.paste(fill, (0, 0), disc)
                art = _feathered(green, int(round(w * 0.86)), feather=0.05)
                off = ((w - art.size[0]) // 2, (h - art.size[1]) // 2)
                layer = Image.new('RGBA', (w, h), (0, 0, 0, 0))
                layer.paste(art, off, art)
                masked = Image.new('RGBA', (w, h), (0, 0, 0, 0))
                masked.paste(layer, (0, 0), Image.composite(layer.getchannel('A'), Image.new('L', (w, h), 0), disc))
                img = Image.alpha_composite(img, masked)
            elif name == 'ic_launcher_foreground.webp':
                img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
                art = _feathered(green, int(round(w * 0.555)))
                img.paste(art, ((w - art.size[0]) // 2, (h - art.size[1]) // 2), art)
            else:
                continue
            img.save(path, 'WEBP', lossless=True)
    bg = os.path.join(res, 'drawable', 'ic_launcher_background.xml')
    with open(bg, encoding='utf-8') as f:
        xml = f.read()
    xml = re.sub(r'android:fillColor="#[0-9a-fA-F]{6}"', f'android:fillColor="{edge_hex}"', xml)
    with open(bg, 'w', encoding='utf-8', newline='') as f:
        f.write(xml)
    print('android launcher icons drawn from the Gold Khata Book art; adaptive background', edge_hex)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'preview')

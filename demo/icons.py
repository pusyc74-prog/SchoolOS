"""App icons: the school's monogram on its colour, with the app's name on a light band.
Replace with the school's real logo later (same file names)."""

import os

from PIL import Image, ImageDraw, ImageFont

from patch_host import COLOR, MONOGRAM

SERIF = "/usr/share/fonts/truetype/crosextra/Caladea-Bold.ttf"
SANS = "/usr/share/fonts/truetype/crosextra/Carlito-Bold.ttf"


def _rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default(size=size)


def icon(size, label, maskable=False, rounded=True):
    scale = 4
    S = size * scale
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    bg = _rgb(COLOR)
    if maskable or not rounded:
        d.rectangle([0, 0, S, S], fill=bg)
    else:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=bg)
    safe = 0.62 if maskable else 0.84  # maskable icons keep content in the centre circle
    # thin gold ring
    gold = (232, 190, 92)
    r = S * safe / 2
    cx, cy = S / 2, S / 2 - (S * 0.06 if label else 0)
    d.ellipse([cx - r * 0.78, cy - r * 0.78, cx + r * 0.78, cy + r * 0.78], outline=gold, width=max(2, int(S * 0.012)))
    f = _font(SERIF, int(S * safe * (0.30 if len(MONOGRAM) <= 3 else 0.24)))
    d.text((cx, cy), MONOGRAM, font=f, fill=(255, 255, 255), anchor="mm")
    # small star above the monogram
    sr = S * 0.028
    sx, sy = cx, cy - r * 0.52
    pts = []
    import math
    for k in range(10):
        a = math.pi / 2 + k * math.pi / 5
        rr = sr if k % 2 == 0 else sr * 0.45
        pts.append((sx + rr * math.cos(a), sy - rr * math.sin(a)))
    d.polygon(pts, fill=gold)
    if label:
        fs = int(S * safe * (0.13 if len(label) <= 9 else 0.10))
        fl = _font(SANS, fs)
        y = cy + r * 0.98
        d.text((cx, y), label.upper(), font=fl, fill=(255, 255, 255), anchor="mm")
    return img.resize((size, size), Image.LANCZOS)


def make_icons(folder, label):
    short = {"Office & Accounts": "Office"}.get(label, label)
    icon(192, short).save(os.path.join(folder, "icon-192.png"))
    icon(512, short).save(os.path.join(folder, "icon-512.png"))
    icon(512, short, maskable=True).save(os.path.join(folder, "icon-512-maskable.png"))
    icon(180, short, rounded=False).convert("RGB").save(os.path.join(folder, "icon-180.png"))  # iOS adds its own corners
    if not label:
        icon(64, "").save(os.path.join(folder, "favicon.png"))

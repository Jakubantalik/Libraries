#!/usr/bin/env python3
"""Pixel-diffs the web reference frames against the iOS snapshots.

Both sides render the same scene (60px pad, 348x122 card r20) frozen at the
same per-family timestamps, at 2x (936x484). Reports, per combination:
  meanDiff  — mean absolute RGB difference (0-255) over all pixels
  p99       — 99th-percentile per-pixel difference
  hot%      — share of pixels differing by more than 25/255

Also writes side-by-side composites (web | iOS | amplified diff) for the worst
offenders to demo/parity-diff/.

Usage: python3 scripts/parity-diff.py
"""
import os
import sys

from PIL import Image, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HERE, "..", "parity-web")
IOS = os.path.join(HERE, "..", "..", "ports", "ios", "BorderBeamKit", "snapshots")
OUT = os.path.join(HERE, "..", "parity-diff")
os.makedirs(OUT, exist_ok=True)

rows = []
for name in sorted(os.listdir(WEB)):
    if not name.endswith(".png"):
        continue
    wp, ip = os.path.join(WEB, name), os.path.join(IOS, name)
    if not os.path.exists(ip):
        print(f"  MISSING iOS snapshot for {name}")
        continue
    web = Image.open(wp).convert("RGB")
    ios = Image.open(ip).convert("RGB")
    if web.size != ios.size:
        ios = ios.resize(web.size)
    diff = ImageChops.difference(web, ios)
    data = list(diff.getdata())
    per_px = sorted(max(p) for p in data)
    n = len(per_px)
    mean = sum(per_px) / n
    p99 = per_px[int(n * 0.99)]
    hot = sum(1 for v in per_px if v > 25) / n * 100
    rows.append((name[:-4], mean, p99, hot))

    # Composite for anything visibly off.
    if mean > 3 or hot > 2:
        w, h = web.size
        combo = Image.new("RGB", (w, h * 3 + 8), (40, 40, 40))
        combo.paste(web, (0, 0))
        combo.paste(ios, (0, h + 4))
        combo.paste(diff.point(lambda v: min(255, v * 6)), (0, 2 * h + 8))
        combo.save(os.path.join(OUT, name))

rows.sort(key=lambda r: -r[1])
print(f"{'combination':34s} {'meanDiff':>8s} {'p99':>5s} {'hot%':>6s}")
for name, mean, p99, hot in rows:
    flag = "  <-- " + ("BAD" if mean > 6 else "check") if (mean > 3 or hot > 2) else ""
    print(f"{name:34s} {mean:8.2f} {p99:5d} {hot:6.2f}{flag}")

worst = rows[0] if rows else None
print(f"\n{len(rows)} compared; composites for outliers in demo/parity-diff/")

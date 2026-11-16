#!/usr/bin/env python3
"""
Encode a folder of f0000.png, f0001.png ... into a looping animated WebP.

    python3 encode_webp.py <frames_dir> <out.webp> <fps> <quality 0-100>

Per-frame durations are spread so the loop is *exactly* N / fps seconds long
(24 fps -> 42/42/41 ms pattern) - a plain "1000/fps" would drift and every
frame count would be rounded the same way.
"""
import glob
import sys

from PIL import Image

frames_dir, out, fps, quality = sys.argv[1], sys.argv[2], float(sys.argv[3]), int(sys.argv[4])

files = sorted(glob.glob(f"{frames_dir}/f*.png"))
if not files:
    sys.exit(f"no frames found in {frames_dir}")

durations = [round((i + 1) * 1000 / fps) - round(i * 1000 / fps) for i in range(len(files))]


def load(path):
    with Image.open(path) as im:
        return im.convert("RGB")


first = load(files[0])
first.save(
    out,
    format="WEBP",
    save_all=True,
    append_images=(load(f) for f in files[1:]),   # lazy: keeps memory flat
    duration=durations,
    loop=0,                                        # loop forever
    quality=quality,
    method=5,
    lossless=False,
    minimize_size=False,
)
print(f"{len(files)} frames, {sum(durations) / 1000:.3f}s loop -> {out}")

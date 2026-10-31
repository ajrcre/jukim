"""Generate the Creeper Trader textures procedurally (no vanilla assets copied).

Usage: python3 tools/gen_textures.py
"""
import random
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / "src/main/resources/assets/creeper_trader"
GREENS = [(13, 160, 13), (40, 190, 40), (90, 210, 90), (20, 120, 20), (60, 170, 50)]
ROBE = [(110, 72, 40), (98, 63, 34), (122, 82, 48)]
STRAW = [(214, 180, 90), (196, 160, 70), (230, 200, 110)]
BLACK = (10, 10, 10)
DARK_GREEN = (25, 70, 25)


def box_faces(u, v, w, h, d):
    """Return (x, y, w, h) rects for every face of a Minecraft cube UV layout."""
    return [
        (u + d, v, w, d),          # top
        (u + d + w, v, w, d),      # bottom
        (u, v + d, d, h),          # right
        (u + d, v + d, w, h),      # front
        (u + d + w, v + d, d, h),  # left
        (u + 2 * d + w, v + d, w, h),  # back
    ]


def fill(img, rects, palette, rng):
    for x0, y0, w, h in rects:
        for x in range(x0, x0 + w):
            for y in range(y0, y0 + h):
                img.putpixel((x, y), rng.choice(palette) + (255,))


def entity_texture(rng):
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    fill(img, box_faces(0, 0, 8, 8, 8), GREENS, rng)       # head
    fill(img, box_faces(16, 16, 8, 12, 4), GREENS, rng)    # body
    fill(img, box_faces(0, 16, 4, 6, 4), GREENS, rng)      # legs
    fill(img, box_faces(0, 32, 8, 14, 5), ROBE, rng)       # robe
    fill(img, box_faces(28, 32, 2, 4, 2), GREENS, rng)     # nose
    fill(img, box_faces(32, 0, 8, 4, 8), STRAW, rng)       # hat crown
    fill(img, box_faces(30, 47, 16, 16, 1), STRAW, rng)    # hat brim

    # Creeper face on the head front (8x8 at 8,8)
    face = ["........", "........", ".##..##.", ".##..##.", "...##...", "..####..", "..####..", "..#..#.."]
    for row, line in enumerate(face):
        for col, ch in enumerate(line):
            if ch == "#":
                img.putpixel((8 + col, 8 + row), BLACK + (255,))
    # Robe front: darker belt and a center seam
    fx, fy = 5, 37
    for x in range(fx, fx + 8):
        img.putpixel((x, fy + 6), (60, 38, 20, 255))
    for y in range(fy, fy + 14):
        img.putpixel((fx + 3, y), (80, 52, 28, 255))
        img.putpixel((fx + 4, y), (80, 52, 28, 255))
    # Hat band
    for x in range(32, 64):
        img.putpixel((x, 8 + 3), DARK_GREEN + (255,))
    return img


def spawn_egg(rng):
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    cx, cy, rx, ry = 7.5, 8.5, 5.5, 7.0
    for x in range(16):
        for y in range(16):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0:
                color = rng.choice(ROBE) if y >= 9 else rng.choice(GREENS)
                img.putpixel((x, y), color + (255,))
    for x, y in [(5, 5), (9, 5), (7, 7), (8, 7)]:
        img.putpixel((x, y), BLACK + (255,))
    return img


def main():
    rng = random.Random(42)
    (ROOT / "textures/entity").mkdir(parents=True, exist_ok=True)
    (ROOT / "textures/item").mkdir(parents=True, exist_ok=True)
    entity_texture(rng).save(ROOT / "textures/entity/creeper_trader.png")
    egg = spawn_egg(rng)
    egg.save(ROOT / "textures/item/creeper_trader_spawn_egg.png")
    egg.resize((128, 128), Image.NEAREST).save(ROOT / "icon.png")


if __name__ == "__main__":
    main()

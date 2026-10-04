#!/usr/bin/env python3
"""Assemble the square tile PNGs in Pages/ into a single grid image.

Usage:
    python3 build_grid.py [--rows H] [--cols W] [--tile-size PX] [--pages N ...]

Tiles are read from Pages/ (Atlas.png = page 1, Atlas2.png = page 2, ...
Atlas67.png = page 67).

--pages takes one or more page numbers and places exactly those tiles, in
the order given — left-to-right, top-to-bottom. e.g. --pages 5 2 9 places
page 5 first, then 2, then 9, and every other page is left out entirely.
Omit --pages to include every page found, in numeric order. If there are
fewer tiles than grid cells, the remaining cells are left white; if there
are more, the extras are skipped and a warning is printed.

Source tiles are 7200x7200px; assembling them at full resolution would
produce an unusably large file, so each tile is downscaled to --tile-size
(default 600px) before being placed. Pass a larger --tile-size (up to 7200)
for higher-resolution output.

Command:
python3 Atlas/Grid/build_grid.py --rows 3 --cols 11 --pages 1 3 7 8 9 12 15 16 20 21 22 24 25 30 31 32 33 35 50 51 46 47 53 37 38 48 49 34 62 63 64 66 67"""

import argparse
import re
import sys
from pathlib import Path

from PIL import Image

SCRIPT_DIR = Path(__file__).resolve().parent
PAGES_DIR = SCRIPT_DIR / "Pages"

NAME_RE = re.compile(r"^Atlas(\d*)\.png$", re.IGNORECASE)


def tile_index(path: Path) -> int:
    match = NAME_RE.match(path.name)
    digits = match.group(1)
    return int(digits) if digits else 1


def load_tiles() -> dict[int, Path]:
    tiles = [p for p in PAGES_DIR.glob("*.png") if NAME_RE.match(p.name)]
    if not tiles:
        sys.exit(f"No tile PNGs found in {PAGES_DIR}")
    return {tile_index(p): p for p in tiles}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rows", "-H", type=int, default=4, help="grid height in tiles (default 4)")
    parser.add_argument("--cols", "-W", type=int, default=17, help="grid width in tiles (default 17)")
    parser.add_argument(
        "--tile-size",
        type=int,
        default=600,
        help="size in pixels each square tile is scaled to before placement (default 600)",
    )
    parser.add_argument(
        "--pages",
        type=int,
        nargs="+",
        default=None,
        metavar="N",
        help="page number(s) to include, in the order given, e.g. --pages 5 2 9. Omit to include every page, in numeric order.",
    )
    args = parser.parse_args()

    rows, cols, tile_size = args.rows, args.cols, args.tile_size
    tiles_by_page = load_tiles()

    if args.pages is not None:
        invalid = sorted(set(n for n in args.pages if n not in tiles_by_page))
        if invalid:
            sys.exit(f"--pages page number(s) not found in {PAGES_DIR}: {invalid}")
        tiles = [tiles_by_page[n] for n in args.pages]
        print(f"including {len(tiles)} tile(s) in the given order: {args.pages}")
    else:
        tiles = [tiles_by_page[n] for n in sorted(tiles_by_page)]

    capacity = rows * cols

    if len(tiles) > capacity:
        overflow = len(tiles) - capacity
        print(
            f"warning: {len(tiles)} tiles but grid only holds {capacity} "
            f"({rows}H x {cols}W) — {overflow} tile(s) will be skipped",
            file=sys.stderr,
        )

    canvas = Image.new("RGB", (cols * tile_size, rows * tile_size), "white")

    for i, tile_path in enumerate(tiles[:capacity]):
        row, col = divmod(i, cols)
        tile = Image.open(tile_path).convert("RGBA")
        if tile.size != (tile_size, tile_size):
            tile = tile.resize((tile_size, tile_size), Image.LANCZOS)
        canvas.paste(tile, (col * tile_size, row * tile_size), tile)

    out_path = SCRIPT_DIR / f"grid_{rows}Hx{cols}W.png"
    canvas.save(out_path)

    print(f"placed {min(len(tiles), capacity)}/{capacity} tiles")
    print(f"saved {out_path} ({canvas.width}x{canvas.height}px)")


if __name__ == "__main__":
    main()

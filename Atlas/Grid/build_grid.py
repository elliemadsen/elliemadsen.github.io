#!/usr/bin/env python3
"""Assemble the square tile PNGs in Pages/ into a single grid image.

Usage:
    python3 build_grid.py [--rows H] [--cols W] [--tile-size PX] [--skip N ...]

Tiles are read from Pages/ (Atlas.png, Atlas2.png, ... Atlas67.png, sorted
numerically) and placed left-to-right, top-to-bottom. If there are fewer
tiles than grid cells, the remaining cells are left white. If there are
more tiles than cells, the extras are skipped and a warning is printed.

--skip takes one or more 1-based positions in that sorted order to leave
out entirely (the cell they would have occupied is left white, and every
later tile shifts up to fill the gap). e.g. --skip 2 omits the 2nd tile
(Atlas2.png); --skip 2 5 omits the 2nd and 5th.

Source tiles are 7200x7200px; assembling them at full resolution would
produce an unusably large file, so each tile is downscaled to --tile-size
(default 600px) before being placed. Pass a larger --tile-size (up to 7200)
for higher-resolution output.
"""

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


def load_tiles() -> list[Path]:
    tiles = [p for p in PAGES_DIR.glob("*.png") if NAME_RE.match(p.name)]
    if not tiles:
        sys.exit(f"No tile PNGs found in {PAGES_DIR}")
    return sorted(tiles, key=tile_index)


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
        "--skip",
        type=int,
        nargs="+",
        default=[],
        metavar="N",
        help="1-based position(s) in the sorted tile order to omit, e.g. --skip 2 5",
    )
    args = parser.parse_args()

    rows, cols, tile_size = args.rows, args.cols, args.tile_size
    tiles = load_tiles()

    skip_positions = set(args.skip)
    invalid = sorted(p for p in skip_positions if p < 1 or p > len(tiles))
    if invalid:
        sys.exit(f"--skip position(s) out of range (1-{len(tiles)}): {invalid}")
    if skip_positions:
        tiles = [t for i, t in enumerate(tiles, start=1) if i not in skip_positions]
        print(f"skipping {len(skip_positions)} tile(s): {sorted(skip_positions)}")

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

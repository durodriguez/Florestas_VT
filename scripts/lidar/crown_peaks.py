#!/usr/bin/env python3
"""Crown peaks for UVM's main campus, from Vermont's 2023 statewide LiDAR.

Each peak is the highest point of a tree crown, as seen from the air: a
place where a tree is, independent of where any inventory says it is. The
positions tool (/positions/) compares them with the mapped trees. See
docs/LIDAR.md for what the peaks are good for and where they go wrong.

The points come from the USGS cloud copy of the collection (public domain),
fetched only for the area asked for. Downloaded pieces are cached, so a second
run is quick and works offline.

    python3 scripts/lidar/crown_peaks.py                  # writes data/crown-peaks.csv
    python3 scripts/lidar/crown_peaks.py --cache ~/lidar  # where downloads are kept

Needs Python 3.10+ with numpy, scipy and laspy[lazrs]:
    pip install -r scripts/lidar/requirements.txt
"""

from __future__ import annotations

import argparse
import concurrent.futures as cf
import io
import json
import math
import os
import sys
import urllib.request
from pathlib import Path

import laspy
import numpy as np
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
SOURCE = 'https://usgs-lidar-public.s3.amazonaws.com/VT_Statewide_2_A23/'
SOURCE_NAME = 'USGS 3DEP VT_Statewide_2_A23 (Vermont 2023 QL1 lidar), flown 21 April 2023, leaf-off'
CAMPUSES = ('central', 'trinity', 'redstone', 'athletic')   # "main campus": where the inventory is
R = 6378137.0

# ---- tuning, each with its reason ------------------------------------------
CELL_M = 0.5          # raster cell on the ground: several points per cell at ~10 pts/m²
MIN_HEIGHT_M = 3.0    # below this a "peak" is as likely a shrub, a car or a lamp post as a tree
SMOOTH_M = 0.75       # leaf-off crowns are a lattice of branches; smoothing turns one crown into one hill
MULTI_RETURN_MIN = 0.35   # share of pulses split into several returns: 0.6-0.9 in crowns, under 0.3 on roofs and frames
BUILDING_MIN_HEIGHT_M = 2.5   # sheds and garages count; cars and hedges are removed by area
BUILDING_MIN_AREA_M2 = 20     # smaller flat patches are vans, kiosks, the odd flat crown
BUILDING_EDGE_M = 1.5         # a roof edge splits pulses for about a metre around it
MARGIN_M = 40         # fetched beyond the campus edge, so a crown on the boundary is whole


def window_radius_m(height_m: np.ndarray) -> np.ndarray:
    """How far apart two peaks must be to count as two trees.

    Grows with height, as crowns do: a 5 m tree has a crown a few metres
    across, a 25 m oak one of fifteen or more. Too small and one big crown
    yields several peaks; too large and two neighbours yield one.
    """
    return np.clip(1.5 + 0.12 * height_m, 1.5, 5.0)


# ---- geometry ----------------------------------------------------------------

def to_merc(lat: float, lng: float) -> tuple[float, float]:
    return math.radians(lng) * R, R * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))


def to_latlng(x: np.ndarray, y: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    return np.degrees(2 * np.arctan(np.exp(y / R)) - math.pi / 2), np.degrees(x / R)


def campus_polygons() -> list[list[tuple[float, float]]]:
    """Outer rings of the main-campus areas, as (lng, lat)."""
    areas = json.loads((ROOT / 'data' / 'campus-areas.geojson').read_text())
    rings = []
    for f in areas['features']:
        if f['properties'].get('area_id') not in CAMPUSES:
            continue
        g = f['geometry']
        polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
        rings += [[tuple(p) for p in poly[0]] for poly in polys]
    return rings


def inside(lng: np.ndarray, lat: np.ndarray, rings) -> np.ndarray:
    """Even-odd point-in-polygon, vectorised over points."""
    hit = np.zeros(len(lng), bool)
    for ring in rings:
        r = np.zeros(len(lng), bool)
        for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
            cross = ((y1 > lat) != (y2 > lat)) & (lng < (x2 - x1) * (lat - y1) / ((y2 - y1) or 1e-12) + x1)
            r ^= cross
        hit |= r
    return hit


# ---- fetching ----------------------------------------------------------------

class Source:
    """An Entwine Point Tile dataset, read only where it overlaps a box."""

    def __init__(self, base: str, cache: Path):
        self.base, self.cache = base, cache
        cache.mkdir(parents=True, exist_ok=True)
        self.ept = json.loads(self.get('ept.json'))

    def get(self, path: str) -> bytes:
        local = self.cache / path.replace('/', '__')
        if local.exists():
            return local.read_bytes()
        for attempt in range(5):
            try:
                data = urllib.request.urlopen(self.base + path, timeout=120).read()
                break
            except Exception:                  # dropped connections arrive as several kinds
                if attempt == 4:
                    raise
        # Written whole or not at all: a half-written piece must not be cached.
        tmp = local.with_suffix('.part')
        tmp.write_bytes(data)
        tmp.replace(local)
        return data

    def nodes(self, box) -> list[str]:
        b = self.ept['bounds']

        def overlaps(key: str) -> bool:
            d, x, y, _ = map(int, key.split('-'))
            w = (b[3] - b[0]) / 2 ** d
            return b[0] + x * w < box[2] and b[0] + (x + 1) * w > box[0] and b[1] + y * w < box[3] and b[1] + (y + 1) * w > box[1]

        found: list[str] = []

        def walk(page: str) -> None:
            for key, count in json.loads(self.get(f'ept-hierarchy/{page}.json')).items():
                if not overlaps(key):
                    continue
                if count == -1:
                    walk(key)
                elif count > 0:
                    found.append(key)

        walk('0-0-0-0')
        return found


# ---- rasters -----------------------------------------------------------------

def rasterize(src: Source, box, cell: float):
    """Per cell: lowest ground point, highest other point, and how many of
    the other points came from pulses that returned more than once."""
    nx = int(math.ceil((box[2] - box[0]) / cell))
    ny = int(math.ceil((box[3] - box[1]) / cell))
    ground = np.full((ny, nx), np.inf)
    top = np.full((ny, nx), -np.inf)
    n_other = np.zeros((ny, nx), np.int32)
    n_multi = np.zeros((ny, nx), np.int32)
    n_ground = np.zeros((ny, nx), np.int32)
    keys = src.nodes(box)
    print(f'  {len(keys)} pieces of the point cloud overlap the area', file=sys.stderr)

    def read(key: str):
        las = laspy.read(io.BytesIO(src.get(f'ept-data/{key}.laz')))
        x, y = np.asarray(las.x), np.asarray(las.y)
        m = (x >= box[0]) & (x < box[2]) & (y >= box[1]) & (y < box[3])
        cls = np.asarray(las.classification)
        m &= (cls == 1) | (cls == 2)          # 7 and 18 are noise; nothing else is used here
        return (((y[m] - box[1]) / cell).astype(np.int32), ((x[m] - box[0]) / cell).astype(np.int32),
                np.asarray(las.z)[m], cls[m], np.asarray(las.number_of_returns)[m])

    total = 0
    with cf.ThreadPoolExecutor(8) as pool:
        for i, (row, col, z, cls, nr) in enumerate(pool.map(read, keys), 1):
            g = cls == 2
            np.minimum.at(ground, (row[g], col[g]), z[g])
            np.add.at(n_ground, (row[g], col[g]), 1)
            o = ~g
            np.maximum.at(top, (row[o], col[o]), z[o])
            np.add.at(n_other, (row[o], col[o]), 1)
            np.add.at(n_multi, (row[o], col[o]), (nr[o] > 1).astype(np.int32))
            total += len(z)
            if i % 200 == 0:
                print(f'  {i}/{len(keys)} pieces read', file=sys.stderr)
    print(f'  {total:,} points', file=sys.stderr)

    # Ground under buildings and dense crowns has no ground hits: take the
    # nearest cell that has one.
    missing = ~np.isfinite(ground)
    _, (iy, ix) = ndimage.distance_transform_edt(missing, return_indices=True)
    ground = ground[iy, ix]
    height = np.where(np.isfinite(top), top - ground, 0.0)
    return np.clip(height, 0, None), n_other, n_multi, n_ground, total


# ---- peaks ---------------------------------------------------------------------

def disk(r: int) -> np.ndarray:
    yy, xx = np.ogrid[-r:r + 1, -r:r + 1]
    return xx * xx + yy * yy <= r * r


def masks(height, n_other, n_multi, n_ground, cell):
    """Which cells are buildings, and which are vegetation.

    Branches split a pulse into several returns; roofs and pavement return it
    once. But a pulse clipping a roof's edge splits too, so every building is
    outlined in false "vegetation". Buildings are therefore found first, as
    large flat surfaces that return once, and their edges are excluded.
    """
    def share_over(radius_m):
        size = 2 * max(1, round(radius_m / cell)) + 1
        return ndimage.uniform_filter(n_multi.astype(float), size) / np.maximum(
            ndimage.uniform_filter(n_other.astype(float), size), 1e-9)

    # Roof: raised, smooth, and seldom splits a pulse. Dark roofing returns
    # few pulses, leaving empty cells that would read as holes, so roughness
    # is judged on the surface with each empty cell given its nearest hit.
    empty = n_other == 0
    _, (iy, ix) = ndimage.distance_transform_edt(empty, return_indices=True)
    surface = height[iy, ix]
    mean = ndimage.uniform_filter(surface, 3)
    rough = np.sqrt(np.maximum(ndimage.uniform_filter(surface * surface, 3) - mean * mean, 0))
    smooth_roof = (share_over(0.5) < 0.2) & (rough < 0.6)
    # Or: nothing reaches the ground. Under bare branches the laser hits the
    # ground constantly; under a roof, glass and skylights included, never.
    sealed = ndimage.uniform_filter(n_ground.astype(float), 2 * round(1.0 / cell) + 1) == 0
    roof = (surface >= BUILDING_MIN_HEIGHT_M) & (smooth_roof | sealed)
    roof = ndimage.binary_opening(roof, structure=disk(2))
    labels, n = ndimage.label(roof)
    sizes = ndimage.sum(roof, labels, range(1, n + 1)) * cell * cell
    roof = np.isin(labels, 1 + np.nonzero(sizes >= BUILDING_MIN_AREA_M2)[0])
    building = ndimage.binary_dilation(roof, structure=disk(round(BUILDING_EDGE_M / cell)))

    share = share_over(1.5)
    veg = (share >= MULTI_RETURN_MIN) & (height >= MIN_HEIGHT_M * 0.5) & ~building
    # Thin lines of "vegetation" left along walls and fences are not crowns.
    veg = ndimage.binary_opening(veg, structure=disk(round(1.0 / cell)))
    return building, veg, share


def find_peaks(height, n_other, n_multi, n_ground, cell):
    """Local maxima of the smoothed canopy, on vegetation only."""
    building, veg, share = masks(height, n_other, n_multi, n_ground, cell)

    # Fill the gaps between branches before smoothing: a leaf-off crown's
    # cells are mostly empty, and an empty cell reads as height zero.
    canopy = ndimage.grey_closing(np.where(veg, height, 0.0), size=3)
    smooth = ndimage.gaussian_filter(canopy, SMOOTH_M / cell)
    want = window_radius_m(smooth)

    # A peak is the highest cell within a radius that grows with its height.
    found = np.zeros(height.shape, bool)
    for r_m in np.arange(1.5, 5.01, 0.5):
        band = np.abs(want - r_m) < 0.25
        if not band.any():
            continue
        is_max = smooth == ndimage.maximum_filter(smooth, footprint=disk(round(r_m / cell)))
        found |= is_max & band
    found &= (smooth >= MIN_HEIGHT_M) & veg
    rows, cols = np.nonzero(found)
    # Reported height: the highest return near the peak, not the smoothed hill.
    top = ndimage.maximum_filter(np.where(veg, height, 0.0), footprint=disk(round(1.0 / cell)))
    return rows, cols, top[rows, cols], (building, veg)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--cache', type=Path, default=Path(os.environ.get('XDG_CACHE_HOME', Path.home() / '.cache')) / 'uvm-trees-lidar')
    ap.add_argument('--out', type=Path, default=ROOT / 'data' / 'crown-peaks.csv')
    ap.add_argument('--raster', type=Path, help='also save the canopy height raster here (.npz), for inspection')
    ap.add_argument('--from-raster', type=Path, help='reuse a raster saved with --raster instead of reading the points')
    args = ap.parse_args()

    rings = campus_polygons()
    lngs = [p[0] for r in rings for p in r]
    lats = [p[1] for r in rings for p in r]
    lat0 = (min(lats) + max(lats)) / 2
    k = 1 / math.cos(math.radians(lat0))       # Web Mercator stretch at this latitude
    cell = CELL_M * k
    x0, y0 = to_merc(min(lats), min(lngs))
    x1, y1 = to_merc(max(lats), max(lngs))
    box = (x0 - MARGIN_M * k, y0 - MARGIN_M * k, x1 + MARGIN_M * k, y1 + MARGIN_M * k)

    print(f'Main campus ({", ".join(CAMPUSES)}): {(box[2]-box[0])/k:.0f} × {(box[3]-box[1])/k:.0f} m', file=sys.stderr)
    if args.from_raster:
        saved = np.load(args.from_raster)
        height, n_other, n_multi, n_ground = (saved['height'].astype(float), saved['n_other'],
                                              saved['n_multi'], saved['n_ground'])
        box, cell = tuple(saved['box']), float(saved['cell'])
    else:
        height, n_other, n_multi, n_ground, _ = rasterize(Source(SOURCE, args.cache), box, cell)
    if args.raster and not args.from_raster:
        np.savez_compressed(args.raster, height=height.astype(np.float32), n_other=n_other, n_multi=n_multi, n_ground=n_ground,
                            box=np.array(box), cell=cell)

    rows, cols, top_h, _ = find_peaks(height, n_other, n_multi, n_ground, CELL_M)
    x = box[0] + (cols + 0.5) * cell
    y = box[1] + (rows + 0.5) * cell
    lat, lng = to_latlng(x, y)
    keep = inside(lng, lat, rings)
    order = np.lexsort((lng[keep], -lat[keep]))
    lat, lng, top_h = lat[keep][order], lng[keep][order], top_h[keep][order]

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open('w') as f:
        f.write('peak_id,lat,lng,height_m\n')
        for i, (a, b, h) in enumerate(zip(lat, lng, top_h), 1):
            f.write(f'P{i:04d},{a:.6f},{b:.6f},{h:.1f}\n')
    print(f'✓ {len(lat)} crown peaks on main campus → {args.out.relative_to(ROOT) if args.out.is_relative_to(ROOT) else args.out}', file=sys.stderr)
    print(f'  source: {SOURCE_NAME}', file=sys.stderr)


if __name__ == '__main__':
    main()

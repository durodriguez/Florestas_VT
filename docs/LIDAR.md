# Crown peaks from LiDAR

`data/crown-peaks.csv` lists **2,521 crown peaks** on main campus (Central,
Trinity, Redstone and Athletic). A peak is the top of a tree's crown, seen from
the air in Vermont's statewide LiDAR. It records that a tree stood there, but
not which tree. [`/positions/`](POSITIONS.md#lidar-crown-peaks) compares the
peaks with the mapped trees and suggests corrections, which a person accepts or
ignores. This is the first step of [to-do 20](TODO.md).

## Where the data comes from

| | |
|---|---|
| Collection | Vermont statewide LiDAR, 2023, USGS quality level 1 (≥ 8 points/m²) |
| Copy used | USGS 3DEP `VT_Statewide_2_A23`, cloud-optimised (Entwine) copy on `usgs-lidar-public` |
| Flown | **21 April 2023**, leaf-off (read from the points' own timestamps) |
| Over campus | 49 million points, about 10 per m² |
| Licence | Public domain (US federal); the peaks can be published freely |

The points are classified only as *ground* or *unclassified*, so buildings and
trees are not separated in the source. Telling them apart is part of the
method, below.

## Running it

It is a desk tool, run when the method changes or a newer collection appears.
The site and its build need none of it.

```bash
pip install -r scripts/lidar/requirements.txt     # numpy, scipy, laspy
python3 scripts/lidar/crown_peaks.py              # → data/crown-peaks.csv
npm run data                                      # → public/data/crown-peaks.json
```

The first run downloads about 300 MB and takes a few minutes. The download is
cached (in `~/.cache/uvm-trees-lidar`, or wherever `--cache` says), so later
runs take seconds. `--raster file.npz` saves the height raster for inspection,
and `--from-raster` reruns from it without the points. The raw points are never
committed.

## The method

1. **A height map** on a 0.5 m grid. Each cell records the highest point above
   the ground, with the ground filled in under buildings from the nearest
   ground hit.
2. **Buildings out.** A pulse clipping a roof edge splits into several returns,
   just as one passing through branches does, so every building would otherwise
   be outlined in false trees. A building is a raised surface at least 20 m²
   that is either smooth and seldom splits pulses, or that **no pulse gets
   through to the ground**. Under bare branches the laser reaches the ground
   constantly; under a roof, glass included, never. The outline is widened by
   1.5 m.
3. **Vegetation.** Cells where at least 35% of pulses split into several returns.
   Crowns measure 60–90%. Roofs, and the steel frame of a building under
   construction in 2023, measure under 30%.
4. **Peaks.** The vegetation heights are smoothed to turn a leaf-off crown's
   lattice of branches into one hill. A peak is the highest point within a
   radius that grows with height, from 1.5 m to 5 m, so a big crown gives one
   peak and two small neighbours give two. Peaks under 3 m are dropped.

Each choice, and the reason for it, is a named constant at the top of
`scripts/lidar/crown_peaks.py`.

## How good it is

**Positions.** Burlington's street trees have surveyed positions. Their nearest
peak is a **median 1.3 m** away: a crown's top is not exactly above its trunk.
That is the method's own error, so `/positions/` treats a tree within 2 m of its
peak as agreeing.

**Against the 2,045 mapped UVM trees** (standing trees only; shrubs left out):

| | Trees |
|---|---|
| A peak within 2 m: record and LiDAR agree | 267 |
| A peak 2–8 m away: **a suggested move** | 526 |
| No peak within 8 m | 1,252 |

**"No peak" does not mean the tree is wrong.** In April 2023, 484 of the 1,252
had nothing taller than 3 m within 2 m of their dot. That covers three cases:

- trees too small or young to show;
- trees planted since;
- dots in the wrong place, as in the Redstone pine grove ([19](TODO.md)).

Most of the rest are trees whose crowns merge with a neighbour's, so that one
peak serves two trees.

**1,385 peaks have no mapped tree within 8 m.** They bunch along wooded edges:

- the ravine on the east side;
- Redstone's southwest corner;
- the yards on Central Campus's west side.

These are the candidates for trees not yet inventoried. Some will be large
shrubs, or trees just outside UVM land on a boundary drawn from a map.

**The suggestions are a starting point for checking, not corrections in
themselves.** A peak 5 m from a tree may belong to the tree next to it. Check
each one on the imagery before accepting it.

## Known limits

- **April 2023.** The data predates trees planted or removed since.
- **Leaf-off.** Crowns show as branches only, which is enough for peaks but not
  for crown measurements.
- **Trunks do not show** at this density. Every position here is a crown top.
- **Merged crowns** in groves and woods yield fewer peaks than trees.
- **Trees overhanging buildings** fall inside the building outline and are lost.

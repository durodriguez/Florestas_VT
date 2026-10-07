# Crown peaks from LiDAR

`data/crown-peaks.csv` lists **8,284 crown peaks** inside the campus boundary,
Centennial Woods and Spear Street included. A peak is the top of a tree's crown,
seen from the air in Vermont's statewide LiDAR. It records that a tree stood
there, but not which tree. [`/positions/`](POSITIONS.md#lidar-crown-peaks)
draws them over the imagery and the mapped trees. Nothing pairs them with trees
yet: the first job is to look at them and see what patterns hold. This is part
of [to-do 20](TODO.md).

| Area | Peaks |
|---|---|
| Centennial | 4,685 |
| Central | 1,365 |
| Spear Street | 1,077 |
| Redstone | 503 |
| Athletic | 374 |
| Trinity | 279 |

## Where the data comes from

| | |
|---|---|
| Collection | Vermont statewide LiDAR, 2023, USGS quality level 1 (≥ 8 points/m²) |
| Copy used | USGS 3DEP `VT_Statewide_2_A23`, cloud-optimised (Entwine) copy on `usgs-lidar-public` |
| Flown | **21 April 2023**, leaf-off (read from the points' own timestamps) |
| Over campus | 131 million points; 10 per m² at Central, nearer 30 where flight lines overlap |
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

The first run downloads about 1 GB and takes about seven minutes. Each part of
the boundary (the main block, and Spear Street) is read separately. The download is
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
peak is a **median 1.3 m** away, because a crown's top is not exactly above its
trunk. That is the best these peaks can do.

**Counts.** One peak is not one tree:

- **Clumps merge.** Two tops closer than the search radius count as one peak.
  The radius is about 4 m for an 18 m tree. The white pines tagged 2646–2648 on
  Trinity are one crown 12 m wide in the LiDAR, with one peak.
- **Big crowns can split.** A broad, flat-topped crown may give two peaks.
- **Woods undercount.** Trees under the canopy have no peak of their own, so the
  4,685 in Centennial are crowns at the top of the canopy, not a tree count.

## Known limits

- **April 2023.** The data predates trees planted or removed since.
- **Leaf-off.** Crowns show as branches only, which is enough for peaks but not
  for crown measurements.
- **Trunks do not show** at this density. Every position here is a crown top.
- **Trees overhanging buildings** fall inside the building outline and are lost.

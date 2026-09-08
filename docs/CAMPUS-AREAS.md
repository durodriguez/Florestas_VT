# Campus areas

UVM's official map at <https://www.uvm.edu/map/> does two useful things this
map did not: it draws a clear edge around university land, and it splits that
land into the five named campuses — Central, Trinity, Centennial, Redstone and
Athletic. Both now exist here as an optional overlay.

The public map shows it under **Campus areas** in the layers control
(bottom-right), as a checkbox alongside *Walking trails*. The three basemaps —
Streets, Satellite, Topographic — stay radio buttons, because you can only have
one basemap; the overlays are checkboxes, because you can have any combination.

---

## Where the geometry stands

**The outer campus boundary is real.** It was traced over satellite imagery on
8 September 2026 — 104 vertices, 542 acres, which sits sensibly against UVM's
commonly cited ~460-acre main campus plus Centennial Woods and the athletic
land.

**The five sub-campuses are still estimates.** They are the original hand-drawn
placeholders, georeferenced from a screenshot of UVM's map, and can be 100–300 m
out. Carve them out of the boundary in split mode, below.

Three things keep the difference visible rather than hidden:

- each feature carries `provisional`, true only while it is an estimate
- provisional areas draw **dashed** and pale; real ones draw solid
- `npm run data` warns on every build while any area is provisional, and the
  map labels the layer **Campus areas (approximate)**

All three clear themselves once nothing is provisional. Nothing needs editing
but the data file.

## The tracer

Open **`/tracer/`** on the live site (or `npm run dev` then
<http://localhost:5173/tracer/>). It is an internal tool: it writes nothing
anywhere, and its only output is a file you download.

**Load a file** pulls in a `campus-areas.geojson` from your computer, so you can
stop, download, come back and carry on without committing between rounds.

### Split — for the sub-campuses

This is the mode to use, and it opens in it whenever the outer boundary is real.
It exists because tracing all five campuses by hand costs hundreds of clicks,
almost all of them re-drawing an edge that has already been traced once.

The whole boundary starts out as unassigned land, shaded green.

1. Click an area in the list — say **Redstone Campus**.
2. Draw a **rough** shape over the part of campus that belongs to it. Run well
   outside the campus edge; that side gets trimmed back to the traced boundary
   automatically. Only the lines *between* campuses need care, and each of those
   gets drawn exactly once, because whatever you leave behind becomes the
   neighbour.
3. **Assign this shape to Redstone Campus.** The acreage appears in the list and
   the unassigned total drops.
4. Repeat for three more. For the last one, **Give the rest to this area** — no
   drawing at all.

Four rough shapes and a button, and the five campuses tile the boundary exactly:
no gaps, no overlaps, every outer edge the one you traced.

**Undo last change** steps back one assignment. **Start over** resets the five
campuses — never the outer boundary, which is far too expensive to lose to a
misclick.

### Trace — for anything from scratch

Click every vertex yourself. This is what the outer boundary needed, and it is
the fallback for redoing a single area. Undo point, discard shape, same as
before.

### Then

**Download campus-areas.geojson**, put it in `data/` replacing the file there,
`npm run data` to check it, and commit. Areas you finished come back with
`provisional: false`; anything you left alone keeps what it had, so the map
never claims more accuracy than it has.

### Or get the real thing

Better than any of this: ask UVM ETS or Campus Planning for the campus boundary
as a shapefile or GeoJSON. They maintain it. If you get one, reproject to WGS84
(EPSG:4326), give each feature the properties below, and drop it straight in —
no code changes.

## File format

`data/campus-areas.geojson` is a GeoJSON `FeatureCollection` of `Polygon` or
`MultiPolygon` features. Every feature needs:

| Property | What it is |
| --- | --- |
| `area_id` | Stable identifier, unique in the file. |
| `name` | What appears on the map, e.g. `Central Campus`. |
| `kind` | `boundary` for the outer campus edge, `campus` for a named sub-campus. |
| `color` | Hex outline and fill colour. |
| `description` | One line, for reference — not currently shown on the map. |
| `provisional` | `true` while the geometry is an estimate. |

`kind` controls the drawing: `boundary` is an unfilled outline with no label
(the sub-campus labels sit inside it, and a seventh label there would collide),
while `campus` is filled at 8% and carries its name across the middle.

Coordinates are **`[longitude, latitude]`** — that is the GeoJSON order, and it
is the reverse of every other coordinate in this repository. Getting it
backwards puts campus in the Indian Ocean, where the polygon is not visibly
wrong so much as simply absent, so `npm run data` rejects any position outside
`config.json`'s map bounds and says to check for a swap.

## Validation

`npm run data` fails the build on: a missing or duplicate `area_id`; a `kind`
that is not `boundary` or `campus`; geometry that is not a Polygon or
MultiPolygon; a ring with fewer than four positions; a ring whose last position
does not repeat its first; and any position outside the configured map bounds.
Every ring of a MultiPolygon is checked, not just the first.

It warns — without failing — while any area is still provisional.

## How the splitting works

Split mode is boolean polygon clipping, via the `polygon-clipping` package. Your
drawn shape is intersected with the unassigned remainder to produce the area,
and subtracted from it to produce the new remainder. That is why a sloppy
outside edge costs nothing: the intersection can only ever return land that was
already inside the boundary.

The remainder is not stored. It is recomputed as the boundary minus everything
the campuses hold, so there is no second copy to drift out of step with the
areas themselves — assigning to one area *is* the whole edit.

Pieces under 200 m² are dropped as clipping noise: a hair of overlap where a
drawn edge grazes the boundary, rather than a real scrap of campus. The maths
lives in `src/tracer/split.ts`, away from Leaflet and the DOM, and
`tests/split.test.ts` covers it — including that area is conserved across a
sequence of carves, that a shape swallowing the whole boundary yields the whole
boundary, and that a self-intersecting scribble is normalised rather than
throwing.

## Two things this does not do yet

**The overlay is decoration, not data.** The polygons are drawn; nothing is
computed from them. In particular they are not connected to `collections.csv`,
which is what feeds the map's existing *Campus area* filter and its colour-by
mode. Those five campuses are the obvious real content for that file, which is
currently empty.

**Nothing assigns a tree to a campus.** Once the geometry is real, a
point-in-polygon check could fill in each plant's `collection_id` automatically
from its coordinates, instead of a surveyor picking one by hand. That is a
small script, and it is worth writing *after* the boundaries are, because a
tree 200 m from where the line really runs would be filed under the wrong
campus — quietly, and 2,500 times over.

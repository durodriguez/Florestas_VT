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

## The geometry is currently an estimate

**Read this before quoting any boundary on this map.**

UVM does not publish these boundaries as a downloadable file, and the machine
that built this repository has no outbound network access to `uvm.edu` (nor to
OpenStreetMap's Overpass or Nominatim APIs), so the real geometry could not be
fetched. The shapes in `data/campus-areas.geojson` were georeferenced by hand
from a screenshot of UVM's map. **Expect them to be off by 100–300 m.**

Three things keep that honest rather than hidden:

- every feature carries `"provisional": true`
- provisional areas are drawn **dashed**, and the layer is labelled
  **Campus areas (approximate)**
- `npm run data` prints a warning on every build while any area is provisional

Once the geometry is real, the dashes, the "(approximate)" suffix and the
warning all disappear on their own. Nothing needs editing but the data file.

The simple block shapes are deliberate too. A hand-wobbled 40-vertex outline
would *look* surveyed while being just as wrong; plain rectangles read as
placeholders, which is what they are.

## Replacing it — the tracer

Open **`/tracer/`** on the live site (or `npm run dev` then
<http://localhost:5173/tracer/>). It is an internal tool: it writes nothing
anywhere, and its only output is a file you download.

1. Click an area in the left-hand list — say **Central Campus**.
2. Click your way around its edge on the satellite imagery. The current
   estimated shapes show underneath as faint dashed guides, so you know which
   part of campus you are looking at.
3. **Undo point** removes the last click; **Clear area** starts that one over.
   You do not need to close the shape — the last point joins back to the first.
4. Repeat for the other areas. You can do one now and the rest later; anything
   you do not trace keeps the shape it already had.
5. **Download campus-areas.geojson**, and put that file in `data/`, replacing
   the one there.
6. `npm run data` to check it, then commit.

Anything you traced comes back with `"provisional": false`. Anything you left
alone stays flagged, so the map keeps telling the truth about which boundaries
are real and which are still guesses.

### Or get the real thing

Better than tracing: ask UVM ETS or Campus Planning for the campus boundary as
a shapefile or GeoJSON. They maintain it, and a file from them beats anyone's
tracing. If you get one, reproject to WGS84 (EPSG:4326), give each feature the
properties below, and drop it straight in — no code changes.

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

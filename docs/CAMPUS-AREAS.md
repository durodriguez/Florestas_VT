# Campus areas

UVM's official map at <https://www.uvm.edu/map/> does two useful things this
map did not: it draws a clear edge around university land, and it splits that
land into its named campuses — Central, Trinity, Centennial, Redstone, Athletic,
and Spear Street, which is detached and sits over a kilometre south of the rest.
Both now exist here as an optional overlay.

The public map shows it under **Campus areas** in the layers control
(bottom-right), as a checkbox alongside *Walking trails*. The three basemaps —
Streets, Satellite, Topographic — stay radio buttons, because you can only have
one basemap; the overlays are checkboxes, because you can have any combination.

---

## Where the geometry stands

**All of it is real.** Traced and split over satellite imagery on 8–9 September
2026, and nothing in the file is flagged provisional any more.

| Area | Acres |
| --- | ---: |
| UVM campus (boundary, two parts) | 692 |
| Centennial Campus | 222 |
| Central Campus | 164 |
| Spear Street Campus | 151 |
| Athletic Campus | 81 |
| Redstone Campus | 55 |
| Trinity Campus | 19 |

The six campuses tile the boundary exactly — nothing unassigned, and they sum
to within 0.02 acres of it, which is the sliver threshold below.

The boundary is a two-part MultiPolygon: the main campus, and the Spear Street
parcel about 1.2 km south of it.

Because nothing is provisional, the map draws every area solid and the layer is
called plain **Campus areas**. Should anyone add an estimated area later, that
one feature draws dashed, the layer regains its "(approximate)" suffix, and
`npm run data` warns until it is replaced. All three are driven by the
`provisional` property and need no code change either way.

## The tracer

Open **`/tracer/`** on the live site (or `npm run dev` then
<http://localhost:5173/tracer/>). It is an internal tool: it writes nothing
anywhere, and its only output is a file you download.

**Load a file** pulls in a `campus-areas.geojson` from your computer, so you can
stop, download, come back and carry on without committing between rounds.

### Detached parcels first

Order matters for anything detached — Spear Street was the case that proved it.
Trace it in **Trace** mode before splitting anything. Two things then happen
automatically:

- the parcel is merged into the **UVM campus** boundary, which becomes a
  two-part MultiPolygon — the tracer says how many acres it added, and *Undo
  last change* backs it out if that was not what you wanted
- because the parcel is now claimed by a campus, split mode's unassigned
  remainder is the main polygon *only*

Do it the other way round and **Give the rest to this area** would hand the
whole Spear Street parcel to whichever campus you were finishing, because from
the geometry's point of view it is simply more unassigned land.

Split mode will not touch the parcel at all — there is no unassigned land down
there until it is merged in — and says so rather than failing quietly.

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

Four rough shapes and a button, and the five main-campus areas tile the boundary
exactly: no gaps, no overlaps, every outer edge the one you traced.

**Undo last change** steps back one assignment. **Start over** resets the
sub-campuses — never the outer boundary, which is far too expensive to lose to a
misclick.

#### When a few acres will not go anywhere

Splitting by hand leaves hairline seams where two draws did not quite meet. In
the real split they came to 1.54 acres in five pieces, the largest 50 m wide and
the smallest 21 × 41 m — impossible to click accurately, and easy to miss
entirely.

**Give the rest to this area** is the answer, and it is built for exactly this:
it takes every leftover piece at once and *merges* them into what that area
already holds. It stays available while you are part-way through drawing,
because that is precisely when you are likely to need it. Watch where the
fragments land, though: a seam can be closer to a different campus than the one
you gave it to, and it will simply become a detached scrap of the area you
chose.

### Edit — for moving land that already has an owner

Split can only hand out *unassigned* land, so once a split is finished it can
fix nothing: every acre has a holder. Edit mode moves land between areas, and
the areas still tile the boundary afterwards — what one gains, the others lose,
with no gap or overlap left behind.

Pick who should receive the land in the list, then choose the land two ways:

**Pick a piece** makes every area clickable; click one and it transfers whole.
Any piece under 5 acres also carries a **label with its acreage** floating over
it, because a half-acre scrap stranded inside a neighbour is invisible at the
zoom where you can see the campus — the pieces most likely to be misfiled are
exactly the ones nobody can find.

**Draw a region** turns the clicking off and lets you draw instead; the region
is taken from whichever areas hold it. This is the tool for a messy junction:
draw the shape you *want* one area to have and it takes it from its neighbours
in one go. The region is clipped to the campus boundary first, so a sloppy
outer edge cannot push an area outside university land.

The two are separate because they cannot coexist — a clickable polygon
swallows the very clicks that would draw a shape across it.

**Undo last change** reverses a move.

### Trace — for anything from scratch

Click every vertex yourself. This is what the outer boundary needed, what Spear
Street needs, and the fallback for redoing any single area. Undo point, discard
shape, same as before.

Tracing a **campus** that reaches outside the boundary extends the boundary to
take it in; that is what makes a detached parcel work. Parts that do not touch
stay disjoint — the boundary becomes a MultiPolygon rather than a shape stretched
across the gap. Anything under 200 m² outside is treated as a wobble on an edge
and ignored, so a slightly sloppy retrace of an existing area does not quietly
grow the campus.

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
(the sub-campus labels sit inside it, and one more there would collide), while
`campus` is filled at 8% and carries its name across the middle. Labels are
hidden below zoom 15, where the areas stop being distinguishable and the names
pile up.

A feature may be a `MultiPolygon`, which is how the boundary holds the main
campus and the detached Spear Street parcel as two separate rings.

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

Merging a detached parcel is the same library's union. Disjoint inputs come back
as separate parts, which is exactly what the boundary needs.

Edit mode's transfer is a union for the receiving area and a difference for
every other one, applied in a single pass. Because the same region is added
once and removed everywhere else, the areas cannot end up overlapping or
leaving a gap — verified after a run of moves as 0.0000 acres of both.

Pieces under 200 m² are dropped as clipping noise: a hair of overlap where a
drawn edge grazes the boundary, rather than a real scrap of campus. It is also
why the campuses can sum to a hair under the boundary — 0.03 acres across a full
split, in testing. The maths
lives in `src/tracer/split.ts`, away from Leaflet and the DOM, and
`tests/split.test.ts` covers it — including that area is conserved across a
sequence of carves, that a shape swallowing the whole boundary yields the whole
boundary, that a self-intersecting scribble is normalised rather than throwing,
that disjoint parts merge without bridging, that claiming the detached parcel
leaves only the main polygon unassigned, and that a transfer conserves area,
leaves no overlap, and closes the hole a moved scrap leaves behind.

## Two things this does not do yet

**The overlay is decoration, not data.** The polygons are drawn; nothing is
computed from them. In particular they are not connected to `collections.csv`,
which is what feeds the map's existing *Campus area* filter and its colour-by
mode. Those five campuses are the obvious real content for that file, which is
currently empty.

**Nothing assigns a tree to a campus.** Spear Street makes this more useful than
it was: a tree there is 1.2 km from anything else, so a coordinate alone would
place it unambiguously. Once the geometry is real, a
point-in-polygon check could fill in each plant's `collection_id` automatically
from its coordinates, instead of a surveyor picking one by hand. That is a
small script, and it is worth writing *after* the boundaries are, because a
tree 200 m from where the line really runs would be filed under the wrong
campus — quietly, and 2,500 times over.

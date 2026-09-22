# Burlington's street trees

Main Street, College Street and Colchester Avenue run through the middle of
campus, and their trees are as much a part of walking across it as the ones the
university owns. A visitor does not care who holds the deed.

**335 of them stand inside the campus boundary**, out of the 14,429 in the
city's inventory. They are on the map, off by default, behind **Show Burlington
street trees**.

```
npm run import:city -- Tree_Sites_Public_View.csv            # dry run
npm run import:city -- Tree_Sites_Public_View.csv --write     # writes data/city-trees.csv
```

The source is the City of Burlington's public tree inventory. It is open data,
so unlike UVM's ArcGIS layer the clipped result **is** committed — a clean clone
draws the same map.

## They are not part of the collection, structurally

This is the whole design, not a disclaimer:

- **Their own file.** `data/city-trees.csv`, never `plants.csv`. `npm run
  import`, `npm run labels` and the accession sequence all read `plants.csv` and
  cannot reach a city tree. A separate file makes that impossible rather than
  merely discouraged.
- **Their own ids.** `BTV-886`, from Burlington's own `site_id`. Nothing here
  can be mistaken for a UVM accession, and no QR label will ever be printed for
  one.
- **Their own array in the payload.** `dataset.cityTrees`, not merged into
  plants. Every count, facet and CSV export in the app takes "plants" to mean
  the UVM collection, and they are right to. The map still says **2,052
  plants** with the city layer on.
- **Their own search.** They do not appear in the plant result list. Typing
  `BTV-` finds nothing, because the list is the university's collection.
- **Their own record panel.** It opens saying `BTV-886 · City of Burlington` and
  states in the first paragraph whose tree it is, then ends by pointing
  corrections at the city rather than the university.

## Blue and white, against green and gold

Burlington's flag is blue and white; UVM's colours are green and gold. The
layer mirrors the UVM one exactly in shape and differs only in palette, so the
difference reads as *whose tree* rather than *what kind of thing*:

| | UVM | Burlington |
| --- | --- | --- |
| Cluster bubble | green at 82%, 2px gold border | `#1D4395` at 82%, 2px white border |
| Individual tree | green fill, thin white stroke | `#1D4395` fill, thin white stroke |
| Sized by | trunk diameter | trunk diameter |
| Clustering | identical | identical |

Source: [flagcolorcodes.com/burlington](https://flagcolorcodes.com/burlington).

A shared link keeps the layer: `?city=1`.

## The projection, and why it needed care

Burlington publishes positions in the state's own grid, not in degrees. `X` and
`Y` are **NAD83 / Vermont (EPSG:32145) in US survey feet**.

That is established rather than assumed. 68 of the 14,429 rows carry both the
feet columns and a pair in metres, and the ratio between them is 3937/1200 — the
US survey foot, not the international foot — to six decimal places on every one.
Using the wrong foot would put every tree about 4 m out.

There is no projection library here, and adding one to convert a single file
would have been the larger change, so `scripts/lib/vtsp.mjs` spells out the
inverse Transverse Mercator. It is checked three ways:

- **At the origin**, where the answer is known exactly: easting 500,000 and
  northing 0 must give 42.5°N, 72.5°W. It does, to nine decimal places.
- **Against the metre columns.** 67 of those 68 rows agree to **one
  centimetre**. The 68th is 13.5 m out, which is one bad row in the source
  rather than a fault in the maths.
- **Against the street names.** The trees that land inside the boundary are on
  Main St (155), South Prospect (58), South Williams (49), Colchester Ave (46),
  East Ave, College St and Summit St — exactly the streets that ring UVM. A
  wrong projection does not put trees on the right streets by accident.

## What is left out, and why

Of the 398 city records inside the boundary, **63 are not standing trees**:

| `site_typ` | Left out | Reading |
| --- | --- | --- |
| `T` | — kept, 335 | a standing tree |
| `S` | 51 | a stump |
| `R` | 8 | removed |
| `P` | 4 | a vacant planting site |

The codes are not documented in the export, so those readings come from the
data: `T` and `S` both carry a species and a diameter, while `R` and `P` mostly
carry neither and `P`'s diameter is zero.

Only `T` is imported. Being wrong about `S` costs 51 records; being wrong the
other way would draw stumps on a map of trees, so the safer error is the one
taken. If somebody at the city confirms the codes, this is one line to change.

## What each tree carries

`city_id`, `taxon_id`, `lat`, `lng`, `collection_id`, `dbh_in`, `condition`,
`planted_year`, `address`, `recorded_on`, `source_id`.

Two of those are worth a note:

- **`condition`** is mapped, not measured. Burlington scores 0–100; this project
  names five grades. The four scores inside the boundary are 90 → excellent,
  80 → good, 70 → fair, 50 → poor. `conditionFromScore()` holds the mapping in
  one place so it is readable rather than buried in an expression.
- **`source_id`** is Burlington's `GlobalID`, kept for the same reason the
  ArcGIS import keeps one: a refresh has to recognise a row rather than add it
  again.

**Every one of the 335 has a trunk diameter**, which is more than can be said
for the university's own records — see [to-do #7](TODO.md) on i-Tree.

## Refreshing it

The file is rewritten from the source every time, not merged. Nothing in it is
hand-edited, which is what makes that safe. Rows are sorted by id so a refresh
diffs cleanly and shows only what actually changed in Burlington's records.

Species resolved at **100%** on the clip — 335 of 335, 309 exact and 26
genus-only — because `species-aliases.csv` was built against this file before
any of this was written. A name the table has never seen is reported and that
tree is left out, rather than stopping the clip.

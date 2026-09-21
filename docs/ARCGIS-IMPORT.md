# The ArcGIS import

UVM's campus tree layer is the map this project is built on: 2,061 points
surveyed between **October 2023 and May 2024**, carrying a position, a tag
number, a common name and a health rating.

The survey work was done by **Erin Camire**, then an undergraduate at UVM, who
walked the campus and recorded every one of these trees. The dataset is used
here with her permission.

```
npm run import:arcgis -- query.geojson            # dry run, writes nothing
npm run import:arcgis -- query.geojson --write    # apply
```

Dry run is the default, as with `npm run import`. Two thousand rows is far too
many to read in a diff, so the report is the thing you actually check.

## What the source file is not

The export is **not committed**. It is UVM's data, shared for this purpose, and
it belongs in the system of record rather than in a public Git repository that
keeps every version of it forever.

Every row also carries `Creator` and `Editor` fields holding a named
individual's email address. Those are dropped on the way in. Crediting someone
for their work is this page's job; publishing their contact details in a data
column is not the same thing and was never wanted.

## What came in

| | |
|---|---|
| Features read | 2,061 |
| New plants | 2,046 |
| New observations | 2,051 |
| Matched a tree already on file | 5 |
| Kept their tag number | 1,348 |
| Issued from the untagged block | 703 |
| Skipped | 10 |

Positions fall inside the campus boundary for all but 8 of them: 837 Central,
587 Athletic, 479 Redstone, 148 Trinity. The 8 outsiders get no
`collection_id` rather than a guessed one.

Species resolve at **99.5%** against `taxa.csv` — 128 of 129 names — because
the alias table was built against this file before the import ran. See
[DATA-MODEL.md](DATA-MODEL.md#species-aliasescsv).

## Accession numbers

**A tagged tree keeps the number on its tag.** Tag 763 is `UVM-0763`, which is
what the metal tag nailed to it says and what a QR label would encode. Anything
else would mean a number in the record that contradicts the number in the
field.

**Untagged trees are issued from a block starting at `UVM-4001`**, above the
highest real tag (3849), so the two can never collide.

That block is also where a tree goes when its tag cannot be trusted:

- **A tag on two different trees.** Eight numbers appear twice in the layer,
  some on trees 400–700 m apart and of different species — tag 2297 is both a
  Japanese tree lilac and a larch. The first keeps the number; the second is
  issued a new one and carries a `TAG DISPUTED` note.
- **A tag nobody could read.** Seven records say things like `1818 or 1942`.
  Guessing either would be inventing data, so the tree gets a new number and a
  `TAG UNCERTAIN` note.

## What is skipped, and why

Ten records did not come in. A tree that cannot be named cannot have a record,
and inventing a species is worse than leaving a gap somebody can go and fill:

- **5 recorded as `ID Needed`** — the surveyor could not identify them
- **3 with no species at all**
- **2 with no position**

They are listed by `OBJECTID` in the import report, so they can be looked up in
ArcGIS and resolved in the field.

## Disagreements are recorded, never resolved silently

Five of the six trees we surveyed ourselves in 2026 also appear in the ArcGIS
layer, and agree with it to within 2.4–3.9 m. Their rows were **not**
overwritten: a position established by somebody standing under the tree beats
a point digitised from imagery.

Where the two sources disagree, the import says so in two places — the report,
and a note on the observation itself, because a report scrolls past:

```
UVM-0762 species: on file as quercus-michauxii; ArcGIS says "Swamp white oak"
UVM-0762 position: ArcGIS puts it 13 m from the recorded position
```

That is one tree, and it needs somebody to walk out to it. Observation notes
are internal — they are not sent to the browser at all — so a `SPECIES
CONFLICT` marker never appears on a public record.

## Running it again

Safe, and verified on the real file: a second run reports **0 new plants, 0 new
observations, 2,051 matched**.

Two rules make that true. An observation is keyed by `(plant_id,
surveyed_on)`, so a visit already on file is never recorded twice. And every
imported row keeps its ArcGIS `GlobalID` in `source_id`, which is how an
untagged tree is recognised the second time — see
[DATA-MODEL.md](DATA-MODEL.md#source_id-and-why-an-import-needs-it).

## Still to do

- **Tag 762** — the species and position conflict above, needing an in-person
  check.
- **The 15 flagged tags** — 8 disputed, 7 unreadable. `grep 'TAG ' data/observations.csv`
  lists them.
- **The 10 skipped records** — 8 need identifying, 2 need a position.
- **Trunk diameters.** The layer has none, so
  [to-do #7](TODO.md) (i-Tree ecosystem services) is still blocked. The 2014
  inventory holds a DBH for 950 of these trees, joinable by tag, but those
  measurements are twelve years old and feeding them to i-Tree would produce
  confident-looking wrong answers. That join is its own decision.

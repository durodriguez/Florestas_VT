# Field survey guide

This is the part software cannot do for you. Here is a workable plan for
getting from an empty `plants.csv` to a mapped campus.

## 1. Decide the accession scheme first

Pick it once and never change it. A good default:

```
UVM-2026-0001
    │    └── zero-padded sequence, never reused
    └── year the plant was accessioned
```

The accession number is printed on the physical label and encoded in its QR
code, so it must be permanent. If a tree is removed, retire the number — do
not reissue it to a new planting.

## 2. Choose your GPS accuracy target

| Method | Accuracy | Good for |
|---|---|---|
| Phone GPS alone | 3–10 m | Too coarse — trees end up in the wrong bed |
| Phone + external GNSS (Bad Elf, Arrow 100) | 0.5–1 m | **Recommended** for a campus inventory |
| Survey-grade RTK (Trimble, Emlid Reach) | 1–3 cm | Ideal; often borrowable from a geology/CEMS department |
| Digitising from orthoimagery | 0.5–2 m | Fine for large open-grown trees, poor under canopy |

Under a closed canopy, GPS degrades badly. A common trick is to stand in the
open, take a point, then record a bearing and taped distance to the trunk.

Vermont has excellent public imagery — the [VCGI](https://vcgi.vermont.gov/)
orthophotos and LiDAR canopy layers are worth loading as a QGIS backdrop to
check your points against visible crowns.

## 3. Collect in the field

Recommended tools, all free:

- **[QField](https://qfield.org/)** or **[Mergin Maps](https://merginmaps.com/)** —
  QGIS projects on an Android/iOS device, with offline basemaps and a form
  built from the column list below. This is the smoothest route.
- **[Epicollect5](https://five.epicollect.net/)** — no GIS knowledge needed;
  build a form in a browser, collect on a phone, export CSV.
- **Paper + a numbered flagging tape roll** — genuinely fine for a first pass,
  especially with a student crew.

Capture per plant — `survey/field-template.csv` is a filled-in example you can
hand to a crew or import straight into a field app:

```
tag, species, lat, lng, area,
dbh_in, height_ft, spread_ft, condition, planted_year, surveyor, date, photo, notes
```

Leave `tag` blank for a new plant; the importer assigns the accession number.
Put an existing accession there when you are re-surveying that tree. `species`
takes a common name, a scientific name or a `taxon_id`, whichever your crew
finds easier — and your app's own column names are fine, see section 6.

**Measuring DBH**: diameter at 4.5 ft above ground on the uphill side. Use a
diameter tape, not a regular one. For a tree forking below 4.5 ft, measure the
largest stem and note the rest.

**Height and spread** can be estimated to the nearest 5 ft; a clinometer app is
plenty accurate for an arboretum inventory.

**Condition** — use the five-point scale consistently:

| Value | Meaning |
|---|---|
| `excellent` | Full canopy, no significant defects |
| `good` | Minor deadwood or small wounds, structurally sound |
| `fair` | 25–50% canopy loss, decay, or a structural defect worth monitoring |
| `poor` | Over 50% decline, major structural defect, likely removal candidate |
| `dead` | Standing dead |

## 4. Work area by area

Do not try to map the whole campus at once. Take one `collection_id` at a
time — the University Green, then Redstone, then Trinity — and finish it
completely. Each finished area is a shippable improvement to the live map.

A two-person crew (one measuring, one recording) typically covers 60–120
trees a day.

## 5. Get it into the repo

Do **not** hand-edit `data/plants.csv` after an outing. Run the importer:

```bash
npm run import -- survey/2026-09-green.csv          # dry run — writes nothing
npm run import -- survey/2026-09-green.csv --write  # apply
```

`survey/field-template.csv` shows the shape it expects, though you rarely need
to match it exactly — see the next section.

The importer does the tedious, error-prone work:

- **Assigns accession numbers** in your scheme, continuing from the highest one
  already issued that year. Leave the `tag` column blank for a new plant.
- **Resolves species** from a common name, a scientific name or a `taxon_id`.
  A name matching two taxa is refused rather than guessed at.
- **Normalises vocabulary** — `EXC`, `Very Good`, `g` all become the right
  `condition` value. Campus areas resolve by display name.
- **Reads whatever coordinate format your app emitted** — decimal degrees,
  degrees-minutes-seconds, `POINT(lng lat)` from QGIS, or a `lat, lng` cell.
- **Applies re-surveys in place.** Put an existing accession in the `tag`
  column and it updates that record instead of adding a new one, changing only
  the values that actually differ. A field the surveyor left blank is left
  alone rather than blanked out, and GPS drift under half a metre is not
  treated as the tree having moved.
- **Refuses to write anything if any row has a problem.** A skipped row means a
  tree quietly missing from the map, so it stops instead and tells you which
  line and why.
- **Catches an accidental re-import.** A field export has no accession numbers
  for new plants, so running the same file twice would add every tree again.
  If most of a batch lands on top of existing plants of the same species, it
  stops. Pass `--allow-duplicates` if it really is dense new planting.

Dry run is the default. To stage the merged result for review without touching
the dataset:

```bash
npm run import -- survey/2026-09-green.csv --out review.csv
```

`--write` saves the previous version as `data/plants.csv.bak` before changing
anything.

Then:

```bash
npm run data     # validates every row
git add data/ && git commit
```

CI re-validates on push, and merging to `main` publishes the update.

### When it reports an unknown species

Add the species to `data/taxa.csv` first — the importer prints paste-ready stub
rows for anything it did not recognise. Fill in family, genus, species and
habit (see [DATA-MODEL.md](DATA-MODEL.md)), then re-run the import.

## 6. Matching your field app's columns

You do not have to rename columns by hand. `survey/mapping.json` maps schema
fields to the headers that mean them, ignoring case, spaces and punctuation —
so `DBH (in)`, `dbh_in` and `DBH` all match. It ships with the aliases common
field apps emit.

When the importer meets a header it cannot place, it says so and ignores that
column. If it should be imported, add the header to the relevant list in
`survey/mapping.json`.

The same file holds the condition aliases. If your crew writes `moderate` for
what the schema calls `fair`, add it there once rather than correcting every
export.

## 7. Photographs

Drop JPEGs in `public/photos/` and put the filename in the `photo` column.
Resize to about 1200 px on the long edge — full-resolution phone photos will
make the site slow on campus wifi.

## 8. Print the labels

```bash
npm run labels -- --collection university-green --base https://uvm.edu/arboretum/
```

Open `public/labels/labels.html` and print at 100% scale. Each label carries
a QR code linking to that plant's record. `public/labels/<accession>.svg`
holds the bare QR artwork if you are ordering engraved or aluminium signs.

## 9. Keep it current

- Re-survey condition on a rolling 5-year cycle, one area per year.
- Update `surveyed_on` whenever you revisit a plant.
- Mark removals as `status = removed` the week they happen — do not delete the row.
- New plantings get the next accession number in the current year's sequence.

## Notes specific to UVM

- **Emerald ash borer** is established in Vermont. Every `Fraxinus` record is
  worth revisiting annually; the `condition` field plus the map's "colour by
  condition" mode gives you a quick visual triage.
- **Beech leaf disease** and **hemlock woolly adelgid** are both present in
  Chittenden County — same argument for `Fagus` and `Tsuga`.
- Mapping invasives (`native_status = invasive`) is worth doing even though
  they are not "collection" plants: filtering to them gives the natural areas
  crew a live removal worklist.
- Centennial Woods and the other natural areas hold naturally regenerated
  stems, not accessions. Consider mapping only notable individuals there
  rather than attempting a full inventory.

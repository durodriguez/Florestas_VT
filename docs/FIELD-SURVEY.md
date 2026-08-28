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

Capture per plant:

```
plant_id, taxon_id, lat, lng, collection_id,
dbh_in, height_ft, spread_ft, condition, planted_year, notes, photo
```

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

1. Export your field data as CSV.
2. Append the rows to `data/plants.csv`.
3. Add any new species to `data/taxa.csv` first — a `taxon_id` that does not
   exist there will fail the build with a clear message.
4. Run `npm run data`. Fix anything it reports.
5. Commit and open a pull request. CI re-validates, and merging to `main`
   publishes the update.

## 6. Photographs

Drop JPEGs in `public/photos/` and put the filename in the `photo` column.
Resize to about 1200 px on the long edge — full-resolution phone photos will
make the site slow on campus wifi.

## 7. Print the labels

```bash
npm run labels -- --collection university-green --base https://uvm.edu/arboretum/
```

Open `public/labels/labels.html` and print at 100% scale. Each label carries
a QR code linking to that plant's record. `public/labels/<accession>.svg`
holds the bare QR artwork if you are ordering engraved or aluminium signs.

## 8. Keep it current

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

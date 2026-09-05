# Data model

All plant data lives in plain CSV files in `data/`. They are the source of
truth — everything the website loads is generated from them by `npm run data`.
CSV was chosen deliberately: a surveyor can open these in Excel, Numbers or
Google Sheets, and every change shows up as a readable diff in git.

```
data/taxa.csv         one row per species/cultivar   (what a plant is)
data/plants.csv       one row per mapped individual  (where it is, how big)
data/collections.csv  campus areas / beds
data/trails.geojson   self-guided walking tours
data/config.json      site name, map centre, campus bounds
```

The split between `taxa.csv` and `plants.csv` matters: species facts (flower
colour, hardiness zone, description) are written **once** per species, not
repeated on all 400 sugar maples. `plants.csv` refers to a species by
`taxon_id`.

---

## taxa.csv

| Column | Required | Notes |
|---|---|---|
| `taxon_id` | ✅ | Stable slug, e.g. `acer-saccharum`. Never reuse or renumber. |
| `scientific_name` | ✅ | Full name as normally written, e.g. `Acer saccharum` |
| `common_name` | ✅ | `Sugar maple` |
| `family` | ✅ | `Sapindaceae` |
| `genus` | ✅ | `Acer` |
| `species` | | `saccharum` — blank for hybrids and genus-only cultivars |
| `infraspecific` | | `var. inermis`, `subsp. nigrum` |
| `cultivar` | | `Princeton` — no quote marks, the site adds them |
| `habit` | ✅ | `tree`, `conifer`, `shrub`, `vine` |
| `foliage` | | `deciduous`, `evergreen`, `semi-evergreen` |
| `native_status` | | `native`, `introduced`, `invasive` |
| `flower_color` | | free text, one word: `pink`, `yellow-green` |
| `flower_months` | | month numbers, e.g. `4,5` for April–May |
| `fruit_color`, `fruit_months` | | same shape as the flower columns |
| `fall_color` | | `orange`, `yellow`, `none` |
| `mature_height_ft` | | number |
| `mature_spread_ft` | | number — typical crown width at maturity |
| `bark_profile` | | short description; bark is usually the most reliable field cue |
| `pest_resistance` | | known pest and disease **pressure**, not a resistance score — see below |
| `soil_preference` | | moisture, drainage and pH in a phrase |
| `hardiness_zones` | | `3-8` |
| `wikipedia_url` | | linked from the plant record. Derived from the scientific name, so run `npm run check:links` to confirm they resolve — a redirect is fine and usually means the name is a synonym of the accepted one |
| `description` | | one or two sentences shown on the record |

## plants.csv

| Column | Required | Notes |
|---|---|---|
| `plant_id` | ✅ | Accession number, e.g. `UVM-2026-0001`. **Permanent** — it is what the QR code encodes. |
| `taxon_id` | ✅ | Must exist in `taxa.csv` |
| `lat`, `lng` | ✅ | Decimal degrees, WGS84, 6 decimal places (~0.1 m) |
| `collection_id` | | Must exist in `collections.csv` |
| `dbh_in` | | Diameter at breast height, inches. Leave blank for shrubs. |
| `height_ft`, `spread_ft` | | numbers |
| `condition` | | `excellent`, `good`, `fair`, `poor`, `dead` |
| `planted_year` | | blank for naturally regenerated plants |
| `status` | | `active` (default) or `removed` |
| `surveyed_on` | | `YYYY-MM-DD` |
| `surveyor` | | initials or name |
| `photo` | | filename in `public/photos/` |
| `memorial` | | dedication text, shown prominently |
| `notes` | | free text |

### Multi-stemmed trees

Record the largest stem in `dbh_in` and note the others in `notes`
(`"3 stems: 12.1, 9.4, 7.8 in"`). A single map point per plant keeps the
accession-to-label relationship one-to-one.

### Removed plants

Set `status` to `removed` rather than deleting the row. The record stays
reachable from its old QR code and from the map's "include removed plants"
option, which preserves the campus's landscape history.

## collections.csv

`collection_id`, `name`, `color` (hex, used by the "colour by campus area"
map mode), `description`.

**Currently empty.** The file previously held seven invented area names, which
were removed when real survey data replaced the sample rows — publishing made-up
campus zones alongside real trees would have been misleading. Fill it with UVM
Grounds' actual landscape zones, then set `collection_id` on the plants. Until
then the campus-area filter and the colour-by-area mode are simply empty, which
is accurate.

Draw the areas so a surveyor standing at a tree knows without thinking which one
they are in; vague boundaries are how the same bed ends up recorded three
different ways.

## trails.geojson

A GeoJSON `FeatureCollection` of `LineString` features. Each needs
`trail_id`, `name`, `color`, `length_mi`, `duration_min`, `description`, and
`stops` — an array of `plant_id` values in walking order. Draw the lines in
[geojson.io](https://geojson.io) or QGIS and paste them in.

### On the horticultural columns generally

`flower_color`, `flower_months`, `fruit_color`, `fruit_months`, `fall_color`,
`hardiness_zones`, `mature_height_ft`, `mature_spread_ft`, `bark_profile`,
`pest_resistance` and `soil_preference` are complete for every taxon, and all of
it is authored rather than transcribed from a reference.

A sample was checked against the Morton Arboretum, Missouri Botanical Garden,
Chicago Botanic Garden and NC State Extension. Of thirty values checked across
five taxa, one was wrong (Amur maackia has no autumn colour; it had been given
yellow, which belongs to one cultivar), three bloom windows were a month too
narrow, and the rest — including every hardiness range — matched. Those five
were corrected. Read that as roughly one value in six needing a nudge, mostly in
the month windows, which shift with the season anyway.

Months are the usual window for this climate, which runs a week or two later
than the same species further south. Anyone reviewing this file should start
with `flower_months` and `fruit_months`.

### On `pest_resistance`

The column records what a species is known to suffer from, not a rating. A
score invites "resistant, so plant it", which is a claim that ages badly:
emerald ash borer and beech leaf disease both arrived in Vermont after the 2014
inventory was taken, and either would have made an earlier rating wrong.

These values are authored, not taken from a source. Check them against UMass
Extension or UVM Extension guidance before using them to inform planting.

## Controlled vocabularies

`habit`, `foliage`, `native_status`, `condition` and `status` are validated
against the lists in `scripts/lib/vocab.mjs`. To add a value, add it there —
the map's filter panel and legend are generated from those lists, so nothing
else needs to change.

## Validation

`npm run data` checks every row and refuses to write output if anything is
wrong:

**Errors** (build fails) — missing required field, duplicate `plant_id` or
`taxon_id`, `taxon_id`/`collection_id` with no matching row, non-numeric
coordinates or measurements, a value outside a controlled vocabulary.

**Warnings** (build continues) — coordinates outside the campus bounds in
`config.json`, a plant with no `collection_id`, a trail stop that is not a known
accession, and a count of taxa no active plant references. That last one is
summarised in a single line rather than one per taxon, because the species list
legitimately runs ahead of the survey: `taxa.csv` holds every species known to
be on campus, while `plants.csv` holds only what has actually been mapped.

CI runs the same check on every push, so bad data cannot reach the live site.

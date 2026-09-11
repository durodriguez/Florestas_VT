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
data/campus-areas.geojson  campus boundary + the six named campuses
data/species-aliases.csv   free-text species names -> taxon_id
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

Holds UVM's six campuses: Central, Trinity, Centennial, Redstone, Athletic and
Spear Street. This is what the map's **Campus area** filter and colour-by mode
read; `campus-areas.geojson` draws the matching polygons. They are separate
files because a collection could one day be a bed finer than a whole campus,
but where an id appears in both, `npm run data` warns if the name or colour has
drifted apart — a filter option with no shape, or a shape nothing can filter to,
is almost always a rename that stopped half way.

Plants are filed by coordinate, not by hand: **`npm run areas`** looks up which
campus polygon each plant stands in and fills in its `collection_id`. It is a
dry run by default, keeps existing values unless you pass `--all`, backs up
`plants.csv` before writing, and reports any plant that falls outside every
area. Run it after an import, or after the campus boundaries change.

## species-aliases.csv

`alias`, `taxon_id`, `note`.

Every source of plant records writes species names as prose. UVM's ArcGIS layer
holds "White pine", "Musclewood", "Northern Katalpa" and both "Scots pine" and
"Scot's pine". Burlington's inventory has "Acer platenoides" and
`Tilia americana "Frontyard`. A surveyor with a clipboard will invent a third
spelling of anything. `taxa.csv` holds one canonical name per taxon, so
something has to sit in between.

This file is that something, and it is data rather than code: a new alias is a
line in a CSV, not a deploy, and the reasoning behind each judgement call
survives in its `note`.

**Matching ignores case, spacing, accents, ligatures and apostrophes.** So
`Scots pine`, `Scot's pine` and `Scot’s pine` all land on the same taxon
without three rows, and `Cratægus phænopyrum` matches `Crataegus phaenopyrum`.
Canonical `taxon_id`, `scientific_name` and `common_name` values resolve
automatically — an alias is only needed for a name that is none of those.

**A blank `taxon_id` means "seen this, deliberately cannot resolve it".** UVM's
layer has five trees recorded as `ID Needed`, which is not a species and never
will be. Recording it keeps it out of the pile of names nobody has looked at
yet. The three outcomes are different and an importer treats them differently:

| Outcome | Meaning |
| --- | --- |
| a `taxon_id` | resolved |
| blank `taxon_id` | looked at, unresolvable |
| absent from the file | nobody has looked |

**Canonical names always win.** An alias that contradicts `taxa.csv` is a
mistake in the alias file, and `npm run data` fails on it rather than letting
it quietly override the real name. Two aliases fighting over one name fail too.

### Checking a source before importing it

```
npm run check:species -- <file.csv|file.geojson> [column]
```

Reports how many of a file's names resolve, which are known-unresolvable, and
which are new — and prints paste-ready alias lines for the new ones. It picks
the species column by trying each candidate and keeping whichever resolves
best, which matters: Burlington's inventory has a `species` column holding
"ash,gr patmore" and a `botanic` column holding
`Fraxinus pennsylvanica 'Patmore'`, and guessing the first would have reported
2.7% coverage on a file that actually reaches 59%.

Current coverage:

| Source | Names resolved | Records |
| --- | --- | --- |
| UVM ArcGIS tree layer | 128 of 129 | 2,051 of 2,061 (99.5%) |
| Burlington street inventory | 267 of 268 | 13,627 of 14,429 (94.4%) |

The one holdout in each is honest: UVM has five trees recorded as `ID Needed`,
Burlington has 265 as `Unknown`. Neither is a species.

### How finely cultivars are recorded

**Fold by default; keep the ones you can see from across a lawn.**

A street tree chosen for uniformity and disease resistance folds to its species:
`Fraxinus pennsylvanica 'Patmore'` and `'Summit'` are both green ash, and a
visitor does not care which. A cultivar with a visible character of its own gets
a taxon row: weeping, columnar or fastigiate, purple or golden or variegated
foliage, cutleaf. Twenty were kept on that test, including `Acer platanoides
'Columnare'`, `Prunus x subhirtella 'Pendula'`, `Fagus sylvatica 'Riversii'` and
`Salix alba 'Tristis'`.

Folding is mechanical — strip the quoted cultivar, strip `var.`/`f.`/`ssp.`,
fall back to `Genus sp.` — so a new source needs judgement only on what is left
over. Two errors that survived the mechanics and were caught by checking each
kept cultivar was still reachable:

- `Salix alba'Tristis'` has no space before the apostrophe, so it missed the
  canonical name and folded to the plain species.
- `Acer rubrum 'Autumn Blaze'` is filed under the wrong species in the source.
  'Autumn Blaze' is a Freeman maple, *Acer x freemanii*, and the alias corrects
  it rather than preserving the mistake.

Genus-level names — `Malus spp`, `Ulmus 'Morton Glossy'`, `Prunus spp` — resolve
to genus taxa (`malus-sp`, `ulmus-sp`) rather than being guessed at. Burlington
has 1,031 trees recorded as `Malus spp`, and deciding which crabapple each one
is would be inventing data.

## campus-areas.geojson

The campus outline and its five named campuses — Central, Trinity, Centennial,
Redstone, Athletic — drawn as an optional map overlay, mirroring the layer on
UVM's own map at <https://www.uvm.edu/map/>.

All of it is traced and real as of 9 September 2026: a 692-acre boundary in two
parts — the main campus, and the detached Spear Street parcel 1.2 km south — with
six campuses tiling it exactly. Nothing is flagged provisional. Any area added
later that *is* an estimate should carry `"provisional": true`, UVM does not
publish them as a file and this repository's build machine cannot reach
`uvm.edu`, so they were georeferenced by hand from a screenshot. They carry
`"provisional": true`, which makes the map draw them dashed and label the layer
"(approximate)". Carve them out of the boundary in split mode at `/tracer/`.
Full format, workflow and validation rules:
[docs/CAMPUS-AREAS.md](CAMPUS-AREAS.md).

Note that this file is *not* connected to `collections.csv` — the overlay is
drawn, but nothing is computed from it.

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

Defined in `scripts/lib/vocab.mjs`. Extend the lists there rather than inventing
values in a CSV — the filter panel and the legend are generated from them.

| Column | Values |
| --- | --- |
| `plant_type` | `deciduous-tree`, `evergreen-tree`, `shrub`, `perennial`, `annual`, `vine`, `grass` |
| `origin` | `vermont-native`, `vermont-invasive`, `introduced` |
| `condition` | `excellent`, `good`, `fair`, `poor`, `dead` |
| `status` | `active`, `removed` |

Blank is allowed in both taxon columns and means nobody has assessed it, which
is not the same as any of the listed values. The map shows nothing for a blank.

### plant_type

Shown on the map as *Deciduous trees*, *Evergreen trees*, *Shrubs & bushes*,
*Perennials*, *Annuals*, *Vines & climbers*, *Grasses*.

This replaced a pair of columns, `habit` and `foliage`. `habit` listed
`conifer` alongside `tree`, which was wrong twice over: a conifer *is* a tree,
and the label implied evergreen while a larch, a bald cypress and a dawn
redwood all drop their needles — the file held 30 conifers against 26
evergreens, and those four were exactly the problem. Merging the two columns
puts the deciduous/evergreen distinction where it is actually useful, on trees,
and leaves one value for a surveyor to pick instead of two that have to agree.

One thing went with it: an evergreen shrub — yew, box, rhododendron — is now
just `shrub`. With five shrubs in the file that costs nothing. If the shrub
list grows into the hundreds, foliage may be worth reviving for them alone.

### origin

- **`vermont-native`** — occurs naturally in Vermont, generally meaning present
  before European settlement.
- **`vermont-invasive`** — spreads aggressively here and displaces other
  plants. Nine taxa currently carry it, including Norway maple, common
  buckthorn and Russian olive.
- **`introduced`** — brought here and not known to be a problem.

One value, not several flags. An earlier draft split this into an origin plus
independent `vt_prohibited` and `northeast_invasive` flags, on the grounds that
a native can be invasive and a sale ban is a legal fact independent of both.
That is true, and it was dropped anyway: tracking Vermont's Noxious Weed
Quarantine Rule means making a regulatory claim on a public website against a
list that changes, and this map does not need to make it. If a Vermont native
ever does need flagging as invasive here, that is the case this column cannot
express, and the flags would have to come back.

## Validation

`npm run data` checks every row and refuses to write output if anything is
wrong:

**Errors** (build fails) — missing required field, duplicate `plant_id` or
`taxon_id`, `taxon_id`/`collection_id` with no matching row, non-numeric
coordinates or measurements, and a value outside a controlled vocabulary.

**Warnings** (build continues) — coordinates outside the campus bounds in
`config.json`, a plant with no `collection_id`, a trail stop that is not a known
accession, a count of campus areas whose geometry is still provisional, and a count
of taxa no active plant references. That last one is
summarised in a single line rather than one per taxon, because the species list
legitimately runs ahead of the survey: `taxa.csv` holds every species known to
be on campus, while `plants.csv` holds only what has actually been mapped.

CI runs the same check on every push, so bad data cannot reach the live site.

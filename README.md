# UVM Arboretum Explorer

An interactive map of the University of Vermont's campus plant collection,
modelled on the [Purdue Arboretum Explorer](https://www.arboretum.purdue.edu/explorer/interactive-map/).

Search and filter every mapped tree, shrub and vine on campus; tap a plant for
its full record; scan a QR code on a physical label to land straight on that
plant's page.

> **The data in this repository is sample data.** The 28 plants in
> `data/plants.csv` all carry `DEMO-` accession numbers and exist only so the
> map has something to draw. They are placed at plausible campus coordinates
> but **were not surveyed** — replace them with real field data before
> publishing. See [docs/FIELD-SURVEY.md](docs/FIELD-SURVEY.md).

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

## What it does

**Map** — clustered plant markers over three keyless basemaps (OpenStreetMap,
Esri satellite, Esri topographic) — no API key, no account. Markers scale with trunk diameter, and can be
coloured by plant type, origin, condition or campus area, with a matching
legend.

**Search** — free text across common name, scientific name, family, cultivar,
campus area and accession number. Every term must match, so extra words narrow
the result.

**Filters** — faceted and combinable: plant type, native/introduced/invasive,
campus area, family, condition, flowering month, minimum trunk diameter, and
whether to include removed plants. Each option shows a live count, computed
with its own facet relaxed so the alternatives stay clickable.

**Plant records** — accession, species description, DBH, height, spread,
condition, planting year, age, last survey date, coordinates, notes, memorial
dedications, photo, and species-level facts (foliage, flower and fruit colour
and season, fall colour, mature height, hardiness zones). Plus walking
directions, a shareable link, and a "see all N of this species" jump.

**QR labels** — `npm run labels` generates a printable label sheet and
individual QR SVGs. Each code encodes `?plant=<accession>`, so scanning a sign
on a tree opens that record. Removed plants still resolve from their old
labels.

**Walking trails** — self-guided tours drawn from `data/trails.geojson`, each
with a stop list.

**Near me** — sorts results by distance from the visitor's location, for
"what am I standing under?"

**Export** — the current result set as CSV, for staff working in a spreadsheet.

**Survey intake** — `npm run import` merges a field export into the dataset:
assigns accession numbers, resolves species from common or scientific names,
normalises `EXC`/`Very Good`/`g` onto the condition vocabulary, reads whatever
coordinate format your GPS app emitted, applies re-surveys in place, and
refuses to write anything if a row has a problem. Dry run by default. See
[docs/FIELD-SURVEY.md](docs/FIELD-SURVEY.md).

Mobile-first throughout, since most visitors arrive by scanning a label
outdoors. Keyboard accessible; `/` focuses search, `Escape` closes a record.

## How it is put together

```
data/*.csv          the source of truth — humans edit these
  ↓ npm run data    validates every row, fails loudly on bad data
public/data/*.json  compact generated files the site loads
  ↓ npm run build
dist/               a static site — no server, no database
```

Editing the collection means editing a CSV and opening a pull request. CI
validates the data on every push, so a mistyped coordinate or an unknown
species never reaches the live site.

| | |
|---|---|
| **Data model & validation rules** | [docs/DATA-MODEL.md](docs/DATA-MODEL.md) |
| **Surveying and mapping trees** | [docs/FIELD-SURVEY.md](docs/FIELD-SURVEY.md) |
| **Hosting, domains, scaling** | [docs/DEPLOY.md](docs/DEPLOY.md) |

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Rebuild data, start the dev server |
| `npm run data` | Validate `data/*.csv` and regenerate `public/data/` |
| `npm run build` | Validate, typecheck and build to `dist/` |
| `npm run import -- <file.csv>` | Merge a field-survey export into `data/plants.csv` (dry run by default) |
| `npm run labels` | Generate QR label sheet and SVGs into `public/labels/` |
| `npm run check:links` | Check every `wikipedia_url` in `taxa.csv` still resolves |
| `npm test` | Run the test suite |
| `npm run typecheck` | TypeScript, no emit |

`npm run labels` takes optional flags:

```bash
npm run labels -- --collection university-green
npm run labels -- --ids UVM-2026-0001,UVM-2026-0002
npm run labels -- --base https://arboretum.uvm.edu/
```

## Configuration

`data/config.json` holds the site name, tagline, contact address, public URL
(what QR codes encode), and the map's centre, zoom and campus bounds.
Coordinates outside those bounds produce a build warning — a cheap catch for
a transposed sign or a dropped minus.

## Stack

Vite, TypeScript, [Leaflet](https://leafletjs.com/) and
[Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster).
Two runtime dependencies, no API keys, no accounts. Chosen so that a student
worker can pick this up in an afternoon and so it still builds in five years.

## Getting started for real

1. Set the accession scheme in `data/config.json` and survey one area — start
   with the University Green.
2. Add each species you encounter to `data/taxa.csv`.
3. `npm run import -- your-export.csv` to see what it makes of your field data,
   then again with `--write`.
4. Delete the `DEMO-` rows from `data/plants.csv` once real records replace them.
5. `npm run data` until it is clean, then commit.
6. Turn on GitHub Pages and push.
7. `npm run labels`, print, and install signs.

Repeat area by area. Each one is a real improvement to a live site.

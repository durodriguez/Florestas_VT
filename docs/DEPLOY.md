# Deploying

The site is fully static — HTML, CSS, JS and JSON. There is no server, no
database and nothing to keep patched. It will run from any web host.

## GitHub Pages (included, zero cost)

`.github/workflows/deploy.yml` is ready to go:

1. **Settings → Pages → Source → GitHub Actions**.
2. Push to the default branch (`master` in this repository).

The workflow also accepts a manual run from **Actions → Deploy to GitHub Pages
→ Run workflow**, but GitHub only offers that once the workflow file exists on
the default branch.

The workflow sets Vite's `base` from the Pages URL automatically, so a project
site at `https://<org>.github.io/<repo>/` works without edits.

## A uvm.edu address

Two options:

- **Custom domain on Pages** — add a `CNAME` file containing e.g.
  `arboretum.uvm.edu` to `public/`, and ask ETS to point that hostname at
  GitHub Pages.
- **University web hosting** — run `npm run build` and copy the contents of
  `dist/` to the web root. If it will live in a subdirectory, build with
  `BASE_PATH=/arboretum/ npm run build`.

Whichever you choose, set `publicUrl` in `data/config.json` to the final
address **before** printing labels — that value is what the QR codes encode.

## Basemap tiles

The map ships with four keyless raster basemaps (CARTO Voyager, Esri World
Imagery, Esri Topographic, OpenStreetMap). No account or token is needed.

These are free public endpoints with fair-use expectations. If the map becomes
heavily used, or if UVM already runs ArcGIS Online, point `basemaps()` in
`src/map.ts` at a university tile service instead — it is a one-function
change.

## Performance at full scale

The current shape comfortably handles a full campus inventory:

- Plant data is emitted as column arrays rather than GeoJSON, roughly a third
  the size. Measured with a synthetic 40,000-plant inventory: 4.1 MB of JSON,
  0.73 MB gzipped over the wire.
- Markers are `L.CircleMarker` (canvas-friendly vector) rather than DOM
  markers, and are created once and reused as filters change.
- Clustering is chunked, so the main thread is not blocked while it builds.

Measured in headless Chromium at 40,000 plants: 1.4 s from page load to first
render, 0.5 s to apply a text search, 0.2 s to add a filter facet, and 0.1 s to
recolour every marker.

If you exceed roughly 50,000 plants and notice sluggishness, the next step is
vector tiles (`tippecanoe` + MapLibre GL) rather than incremental tuning.

## Backups

The CSVs in `data/` are the whole dataset, and they are in git. Every change
is a reviewable diff with an author and a date. That is the backup — but do
also keep the repository mirrored somewhere outside GitHub, and export a copy
to university records annually.

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

The map ships with three keyless raster basemaps — OpenStreetMap (default),
Esri World Imagery (satellite) and Esri World Topographic. No account, token or
API key is needed.

CARTO's raster basemaps were the original default and were dropped in
August 2026: that service now watermarks every tile "API KEY REQUIRED" and is
being retired in favour of vector tiles. Nothing else here depends on a
third-party account, which is the point — a key is a thing that expires while
nobody is watching.

These remain free public endpoints with fair-use expectations, and the
OpenStreetMap tile policy in particular is aimed at modest traffic. If the map
becomes heavily used, or if UVM already runs ArcGIS Online, point `basemaps()`
in `src/map.ts` at a university tile service instead — it is a one-function
change.

If a basemap ever fails, the map now says so by name rather than just looking
broken: six consecutive tile failures on the active layer raise a notice
telling the visitor to pick another layer.

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

## Why a new survey shows up immediately

The generated data files sit in `public/`, which Vite copies through without
hashing their filenames — unlike the JS and CSS, whose names change on every
build. Left alone, `data/plants.json` would keep the same URL forever and a
returning visitor would keep seeing the plants they saw last time.

So `npm run data` hashes the source CSVs and writes `.data-version`, which the
build compiles into the bundle and the app appends to its data requests
(`data/plants.json?v=13daaec74e34`). Because the constant lives inside the
bundle, changing it also changes the bundle's own hashed filename — so the
browser fetches new JS, which asks for a new data URL.

The hash comes from the source files rather than the generated JSON, which
carries a build timestamp; hashing the output would invalidate every visitor's
cache on every deploy even when nothing changed.

If a change still does not appear, it is worth checking the deploy actually ran
(**Actions → Deploy to GitHub Pages**) before assuming a caching problem.

## Backups

The CSVs in `data/` are the whole dataset, and they are in git. Every change
is a reviewable diff with an author and a date. That is the backup — but do
also keep the repository mirrored somewhere outside GitHub, and export a copy
to university records annually.

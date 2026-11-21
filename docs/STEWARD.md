# The steward console

`/steward/` is the inventory for Grounds and whoever plans the planting: how
complete it is, where the gaps are, and lists of the trees that still need a
visit. It reads the same data files as the map and the field guide, so it is
as current as they are. The code is in `src/steward/`; the rules for what a
tree still needs are in `src/steward/worklist.ts`, with tests.

It is not hidden, but it is kept out of search engines (`noindex`), and
nothing on it is private: every number comes from the public data.

## Overview

- **Five headline numbers:** trees mapped, the share with a trunk size (and
  how many of those are under five years old), photographed, named to
  species, and visited this year or last.
- **Where the gaps are:** every standing tree on a map, colored by when its
  trunk was measured, whether it has a photo, or whether its species is
  known. A tap gives the tree and links to its record and its field guide
  page.
- **Diversity** against the 10-20-30 guideline, **pest exposure** by host
  genus, and the **recent survey days**: how many trees were visited and how
  many trunk sizes and photos each day added. Who surveyed is left out, as on
  the public map.
- **By campus:** trees, trunk measured, photographed, named to species and
  visited, campus by campus.

The diversity, pest, campus and headline numbers are worked out by the build
(`scripts/lib/health.mjs`, tested) and written to `public/data/health.json`,
which the console reads.

## Collection health

The collection as a whole, as the separate `/health/` page showed it until
November 2026 (that address now leads here):

- **Diversity** against the 10-20-30 guideline, with the ten most common
  species, genera and families. Counted over identified plants; a genus
  named without a species counts as one species.
- **Pest and disease exposure:** plants of the genera that emerald ash borer,
  Dutch elm disease, oak wilt and spongy moth, fire blight, beech bark
  disease and hemlock woolly adelgid attack. Hosts, not damage.
- **Origin**, and the species marked invasive in Vermont.
- **Condition** ratings, with a note that they come from different scales.
- **How fresh the trunk measurements are.**

The map's results and every species page link here as "Collection health".

## Worklists

The standing trees that need one of these, on one campus or all, ordered by
campus and accession:

- no trunk size;
- a trunk size over 10 years old;
- no photo;
- named only to genus (a crabapple, an elm, an ash);
- species not identified ("Unknown (TBD)").

Each list links every tree to its record and its field guide page, downloads
as CSV, and prints as a plain table for a clipboard. In the field, the survey
app's route (docs/FIELD-APP.md) walks a surveyor to the nearest of the same
trees.

## Exports

All trees as CSV (the same columns as the map's "Export CSV"), the standing
trees as GeoJSON for ArcGIS or QGIS, and a link to the source spreadsheets on
GitHub. Made in the browser from the live data.

## Not built yet

From the report's mock-up: a **review inbox**, where survey uploads wait for
a person to approve them (to-do 22), and a **planting plan**. The inbox needs
a decision about where uploads go and who approves them; the planting plan
needs a decision about what it should plan.

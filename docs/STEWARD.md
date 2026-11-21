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

## Planting plan

What to plant more of and less of, and where (`src/steward/planting.ts`, with
tests). Starting points from the inventory's own data, not a prescription:
the site, what nurseries can supply and Grounds' own plans decide.

- **Plant more of:** the trees in `taxa.csv` that are a species (not a
  cultivar or variety), hardy in zone 5 (Burlington is 5b on the USDA's 2023
  map; a species counts when its recorded zones include 5), not marked
  invasive in Vermont, and from a genus under 20% and a family under 30% of
  campus. Vermont natives first, then those whose family and genus campus has
  least of. Hosts of the pests on the collection-health list come last,
  flagged. Each shows its mature size, zones and the pests recorded for it,
  so a species whose own pest is serious (butternut canker) says so. Filter
  to natives only, or by size.
- **Plant less of:** the six most common genera and four most common
  families against their limits, with the pests each hosts, and the species
  marked invasive in Vermont, not to replace in kind.
- **Places that need a tree:** where the record says a tree was removed or
  not found, and standing trees rated dead or poor, on a map and in a list.
  Open ground that could take a tree needs building and pavement outlines the
  data does not have yet.

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
a person to approve them (to-do 22).

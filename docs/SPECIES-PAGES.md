# Species pages

A page for every species in `taxa.csv`, at `/species/<taxon-id>/`, written as
plain HTML by `npm run data` (`scripts/lib/species-pages.mjs`). Since November
2026 they follow the layout of the report's mock-up, itself modeled on a tree
book's spread: a drawing of the mature tree, photos, the year, where it grows
wild, and where it stands on campus.

This is phase 1: everything on a page is worked out from data already in the
repository, at every build. Phase 2 adds what has to be written or chosen by
hand (below).

## What a page shows, in order

1. **The name**, its family and type above it, and its origin (Vermont native,
   introduced, Vermont invasive) as a badge.
2. **The drawing and the lead photo**, side by side.
   - *The drawing* (`scripts/lib/tree-drawing.mjs`, tested): the tree at
     maturity, from the mature height and spread in `taxa.csv`, beside a 6 ft
     person, with a guide every 20 ft. Every species is drawn at the same
     scale (3.4 px to the foot), so a dogwood's frame is shorter than an
     oak's. The crown is a cone for conifers and an oval for everything else,
     until `taxa.csv` records each species' shape; the dabs of leaves are
     placed at random, seeded by the taxon's id, so a drawing is the same on
     every build. Only trees with both a height and a spread get one. A first
     version: better drawings are wanted.
   - *The lead photo*: the newest photo of the species taken on campus, aimed
     a little above the middle as the field guide's are. A tap shows it whole.
     The other photos are under On campus.
3. **The description**, and beside it **Worth knowing**: the fun fact, then
   what the inventory can vouch for, worked out at every build so it stays
   true. That it is the only one on campus, or the largest trunk measured so
   far ("so far", because most trees have no measurement yet). How many there
   are and where is On campus's to say, not repeated here.
4. **Through the year**: the field guide's year table and its sentence under it
   (leaves, flowers, fruit or cones, month by month, in their colors), from
   the species' typical months in `taxa.csv`. `scripts/lib/year.mjs` is a copy
   of `src/fieldguide/year.ts`, as the build cannot import TypeScript; a test
   runs both over every species and fails if they disagree.
5. **Where it grows wild**, for the 126 species in Little's *Atlas of United
   States Trees* (see below), including every Vermont-native tree species but
   two, *Amelanchier laevis* and *Crataegus crus-galli*, which the atlas does
   not map. A cultivar or variety shows its species' range, and says so; a
   hybrid has none. The sentence beside the map is worked out from it:
   Burlington inside the range, outside it, or outside it with the range
   reaching another part of Vermont (flowering dogwood, chestnut oak and
   others native only to the south of the state). Then the soil and
   hardiness zones from `taxa.csv`.
6. **On campus**: how many are mapped, by campus, the other photos, the
   buttons to the map and Wikipedia, and a small campus map with each tree as
   a red dot linking to it on the map (`scripts/lib/campus-map.mjs`). Not a
   zoomable map: "Show them on the map" is the way to one.
7. **Characteristics**: the table every page had before, listing only what is
   recorded.
8. **Sources**: the range map's citation, when there is one, and where the
   drawing comes from.

## The maps, and the files they share

Each map is layers stacked in the page, so what every page shares is written
once to `public/species/` and cached:

| File | What |
| --- | --- |
| `range-base.svg` | the sea, Canada and Mexico, the lower 48 |
| *(inline)* | the species' range, with the gaps inside it cut out |
| `range-lines.svg` | the large lakes, state lines, Vermont, and a star on Burlington |
| `campus-map.svg` | the campuses and every standing tree as a gray dot |
| *(inline)* | the species' own trees, as red links |

Each shared file's address carries a fingerprint of its contents, so a
browser fetches it again when it changes. They carry their own light and dark
colors, as an `<img>` cannot see the page's.

## Native ranges

`data/ranges/` holds one file per species, from Little's atlas, and the
outlines they are drawn on, from Natural Earth; both public domain, credited
in `data/SOURCES.md`. `npm run ranges:fetch` fetches them again; it is the only
step that needs the network, and is run by hand, rarely: after species are
added to `taxa.csv`. Eight species are matched under the older names Little
used, listed in `scripts/fetch-ranges.mjs`.

The maps are hand-drawn at continental scale. Whether Burlington is inside a
range is read off them as drawn, and near a range's edge it is only as good
as the drawing. Two disagree with `taxa.csv`'s origin column and want a
look: the atlas puts Burlington inside the range of tulip tree (recorded as
introduced) and mockernut hickory (no origin recorded).

## Phase 2: what is still to come

Written or chosen by hand, species by species, most common first, each batch
reviewed:

- **Crown shapes** in `taxa.csv` (rounded, oval, conical, vase, columnar,
  weeping), for the drawings; and better drawings.
- **Habitat**: a paragraph on where it grows wild, drafted from *Silvics of
  North America* (U.S. Forest Service, public domain) and reviewed as the
  species text is (SPECIES-TEXT-REVIEW.md).
- **More facts** for Worth knowing, each with a source.
- **Photos of the bark, leaves, flowers and fruit**, from Wikimedia Commons,
  each checked for its license and identification and credited under it,
  replaced by campus photos as the survey takes them.
- **Where introduced species come from**, which Little's atlas does not cover.

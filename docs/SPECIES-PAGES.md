# Species pages

A page for every species in `taxa.csv`, at `/species/<taxon-id>/`, written as
plain HTML by `npm run data` (`scripts/lib/species-pages.mjs`). Since November
2026 they follow the layout of the report's mock-up, itself modeled on a tree
book's spread: a drawing of the mature tree, photos, the year, where it grows
wild, and where it stands on campus.

Phase 1 worked everything on a page out from data already in the repository,
at every build. Phase 2, under way since November 2026, adds what has to be
written or chosen by hand, in three files beside `taxa.csv` (below), species
by species, most common first.

## What a page shows, in order

1. **The name**, its family and type above it, and its origin (Vermont native,
   introduced, Vermont invasive) as a badge.
2. **The drawing and the lead photo**, side by side.
   - *The drawing* (`scripts/lib/tree-drawing.mjs`, tested): the tree at
     maturity, from the mature height and spread in `taxa.csv`, beside a 6 ft
     person, with a guide every 20 ft. Every species is drawn at the same
     scale (3.4 px to the foot), so a dogwood's frame is shorter than an
     oak's. A trunk, its main limbs and clusters of leaves, lit from the upper
     left, in the species' crown form from `data/crown-forms.csv`: rounded,
     oval, pyramidal, conical, columnar, spreading, vase, weeping or tiered
     (an old white pine's level limbs). Without one, conifers are a cone and
     everything else an oval. Everything random is seeded by the taxon's id,
     so a drawing is the same on every build. Only trees with both a height
     and a spread get one.
   - *The lead photo*: the newest photo of the species taken on campus, aimed
     a little above the middle as the field guide's are. A tap shows it whole.
     The other photos are under On campus.
3. **The description**, and beside it **Worth knowing**: the fun fact, the
   facts in `data/facts.csv`, then what the inventory can vouch for, worked out at every build so it stays
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
   Burlington inside the range, outside it, outside it with the range
   reaching another part of Vermont (flowering dogwood, chestnut oak and
   others native only to the south of the state), or in a small outlying
   area Little drew apart from the main range (bur oak, pitch pine, tulip
   tree: under 2 square degrees, about three quarters of Vermont). Then the
   soil and hardiness zones from `taxa.csv`, and the campus's zone, 5a on the
   USDA's 2023 map (the lakeshore is 5b).
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
as the drawing; an outlying area is said to be Little's, not the page's.
Little marks one at Burlington for mockernut hickory, which other sources
disagree about (*Silvics of North America* puts Vermont at its northern
limit; Wikipedia says it is absent from the state), so `taxa.csv` records no
origin for it. Tulip tree, marked there too, is native to Vermont but rare
(S1, endangered, per the Native Plant Trust's Go Botany), and since November
2026 is recorded as a Vermont native.

## Written by hand: crown forms, habitats, facts

Three files beside `taxa.csv`, read by `scripts/lib/species-extras.mjs`
(tested), which stops the build on a bad row:

| File | Columns | Shown |
| --- | --- | --- |
| `data/crown-forms.csv` | taxon_id, crown_form | the drawing's shape |
| `data/habitat.csv` | taxon_id, habitat, source, source_url | Where it grows wild, as *Habitat*, with or without a range map |
| `data/facts.csv` | taxon_id, fact, source, source_url | Worth knowing, after the fun fact, in file order |

A cultivar or variety without its own crown form or habitat takes its
species', and the page says once that what follows is the species'. Not its
facts: one about the species may not hold for a selection of it (wild
honeylocusts carry thorns; the planted ones are thornless).

Habitats and facts are held to the fun fact's rule (DATA-MODEL.md): checkable,
with a source the page cites. Habitats are written in our own words from
*Silvics of North America* (U.S. Forest Service, public domain) where it covers
the species, from other sources where it does not (it covers no European
trees). `npm run data` warns about a fact longer than 240 characters.

### Batch 1 (November 2026)

The ten most common species on campus that are a species rather than a genus
or a hybrid: eastern white pine, honeylocust, northern red oak, river birch,
Norway maple, swamp white oak, Colorado blue spruce, red maple, Austrian pine
and pin oak. Each has a crown form and a habitat; all but river birch have new
facts (nothing checkable and new turned up for it that its description and
fun fact did not already say). Columnar, pyramidal and weeping cultivars named
as such have their own crown form. The five least certain facts were checked
against a second source before writing; the pin oak's name is given as
"probably", because the sources disagree.

### Batch 2 (November 2026)

The next ten: sugar maple, northern white cedar, white spruce, littleleaf
linden, Norway spruce, Japanese zelkova, ginkgo, American basswood, silver
maple and paper birch, with crown forms for their columnar cultivars
('Smaragd' arborvitae, 'Princeton Sentry' ginkgo, 'Musashino' zelkova). All
have a habitat; zelkova and silver maple have no new facts. Two facts were
checked against more sources first and are hedged where those disagree:
northern white cedar as "probably" the first North American tree grown in
Europe (sources date it from 1536 to 1566), and littleleaf linden as national
tree of the Czech Republic and Slovakia only (Slovenia's claim is weaker).

**For review:** every habitat and fact in these batches is a draft, written
here, not by a botanist.

## Know it by: photos of the parts

`data/part-photos.csv` (taxon_id, part, title, page_url, image_url, author,
license, license_url): a photo of a species' bark, leaves, flowers or fruit
from Wikimedia Commons, shown in four tiles under the description, each with
what `taxa.csv` says of that part and a credit line (photographer, license,
link to the photo's Commons page), as the licenses require. The page loads the
500 px thumbnail from Wikimedia, and the 960 px one on a sharp screen.

The build refuses a photo that is not under public domain, CC0, CC BY or CC
BY-SA, has no author, or is not a Commons thumbnail. A cultivar or variety
without photos of its own shows its species', and says so.

Each photo is chosen by eye from Commons search results: the right species
(named in the file, not just a "maple leaf"), the part shown clearly, and the
mature form where it differs (red maple's shaggy bark, not a sapling's smooth
one). Doubtful ones are left out: a part with no tile is better than the
wrong tree. Batch 1 has 36: all four for red maple, eastern white pine,
honeylocust, northern red oak, Austrian pine and pin oak; three for river
birch (no fruit), Norway maple (no leaves: the candidates were captioned as
other maples), swamp white oak (no flowers on Commons) and Colorado blue
spruce (no pollen cones that were certainly pollen cones).
Campus photos of the parts can replace them as the survey takes them.

## Still to come

- **More batches** of crown forms, habitats and facts, most common first: the
  genus-only entries (crabapples, elms, serviceberries, ashes) and hybrids
  (Freeman maple) want a decision first about what their page should say.
- **Photos of the bark, leaves, flowers and fruit** for later batches, and
  the parts batch 1 is missing (see Know it by, above).
- **Better drawings** still, if the drawn ones are not enough.

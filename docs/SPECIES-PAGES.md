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
2. **The drawing**, with the description and Worth knowing (3) beside it.
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
   - No campus photo here: since November 2026 they are all under On campus,
     newest first. The newest one used to lead the page beside the drawing;
     the top is the drawing's, to be brought up to standard species by species.
   - A page without a drawing (shrubs, vines, ferns, a tree without its size on
     file) opens with the description and Worth knowing side by side.
3. **The description**, and with it **Worth knowing**: the fun fact, then the
   facts in `data/facts.csv`, about the species. Until November 2026 it ended
   with facts about the campus's own trees (the only one mapped, the largest
   trunk measured so far); those were taken out, as Worth knowing is about the
   species, and On campus says how many there are and where.
4. **Through the year**: the field guide's year table and its sentence under it
   (leaves, flowers, fruit or cones, month by month, in their colors), from
   the species' typical months in `taxa.csv`. `scripts/lib/year.mjs` is a copy
   of `src/fieldguide/year.ts`, as the build cannot import TypeScript; a test
   runs both over every species and fails if they disagree.
5. **Where it grows wild**, for the 126 species in Little's *Atlas of United
   States Trees* (see below), including every Vermont-native tree species but
   two, *Amelanchier laevis* and *Crataegus crus-galli*, which the atlas does
   not map; and since November 2026 for 36 European species it does not map,
   from Caudullo et al.'s chorological maps (see *European ranges*); and
   since November 2026 for 8 species native only to Japan, Korea and nearby,
   drawn from herbarium specimens (see *East Asian ranges*). A cultivar or variety shows its species' range, and says so; a
   hybrid has none. Beside the map, as a field guide sets it out, *Habitat*
   (the ground, light and places it grows in) and *Distribution* (where in
   the world), from `data/habitat.csv`. Where no distribution is written, a
   sentence on where the range lies stands in for it ("Grows wild in 32
   states, from Maine west to Minnesota and south to Florida and Texas,
   reaching north into Canada"), from the states it covers, read off the map
   once by `npm run ranges:fetch` and stored with it. Until November 2026 the
   two were one paragraph, followed by the soil and hardiness zones, which
   repeated Characteristics word for word; the 333 habitats were split then,
   in their own words and from their own sources, and the soil and zones
   left to Characteristics. A garden hybrid, wild nowhere, shows where it
   came from under Distribution, and under Habitat, where it is grown.
   Since November 2026 Habitat and Distribution are being written out in
   full, to the depth of a field guide (climate, soils, moisture, light and
   elevation; the whole range and where it grows best), from *Silvics of
   North America* for native trees and the European Commission's *European
   Atlas of Forest Tree Species* for European ones, each then the row's
   cited source. Trees neither covers (most East Asian ones) add a sentence
   on how they do when planted, from NC State Extension's Plant Toolbox;
   their row cites both sources, its two addresses separated by a space. Whether Burlington is inside the range is
   left to the map, which marks it with a star; until November 2026 a
   sentence said so, and it repeated the habitat. A European map has no star
   (Burlington is far off it); its key, on one line, is *Grows wild* and the
   dots it draws for *Small isolated stands*. (A *Not native to North
   America* note there was dropped in November 2026: the origin badge at the
   top of the page says as much.)
6. **Characteristics**: the table every page had before, listing only what is
   recorded. (It came after On campus until November 2026.)
7. **On campus**: how many are mapped, by campus, its photos, newest first (a tap shows one whole), the
   buttons to the map and Wikipedia, and a small campus map with each tree as
   a red dot linking to it on the map (`scripts/lib/campus-map.mjs`). Not a
   zoomable map: "Show them on the map" is the way to one.
8. **Credits**, only for what a license requires: the European range map's
   (*Map credit*, CC BY 4.0) and the photos' (*Photo credits*, numbered as
   marked). Until November 2026 a *Sources* line also cited the habitat, the
   added facts, Little's atlas (public domain) and the drawing; it was taken
   out, as the description and fun fact were never cited on the page either.
   The habitats' and facts' sources are still required in their files.

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

A European range map is drawn the same way, but framed to its range, so its
two outer layers are its own: `ranges/<species>-base.svg` (the sea and the
land) and `ranges/<species>-lines.svg` (the large lakes and the borders),
shared only by the species and its cultivars.

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

The maps are hand-drawn at continental scale, and near a range's edge they
are only as good as the drawing. Little drew small outlying areas apart from
some main ranges; he marks one at Burlington for mockernut hickory, which other sources
disagree about (*Silvics of North America* puts Vermont at its northern
limit; Wikipedia says it is absent from the state), so `taxa.csv` records no
origin for it. Tulip tree, marked there too, is native to Vermont but rare
(S1, endangered, per the Native Plant Trust's Go Botany), and since November
2026 is recorded as a Vermont native.

## European ranges

`data/ranges/europe/` holds the 36 species in `taxa.csv` that Caudullo, Welk
and San-Miguel-Ayanz's *Chorological maps for the main European woody
species* (European Commission Joint Research Centre, CC BY 4.0) maps and
Little's atlas does not, and the outlines they are drawn on (Natural Earth's
countries from the equator to the Arctic, the Azores to the Bering Strait).
Credited in `data/SOURCES.md`. `npm run ranges:fetch-europe`
(`scripts/fetch-ranges-europe.mjs`) fetches them again, by hand, after
species are added to `taxa.csv`; it leaves Little's files be, and
`ranges:fetch` leaves these.

The dataset maps each species' native range, its small isolated stands as
points, and where it was introduced. The pages show the first two: the range
in green and the stands as dots. Where it maps subspecies apart (Austrian
pine's five; Norway spruce's none), they are put together, as `taxa.csv`
names the species. Areas too small to see at the map's scale are drawn as
dots too.

Each map is framed to its range (`scripts/lib/europe-range-map.mjs`, tested):
a Lambert azimuthal equal-area projection centred on it, the range with room
around it, never narrower than about 2,500 km, in the US maps' size. So Scotch
pine's runs from Spain to the Pacific and Serbian spruce's shows the Balkans,
with its few valleys on the Drina as a speck and four dots.

Worth knowing about the data:

- Two file names in version 19 break the dataset's pattern: sycamore maple's
  introduced stands are also in a file spelled `_sym_pnt` (left out, with the
  `_syn_` files), and Atlas cedar's native range is in one spelled `_png` (a
  slip for `_plg`, kept).
- Cedar of Lebanon's includes one point on Cyprus, the Cyprus cedar, which
  the dataset files under *Cedrus libani* and some botanists treat as a
  species of its own. Its habitat says so.
- Norway spruce's range runs past the Urals into western Siberia, where it
  merges with Siberian spruce, which some botanists treat as a subspecies of
  it and some as a species. Its habitat says so.
- Walnut's has no separate file for where it was introduced, and shades much
  of western, central and northern Europe (Britain, southern Sweden) as its
  range. The European Atlas of Forest Tree Species says its natural range is
  unclear after so long in cultivation: thought native to the Mediterranean
  and Central Asia. Its Distribution says so, and what the map also shows.
- Like Little's, these are continental-scale maps, the authors say, not to be
  read for whether a given place is inside.

Habitats were checked against these maps when they were added (November
2026): 22 of the 36 said less than the map shows (Norway spruce's stopped at
northern Russia; beech's left out the oriental beech of Turkey and the
Caucasus) and had their geography widened to match it, in their own words,
leaving the rest of each as written. The map is credited on the same page,
under *Map credit*.

## East Asian ranges

No one has drawn chorological maps of East Asia as Little did for the United
States and Caudullo et al. for Europe. `data/ranges/asia/` holds maps drawn
for this site, November 2026, for the 8 species in `taxa.csv` native only to
Japan, Korea and nearby: Japanese maple, Japanese barberry, hinoki, sawara,
star magnolia, Japanese white pine, Sargent cherry and Japanese stewartia.
`npm run ranges:fetch-asia` (`scripts/ranges-asia/fetch_ranges_asia.py`,
Python, `pip install -r scripts/ranges-asia/requirements.txt`) draws them
again, picking the species itself; it caches its two large downloads in
`.cache/` (not committed). Credited in `data/SOURCES.md`, and on the page
under *Map credit*.

- **Where it is native** is Kew's World Checklist of Vascular Plants, by
  botanical country (Japan, Korea, the Kurils...). Kew takes some species
  broadly: its Japanese maple includes the mountain maple of Hokkaido, so the
  map shades Hokkaido, and the Distribution says so.
- **Where in those regions** is herbarium specimens from GBIF.org, CC0, CC
  BY or CC BY-NC (the site is non-commercial; CC BY-NC was left out at
  first, which hid most of Korea's specimens, Seoul National University's),
  without any whose label says planted (garden, park, temple,
  school, plantation...). Each is drawn as a 20 km circle; records within
  120 km of each other are joined, and the result is cut to the coast. A
  record with no neighbour is a dot, keyed *Isolated records* rather than
  *Small isolated stands*, as a specimen is not a stand; a single specimen
  alone is left out, as likely a planted tree whose label does not say so.
- **Northern limits.** Where a Japanese flora gives a northern limit that
  plantations and hedges gone wild overrun, the map is cut there: hinoki at
  Fukushima (38°N; native from Fukushima to Yakushima), sawara likewise, with
  its outlying stand on Mount Hayachine in Iwate as a dot, and Japanese
  barberry at 40°N (southern Tohoku and a few in Akita; escaped in Hokkaido).
- **Rare in part of its range.** Japanese white pine is wild in Kyushu but
  rare there (threatened on Kumamoto's and Saga's red lists, which keep their
  stands' places vague), and GBIF holds one specimen from the island, in
  Miyazaki. Where a species is so rare that its specimens stand alone, the
  script keeps a single one as a dot (`RARE_WILD`); the Distribution says it
  is rare there.
- **China.** Seventy-one East Asian species in `taxa.csv` are native in
  China too, and GBIF's Chinese specimens are too few to draw them (zelkova
  has about 200 across the country, which drew as scattered patches). The
  county-level distributions behind the *Atlas of Woody Plants in China*
  (Fang, Wang and Tang 2011) would do it, but are not public: the Dryad
  deposits from that group (doi:10.5061/dryad.pzgmsbcnn and
  doi:10.5061/dryad.ns1rn8ptx) hold model projections, with the species
  numbered rather than named, not the observed records, which would have
  to be asked of the authors.
- **Ginkgo** is held: almost every ginkgo is planted, and the stands thought
  wild (the West Tianmu Mountains, Gong et al. 2008; the Dalou Mountains,
  Tang et al. 2012) are a few dots on a map this wide.

The Distribution of each was checked against its map and Kew when it was
drawn, and six were rewritten to match (barberry's said eastern China, which
Kew does not count; star magnolia's said only "Japan", where it grows wild
around Ise Bay).

## Written by hand: crown forms, habitats, facts

Three files beside `taxa.csv`, read by `scripts/lib/species-extras.mjs`
(tested), which stops the build on a bad row:

| File | Columns | Shown |
| --- | --- | --- |
| `data/crown-forms.csv` | taxon_id, crown_form | the drawing's shape |
| `data/habitat.csv` | taxon_id, habitat, distribution, source, source_url | Where it grows wild, as *Habitat* and *Distribution*, with or without a range map |
| `data/facts.csv` | taxon_id, fact, source, source_url, cultivars | Worth knowing, after the fun fact, in file order |

A cultivar or variety without its own crown form or habitat takes its
species', and the page says once that what follows is the species'. Its
facts only where a fact's `cultivars` column says `yes`: one about the species
may not hold for a selection of it (wild honeylocusts carry thorns; the planted
ones are thornless), so each is marked as it is written. A cultivar's page
shows those after its own, under "Of the species, *Gleditsia triacanthos*:".
Until November 2026 cultivars took none, which left 98 pages with only their
fun fact; the 43 facts then on file were all marked `yes`, each read as
holding for the species' selections too.

**Worth knowing should hold three things**: the fun fact and two more. The
progress page counts it (`worth knowing (3)`, borrowed when a cultivar's
come from its species). In November 2026, 413 of 419 pages had fewer.

Habitats and facts are held to the fun fact's rule (DATA-MODEL.md): checkable,
with a source recorded in their file (the build refuses a row without one).
Since November 2026 the page does not show it, as it does not show the
description's or fun fact's. Habitats are written in our own words from
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

Photos: all four parts for seven species; three for silver maple; northern
white cedar's cones from iNaturalist (every Commons result was oriental
arborvitae, *Platycladus*); two for Japanese zelkova (no photos of its flowers or fruit
on Commons).

### Batch 3 (November 2026)

American hornbeam, Washington hawthorn, Japanese tree lilac, American
sycamore, black locust, common horsechestnut, English oak, common
baldcypress, bur oak and Sargent cherry. All have a crown form and a
habitat; five have new facts. Black locust's habitat says its original range
is not known exactly, as Silvics does. For the horsechestnut's, sources
disagree whether it still grows wild in Albania; the page includes it, as the
European Atlas of Forest Tree Species does.

Photos: all four parts for American sycamore, black locust, horsechestnut,
English oak and baldcypress; three for American hornbeam (no catkins),
Japanese tree lilac and Washington hawthorn (no bark) and bur oak (no
catkins); two for Sargent cherry (flowers, leaves). Three of them, the
hawthorn's leaf, the lilac's seed capsules and the cherry's leaf, are from
iNaturalist.

### Batch 4 (November 2026)

Lombardy poplar, northern catalpa, American chestnut, Douglas fir, Scotch
pine, black walnut, eastern redbud, white oak, eastern hemlock and tuliptree.
All have a crown form and a habitat; six have new facts, all state or
national trees. Lombardy poplar's habitat is its species', the black poplar's,
as the cultivated clone grows wild nowhere. Photos: all four for Douglas fir, black walnut, redbud,
white oak, eastern hemlock and tuliptree; three for northern catalpa (its
pods from iNaturalist) and American chestnut; two for Scotch pine; one for
Lombardy poplar. The rest are in PHOTO-GAPS.md.

### Batch 5 (November 2026)

Silver linden, dawn redwood, sweetgum, American beech, common smoketree,
hedge maple, eastern hophornbeam, Alaska cedar, bigtooth aspen and shingle
oak. All have a crown form and a habitat; two have new facts. The dawn
redwood's is from the Arnold Arboretum's own history of its 1948 seed. Photos:
all four for silver linden, dawn redwood, sweetgum, American beech, common
smoketree, hedge maple and Alaska cedar; three for eastern hophornbeam; two
for bigtooth aspen (its bark from iNaturalist) and shingle oak.

### Batch 6 (November 2026)

Twenty this time: yellow birch, gray birch, white fringetree, katsuratree,
European beech, Callery pear, Kentucky coffeetree, kousa dogwood, common
apple, three-flower maple, boxelder, four-winged silverbell, flowering
dogwood, yellowwood, paperbark maple, hackberry, Amur corktree, green ash,
Japanese stewartia and European mountain ash, with crown forms for
European beech's columnar and weeping forms. All have a crown form and a
habitat; three have new facts. The common apple's habitat describes its wild
ancestor, as the orchard apple grows wild only where it escapes. Photos: 73,
chosen under the rules above, three of them from iNaturalist; seven parts are
in PHOTO-GAPS.md.

### Batch 7 (November 2026)

The last 23 species-level trees with campus trees: balsam fir, white fir,
black cherry, sweet birch, swamp chestnut oak, hinoki falsecypress, bigleaf
magnolia, white mulberry, black tupelo, Japanese maple, seven-son flower, red
pine, northern pin oak, European hornbeam, Turkish filbert, Scotch elm,
Russian olive, Nordmann fir, wafer ash, Amur maackia, common sassafras,
corneliancherry dogwood and sweetbay magnolia. All have a crown form and a
habitat; two have new facts. Photos: 68, all from Commons, under the rules
above; 24 parts are in PHOTO-GAPS.md. A search of iNaturalist (research
grade, CC BY or CC0) then filled 10 of the 24, each looked at beside
taxa.csv; 14 are still open.

Every species-level tree on campus now has its page filled in. Left: the
cultivar-only taxa (corkscrew willow, Montmorency cherry, Crimson Cloud
hawthorn), whose species have no row of their own, and the genus-only and
hybrid entries (crabapples, elms, serviceberries, ashes, Freeman maple),
which want a decision on what their pages should say.

### Batch 8 (November 2026)

The first species not on the campus map: twelve Vermont natives and street
trees, chosen as the ones a visitor is likeliest to meet nearby. American and
slippery elm, black, scarlet and chestnut oak, quaking aspen, eastern
cottonwood, pin cherry, black willow, pitch pine, Tatarian maple and
cockspur hawthorn: a crown form, a habitat (Silvics of North America for the
natives) and 41 photos, all from iNaturalist, each research grade and looked
at beside taxa.csv. Gaps are not listed in PHOTO-GAPS.md, which keeps to
species on the map.

Also this round, for species already on the map: the eleven shrubs, ivy and
hardy banana got habitats and 31 photos; Freeman maple a habitat and its leaf;
white ash its page; and 15 more PHOTO-GAPS.md lines were filled.

### Batch 9 (November 2026)

Ten more unmapped species: bigleaf linden, Siberian elm, Japanese pagoda
tree, white willow, European bird cherry, Japanese flowering cherry, Japanese
snowbell, Amur chokecherry, balsam poplar and common pear, each
with a crown form, a habitat and photos from iNaturalist (28 in all). Shumard,
willow and scarlet oak were tried and left: their iNaturalist results were
largely other oaks, and the source check refused those photos.

### Batch 10 (November 2026)

Eight more unmapped species, taking taxa.csv in order: Fraser fir, black
maple, sycamore maple, Ohio buckeye, tree of heaven, mimosa, European alder
and Allegheny serviceberry, each with a crown form, a habitat and 24 photos
between them from iNaturalist. Skipped for now, with too few usable photos:
grand fir, trident, Korean and Shantung maples, yellow buckeye, Manchurian
alder and downy serviceberry.

### Batch 11 (November 2026)

Seven more: shagbark, bitternut and pignut hickory, pawpaw, southern catalpa,
sugarberry and Chinese chestnut, each with a crown form, a habitat and 25
photos between them from iNaturalist.

### Batch 12 (November 2026)

Eight more: butternut, common persimmon, American holly, English walnut,
European hazel, Japanese cedar, European ash and American smoketree, each
with a crown form, a habitat and 27 photos between them from iNaturalist.

### Batch 13 (November 2026)

Eight more: tamarack, eastern redcedar, Osage orange, cucumbertree, sourwood,
red mulberry, umbrella magnolia and goldenrain tree, each with a crown form, a
habitat and 31 photos between them from iNaturalist.

### Batch 14 (November 2026)

Seven more: red spruce, white poplar, post oak, peach, weeping willow,
sawtooth oak and cherry plum, each with a crown form, a habitat and 24 photos
between them from iNaturalist. Overcup oak's candidates were all other oaks
at their source, and were refused.

### Batch 15 (November 2026)

Ten unmapped shrubs: bottlebrush and red buckeye, black chokeberry, Japanese
barberry, Carolina allspice, buttonbush, Siberian peashrub, gray and redosier
dogwood and bush honeysuckle, each with a habitat and 32 photos between them
from iNaturalist. Shrubs take no crown form. Shadblow serviceberry's
candidates were Allegheny serviceberry at their source, and were refused.

### Batch 16 (November 2026)

The remaining unmapped shrubs and vines with research-grade photos: 33
species, among them burning bush, fothergilla, the hydrangeas, winterberry
and inkberry, the junipers, privet, Amur honeysuckle, Virginia creeper and
Boston ivy, ninebark, chokecherry, the sumacs, multiflora rose, elderberry
and bladdernut, highbush blueberry, three viburnums, weigela and English yew,
plus pond cypress. Each has a habitat and about 90 photos
between them from iNaturalist. Not done: Tibetan bramble and Sargent
crabapple, which have no usable research-grade photos, and the ferns
and grasses.

### Batch 17 (November 2026)

The six perennials in taxa.csv: maidenhair, New York, lady, ostrich and
Christmas fern and Siberian iris, each with a habitat and a photo of its
fronds or leaves (the iris also its flower). Ferns show only that tile: they
have no bark, flowers or fruit.

### Batch 18 (November 2026)

The species skipped in batches 10 to 14 for want of good candidates, taken
again: grand fir, Amur and trident maple, downy serviceberry, yellow buckeye,
pecan, shellbark and mockernut hickory, devil's walkingstick and Japanese
angelica tree, Atlantic white cedar, Chinese fringetree, Japanese cornel,
blue ash, Chinese juniper, European larch, southern magnolia, Persian ironwood,
Rocky Mountain juniper, American crabapple, green hawthorn, Oriental spruce,
limber pine and Darlington oak. Each has a habitat, a crown form where it is a
tree, and between one and four photos from iNaturalist (about 60 in all).

### Batch 19 (November 2026)

Twelve more, found once the photo search fell back to plain observations
rather than only described or annotated ones: Atlas and Lebanon cedar, Serbian
spruce, Swiss stone and Japanese white pine, Chinese redbud, red horse
chestnut, willow and chinkapin oak, American plum, lacebark elm and common
linden. Habitats and 30-odd photos. London plane is left: iNaturalist files it
as *Platanus × hispanica*, which the identification check does not accept as
*P. × acerifolia*.

### Batch 20 (November 2026)

Photos for unmapped species that had none: Tibetan bramble, Sargent and
Japanese flowering crabapple, shadblow serviceberry, speckled and Manchurian
alder, Bosnian pine, hardy rubber tree, Japanese clethra, Japanese elm, Korean
and Shantung maple, overcup and Shumard oak, Russian hawthorn and Sawara
falsecypress, from iNaturalist and, where it had too little, Commons. Two
things the identification check caught: iNaturalist had re-identified most of
its "shadblow" photos as other serviceberries, and the search had picked up
the Shumard oak *complex* (a group of look-alikes) rather than the species, so
it returned red oaks; the search now prefers the species. Left out: creeping
cotoneaster (Commons has only var. *praecox*, often treated as a species of
its own) and Miyabe maple and lacebark pine, still to find.

### Batch 21 (November 2026)

Cultivars and hybrids. Where a cultivar's species has no page here, its
photos are of the species, marked `of_species` (above): the two Chiffon roses
of Sharon, Dwarf Everbearing mulberry, Fall Gold raspberry (not its fruit,
which is yellow), Mariesii viburnum, Show Off forsythia, Brilliance autumn
fern, and the two maiden grasses (flowers only: both are grown for leaves
narrower than the species'). Hybrids: blue holly, hybrid witch hazel (a
yellow-flowered one, as recorded; most on Commons are red or orange
cultivars), apple serviceberry, Loebner magnolia, Yoshino cherry, European
linden and Japanese flowering crabapple. Weeping Higan cherry's species is
now recorded as *subhirtella*, matching its parent's row, so it shows that
page's photos; its scientific name is unchanged.

### Batch 22 (November 2026)

Unmapped species missing two or three photos: mugo pine, old-fashioned
weigela, panicle hydrangea, both fothergillas, creeping juniper, Japanese
cedar, Japanese cornel, Higan cherry (*Prunus × subhirtella* on iNaturalist,
which the identification check now accepts), willow, scarlet and chinkapin
oak, shellbark hickory, flowering cherry and Persian ironwood. Rejected for
disagreeing with taxa.csv: Fraser fir's cones (the photos show green-brown
cones; purple is recorded), pond cypress's bark (pale and swollen in the
photos; fibrous red-brown is recorded) and Higan cherry's fruit (green, not
yet the black recorded).

### Batch 23 (November 2026)

Single missing parts, mostly shrubs' fruit and conifers' cones: bush
honeysuckle, Catawba rhododendron, Japanese spirea, smooth hydrangea,
Virginia sweetspire and Siberian iris (their dry brown capsules), Atlantic
white cedar's foliage, Japanese snowbell's leaves, and the red young cones of
Serbian spruce and Swiss stone pine. A Commons round alongside filled red
horse chestnut, oakleaf mountain ash, Spaeth alder, Miyabe maple and lacebark
pine, and blank-species cultivars' flowers: Ann, Elizabeth, Gold Star
and Shirazz magnolia and Brouwer's Beauty pieris. Mongolian linden's leaf was
taken out again: the taxon was named *Tilia × mongolica*, after 'Harvest Gold'
(littleleaf × Mongolian linden), while its text described the wild species.
Since resolved by keeping both: `tilia-mongolica` is the wild species, with
that text, range and leaf photo, and `tilia-x-mongolica` (the id kept, as ids
are never reused) is now 'Harvest Gold', a garden hybrid (NC State Extension).
Still without: the bark of most shrubs, which few
photographers take.

### Batch 24 (November 2026)

Tree bark from Commons search ("<species> bark"), where iNaturalist had little:
Allegheny serviceberry, balsam and quaking aspen, white poplar, bigleaf linden,
cockspur and midland hawthorn, common pear, European bird cherry, goldenrain
tree, Japanese pagoda tree, pawpaw, pecan, southern catalpa, Tatarian maple and
yellow buckeye. Rejected: the "sour cherry" and "peach" bark photos, pale gray
where taxa.csv records red-brown and dark gray-brown, and an "Amur maple" set
that was paperbark maple.

### Batch 25 (November 2026)

A Commons search round across 76 single missing parts, with iNaturalist for
shrub fruit alongside. Filled: the bark of four campus shrubs (witch hazel,
common lilac, beautybush, summersweet); Lebanon cedar, grand fir, Oriental and
Serbian spruce, Swiss stone and Japanese white pine, pond cypress, Shantung
maple, Japanese cornel, saucer magnolia and contorted hazelnut bark; cones of
grand fir, red and Oriental spruce, Bosnian pine and giant sequoia (green, on
the tree); Chinese and Rocky Mountain juniper berries; sycamore maple
samaras; Ohio buckeye leaves; and the flowers of Persian ironwood, mockernut
and bitternut hickory, pitch pine and Amur chokecherry. Rejected for not
matching taxa.csv or not being filed under the species: Anglojap yew (both
photos were English yew), Atlas cedar's bark (filed under cedar of Lebanon), a
"flowering cherry" bark that looks like Tibetan cherry, and the red cones that
keep turning up for northern white cedar. Freeman maple's flowers and fruit,
Sargent cherry's bark and the other campus gaps in PHOTO-GAPS.md found nothing
usable again; they need photos taken on campus.

### Batch 26 (November 2026)

Mongolian linden split in two at the owner's request (above). Then a Commons
search of 30 cultivar and hybrid gaps: Ann magnolia's and Triumph elm's leaves,
Miss Kim lilac's and Rosy Lights azalea's flowers (and the azalea's leaves),
White Chiffon rose of Sharon's flower, Yoshino cherry's leaves, Triple Crown
blackberry's flowers and Korean sun pear's bark (Commons files the pear as
*Pyrus calleryana* var. *fauriei*, which the identification check now
accepts). Nannyberry's bark came from iNaturalist. Rejected: Crimson Spire
oak's photos, in no Commons category at all; a "Blue Chiffon" filed only as an
unidentified hibiscus; Karl Foerster grass in its tan winter plumes (purple is
recorded for June and July). iNaturalist has almost no shrub bark: a round of
eighteen shrubs found one usable photo.

### Batch 27 (November 2026)

The first rounds after non-commercial photos were allowed (Licenses, below).
Campus gaps that had resisted every earlier search: Freeman maple's red
flowers and samaras, Sargent cherry's, white fringetree's, spicebush's and
sour cherry's bark, northern pin oak's acorns and swamp chestnut oak's
catkins. Shrubs: inkberry, Japanese barberry, red buckeye, Siberian peashrub
and winterberry bark, weigela's capsules. Peking willow and dragon's claw
willow got catkin and seed photos filed under weeping willow, which both
sites now treat them as (weeping willow's own fruit came from the same
observation). American and European beech fruit were replaced with photos
the owner chose. A further round added Rocky Mountain juniper and Manchurian
alder bark, the alder's and chinkapin oak's catkins, Korean and Shantung maple
flowers and flowering cherry's fruit. Rejected: "common privet" stems with thorns, which privet
has not; northern white cedar's red seed cones again.

### Batch 28 (November 2026): clean photos

The owner asked for clean close-ups (rule 5 under "Choosing a photo"). Every
photo on the site, about 1,070, was looked at in contact sheets: 150 showed a
hand or a prop (mostly hands; also coins, rulers, paper backgrounds and a soda
bottle). The campus species came first. Replaced with clean photos from
Commons and iNaturalist: Freeman maple's, Japanese maple's, sweet birch's,
flowering dogwood's, sweetgum's, common buckthorn's, Kentucky coffeetree's,
English ivy's and bigleaf magnolia's leaves; basswood's, paper birch's,
northern catalpa's, American chestnut's, white oak's, summersweet's, kousa
dogwood's, coffeetree's, apple's, Japanese stewartia's and Turkish hazel's
fruit; buckthorn's bark; Cistena plum's flowers. Further rounds, from
iNaturalist and then Commons, replaced all but 21 of the 150; those are listed
in PHOTO-GAPS.md ("Photos to replace"), campus trees first. For most of them
no clean photo could be found that also matched taxa.csv's colors (bigtooth
aspen's green catkins, baldcypress's purple ones) or was filed under the species.

### Genus-only pages: Which one?

A taxon named only to genus (crabapples, elms, serviceberries, ashes and the
rest of the "sp." entries) now has a **Which one?** section in place of Know
it by: a leaf of each species or hybrid of that genus in the collection that
has its own leaf photo, most planted on campus first, each labelled and
linking to its page (species-extras.mjs, `kin`). A genus with no species or
hybrid of its own here, such as forsythia, shows its cultivars' leaves instead. Cultivars whose species is blank, such as the
magnolia hybrids, do not get it: they are identified, just not to a species.

### Adding photos from here on

`data/part-photos.csv` is the record: edit it directly. Search Commons or
iNaturalist, look at each candidate beside what taxa.csv records for that
part, add the row with its `matches` note, then run `npm run check:photos`
and `npm run data`. Commons rate-limits automated requests; one request every
couple of seconds gets through.

**When the Commons API refuses (HTTP 429).** In November 2026 it refused this
project's requests for hours at a time while ordinary Commons pages still
loaded. What worked: find files through the search page
(`commons.wikimedia.org/w/index.php?title=Special:MediaSearch&search=…`) or a
category's own page, fetch thumbnails at a standard width (250 or 500 px; other
widths are refused), read a file's licence, author and categories from its
page, and wait a few seconds between requests. `npm run check:photos` falls
back to reading each file page itself when the API refuses, at one page every
two seconds; a full run takes about fifteen minutes.

**For review:** every habitat and fact in these batches is a draft, written
here, not by a botanist.

## Know it by: photos of the parts

`data/part-photos.csv` (taxon_id, part, title, page_url, image_url, author,
license, license_url, matches, of_species): a photo of a species' bark, leaves, flowers or fruit
from Wikimedia Commons, shown in four tiles under the description, each with
what `taxa.csv` says of that part. Each photo's credit (photographer, license,
link to the photo's Commons page), as the licenses require, is a numbered note:
a small number after the part's name links to the *Photo credits* list at the
end of the page, which links back. Until November 2026 the
credit was written out under each tile, which made the row busy. The "Which
one?" tiles of a genus-only page are credited the same way.

A tap on a photo shows it full size, as the campus photos and the map do
(the same viewer), loading the larger copy, with its credit beneath. The page
loads the 500 px thumbnail from Wikimedia, and the 960 px one on a sharp screen.

Where Commons has nothing usable, a photo can come from iNaturalist instead:
from a research-grade observation (its species confirmed by other observers),
credited "iNaturalist" and linked to the observation. The photos are links,
not files: the repository holds one line per photo, and visitors' browsers
fetch each from Wikimedia or iNaturalist.

The build refuses a photo that is not under public domain, CC0, CC BY, CC
BY-SA, CC BY-NC or CC BY-NC-SA, has no author, or is not a Commons thumbnail
or an iNaturalist observation photo.

**Licenses.** Until 24 November 2026 only CC0, CC BY and CC BY-SA were taken;
that was a choice made when the photo tiles were built, not a requirement,
and the owner widened it. The site is free and educational, with no ads or
sales, which is the non-commercial use CC BY-NC and BY-NC-SA allow; each page
credits the photographer and links the license, as both require. Should
the site or its data ever be used commercially (sold, paywalled, carrying ads,
or reused in a paid product), the NC photos would have to come out: their rows
say which in the `license` column. Still refused: no-derivatives licenses (ND)
and anything all rights reserved. A cultivar or variety
without photos of its own shows its species', and says so.

Some cultivars belong to a species that has no page of its own here, such as
the rose of Sharon cultivars (*Hibiscus syriacus*), so there are no species
photos for them to borrow. For those, a photo of the species itself can be
filed under the cultivar with `of_species` set to `yes`: the page then shows
it as the species', just as if it had been borrowed, and the progress tracker
counts it as borrowed. Use it only where the cultivar looks like its species
in that part; a cultivar grown for its odd flowers or leaves needs its own
photo of that part, or none.

### Choosing a photo

A photo's label is not enough: uploaders get species wrong. In November 2026
a photo of bright pink-red cones went in as northern white cedar's pollen
cones because its Commons page said so; the cedar's are yellow, as taxa.csv
records. A white-barked birch went in as river birch, whose bark taxa.csv
records as salmon-pink. Both are now replaced, and every photo was checked
again. The rules since:

1. **It must agree with taxa.csv.** Look at the photo beside what taxa.csv
   records for that part (the bark's description; the flowers' or fruit's
   color and months) and write what agrees in the row's `matches` column
   ("yellow pollen cones, as recorded"). The build refuses a row without it.
   If they disagree, the photo is wrong until proved otherwise.
2. **It must show the species' own marks**, not just the part: river birch's
   peeling salmon bark, not any birch bark; sugar maple's long-stalked
   flowers, not any maple's.
3. **It must be identified to species at its source**: on Commons, filed in a
   category that names the species; on iNaturalist, research grade.
   `npm run check:photos` checks every row for this.
4. **When in doubt, leave the part empty** and add it to PHOTO-GAPS.md.
5. **Prefer a clean photo** (the owner's standard, November 2026): a close-up
   of the part itself, filling the frame, against a blurred background, with
   no hands, napkins, rulers, labels or other objects in it. A photo with a
   hand or a prop is a last resort, and one to replace when a clean one turns
   up. American beech's and tamarack's fruit were replaced for this.

Each photo is chosen by eye from Commons search results: the right species
(named in the file, not just a "maple leaf"), the part shown clearly, and the
mature form where it differs (red maple's shaggy bark, not a sapling's smooth
one). Doubtful ones are left out: a part with no tile is better than the
wrong tree. A second search, with other words, filled some gaps. Batch 1 has
38: all four for every species but Colorado blue spruce, which has no pollen
cones that were certainly pollen cones.
The parts still missing are listed in PHOTO-GAPS.md, a checklist for
finding or taking them. Campus photos of the parts can replace them as the
survey takes them.

## Still to come

- **More batches** of crown forms, habitats and facts, most common first: the
  genus-only entries (crabapples, elms, serviceberries, ashes) and hybrids
  (Freeman maple) want a decision first about what their page should say.
- **Photos of the bark, leaves, flowers and fruit** for later batches, and
  the parts batch 1 is missing (see Know it by, above).
- **Better drawings** still, if the drawn ones are not enough.

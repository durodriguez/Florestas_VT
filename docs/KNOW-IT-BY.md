# Know it by: notes, style and plan

Started 26 November 2026. The owner asked for the *Know it by* section of the
species pages to work like the identification column of a tree book they
own (a large-format North American tree guide, softwoods and hardwoods, one
spread per species). This file records what that book does, what the site now
does, how to write a note, and what is left.

## What the book does

Each species has a column of three to five photos, each with a short caption
under a bold label. Read across 21 spreads (yellow poplar, black locust, black
walnut, pin oak, white oak, American beech, flowering dogwood, red alder, bald
cypress, eastern redcedar, red spruce, Douglas-fir, black willow, sugarberry,
eastern cottonwood, quaking and bigtooth aspen, black cherry, sweet crab
apple, downy serviceberry, southern magnolia):

- **The label follows the plant, not a fixed list.** Bark, buds, foliage,
  needles, leaves, cones (young, pollen, male, female, seed), flowers, fruit,
  seed, nut, ripe nut, acorns, catkins, spines, thorns, "buttress and knees"
  (bald cypress), "plentiful cones" and "food source" (Douglas-fir, a squirrel
  eating a cone).
- **Labels combine** when two parts tell one story: *Flowers and fruit*,
  *Foliage and fruit*, *Leaves and flowers*, *Flowers and seeds*, *Male
  catkins on left, female cones on right*. A combined tile often has two
  photos side by side, the caption covering both.
- **It picks the parts that tell the tree apart.** Beech gets *Buds* (long,
  thin, "like cigars") instead of flowers alone; black locust gets *Spines*
  (paired at each leaf, unlike honey locust's long ones); bald cypress gets
  its knees; cottonwood its cottony *Seed*.
- **The captions are prose,** two to four sentences: what the part looks like,
  how it changes with age or season, a measurement or two, and often a
  comparison with a look-alike ("often confused with paper birch", "rather
  than the long thorns of the honey locust", "unlike other alders").
- **Bark is usually first, but not always present.** Most spreads have bark;
  a small tree's bark is often the least telling photo.

## What the site does now

- A species with rows in `data/know-it-by.csv` shows those tiles, in file
  order, up to four: a label, one photo or two side by side
  (`parts` = `flowers+fruit`), and a note in prose. Each row carries its
  source, as facts do; sources are kept in the file, not shown.
- A species without rows shows the four default tiles (bark, leaves,
  flowers, fruit) captioned from `taxa.csv`, as before. If a species has
  fewer than four written tiles, defaults fill the rest.
- Photo parts (`part-photos.csv`'s `part`): bark, leaves, flowers, fruit,
  buds, twigs, thorns, catkins, seeds, fronds, fiddleheads, spores, underside
  (of a leaf or spray), color (fall or winter color), habit (the whole
  plant), roots. For a conifer, `flowers` is its pollen cones and `fruit` its
  seed cones. The label is free text, so a `fruit` photo can be labelled
  *Pods*, *Acorns*, *Nuts* or *Cones*.
- A cultivar shows its species' written tiles, marked as the species', except
  where it has its own photo of that part (it differs there) or the row says
  `cultivars` = `no` (honeylocust's thorns: the planted ones are thornless).
  Those slots fall back to default tiles.

## How to write a note

- **Two or three sentences, under 320 characters** (the build warns past
  that). About the length of the book's.
- **What tells it apart, not a list of attributes.** Shape, size in inches,
  texture, how it changes with age or season, and where it helps, a
  comparison with a look-alike on campus (Norway vs sugar maple, white pine's
  five needles vs the two-needled pines).
- **Do not repeat** the page's description, fun fact, *Worth knowing* items
  or *Characteristics*. Read them first. Where the description already makes
  the point, add a different detail.
- **Every claim from the cited source.** One expert source per note is
  enough (NC State Plant Toolbox, Silvics, FEIS, Trees and Shrubs Online,
  an extension service), never Wikipedia alone. Re-read the note against the
  source after writing it, and cut what the source does not say.
- **Our own words.** Never copy the book's captions or a source's sentences;
  both are copyrighted.

## Choosing the four

Ask what a person standing in front of the plant would use to name it, in
the order they would notice it. Good swaps:

- **Small trees and shrubs:** bark photos are hard to find and seldom
  telling; use *Habit* (the whole shrub), *Twigs*, *Buds* or *Fall color*
  instead.
- **Conifers:** pollen cones are rarely telling. Use *Buds* (fir, spruce,
  beech-like cigar buds on Douglas-fir), *Underside* (the white markings that
  tell the false cypresses apart), or *Winter color* (arborvitae's bronze).
- **Oaks:** *Catkins* is fine, but *Buds* (clustered at the twig tip) can be
  more telling in winter.
- **Thorny plants:** *Thorns* (honeylocust, hawthorns, multiflora rose).
- **Ferns:** *Fronds*, *Fiddleheads*, *Spore cases*, and the habit or the
  base of the plant (ostrich fern's vase, maidenhair's black stalks).

## Done

Written notes (November 2026) for 243 of the 296 species, most planted first,
each checked against its source after writing. The record is
`know-it-by.csv`.

Swaps made in the book's spirit: honeylocust *Thorns* (not on its thornless
cultivars), black locust *Spines*, bald cypress *Knees*, horsechestnut and
beech *Buds* (beech with *Flowers and nuts* in one tile), Lombardy poplar
*Shape*, arborvitae *Winter color*, oakleaf hydrangea, sweetspire and
fragrant sumac *Fall color*, multiflora rose *Stipules*, Washington hawthorn
*Bark and thorns*, sweetgum *Bark and twigs*, burning bush *Winged twigs*,
barberry *Spines*, devil's walking stick *Prickly stems*, smoketree *Smoke*.
New photos come from iNaturalist (research grade, looked at before use).

A fix on the way: American elm's bark and leaf photos had been filed under
each other's part; they are now the right way round.

## Still to do

1. **Species with fewer than four written tiles: 67.** Most have only three
   photos; each wants a fourth photo and note. Shrubs: habit, twigs or fall
   color; conifers: buds or underside; oaks: buds. abies-grandis, acer-ginnala, acer-nigrum, acer-triflorum, acer-truncatum, aesculus-parviflora, buxus-sempervirens, calycanthus-floridus, caragana-arborescens, carya-laciniosa, castanea-mollissima, chamaecyparis-obtusa, chamaecyparis-pisifera, chamaecyparis-thyoides, chionanthus-retusus, clethra-barbinervis, cotinus-obovatus, crataegus-crus-galli, crataegus-viridis, euonymus-fortunei, hydrangea-arborescens, hydrangea-paniculata, ilex-x-meserveae, iris-sibirica, juniperus-scopulorum, larix-laricina, ligustrum-vulgare, maackia-amurensis, magnolia-macrophylla, magnolia-tripetala, malus-coronaria, musa-basjoo, parrotia-persica, parthenocissus-quinquefolia, picea-orientalis, picea-rubens, pinus-cembra, pinus-flexilis, pinus-heldreichii, pinus-mugo, pinus-parviflora, pinus-resinosa, pinus-rigida, populus-grandidentata, populus-tremuloides, prunus-americana, prunus-cerasifera, prunus-maackii, prunus-persica, prunus-serrulata, prunus-x-cistena, prunus-x-yedoensis, ptelea-trifoliata, quercus-coccinea, quercus-hemisphaerica, quercus-lyrata, quercus-montana, quercus-muehlenbergii, quercus-shumardii, rhododendron-catawbiense, sequoia-sempervirens, spiraea-japonica, staphylea-trifolia, styrax-japonicus, ulmus-parvifolia, viburnum-dentatum, weigela-florida.
2. **Species with no written tiles: 53.** 16 have three or four photos but
   no expert page found that describes them part by part (NC State, Trees
   and Shrubs Online and Silvics were tried); English ivy's "bark" photo is
   a leaf and needs replacing first: acer-pseudosieboldianum, acer-x-freemanii, betula-populifolia, crataegus-laevigata, diervilla-lonicera, fraxinus-excelsior, hedera-helix, heptacodium-miconioides, magnolia-x-soulangiana, malus-sargentii, picea-glauca, prunus-pennsylvanica, prunus-subhirtella, quercus-ellipsoidalis, sequoiadendron-giganteum, sorbus-x-thuringiaca. The other 37 have two photos or
   fewer and need photos first: abies-fraseri, acer-buergeranum, acer-miyabei, adiantum-pedatum, aesculus-x-arnoldiana, alnus-x-spaethii, amauropelta-noveboracensis, amelanchier-x-grandiflora, athyrium-filix-femina, cedrus-atlantica, cedrus-libani, cercis-chinensis, cotoneaster-adpressus, crataegus-ambigua, eucommia-ulmoides, fothergilla-gardenii, fothergilla-major, juniperus-chinensis, juniperus-communis, juniperus-horizontalis, kerria-japonica, malus-floribunda, matteuccia-struthiopteris, parthenocissus-tricuspidata, polystichum-acrostichoides, pyrus-fauriei, quercus-x-bimundorum, quercus-x-warei, rubus-thibetanus, salix-matsudana, scandosorbus-intermedia, sorbus-x-hybrida, syringa-pekinensis, taxodium-ascendens, taxus-x-media, tilia-mongolica, ulmus-davidiana-japonica.
3. **Cultivars** inherit their species' notes. One that differs in a part
   (purple leaves, double flowers) shows its own photo there with the default
   caption; a note of its own for that part would be better.
4. **Photo swaps still worth making** as photos turn up: bitternut hickory's
   sulfur-yellow buds, Osage orange's thorns, balsam poplar's sticky buds,
   Norway and sugar maple's buds, Hinoki cypress's white Y marks.

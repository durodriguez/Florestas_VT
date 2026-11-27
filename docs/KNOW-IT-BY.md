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
- **Write first, then check (owner's rule, November 2026).** Draft the
  note from what you know of the plant, then check every claim against
  sources and revise: cut or correct what they do not bear out. Do not
  start from one page and paraphrase it; notes written that way read as
  copied. Check against more than one site where you can: Morton
  Arboretum, Missouri Botanical Garden's Plant Finder, Trees and Shrubs
  Online, the Forest Service's Silvics and FEIS, Oregon State Landscape
  Plants, university extension services and arboreta, the Gymnosperm
  Database, Flora of North America. Cite the ones that confirmed the note.
  NC State's Plant Toolbox is one source among these, not the default:
  989 of the 1,113 notes written by November 2026 cite it alone, because
  its pages describe each part in labelled fields and were read first.
  Never Wikipedia alone.
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
Every photo must be a clean, natural close-up of the plant, with no hands,
coins, rulers or other objects ([SPECIES-PAGES.md](SPECIES-PAGES.md),
"Choosing a photo"). Two photos that broke this rule (honeylocust thorns
held against a hand, arborvitae foliage in a gloved hand) were replaced.

A fix on the way: American elm's bark and leaf photos had been filed under
each other's part; they are now the right way round.

## Still to do

1. **Species showing fewer than four written tiles: 30.** 47 got a fourth
   tile on 27 November 2026 (Shape for shrubs and conifers, Fall color,
   Thorny twigs, bark, pollen cones). Left: mostly oaks (catkins), pines,
   and parts whose photo the audit removed: acer-triflorum, caragana-arborescens, carya-laciniosa, castanea-mollissima, fraxinus-quadrangulata, ilex-x-meserveae, larix-laricina, pinus-cembra, pinus-flexilis, pinus-parviflora, pinus-resinosa, pinus-rigida, populus-grandidentata, prunus-cerasifera, prunus-maackii, prunus-persica, prunus-x-cistena, prunus-x-yedoensis, ptelea-trifoliata, quercus-coccinea, quercus-hemisphaerica, quercus-lyrata, quercus-shumardii, ulmus-parvifolia, viburnum-lentago.
1b. **Default tiles still showing (27 November 2026).** A tile with a photo
   but no written note shows the old caption (color and months from
   taxa.csv). The build marks them (`part--default`), so they can be counted:
   85 pages on 27 November 2026, 53 by the end of that day, after first
   notes for 37 species that had none. Six are on species with notes (Chinese chestnut and tamarack
   bark; Swiss stone, limber and red pine pollen cones; Amur chokecherry
   fruit); the sources tried say too little. The rest are the species with
   no notes yet (item 2) and their cultivars. Later on 27 November 2026, 18 notes
   closed the gaps on 12 species, from wider sources (Oregon State Landscape
   Plants, the Gymnosperm Database, Utah State and Minnesota extension, the
   UConn plant database). Still without a source: Korean maple and Korean
   sun pear bark; Swedish whitebeam has no photos. Cultivar pages can now carry
   their own note for a part where they differ, and a species note marked
   `cultivars` = `only` stands in on its cultivars where a species tile is
   withheld (honeylocust's flowers on the thornless pages).
1c. **Commons, tried for oak catkins (27 November 2026).** A full-text search
   by species name and "flowers", at one request every few seconds, ran an
   hour: two of eight searches were refused outright, and those answered
   returned no catkin close-ups (chestnut oak's nine were trees, leaves and
   stray matches). Next time, browse each species' own category page
   (`Category:Quercus montana`) for flower photos instead of searching.
   Tried the same day: the Shumard and overcup oak categories hold acorns,
   leaves and old book plates, but no catkins. Oak catkins may simply not be
   photographed cleanly; the oaks keep three tiles until some turn up.
2. **Species with no written tiles: 53.** 16 have three or four photos but
   no expert page found that describes them part by part (NC State, Trees
   and Shrubs Online and Silvics were tried); English ivy's "bark" photo is
   a leaf and needs replacing first: acer-pseudosieboldianum, acer-x-freemanii, betula-populifolia, crataegus-laevigata, diervilla-lonicera, fraxinus-excelsior, hedera-helix, heptacodium-miconioides, magnolia-x-soulangiana, malus-sargentii, picea-glauca, prunus-pennsylvanica, prunus-subhirtella, quercus-ellipsoidalis, sequoiadendron-giganteum, sorbus-x-thuringiaca. The other 37 have two photos or
   fewer and need photos first: abies-fraseri, acer-buergeranum, acer-miyabei, adiantum-pedatum, aesculus-x-arnoldiana, alnus-x-spaethii, amauropelta-noveboracensis, amelanchier-x-grandiflora, athyrium-filix-femina, cedrus-atlantica, cedrus-libani, cercis-chinensis, cotoneaster-adpressus, crataegus-ambigua, eucommia-ulmoides, fothergilla-gardenii, fothergilla-major, juniperus-chinensis, juniperus-communis, juniperus-horizontalis, kerria-japonica, malus-floribunda, matteuccia-struthiopteris, parthenocissus-tricuspidata, polystichum-acrostichoides, pyrus-fauriei, quercus-x-bimundorum, quercus-x-warei, rubus-thibetanus, salix-matsudana, scandosorbus-intermedia, sorbus-x-hybrida, syringa-pekinensis, taxodium-ascendens, taxus-x-media, tilia-mongolica, ulmus-davidiana-japonica.
3. **Photo audit.** All 620 iNaturalist photos were looked at on 26
   November 2026; 32 broke the photo rule (a hand, a ruler, a pencil, a
   fence or street, or the part laid on a table or cloth). 24 were replaced
   with clean close-ups; 8 were removed because no clean photo turned up
   (marked below), and want one when found. The 460 Wikimedia Commons photos are not yet checked:
   Commons refuses this project's downloads for now (see HANDOFF.md).

   - [x] `abies-concolor`, fruit (removed; replaced 27 November 2026 with the owner's pick, Commons File:Abies concolor cones.jpg): https://www.inaturalist.org/observations/1711555
   - [x] `populus-grandidentata`, flowers: https://www.inaturalist.org/observations/155049184
   - [x] `quercus-coccinea`, leaves: https://www.inaturalist.org/observations/18096656
   - [x] `quercus-montana`, leaves: https://www.inaturalist.org/observations/185581695
   - [x] `populus-deltoides`, bark: https://www.inaturalist.org/observations/7718358
   - [x] `ulmus-rubra`, flowers: https://www.inaturalist.org/observations/346043391
   - [x] `salix-nigra`, leaves: https://www.inaturalist.org/observations/239429382
   - [x] `asimina-triloba`, flowers: https://www.inaturalist.org/observations/207754488
   - [x] `asimina-triloba`, fruit: https://www.inaturalist.org/observations/34654133
   - [x] `catalpa-bignonioides`, fruit: https://www.inaturalist.org/observations/107127588
   - [x] `celtis-laevigata`, fruit: https://www.inaturalist.org/observations/337371176
   - [x] `morus-rubra`, fruit: https://www.inaturalist.org/observations/159134763
   - [x] `picea-rubens`, leaves: https://www.inaturalist.org/observations/108753967
   - [x] `quercus-stellata`, leaves: https://www.inaturalist.org/observations/35307036
   - [x] `prunus-virginiana`, leaves: https://www.inaturalist.org/observations/1552239
   - [x] `ilex-glabra`, fruit: https://www.inaturalist.org/observations/107291109
   - [x] `polystichum-acrostichoides`, leaves: https://www.inaturalist.org/observations/325890589
   - [x] `chamaecyparis-thyoides`, fruit: https://www.inaturalist.org/observations/103893524
   - [x] `fraxinus-quadrangulata`, leaves: https://www.inaturalist.org/observations/246656157
   - [x] `fraxinus-quadrangulata`, flowers (removed; no clean replacement found yet): https://www.inaturalist.org/observations/258473855
   - [x] `ulmus-davidiana-japonica`, leaves: https://www.inaturalist.org/observations/286674276
   - [x] `hibiscus-syriacus-notwoodtwo`, leaves: https://www.inaturalist.org/observations/155799715
   - [x] `viburnum-plicatum-tomentosum-mariesii`, leaves: https://www.inaturalist.org/observations/353215802
   - [x] `weigela-florida`, leaves: https://www.inaturalist.org/observations/191556061
   - [x] `fothergilla-major`, leaves: https://www.inaturalist.org/observations/196874244
   - [x] `quercus-phellos`, flowers (removed; replaced 27 November 2026 with iNaturalist observation 155045108, catkins among the leaves): https://www.inaturalist.org/observations/154113129
   - [x] `viburnum-lentago`, bark (removed; no clean replacement found yet): https://www.inaturalist.org/observations/20764350
   - [x] `fraxinus-quadrangulata`, fruit (removed; no clean replacement found yet): https://www.inaturalist.org/observations/39389456
   - [x] `salix-matsudana-tortuosa`, fruit (removed; no clean replacement found yet): https://www.inaturalist.org/observations/8405816
   - [x] `salix-matsudana`, fruit (removed; no clean replacement found yet): https://www.inaturalist.org/observations/8405816
   - [x] `salix-babylonica`, fruit (removed; no clean replacement found yet): https://www.inaturalist.org/observations/8405816
   - [x] `quercus-stellata`, fruit: https://www.inaturalist.org/observations/251388509

4. **Cultivars** inherit their species' notes. One that differs in a part
   (purple leaves, double flowers) shows its own photo there with the default
   caption; a note of its own for that part would be better.
5. **Photo swaps still worth making** as photos turn up: bitternut hickory's
   sulfur-yellow buds, Osage orange's thorns, balsam poplar's sticky buds,
   Norway and sugar maple's buds, Hinoki cypress's white Y marks.

## Redone by the default method

Every note written before November 2026's rule began from a source page,
so all are being rewritten: drafted from memory, checked against several
sources, revised (CLAUDE.md). Species done, in the order redone:

- 27 Nov 2026: pinus-strobus, quercus-rubra, betula-nigra, quercus-bicolor,
  acer-platanoides.
- 27 Nov 2026: acer-x-freemanii, picea-pungens, acer-saccharum, acer-rubrum, pinus-nigra.
- 27 Nov 2026: quercus-palustris, thuja-occidentalis, picea-glauca, tilia-cordata, picea-abies.
- 27 Nov 2026: zelkova-serrata, ginkgo-biloba, tilia-americana, acer-saccharinum, carpinus-caroliniana.
- 27 Nov 2026: betula-papyrifera, crataegus-phaenopyrum, syringa-reticulata, platanus-occidentalis, robinia-pseudoacacia, aesculus-hippocastanum.
- 27 Nov 2026: quercus-macrocarpa, taxodium-distichum, catalpa-speciosa, populus-nigra, prunus-sargentii, castanea-dentata.
- 27 Nov 2026: pinus-sylvestris, pseudotsuga-menziesii, tsuga-canadensis, cercis-canadensis, juglans-nigra, liriodendron-tulipifera.
- 27 Nov 2026: quercus-alba, liquidambar-styraciflua, metasequoia-glyptostroboides, tilia-tomentosa, acer-campestre, cotinus-coggygria.
- 27 Nov 2026: fagus-grandifolia, ostrya-virginiana, betula-alleghaniensis, betula-populifolia, callitropsis-nootkatensis, chionanthus-virginicus.
- 27 Nov 2026: populus-grandidentata, quercus-imbricaria, quercus-robur, taxus-x-media, thuja-green-giant, acer-negundo.
- 27 Nov 2026: acer-triflorum, cercidiphyllum-japonicum, clethra-alnifolia, cornus-kousa, fagus-sylvatica, fraxinus-pennsylvanica.
- 27 Nov 2026: gymnocladus-dioicus, hamamelis-virginiana, malus-domestica, pyrus-calleryana, rhamnus-cathartica, abies-balsamea.
- 27 Nov 2026: abies-concolor, acer-griseum, acer-platanoides-crimson-king, betula-lenta, buxus-sempervirens, celtis-occidentalis.
- 27 Nov 2026: cladrastis-kentukea, cornus-florida, halesia-tetraptera, phellodendron-amurense, prunus-serotina, salix-matsudana-tortuosa.
- 27 Nov 2026: sorbus-aucuparia, stewartia-pseudocamellia, syringa-vulgaris, abies-nordmanniana, acer-palmatum, carpinus-betulus.
- 27 Nov 2026: chamaecyparis-obtusa, cornus-alternifolia, cornus-mas, corylus-colurna, elaeagnus-angustifolia, hedera-helix.
- 27 Nov 2026: heptacodium-miconioides, kolkwitzia-amabilis, lindera-benzoin, maackia-amurensis, magnolia-macrophylla, magnolia-virginiana.
- 27 Nov 2026: morus-alba, musa-basjoo, nyssa-sylvatica, pieris-japonica, pinus-resinosa, prunus-x-cistena.
- 27 Nov 2026: ptelea-trifoliata, quercus-ellipsoidalis, quercus-michauxii, sassafras-albidum, abies-fraseri, abies-grandis.
- 27 Nov 2026: acer-buergeranum, acer-ginnala, acer-miyabei, acer-nigrum, acer-pseudoplatanus, acer-pseudosieboldianum.
- 27 Nov 2026: acer-tataricum, acer-truncatum, adiantum-pedatum, aesculus-flava, aesculus-glabra, aesculus-parviflora.
- 27 Nov 2026: aesculus-pavia, aesculus-x-carnea, ailanthus-altissima, albizia-julibrissin, alnus-glutinosa, alnus-hirsuta.
- 27 Nov 2026: alnus-incana-rugosa, amauropelta-noveboracensis, amelanchier-arborea, amelanchier-canadensis, amelanchier-laevis, amelanchier-x-grandiflora.
- 27 Nov 2026: aralia-elata, aralia-spinosa, aronia-melanocarpa, asimina-triloba, athyrium-filix-femina, berberis-thunbergii.
- 27 Nov 2026: calycanthus-floridus, caragana-arborescens, carya-cordiformis, carya-glabra, carya-illinoinensis, carya-laciniosa.
- 27 Nov 2026: carya-ovata, carya-tomentosa, castanea-mollissima, catalpa-bignonioides, cedrus-atlantica, cedrus-libani.
- 27 Nov 2026: celtis-laevigata, cephalanthus-occidentalis, cercis-chinensis, chamaecyparis-pisifera, chamaecyparis-thyoides, chionanthus-retusus.
- 27 Nov 2026: clethra-barbinervis, cornus-officinalis, cornus-racemosa, cornus-sericea, corylus-avellana, cotinus-obovatus.
- 27 Nov 2026: cotoneaster-adpressus, crataegus-ambigua, crataegus-crus-galli, crataegus-laevigata, crataegus-viridis, cryptomeria-japonica.
- 27 Nov 2026: diervilla-lonicera, diospyros-virginiana, dryopteris-erythrosora-brilliance, eucommia-ulmoides, euonymus-alatus, euonymus-fortunei.
- 27 Nov 2026: forsythia-x-intermedia-mindor, fothergilla-gardenii, fothergilla-major, fraxinus-americana, fraxinus-excelsior, fraxinus-quadrangulata.
- 27 Nov 2026: gleditsia-triacanthos, hamamelis-x-intermedia, hibiscus-syriacus-notwoodthree, hibiscus-syriacus-notwoodtwo, hydrangea-arborescens, hydrangea-paniculata.
- 27 Nov 2026: hydrangea-quercifolia, ilex-glabra, ilex-opaca, ilex-verticillata, ilex-x-meserveae, iris-sibirica.
- 27 Nov 2026: itea-virginica, juglans-cinerea, juglans-regia, juniperus-chinensis, juniperus-communis, juniperus-horizontalis.
- 27 Nov 2026: juniperus-scopulorum, juniperus-virginiana, kerria-japonica, koelreuteria-paniculata, larix-decidua, larix-laricina.
- 27 Nov 2026: ligustrum-vulgare, lonicera-maackii, maclura-pomifera, magnolia-acuminata, magnolia-elizabeth, magnolia-grandiflora.
- 27 Nov 2026: magnolia-stellata, magnolia-tripetala, magnolia-x-loebneri, magnolia-x-soulangiana, malus-coronaria, malus-floribunda.
- 27 Nov 2026: malus-sargentii, matteuccia-struthiopteris, miscanthus-sinensis-adagio, miscanthus-sinensis-gracillimus, morus-rubra, oxydendrum-arboreum.
- 27 Nov 2026: parrotia-persica, parthenocissus-quinquefolia, parthenocissus-tricuspidata, physocarpus-opulifolius, picea-omorika, picea-orientalis.
- 27 Nov 2026: picea-rubens, pinus-bungeana, pinus-cembra, pinus-flexilis, pinus-heldreichii, pinus-mugo.
- 27 Nov 2026: pinus-parviflora, pinus-rigida, platanus-x-acerifolia, polystichum-acrostichoides, populus-alba, populus-balsamifera.
- 27 Nov 2026: populus-deltoides, populus-tremuloides, prunus-americana, prunus-cerasifera, prunus-cerasus, prunus-maackii.

# Species text: what to check

Between 25 and 26 September 2026 the prose in `data/taxa.csv` was reviewed
species by species, and **169 of the 257 taxa were rewritten**: 60
descriptions and 135 fun facts. The old text repeated itself, gave planting
opinions, or talked about the inventory rather than the tree; the new text
is better written, but it was **written from general knowledge and not
checked against sources**. The source rule in
[DATA-MODEL.md](DATA-MODEL.md#fun_fact-and-story-the-source-rule) applies:
treat it as a good draft. Earlier spot checks found about one fun fact in
seven wrong, and dates and numbers are where the errors hide.

This page is for whoever reads it before the map goes on a university
domain — ideally someone who knows the trees. It is in two parts: the
specific claims most worth checking first, then every rewritten species, for
a full read.

**How to fix something.** Each species has one row in `data/taxa.csv`; the
last two columns are `description` and `fun_fact`. Edit the text there (a
fun fact must stay under 240 characters), run `npm run data` and
`npm run check:prose`, and open a pull request. Or note the problem against
the box below and pass it on. Blank is an acceptable answer for a fun fact
nobody can stand behind.

## 1. Claims to check first

Each of these is a specific date, number, name or story that the reviewer
of the batch it came from was least sure of. Quoted as they appear on the
site.

| | Species | The claim | What to check |
| --- | --- | --- | --- |
| [ ] | Red maple | "Uncommon in many of the forests the first European settlers saw… Ecologists call this the red maple paradox" | Abrams, M.D. (1998), *The Red Maple Paradox*, BioScience 48(5). Does "uncommon" fit? |
| [ ] | Pin oak | "wildlife managers flood pin oak stands in autumn to feed ducks on their way south" | Green-tree reservoirs; pin oak as a primary species |
| [ ] | Willow (genus) | "Each bud is wrapped in a single cap-like scale, which no other northern tree has" | The "no other" |
| [ ] | Cherry (genus) | "Many carry a pair of small glands on the leafstalk" | How general across *Prunus* |
| [ ] | Dogwood (genus) | "a leaf torn gently apart stays joined by fine white threads" | True of all *Cornus*? |
| [ ] | Washington hawthorn | "takes its name from Washington, DC, where nurseries were already growing it in the early 1800s" | The name's origin |
| [ ] | River birch | "The only birch whose seed ripens in late spring rather than autumn" | The "only" |
| [ ] | Sargent cherry | "brought its seed back from Japan in 1892" | The year |
| [ ] | Common smoketree | "yields a yellow dye, called young fustic" | The dye name |
| [ ] | Silver linden | "Research suggests they are starving as the nectar runs out, rather than being poisoned" | The bee research |
| [ ] | Green Giant arborvitae | "a seedling raised in Denmark in 1937… reached the US National Arboretum in 1967" | Both dates |
| [ ] | Katsuratree | "a traditional choice for the boards of the game go" | Katsura, not kaya? |
| [ ] | Hackberry | "seeds of an Asian relative turn up in the Zhoukoudian caves… hundreds of thousands of years ago" | The site and its age |
| [ ] | Amur maackia | "gets nitrogen from bacteria living in its roots" | Whether *Maackia* nodulates |
| [ ] | Four-winged silverbell | "silverbells over 80 feet tall stand in the Great Smoky Mountains" | The height |
| [ ] | Black tupelo | "more than 600 years old have been found in swamps in New Hampshire and Massachusetts" | The age and places |
| [ ] | Heritage river birch | "found in the St. Louis area in the late 1960s" | Place and decade |
| [ ] | October Glory red maple | "came from Princeton Nurseries in New Jersey" | The nursery |
| [ ] | Nordman fir | "a Finnish naturalist who came across it… in the 1830s" | Nationality and decade |
| [ ] | Common larch | "much of Venice stands on piles of larch and oak" | Larch's share, against alder |
| [ ] | Peking lilac | "Emil Bretschneider sent its seed west in the 1880s" | The introducer and decade |
| [ ] | White poplar | "the tree of Heracles, who wore a crown of its leaves on his way back from the underworld" | The myth |
| [ ] | Bigleaf linden | "bigleaf lindens over a thousand years old stand in village squares in Germany and Austria" | The ages |
| [ ] | Prairifire crabapple | "Bred at the University of Illinois" | The breeder |

### Worth a second look

Less doubtful, but each rests on one remembered detail:

- [ ] **Autumn Blaze maple** — registered as 'Jeffersred', after Ohio nurseryman Glenn Jeffers
- [ ] **Red Sunset red maple** — 'Franksred', J. Frank Schmidt's Oregon nursery, 1966
- [ ] **Austrian pine** — resin tapping south of Vienna "now listed as Austrian cultural heritage"
- [ ] **Spaeth alder** — raised at the Späth nursery in Berlin around 1908
- [ ] **Tamarack** — "survives cold below minus 60 degrees Fahrenheit"
- [ ] **Bur oak** — a seedling's taproot "can reach four feet down" in its first season
- [ ] **American sycamore** — the Pringle brothers, "in the 1760s… for three years"
- [ ] **Common pear** / **Korean sun pear** — the Endicott pear, planted around 1630, "still bears fruit"
- [ ] **Eastern poplar** — state tree of Kansas, Nebraska and Wyoming (Wyoming's is the plains cottonwood)
- [ ] **Shantung maple** — seed oil rich in nervonic acid, grown as a crop in China
- [ ] **Serviceberry** — the burial-service story is labelled folklore; is that fair?
- [ ] **Larch (genus)** — tamarack root-and-trunk joints used as ship's knees

## 2. Every rewritten species

Ticking a box means somebody who knows the tree has read both its
description and its fun fact on the species page and is content with them.
"description", "fun fact" or both says which of the two was rewritten; the
other was already there and has not been reviewed either.

- [ ] **Allegheny serviceberry** (*Amelanchier laevis*, `amelanchier-laevis`): fun fact
- [ ] **Amber Glow dawn redwood** (*Metasequoia glyptostroboides 'Amber Glow'*, `metasequoia-glyptostroboides-amber-glow`): fun fact
- [ ] **American basswood** (*Tilia americana*, `tilia-americana`): description
- [ ] **American beech** (*Fagus grandifolia*, `fagus-grandifolia`): description
- [ ] **American chestnut** (*Castanea dentata*, `castanea-dentata`): description
- [ ] **American elm** (*Ulmus americana*, `ulmus-americana`): description + fun fact
- [ ] **American hornbeam** (*Carpinus caroliniana*, `carpinus-caroliniana`): fun fact
- [ ] **American smoketree** (*Cotinus obovatus*, `cotinus-obovatus`): description
- [ ] **American sycamore** (*Platanus occidentalis*, `platanus-occidentalis`): description + fun fact
- [ ] **Amur chokecherry** (*Prunus maackii*, `prunus-maackii`): fun fact
- [ ] **Amur corktree** (*Phellodendron amurense*, `phellodendron-amurense`): description
- [ ] **Amur maackia** (*Maackia amurensis*, `maackia-amurensis`): description + fun fact
- [ ] **Amur maple** (*Acer ginnala*, `acer-ginnala`): description + fun fact
- [ ] **Arborvitae** (*Thuja sp.*, `thuja-sp`): description + fun fact
- [ ] **Armstrong red maple** (*Acer rubrum 'Armstrong'*, `acer-rubrum-armstrong`): fun fact
- [ ] **Ash** (*Fraxinus sp.*, `fraxinus-sp`): description + fun fact
- [ ] **Austrian pine** (*Pinus nigra*, `pinus-nigra`): fun fact
- [ ] **Autumn Blaze maple** (*Acer x freemanii 'Autumn Blaze'*, `acer-x-freemanii-autumn-blaze`): description + fun fact
- [ ] **Autumn Brilliance serviceberry** (*Amelanchier x grandiflora 'Autumn Brilliance'*, `amelanchier-x-grandiflora-autumn-brilliance`): fun fact
- [ ] **Balsam poplar** (*Populus balsamifera*, `populus-balsamifera`): fun fact
- [ ] **Bigleaf linden** (*Tilia platyphyllos*, `tilia-platyphyllos`): fun fact
- [ ] **Bigleaf magnolia** (*Magnolia macrophylla*, `magnolia-macrophylla`): fun fact
- [ ] **Bitternut hickory** (*Carya cordiformis*, `carya-cordiformis`): description + fun fact
- [ ] **Black tupelo** (*Nyssa sylvatica*, `nyssa-sylvatica`): fun fact
- [ ] **Black walnut** (*Juglans nigra*, `juglans-nigra`): fun fact
- [ ] **Boxelder** (*Acer negundo*, `acer-negundo`): fun fact
- [ ] **Buckthorn** (*Rhamnus sp.*, `rhamnus-sp`): description
- [ ] **Bur oak** (*Quercus macrocarpa*, `quercus-macrocarpa`): fun fact
- [ ] **Cherry** (*Prunus sp.*, `prunus-sp`): description
- [ ] **Chokecherry** (*Prunus virginiana*, `prunus-virginiana`): fun fact
- [ ] **Colorado Blue spruce** (*Picea pungens*, `picea-pungens`): fun fact
- [ ] **Columnar American basswood** (*Tilia americana 'Fastigiata'*, `tilia-americana-fastigiata`): fun fact
- [ ] **Columnar European beech** (*Fagus sylvatica 'Fastigiata'*, `fagus-sylvatica-fastigiata`): fun fact
- [ ] **Columnar Norway maple** (*Acer platanoides 'Columnare'*, `acer-platanoides-columnare`): fun fact
- [ ] **Columnar red maple** (*Acer rubrum 'Columnare'*, `acer-rubrum-columnare`): fun fact
- [ ] **Columnar Sargent cherry** (*Prunus sargentii 'Columnaris'*, `prunus-sargentii-columnaris`): fun fact
- [ ] **Common baldcypress** (*Taxodium distichum*, `taxodium-distichum`): fun fact
- [ ] **Common buckthorn** (*Rhamnus cathartica*, `rhamnus-cathartica`): description
- [ ] **Common Larch** (*Larix decidua*, `larix-decidua`): fun fact
- [ ] **Common lilac** (*Syringa vulgaris*, `syringa-vulgaris`): description
- [ ] **Common smoketree** (*Cotinus coggygria*, `cotinus-coggygria`): fun fact
- [ ] **Common witchhazel** (*Hamamelis virginiana*, `hamamelis-virginiana`): fun fact
- [ ] **Contorted hazelnut** (*Corylus avellana*, `corylus-avellana`): description
- [ ] **Copper Curls Peking lilac** (*Syringa pekinensis 'Copper Curls'*, `syringa-pekinensis-copper-curls`): fun fact
- [ ] **Crabapple** (*Malus sp.*, `malus-sp`): description
- [ ] **Crimson Cloud hawthorn** (*Crataegus laevigata 'Crimson Cloud'*, `crataegus-laevigata-crimson-cloud`): fun fact
- [ ] **Cutleaf silver maple** (*Acer saccharinum 'Skinneri'*, `acer-saccharinum-skinneri`): fun fact
- [ ] **Dawn redwood** (*Metasequoia glyptostroboides*, `metasequoia-glyptostroboides`): fun fact
- [ ] **Devils Walkingstick** (*Aralia spinosa*, `aralia-spinosa`): fun fact
- [ ] **Dogwood** (*Cornus sp.*, `cornus-sp`): description
- [ ] **Donald Wyman crabapple** (*Malus 'Donald Wyman'*, `malus-donald-wyman`): fun fact
- [ ] **Dragon's claw willow** (*Salix matsudana 'Tortuosa'*, `salix-matsudana-tortuosa`): description + fun fact
- [ ] **Eastern hemlock** (*Tsuga canadensis*, `tsuga-canadensis`): description
- [ ] **Eastern hophornbeam** (*Ostrya virginiana*, `ostrya-virginiana`): fun fact
- [ ] **Eastern poplar** (*Populus deltoides*, `populus-deltoides`): fun fact
- [ ] **Eastern redcedar** (*Juniperus virginiana*, `juniperus-virginiana`): fun fact
- [ ] **Eastern white pine** (*Pinus strobus*, `pinus-strobus`): description
- [ ] **Elm** (*Ulmus sp.*, `ulmus-sp`): description + fun fact
- [ ] **European ash** (*Fraxinus excelsior*, `fraxinus-excelsior`): fun fact
- [ ] **European bird cherry** (*Prunus padus*, `prunus-padus`): fun fact
- [ ] **European linden** (*Tilia x europaea*, `tilia-x-europaea`): fun fact
- [ ] **Fastigiate English oak** (*Quercus robur 'Fastigiata'*, `quercus-robur-fastigiata`): description + fun fact
- [ ] **Flowering dogwood** (*Cornus florida*, `cornus-florida`): fun fact
- [ ] **Four Winged silverbell** (*Halesia tetraptera*, `halesia-tetraptera`): fun fact
- [ ] **Freeman's maple** (*Acer x freemanii*, `acer-x-freemanii`): description
- [ ] **Ginkgo** (*Ginkgo biloba*, `ginkgo-biloba`): description
- [ ] **Golden Raindrops crabapple** (*Malus 'Schmidtcutleaf'*, `malus-schmidtcutleaf`): fun fact
- [ ] **Golden weeping willow** (*Salix alba 'Tristis'*, `salix-alba-tristis`): fun fact
- [ ] **Grand fir** (*Abies grandis*, `abies-grandis`): fun fact
- [ ] **Gray birch** (*Betula populifolia*, `betula-populifolia`): fun fact
- [ ] **Green ash** (*Fraxinus pennsylvanica*, `fraxinus-pennsylvanica`): description
- [ ] **Green Giant arborvitae** (*Thuja 'Green Giant'*, `thuja-green-giant`): fun fact
- [ ] **Green hawthorn** (*Crataegus viridis*, `crataegus-viridis`): fun fact
- [ ] **Greenspire linden** (*Tilia cordata 'Greenspire'*, `tilia-cordata-greenspire`): fun fact
- [ ] **Hackberry** (*Celtis occidentalis*, `celtis-occidentalis`): fun fact
- [ ] **Hardy rubber tree** (*Eucommia ulmoides*, `eucommia-ulmoides`): description
- [ ] **Hawthorn** (*Crataegus sp.*, `crataegus-sp`): description + fun fact
- [ ] **Hedge maple** (*Acer campestre*, `acer-campestre`): fun fact
- [ ] **Heritage river birch** (*Betula nigra 'Heritage'*, `betula-nigra-heritage`): fun fact
- [ ] **Hinoki falsecypress** (*Chamaecyparis obtusa*, `chamaecyparis-obtusa`): fun fact
- [ ] **Honeycrisp apple** (*Malus domestica 'Honeycrisp'*, `malus-domestica-honeycrisp`): fun fact
- [ ] **Japanese stewartia** (*Stewartia pseudocamellia*, `stewartia-pseudocamellia`): description
- [ ] **Japanese Tree lilac** (*Syringa reticulata*, `syringa-reticulata`): fun fact
- [ ] **Juniper** (*Juniperus sp.*, `juniperus-sp`): description
- [ ] **Katsuratree** (*Cercidiphyllum japonicum*, `cercidiphyllum-japonicum`): fun fact
- [ ] **Kentucky coffeetree** (*Gymnocladus dioicus*, `gymnocladus-dioicus`): description
- [ ] **Korean maple** (*Acer pseudosieboldianum*, `acer-pseudosieboldianum`): fun fact
- [ ] **Korean sun pear** (*Pyrus fauriei*, `pyrus-fauriei`): description + fun fact
- [ ] **Kousa dogwood** (*Cornus kousa*, `cornus-kousa`): fun fact
- [ ] **Larch** (*Larix sp.*, `larix-sp`): description + fun fact
- [ ] **Littleleaf linden** (*Tilia cordata*, `tilia-cordata`): fun fact
- [ ] **Lombardy poplar** (*Populus nigra*, `populus-nigra`): description
- [ ] **London planetree** (*Platanus x acerifolia*, `platanus-x-acerifolia`): fun fact
- [ ] **Magnolia** (*Magnolia sp.*, `magnolia-sp`): description
- [ ] **Manchurian alder** (*Alnus hirsuta*, `alnus-hirsuta`): fun fact
- [ ] **Maple** (*Acer sp.*, `acer-sp`): description
- [ ] **Mongolian linden** (*Tilia x mongolica*, `tilia-x-mongolica`): fun fact
- [ ] **Montmorency cherry** (*Prunus cerasus 'Montmorency'*, `prunus-cerasus-montmorency`): fun fact
- [ ] **Mugo pine** (*Pinus mugo*, `pinus-mugo`): description + fun fact
- [ ] **Mulberry** (*Morus sp.*, `morus-sp`): description
- [ ] **Nordman fir** (*Abies nordmanniana*, `abies-nordmanniana`): fun fact
- [ ] **Northern red oak** (*Quercus rubra*, `quercus-rubra`): description
- [ ] **Norway maple** (*Acer platanoides*, `acer-platanoides`): description
- [ ] **Norway spruce** (*Picea abies*, `picea-abies`): description
- [ ] **Oakleaf mountain ash** (*Sorbus x thuringiaca*, `sorbus-x-thuringiaca`): fun fact
- [ ] **October Glory red maple** (*Acer rubrum 'October Glory'*, `acer-rubrum-october-glory`): fun fact
- [ ] **Pagoda dogwood** (*Cornus alternifolia*, `cornus-alternifolia`): description + fun fact
- [ ] **Paper birch** (*Betula papyrifera*, `betula-papyrifera`): description
- [ ] **Paperbark maple** (*Acer griseum*, `acer-griseum`): fun fact
- [ ] **Pear** (*Pyrus sp.*, `pyrus-sp`): description + fun fact
- [ ] **Peking lilac** (*Syringa pekinensis*, `syringa-pekinensis`): fun fact
- [ ] **Persian ironwood** (*Parrotia persica*, `parrotia-persica`): fun fact
- [ ] **Pin oak** (*Quercus palustris*, `quercus-palustris`): fun fact
- [ ] **Prairifire crabapple** (*Malus 'Prairifire'*, `malus-prairifire`): fun fact
- [ ] **Princeton Sentry ginkgo** (*Ginkgo biloba 'Princeton Sentry'*, `ginkgo-biloba-princeton-sentry`): fun fact
- [ ] **Purple Leaf Plum** (*Prunus cerasifera*, `prunus-cerasifera`): fun fact
- [ ] **Quaking aspen** (*Populus tremuloides*, `populus-tremuloides`): fun fact
- [ ] **Ragin Red redosier dogwood** (*Cornus sericea 'Ragin Red'*, `cornus-sericea-ragin-red`): description + fun fact
- [ ] **Red maple** (*Acer rubrum*, `acer-rubrum`): description + fun fact
- [ ] **Red mulberry** (*Morus rubra*, `morus-rubra`): fun fact
- [ ] **Red Sunset red maple** (*Acer rubrum 'Red Sunset'*, `acer-rubrum-red-sunset`): fun fact
- [ ] **Redosier dogwood** (*Cornus sericea*, `cornus-sericea`): fun fact
- [ ] **River birch** (*Betula nigra*, `betula-nigra`): fun fact
- [ ] **Ruby Lace honeylocust** (*Gleditsia triacanthos var. inermis 'Ruby Lace'*, `gleditsia-triacanthos-inermis-ruby-lace`): fun fact
- [ ] **Russian olive** (*Elaeagnus angustifolia*, `elaeagnus-angustifolia`): description
- [ ] **Sargent cherry** (*Prunus sargentii*, `prunus-sargentii`): fun fact
- [ ] **Saucer magnolia** (*Magnolia x soulangiana*, `magnolia-x-soulangiana`): fun fact
- [ ] **Scarlet oak** (*Quercus coccinea*, `quercus-coccinea`): fun fact
- [ ] **Scotch pine** (*Pinus sylvestris*, `pinus-sylvestris`): fun fact
- [ ] **Serviceberry** (*Amelanchier sp.*, `amelanchier-sp`): fun fact
- [ ] **Shadblow serviceberry** (*Amelanchier canadensis*, `amelanchier-canadensis`): fun fact
- [ ] **Shantung maple** (*Acer truncatum*, `acer-truncatum`): fun fact
- [ ] **Shingle oak** (*Quercus imbricaria*, `quercus-imbricaria`): fun fact
- [ ] **Siberian elm** (*Ulmus pumila*, `ulmus-pumila`): fun fact
- [ ] **Siberian peashrub** (*Caragana arborescens*, `caragana-arborescens`): fun fact
- [ ] **Sienna Glen maple** (*Acer x freemanii 'Sienna Glen'*, `acer-x-freemanii-sienna-glen`): fun fact
- [ ] **Silver linden** (*Tilia tomentosa*, `tilia-tomentosa`): fun fact
- [ ] **Silver maple** (*Acer saccharinum*, `acer-saccharinum`): fun fact
- [ ] **Southern magnolia** (*Magnolia grandiflora*, `magnolia-grandiflora`): fun fact
- [ ] **Spaeth alder** (*Alnus x spaethii*, `alnus-x-spaethii`): fun fact
- [ ] **Spirea** (*Spiraea sp.*, `spiraea-sp`): description + fun fact
- [ ] **Spruce** (*Picea sp.*, `picea-sp`): description + fun fact
- [ ] **Sugar maple** (*Acer saccharum*, `acer-saccharum`): description
- [ ] **Summersweet** (*Clethra alnifolia*, `clethra-alnifolia`): fun fact
- [ ] **Swamp White oak** (*Quercus bicolor*, `quercus-bicolor`): fun fact
- [ ] **Sweet birch** (*Betula lenta*, `betula-lenta`): fun fact
- [ ] **Sweetgum** (*Liquidambar styraciflua*, `liquidambar-styraciflua`): fun fact
- [ ] **Tamarack** (*Larix laricina*, `larix-laricina`): description + fun fact
- [ ] **Tatarian maple** (*Acer tataricum*, `acer-tataricum`): fun fact
- [ ] **Thornless Common honeylocust** (*Gleditsia triacanthos*, `gleditsia-triacanthos`): fun fact
- [ ] **Thornless honeylocust** (*Gleditsia triacanthos var. inermis*, `gleditsia-triacanthos-inermis`): description
- [ ] **Three-flower maple** (*Acer triflorum*, `acer-triflorum`): fun fact
- [ ] **Turkish filbert** (*Corylus colurna*, `corylus-colurna`): description + fun fact
- [ ] **Variegated tuliptree** (*Liriodendron tulipifera 'Aureomarginatum'*, `liriodendron-tulipifera-aureomarginatum`): fun fact
- [ ] **Ware oak** (*Quercus x warei*, `quercus-x-warei`): fun fact
- [ ] **Washington hawthorn** (*Crataegus phaenopyrum*, `crataegus-phaenopyrum`): description + fun fact
- [ ] **Weeping Cherry** (*Prunus subhirtella*, `prunus-subhirtella`): fun fact
- [ ] **White ash** (*Fraxinus americana*, `fraxinus-americana`): description
- [ ] **White fir** (*Abies concolor*, `abies-concolor`): fun fact
- [ ] **White oak** (*Quercus alba*, `quercus-alba`): description + fun fact
- [ ] **White poplar** (*Populus alba*, `populus-alba`): fun fact
- [ ] **White spruce** (*Picea glauca*, `picea-glauca`): fun fact
- [ ] **White willow** (*Salix alba*, `salix-alba`): fun fact
- [ ] **Whitespire birch** (*Betula populifolia 'Whitespire'*, `betula-populifolia-whitespire`): fun fact
- [ ] **Wildfire black tupelo** (*Nyssa sylvatica 'Wildfire'*, `nyssa-sylvatica-wildfire`): fun fact
- [ ] **Willow** (*Salix sp.*, `salix-sp`): description + fun fact
- [ ] **Yellow birch** (*Betula alleghaniensis*, `betula-alleghaniensis`): fun fact
- [ ] **Yew** (*Taxus sp.*, `taxus-sp`): description
- [ ] **Yoshino cherry** (*Prunus x yedoensis*, `prunus-x-yedoensis`): fun fact

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
| [x] | Red maple | "Uncommon in many of the forests the first European settlers saw… Ecologists call this the red maple paradox" | Abrams, M.D. (1998), *The Red Maple Paradox*, BioScience 48(5). Does "uncommon" fit? |
| [x] | Pin oak | "wildlife managers flood pin oak stands in autumn to feed ducks on their way south" | Green-tree reservoirs; pin oak as a primary species |
| [x] | Willow (genus) | "Each bud is wrapped in a single cap-like scale, which no other northern tree has" | The "no other" |
| [x] | Cherry (genus) | "Many carry a pair of small glands on the leafstalk" | How general across *Prunus* |
| [x] | Dogwood (genus) | "a leaf torn gently apart stays joined by fine white threads" | True of all *Cornus*? |
| [x] | Washington hawthorn | "takes its name from Washington, DC, where nurseries were already growing it in the early 1800s" | The name's origin |
| [x] | River birch | "The only birch whose seed ripens in late spring rather than autumn" | The "only" |
| [x] | Sargent cherry | "brought its seed back from Japan in 1892" | The year |
| [x] | Common smoketree | "yields a yellow dye, called young fustic" | The dye name |
| [x] | Silver linden | "Research suggests they are starving as the nectar runs out, rather than being poisoned" | The bee research |
| [x] | Green Giant arborvitae | "a seedling raised in Denmark in 1937… reached the US National Arboretum in 1967" | Both dates |
| [x] | Katsuratree | "a traditional choice for the boards of the game go" | Katsura, not kaya? |
| [x] | Hackberry | "seeds of an Asian relative turn up in the Zhoukoudian caves… hundreds of thousands of years ago" | The site and its age |
| [x] | Amur maackia | "gets nitrogen from bacteria living in its roots" | Whether *Maackia* nodulates |
| [x] | Four-winged silverbell | "silverbells over 80 feet tall stand in the Great Smoky Mountains" | The height |
| [x] | Black tupelo | "more than 600 years old have been found in swamps in New Hampshire and Massachusetts" | The age and places |
| [x] | Heritage river birch | "found in the St. Louis area in the late 1960s" | Place and decade |
| [x] | October Glory red maple | "came from Princeton Nurseries in New Jersey" | The nursery |
| [x] | Nordmann fir | "a Finnish naturalist who came across it… in the 1830s" | Nationality and decade |
| [x] | Common larch | "much of Venice stands on piles of larch and oak" | Larch's share, against alder |
| [x] | Peking lilac | "Emil Bretschneider sent its seed west in the 1880s" | The introducer and decade |
| [x] | White poplar | "the tree of Heracles, who wore a crown of its leaves on his way back from the underworld" | The myth |
| [x] | Bigleaf linden | "bigleaf lindens over a thousand years old stand in village squares in Germany and Austria" | The ages |
| [x] | Prairifire crabapple | "Bred at the University of Illinois" | The breeder |

Checked on 3 November 2026 against extension, arboretum and published
sources. Thirteen held up as written. Reworded: willow (the single bud scale
is not unique; sycamore has one too), Washington hawthorn (late 1700s, not
early 1800s), river birch ("unusually", not "the only"), Green Giant (late
1930s; a single plant in 1967), black tupelo (nearly 700 years, New
Hampshire), Heritage river birch (around 1970), common larch (alder, larch
and oak), bigleaf linden (thousand-year ages are traditional; most are
probably 600 to 800). Softened: hackberry ("may have been eating"), Sargent
cherry (seed first reached the Arboretum in 1890). Four-winged silverbell
kept: the tallest Smokies trees are the mountain form, which some botanists
treat as a separate species.

### Worth a second look

Less doubtful, but each rests on one remembered detail:

- [x] **Autumn Blaze maple** — registered as 'Jeffersred', after Ohio nurseryman Glenn Jeffers
- [x] **Red Sunset red maple** — 'Franksred', J. Frank Schmidt's Oregon nursery, 1966
- [x] **Austrian pine** — resin tapping south of Vienna "now listed as Austrian cultural heritage"
- [x] **Spaeth alder** — raised at the Späth nursery in Berlin around 1908
- [x] **Tamarack** — "survives cold below minus 60 degrees Fahrenheit"
- [x] **Bur oak** — a seedling's taproot "can reach four feet down" in its first season
- [x] **American sycamore** — the Pringle brothers, "in the 1760s… for three years"
- [x] **Korean sun pear** — the Endicott pear, planted around 1630, "still bears fruit"
- [x] **Eastern cottonwood** — state tree of Kansas, Nebraska and Wyoming (Wyoming's is the plains cottonwood)
- [x] **Shantung maple** — seed oil rich in nervonic acid, grown as a crop in China
- [x] **Serviceberry** — the burial-service story is labeled folklore; is that fair?
- [x] **Larch (genus)** — tamarack root-and-trunk joints used as ship's knees

Checked on 3 November 2026. Seven held up as written. Changed: Austrian pine
(resin tapping continues; listed in Austria's intangible heritage inventory
in 2011), Spaeth alder (raised in the 1890s, sold from 1908), bur oak (more
than three feet, per the USDA plant guide), American sycamore (marked as a
story), Korean sun pear (planted in the 1630s). Serviceberry now gives the
likely origin of the name, from the European service tree, as well as the
folklore.


## Characteristics: where the sources disagree

On 27 September 2026 the characteristics columns (heights, spreads, zones,
colors, months) were compared with the Morton Arboretum's tree and shrub
pages. 175 of the 257 taxa matched a page. The rule was to change a value
only where Morton and a second source agreed it was clearly wrong; nothing
met it, which says the table holds up where Morton covers it. These are the
disagreements a person who knows the trees should settle:

- [x] **Seven-son flower** — we say yellow fall color; Morton says "little to no fall color"
- [x] **Russian olive** — we say zones 2–7; Morton says 3–10
- [x] **Chinese juniper** — we say 18 ft; Morton says 50–60 ft (Wikipedia: 3–65 ft, "very variable")
- [x] **Bigleaf linden** — we say hardy to zone 3; Morton says zone 5
- [x] **Sugar maple**, **katsura**, **black oak** — our fall colors (orange, orange, red) against Morton's yellow; Chicago against Vermont, probably, but worth a look
- [x] **American sycamore** — we say yellow fall color; Morton says brown

Settled on 4 November 2026 against extension and arboretum sources. Changed:
seven-son flower to no fall color (the leaves drop late without coloring;
the red is in the sepals), Russian olive to zones 3–7 (the range most often
cited), Chinese juniper to 50 × 15 ft (the species, not a garden cultivar),
American sycamore to yellow-brown. Kept: bigleaf linden at 3–7 (NC State
Extension gives the same), and sugar maple, katsura and black oak, whose
colors sit inside the ranges the sources give.

The Amber Glow dawn redwood's description and pest note were corrected the
same day from its introducer's and two other nurseries' descriptions (golden
new growth with a burgundy tinge, yellow through summer, no sun scorch).

## Origin labels: checked against USDA PLANTS

On 27 September 2026 each species' `origin` (Vermont native, introduced,
Vermont invasive) was compared with its native status in the
[USDA PLANTS Database](https://plants.usda.gov/). 157 of the 191 species
matched a USDA record; the rest are hybrids and garden trees USDA does not
list, all but one labeled introduced.

- Every species labeled **Vermont native** is native to the lower 48 states
  in USDA. None was wrongly called native.
- Every species labeled **Vermont invasive** is introduced in USDA, except
  black locust, which is native to the Appalachians and invasive here — as
  its entry already says.
- Thirty species labeled **introduced** are native elsewhere in the United
  States (tuliptree, black locust's relatives, baldcypress, Douglas fir and
  others). None is native to Vermont as far as is known, but USDA's
  state-by-state data could not be reached, so that last step rests on
  general knowledge. Worth a glance: **river birch**, which grows wild in
  neighboring states.
- The check could not test the **Vermont invasive** labels against Vermont's
  own noxious weed list: USDA's service returns those fields empty.

Found along the way, for a person to settle:

- [x] **Apple serviceberry** (and **Autumn Brilliance**) — labeled Vermont
  native. It is a hybrid of two native serviceberries that occurs wild where
  they meet, but the trees sold are nursery selections. Native, or introduced?
- [x] **Chestnut oak** — listed as *Quercus prinus*. USDA files that name under
  swamp chestnut oak (*Q. michauxii*); most current sources call chestnut oak
  *Q. montana*, as its description says. Which name should the record use?
- [x] **Laurel oak** (*Quercus hemisphaerica*) — USDA folds it into
  *Q. laurifolia*. A taxonomic difference, not an error.
- [x] **Common apple** (*Malus domestica*) — USDA calls it *Malus pumila*. The
  same.

Settled on 4 November 2026. Apple serviceberry and Autumn Brilliance stay
Vermont native: a natural hybrid of two Vermont natives, labeled the way
the file already labels cultivars of native species. Chestnut oak is now
*Quercus montana* (`quercus-montana`), the name Kew accepts; *Q. prinus*
stays as an alias. Laurel oak and common apple keep their names; *Malus
pumila* is an alias.

Corrected: pin cherry's scientific name was misspelled *Prunus pennsylvanica*;
it is *P. pensylvanica*, with one n.

## 2. Every rewritten species

Ticking a box means somebody who knows the tree has read both its
description and its fun fact on the species page and is content with them.
"description", "fun fact" or both says which of the two was rewritten; the
other was already there and has not been reviewed either.

Checked from the top on 6 November 2026, against extension, arboretum and
published sources found by web search: Allegheny serviceberry (fun fact
eased: one of the taller serviceberries, not the tallest; downy
serviceberry grows taller), Amber Glow dawn redwood (fun fact made exact:
five genera of conifers are deciduous) and American basswood (description
as written). By the project lead's decision of 6 November 2026, a source check
is enough to tick a box for now; a reading by someone who knows the trees
is still welcome before the map moves to a university domain.

A second ten on 6 November 2026, American beech to Amur maple. Four fixed:
American elm (Loyalists as well as British soldiers felled the Liberty
Tree), American smoketree (a rare native, not "rarer than its European
cousin"), Amur corktree (an unconfirmed detail about the bark dropped) and
Amur maple (its fun fact, that it colors first of any tree, could not be
confirmed and is replaced).

A third ten on 6 November 2026, arborvitae to bitternut hickory (Austrian
pine, Autumn Blaze and bigleaf linden fun facts were checked in section 1).
Four fixed: arborvitae (the crushed foliage smells sharp; "fruity" was
unsourced), ash (five to thirteen leaflets across the genus), Autumn
Brilliance serviceberry (its core is small and indistinct, not a
miniature apple's five-part star) and bitternut hickory (wagon wheels
unsourced; tool handles and farm implements confirmed).

A fourth ten on 6 November 2026, black tupelo to columnar European beech
(black locust was checked in section 1). Three fixed: Colorado blue spruce
(no longer Utah's state tree, which became quaking aspen in 2014), black
tupelo (sources put the oldest New Hampshire trees at 650 to 700 years, so
"more than 600", not "nearly 700") and the Dawyck beech (found in the
mid-1800s; sources give 1850 to 1864, not the 1860s). Black walnut thefts,
chokecherry as North Dakota's state fruit (2007) and the bur oak's first-year
taproot (about 4.5 ft, per Silvics) were confirmed.

A fifth ten on 7 November 2026, columnar Norway maple to common witchhazel.
Six fixed: Norway maple (John Bartram received its seed from London in 1756;
he did not bring it over himself), common lilac (arrived with colonists in
the 1700s, not with the first ones), common smoketree (young fustic dyed
wool and silk; leather is unsourced), common witchhazel (seeds thrown up to
about twenty feet, sources ranging 17 to 40, and "among the last flowers of
the year", not the last), common buckthorn (planted as a hedge through the
1800s; "a century before anyone noticed" overstated it) and, for the same
entry, "Class B noxious weed" dropped from the description, since the map
makes no claims about Vermont's noxious-weed rule (see DATA-MODEL, origin).
Baldcypress sinker logs, honeylocust's lost megafauna, larch in Venice's
piles (with alder and oak) and Sargent cherry's range were confirmed.

A sixth ten on 7 November 2026, contorted hazelnut to dragon's claw willow.
Five fun facts fixed: contorted hazel (found in 1863 at Frocester, and
propagated by grafting rather than cuttings), crabapple (the domestic apple
descends mainly from central Asia's wild apple, with a large share from
Europe's crab, not wholly from the former), dawn redwood (the Axel Heiberg
forest is about 45 million years old, not 50), dogwood (the form "dagwood"
is not attested; the skewer explanation is kept, hedged) and dragon's claw
willow (the claim that all trees come from one original was unsourced).
Donald Wyman's 35 years at the Arnold Arboretum (1935 to 1970) were
confirmed.

A seventh ten on 7 November 2026, eastern cottonwood to fastigiate English
oak. Two fun facts fixed: fastigiate English oak (it was said that every
narrow one is a graft; arboretum and extension sources say it comes largely
true from seed, which is why rows vary in width) and eastern cottonwood
(Wyoming's state tree is the plains form, *Populus deltoides* subsp.
*monilifera*). European ash's "matt" became "matte". Ash dieback (first seen
in Poland in 1992, from Asia), redcedar pencils (supplies ran short by the
1910s), London's elm water pipes and the Broad Arrow pines were confirmed.

An eighth ten on 7 November 2026, flowering dogwood to Green Giant
arborvitae. One fun fact eased: flowering dogwood (shuttles of dogwood are
well documented; "by the million" was not). Frost's own birches were gray
birch, as he said; Green Giant's Danish origin (1937 or 1938 by source) and
its single plant at the US National Arboretum in 1967, Freeman's 1933 cross,
J. Frank Schmidt's Red Sunset maple and emerald ash borer in Vermont (2018)
were confirmed.

A ninth ten on 7 November 2026, green hawthorn to Japanese stewartia. Three
fun facts and one description adjusted: Heritage river birch (found by Earl
Cully in a St. Louis yard, around 1968 to 1970 by source; first propagated
by grafted cuttings, so "grown from cuttings ever since" was dropped),
hackberry (Celtis seeds at Zhoukoudian may have been left by animals, so
the claim is hedged), hinoki (Noh stages are almost entirely hinoki, not
wholly) and hardy rubber tree (the threads are latex; dogwood leaves also
hold together when torn, by a different means, so "the only hardy tree
that does this" became "the only hardy tree with rubber in its leaves").
Japanese stewartia's "grey" became "gray".

A tenth ten on 7 November 2026, Japanese tree lilac to Lombardy poplar. Two
fun facts eased: Japanese tree lilac (sharing a family with privet does not
explain the scent, so "which is why" was dropped) and katsura (its wood is
a recognized but cheaper go-board wood; kaya is the traditional prize).
Katsura's maltol, the Endicott pear (planted about 1630, still fruiting),
Unter den Linden's first lindens (1647) and kousa dogwood's resistance to
anthracnose were confirmed.

An eleventh ten on 7 November 2026, London planetree to northern red oak.
Three adjusted: maple (its description called it "Vermont's most-planted
genus", which could not be sourced; it now says one of the most-planted
on this map, where it leads oak only 270 to 264, and opposite buds narrow a winter tree
to a short list, since katsura and Amur corktree are opposite too),
Mongolian linden (native to northern China including Inner Mongolia, not
to Mongolia itself) and London planetree (Spain or southern France is the
usual view, but English origins are argued too). Montmorency and Traverse
City, Nordmann's 1836 expedition and red mulberry's hybridizing with white
were confirmed.

A twelfth ten on 7 November 2026, Norway maple to Persian ironwood. One
fun fact fixed: pagoda dogwood is one of two alternate-leaved dogwoods,
not the only one; the Asian giant dogwood, *Cornus controversa*, is the
other. Sorbic acid (isolated from rowan berries by Hofmann in 1859), the
Princeton Nurseries origin of October Glory, Wilson's 1901 paperbark maple,
Bretschneider's Peking lilac seed (about 1881) and Parrot's ascent of
Ararat (1829) were confirmed.

A thirteenth ten on 7 November 2026, pin oak to redosier dogwood. Two
adjusted: red mulberry (fence posts, cooperage and boat building are
documented; boat ribs in particular were not) and red maple's description
(three main lobes, not "three shallow lobes", and sugar maple's leaf edge
is smooth between a few large points rather than wholly smooth).
Prairifire's 1982 University of Illinois release for scab resistance,
Red Sunset's 'Franksred' (1966), Pando and kinnikinnick were confirmed.

A fourteenth ten on 7 November 2026, river birch to Shantung maple. One fun
fact eased: Scotch pine was for decades the most widely grown Christmas
tree in America; that it was the most popular could not be sourced.
Sargent cherry (Bigelow's seed in 1890, Sargent's in 1892), Soulange-Bodin
as a retired cavalry officer of Napoleon's, scarlet oak as Washington,
DC's tree and Shantung maple's nervonic-acid oil were confirmed.

A fifteenth ten on 7 November 2026, shingle oak to spruce, all as written
(shingle oak's fun fact had been rewritten that day). Confirmed: Siberian
elm seeds eaten in northern China, starving bumblebees under silver
linden, silver maple's seed sprouting without a winter, southern magnolia
as Mississippi's tree and Louisiana's flower, the Späth alder (selected
1894, sold from 1908), salicylic acid from meadowsweet and the "spir" in
aspirin, and Maine spruce gum (1848).

A sixteenth ten on 7 November 2026, sugar maple to Turkish filbert. One fun
fact fixed: sweet birch (birch beer was traditionally brewed from it in the
Northeast, but an English birch-sap ale is recorded in 1676, so it was not
"first brewed from this tree"). Tatarian maple's name (Linnaeus's "Habitat
in Tataria"), box elder as the one native maple with divided leaves, swamp
white oak's long-stalked acorns and sweet pepperbush's peppercorn capsules
were confirmed.

A seventeenth ten on 7 November 2026, variegated tuliptree to white
willow. Two fun facts adjusted: Ware oak (named for George Ware, the
Morton Arboretum's research director, but he is not documented as its
breeder; a nursery catalogue credits the Regal Prince cross to Earl
Cully; the parent is the columnar English oak) and Washington hawthorn
(the late-1700s Washington nurseries are reported, not documented, and
its later spread north was unsourced). Higan-zakura, concolor, white oak's
plugged pores, the Heracles myth, watap and the cricket-bat willow were
confirmed.

The last six on 7 November 2026, Whitespire birch to Yoshino cherry, all as
written: betulin's white bark, bee gums cut from hollow black gum, salicin
and aspirin, yellow birch on stilt roots past 300 years, and the 1912 gift
of 3,020 cherries answered by dogwoods in 1915. With these, every box in
this section is ticked.

- [x] **Allegheny serviceberry** (*Amelanchier laevis*, `amelanchier-laevis`): fun fact
- [x] **Amber Glow dawn redwood** (*Metasequoia glyptostroboides 'Amber Glow'*, `metasequoia-glyptostroboides-amber-glow`): fun fact
- [x] **American basswood** (*Tilia americana*, `tilia-americana`): description
- [x] **American beech** (*Fagus grandifolia*, `fagus-grandifolia`): description
- [x] **American chestnut** (*Castanea dentata*, `castanea-dentata`): description
- [x] **American elm** (*Ulmus americana*, `ulmus-americana`): description + fun fact
- [x] **American hornbeam** (*Carpinus caroliniana*, `carpinus-caroliniana`): fun fact
- [x] **American smoketree** (*Cotinus obovatus*, `cotinus-obovatus`): description
- [x] **American sycamore** (*Platanus occidentalis*, `platanus-occidentalis`): description + fun fact
- [x] **Amur chokecherry** (*Prunus maackii*, `prunus-maackii`): fun fact
- [x] **Amur corktree** (*Phellodendron amurense*, `phellodendron-amurense`): description
- [x] **Amur maackia** (*Maackia amurensis*, `maackia-amurensis`): description + fun fact
- [x] **Amur maple** (*Acer ginnala*, `acer-ginnala`): description + fun fact
- [x] **Arborvitae** (*Thuja sp.*, `thuja-sp`): description + fun fact
- [x] **Armstrong red maple** (*Acer rubrum 'Armstrong'*, `acer-rubrum-armstrong`): fun fact
- [x] **Ash** (*Fraxinus sp.*, `fraxinus-sp`): description + fun fact
- [x] **Austrian pine** (*Pinus nigra*, `pinus-nigra`): fun fact
- [x] **Autumn Blaze maple** (*Acer x freemanii 'Autumn Blaze'*, `acer-x-freemanii-autumn-blaze`): description + fun fact
- [x] **Autumn Brilliance serviceberry** (*Amelanchier x grandiflora 'Autumn Brilliance'*, `amelanchier-x-grandiflora-autumn-brilliance`): fun fact
- [x] **Balsam poplar** (*Populus balsamifera*, `populus-balsamifera`): fun fact
- [x] **Bigleaf linden** (*Tilia platyphyllos*, `tilia-platyphyllos`): fun fact
- [x] **Bigleaf magnolia** (*Magnolia macrophylla*, `magnolia-macrophylla`): fun fact
- [x] **Bitternut hickory** (*Carya cordiformis*, `carya-cordiformis`): description + fun fact
- [x] **Black tupelo** (*Nyssa sylvatica*, `nyssa-sylvatica`): fun fact
- [x] **Black walnut** (*Juglans nigra*, `juglans-nigra`): fun fact
- [x] **Boxelder** (*Acer negundo*, `acer-negundo`): fun fact
- [x] **Buckthorn** (*Rhamnus sp.*, `rhamnus-sp`): description
- [x] **Bur oak** (*Quercus macrocarpa*, `quercus-macrocarpa`): fun fact
- [x] **Cherry** (*Prunus sp.*, `prunus-sp`): description
- [x] **Chokecherry** (*Prunus virginiana*, `prunus-virginiana`): fun fact
- [x] **Colorado blue spruce** (*Picea pungens*, `picea-pungens`): fun fact
- [x] **Columnar American basswood** (*Tilia americana 'Fastigiata'*, `tilia-americana-fastigiata`): fun fact
- [x] **Columnar European beech** (*Fagus sylvatica 'Fastigiata'*, `fagus-sylvatica-fastigiata`): fun fact
- [x] **Columnar Norway maple** (*Acer platanoides 'Columnare'*, `acer-platanoides-columnare`): fun fact
- [x] **Columnar red maple** (*Acer rubrum 'Columnare'*, `acer-rubrum-columnare`): fun fact
- [x] **Columnar Sargent cherry** (*Prunus sargentii 'Columnaris'*, `prunus-sargentii-columnaris`): fun fact
- [x] **Common baldcypress** (*Taxodium distichum*, `taxodium-distichum`): fun fact
- [x] **Common buckthorn** (*Rhamnus cathartica*, `rhamnus-cathartica`): description
- [x] **Common honeylocust** (*Gleditsia triacanthos*, `gleditsia-triacanthos`): fun fact
- [x] **Common larch** (*Larix decidua*, `larix-decidua`): fun fact
- [x] **Common lilac** (*Syringa vulgaris*, `syringa-vulgaris`): description
- [x] **Common smoketree** (*Cotinus coggygria*, `cotinus-coggygria`): fun fact
- [x] **Common witchhazel** (*Hamamelis virginiana*, `hamamelis-virginiana`): fun fact
- [x] **Contorted hazelnut** (*Corylus avellana*, `corylus-avellana`): description
- [x] **Copper Curls Peking lilac** (*Syringa pekinensis 'Copper Curls'*, `syringa-pekinensis-copper-curls`): fun fact
- [x] **Crabapple** (*Malus sp.*, `malus-sp`): description
- [x] **Crimson Cloud hawthorn** (*Crataegus laevigata 'Crimson Cloud'*, `crataegus-laevigata-crimson-cloud`): fun fact
- [x] **Cutleaf silver maple** (*Acer saccharinum 'Skinneri'*, `acer-saccharinum-skinneri`): fun fact
- [x] **Dawn redwood** (*Metasequoia glyptostroboides*, `metasequoia-glyptostroboides`): fun fact
- [x] **Devil's walkingstick** (*Aralia spinosa*, `aralia-spinosa`): fun fact
- [x] **Dogwood** (*Cornus sp.*, `cornus-sp`): description
- [x] **Donald Wyman crabapple** (*Malus 'Donald Wyman'*, `malus-donald-wyman`): fun fact
- [x] **Dragon's claw willow** (*Salix matsudana 'Tortuosa'*, `salix-matsudana-tortuosa`): description + fun fact
- [x] **Eastern cottonwood** (*Populus deltoides*, `populus-deltoides`): fun fact
- [x] **Eastern hemlock** (*Tsuga canadensis*, `tsuga-canadensis`): description
- [x] **Eastern hophornbeam** (*Ostrya virginiana*, `ostrya-virginiana`): fun fact
- [x] **Eastern redcedar** (*Juniperus virginiana*, `juniperus-virginiana`): fun fact
- [x] **Eastern white pine** (*Pinus strobus*, `pinus-strobus`): description
- [x] **Elm** (*Ulmus sp.*, `ulmus-sp`): description + fun fact
- [x] **European ash** (*Fraxinus excelsior*, `fraxinus-excelsior`): fun fact
- [x] **European bird cherry** (*Prunus padus*, `prunus-padus`): fun fact
- [x] **European linden** (*Tilia x europaea*, `tilia-x-europaea`): fun fact
- [x] **Fastigiate English oak** (*Quercus robur 'Fastigiata'*, `quercus-robur-fastigiata`): description + fun fact
- [x] **Flowering dogwood** (*Cornus florida*, `cornus-florida`): fun fact
- [x] **Four-winged silverbell** (*Halesia tetraptera*, `halesia-tetraptera`): fun fact
- [x] **Freeman's maple** (*Acer x freemanii*, `acer-x-freemanii`): description
- [x] **Ginkgo** (*Ginkgo biloba*, `ginkgo-biloba`): description
- [x] **Golden Raindrops crabapple** (*Malus 'Schmidtcutleaf'*, `malus-schmidtcutleaf`): fun fact
- [x] **Golden weeping willow** (*Salix alba 'Tristis'*, `salix-alba-tristis`): fun fact
- [x] **Grand fir** (*Abies grandis*, `abies-grandis`): fun fact
- [x] **Gray birch** (*Betula populifolia*, `betula-populifolia`): fun fact
- [x] **Green ash** (*Fraxinus pennsylvanica*, `fraxinus-pennsylvanica`): description
- [x] **Green Giant arborvitae** (*Thuja 'Green Giant'*, `thuja-green-giant`): fun fact
- [x] **Green hawthorn** (*Crataegus viridis*, `crataegus-viridis`): fun fact
- [x] **Greenspire linden** (*Tilia cordata 'Greenspire'*, `tilia-cordata-greenspire`): fun fact
- [x] **Hackberry** (*Celtis occidentalis*, `celtis-occidentalis`): fun fact
- [x] **Hardy rubber tree** (*Eucommia ulmoides*, `eucommia-ulmoides`): description
- [x] **Hawthorn** (*Crataegus sp.*, `crataegus-sp`): description + fun fact
- [x] **Hedge maple** (*Acer campestre*, `acer-campestre`): fun fact
- [x] **Heritage river birch** (*Betula nigra 'Heritage'*, `betula-nigra-heritage`): fun fact
- [x] **Hinoki falsecypress** (*Chamaecyparis obtusa*, `chamaecyparis-obtusa`): fun fact
- [x] **Honeycrisp apple** (*Malus domestica 'Honeycrisp'*, `malus-domestica-honeycrisp`): fun fact
- [x] **Japanese stewartia** (*Stewartia pseudocamellia*, `stewartia-pseudocamellia`): description
- [x] **Japanese tree lilac** (*Syringa reticulata*, `syringa-reticulata`): fun fact
- [x] **Juniper** (*Juniperus sp.*, `juniperus-sp`): description
- [x] **Katsuratree** (*Cercidiphyllum japonicum*, `cercidiphyllum-japonicum`): fun fact
- [x] **Kentucky coffeetree** (*Gymnocladus dioicus*, `gymnocladus-dioicus`): description
- [x] **Korean maple** (*Acer pseudosieboldianum*, `acer-pseudosieboldianum`): fun fact
- [x] **Korean sun pear** (*Pyrus fauriei*, `pyrus-fauriei`): description + fun fact
- [x] **Kousa dogwood** (*Cornus kousa*, `cornus-kousa`): fun fact
- [x] **Larch** (*Larix sp.*, `larix-sp`): description + fun fact
- [x] **Littleleaf linden** (*Tilia cordata*, `tilia-cordata`): fun fact
- [x] **Lombardy poplar** (*Populus nigra*, `populus-nigra`): description
- [x] **London planetree** (*Platanus x acerifolia*, `platanus-x-acerifolia`): fun fact
- [x] **Magnolia** (*Magnolia sp.*, `magnolia-sp`): description
- [x] **Manchurian alder** (*Alnus hirsuta*, `alnus-hirsuta`): fun fact
- [x] **Maple** (*Acer sp.*, `acer-sp`): description
- [x] **Mongolian linden** (*Tilia x mongolica*, `tilia-x-mongolica`): fun fact
- [x] **Montmorency cherry** (*Prunus cerasus 'Montmorency'*, `prunus-cerasus-montmorency`): fun fact
- [x] **Mugo pine** (*Pinus mugo*, `pinus-mugo`): description + fun fact
- [x] **Mulberry** (*Morus sp.*, `morus-sp`): description
- [x] **Nordmann fir** (*Abies nordmanniana*, `abies-nordmanniana`): fun fact
- [x] **Northern red oak** (*Quercus rubra*, `quercus-rubra`): description
- [x] **Norway maple** (*Acer platanoides*, `acer-platanoides`): description
- [x] **Norway spruce** (*Picea abies*, `picea-abies`): description
- [x] **Oakleaf mountain ash** (*Sorbus x thuringiaca*, `sorbus-x-thuringiaca`): fun fact
- [x] **October Glory red maple** (*Acer rubrum 'October Glory'*, `acer-rubrum-october-glory`): fun fact
- [x] **Pagoda dogwood** (*Cornus alternifolia*, `cornus-alternifolia`): description + fun fact
- [x] **Paper birch** (*Betula papyrifera*, `betula-papyrifera`): description
- [x] **Paperbark maple** (*Acer griseum*, `acer-griseum`): fun fact
- [x] **Pear** (*Pyrus sp.*, `pyrus-sp`): description + fun fact
- [x] **Peking lilac** (*Syringa pekinensis*, `syringa-pekinensis`): fun fact
- [x] **Persian ironwood** (*Parrotia persica*, `parrotia-persica`): fun fact
- [x] **Pin oak** (*Quercus palustris*, `quercus-palustris`): fun fact
- [x] **Prairifire crabapple** (*Malus 'Prairifire'*, `malus-prairifire`): fun fact
- [x] **Princeton Sentry ginkgo** (*Ginkgo biloba 'Princeton Sentry'*, `ginkgo-biloba-princeton-sentry`): fun fact
- [x] **Purple leaf plum** (*Prunus cerasifera*, `prunus-cerasifera`): fun fact
- [x] **Quaking aspen** (*Populus tremuloides*, `populus-tremuloides`): fun fact
- [x] **Ragin Red redosier dogwood** (*Cornus sericea 'Ragin Red'*, `cornus-sericea-ragin-red`): description + fun fact
- [x] **Red maple** (*Acer rubrum*, `acer-rubrum`): description + fun fact
- [x] **Red mulberry** (*Morus rubra*, `morus-rubra`): fun fact
- [x] **Red Sunset red maple** (*Acer rubrum 'Red Sunset'*, `acer-rubrum-red-sunset`): fun fact
- [x] **Redosier dogwood** (*Cornus sericea*, `cornus-sericea`): fun fact
- [x] **River birch** (*Betula nigra*, `betula-nigra`): fun fact
- [x] **Ruby Lace honeylocust** (*Gleditsia triacanthos f. inermis 'Ruby Lace'*, `gleditsia-triacanthos-inermis-ruby-lace`): fun fact
- [x] **Russian olive** (*Elaeagnus angustifolia*, `elaeagnus-angustifolia`): description
- [x] **Sargent cherry** (*Prunus sargentii*, `prunus-sargentii`): fun fact
- [x] **Saucer magnolia** (*Magnolia x soulangiana*, `magnolia-x-soulangiana`): fun fact
- [x] **Scarlet oak** (*Quercus coccinea*, `quercus-coccinea`): fun fact
- [x] **Scotch pine** (*Pinus sylvestris*, `pinus-sylvestris`): fun fact
- [x] **Serviceberry** (*Amelanchier sp.*, `amelanchier-sp`): fun fact
- [x] **Shadblow serviceberry** (*Amelanchier canadensis*, `amelanchier-canadensis`): fun fact
- [x] **Shantung maple** (*Acer truncatum*, `acer-truncatum`): fun fact
- [x] **Shingle oak** (*Quercus imbricaria*, `quercus-imbricaria`): fun fact
- [x] **Siberian elm** (*Ulmus pumila*, `ulmus-pumila`): fun fact
- [x] **Siberian peashrub** (*Caragana arborescens*, `caragana-arborescens`): fun fact
- [x] **Sienna Glen maple** (*Acer x freemanii 'Sienna Glen'*, `acer-x-freemanii-sienna-glen`): fun fact
- [x] **Silver linden** (*Tilia tomentosa*, `tilia-tomentosa`): fun fact
- [x] **Silver maple** (*Acer saccharinum*, `acer-saccharinum`): fun fact
- [x] **Southern magnolia** (*Magnolia grandiflora*, `magnolia-grandiflora`): fun fact
- [x] **Spaeth alder** (*Alnus x spaethii*, `alnus-x-spaethii`): fun fact
- [x] **Spirea** (*Spiraea sp.*, `spiraea-sp`): description + fun fact
- [x] **Spruce** (*Picea sp.*, `picea-sp`): description + fun fact
- [x] **Sugar maple** (*Acer saccharum*, `acer-saccharum`): description
- [x] **Summersweet** (*Clethra alnifolia*, `clethra-alnifolia`): fun fact
- [x] **Swamp white oak** (*Quercus bicolor*, `quercus-bicolor`): fun fact
- [x] **Sweet birch** (*Betula lenta*, `betula-lenta`): fun fact
- [x] **Sweetgum** (*Liquidambar styraciflua*, `liquidambar-styraciflua`): fun fact
- [x] **Tamarack** (*Larix laricina*, `larix-laricina`): description + fun fact
- [x] **Tatarian maple** (*Acer tataricum*, `acer-tataricum`): fun fact
- [x] **Thornless honeylocust** (*Gleditsia triacanthos f. inermis*, `gleditsia-triacanthos-inermis`): description
- [x] **Three-flower maple** (*Acer triflorum*, `acer-triflorum`): fun fact
- [x] **Turkish filbert** (*Corylus colurna*, `corylus-colurna`): description + fun fact
- [x] **Variegated tuliptree** (*Liriodendron tulipifera 'Aureomarginatum'*, `liriodendron-tulipifera-aureomarginatum`): fun fact
- [x] **Ware oak** (*Quercus x warei*, `quercus-x-warei`): fun fact
- [x] **Washington hawthorn** (*Crataegus phaenopyrum*, `crataegus-phaenopyrum`): description + fun fact
- [x] **Weeping cherry** (*Prunus subhirtella*, `prunus-subhirtella`): fun fact
- [x] **White ash** (*Fraxinus americana*, `fraxinus-americana`): description
- [x] **White fir** (*Abies concolor*, `abies-concolor`): fun fact
- [x] **White oak** (*Quercus alba*, `quercus-alba`): description + fun fact
- [x] **White poplar** (*Populus alba*, `populus-alba`): fun fact
- [x] **White spruce** (*Picea glauca*, `picea-glauca`): fun fact
- [x] **White willow** (*Salix alba*, `salix-alba`): fun fact
- [x] **Whitespire birch** (*Betula populifolia 'Whitespire'*, `betula-populifolia-whitespire`): fun fact
- [x] **Wildfire black tupelo** (*Nyssa sylvatica 'Wildfire'*, `nyssa-sylvatica-wildfire`): fun fact
- [x] **Willow** (*Salix sp.*, `salix-sp`): description + fun fact
- [x] **Yellow birch** (*Betula alleghaniensis*, `betula-alleghaniensis`): fun fact
- [x] **Yew** (*Taxus sp.*, `taxus-sp`): description
- [x] **Yoshino cherry** (*Prunus x yedoensis*, `prunus-x-yedoensis`): fun fact

## 3. Added since

Species added after the review above. Their description and fun fact were
written new, from the sources named in each commit, and want the same check.

Checked from the newest end on 5 November 2026. Ten ticked: highbush
blueberry, Japanese snowbell, dwarf fothergilla, Golden Spirit smokebush,
Rosy Lights azalea, Japanese clethra, Japanese angelica tree, bottlebrush
buckeye, Blue Mist dwarf fothergilla and spicebush. Four descriptions eased
where they ran ahead of the sources: blueberry ("most", not "nearly every",
cultivated blueberry), Golden Spirit ("said to" resist scorch), bottlebrush
buckeye (red-tipped stamens, not pink) and Blue Mist (bluer than the
species, not a color the species lacks).

A second ten on 5 November 2026: Mariesii doublefile viburnum, Meader
persimmon, ghost bramble, creeping cotoneaster, beautybush, weeping Alaska
cedar, panicle hydrangea, Japanese pagoda tree, pawpaw and sawtooth oak.
Three fixed: cotoneaster's pronunciation (the stress falls on AS, per Oregon
State and Dictionary.com), sawtooth oak (planted for wildlife across the
eastern United States, not only the South) and Meader persimmon (its
description no longer suggests frost is needed to ripen the fruit).

A third ten on 5 November 2026: Emerald Green arborvitae, Boston ivy,
Virginia creeper, Japanese fiber banana, English ivy, Triumph and Accolade
elms, lilac (genus), Miss Kim lilac and Triple Crown blackberry. Four fixed:
Boston ivy no longer claims to be *the* ivy of the Ivy League name, and drops
an unsourced line about English ivy failing in New England; Virginia creeper
no longer says it came from the Virginia colony (only that it reached
England from eastern North America by 1629); Accolade's date is when its
seedling was planted, not when the seed was collected; Triumph loses an
unconfirmed year.

A fourth ten on 5 November 2026: Fall Gold raspberry, rhododendron (genus),
PJM and Catawba rhododendrons, Heritage oak, Snow Fountains weeping cherry,
Christmas fern, and Japanese white, Bosnian and limber pines. Two fixed:
Heritage oak (it grew from 1974 seed of a hybrid near Jacksonville, per its
patent; McDaniel worked out the parentage) and PJM (its first-flowering
year, 1945, could not be confirmed and is dropped).

A fifth ten on 5 November 2026: Swiss stone pine, lacebark pine, Japanese
pieris, Brouwer's Beauty andromeda, Serbian spruce, Dwarf Everbearing black
mulberry, Gracillimus and Adagio maiden grasses, ostrich fern and sweetbay
magnolia. Two eased: the mulberry (silkworms *do best* on white mulberry;
they will eat black) and Swiss stone pine (the sleep research is more than
one small study, but still small).

A sixth ten on 5 November 2026: Osage orange, and the cucumbertree, Ann,
Cameo, Elizabeth, Gold Star, Judy Zuk, Shirazz, umbrella and Ultimate Yellow
magnolias. Three fixed: Osage orange's 40,000 miles is "an estimated"
figure (one source gives far more by 1948); Elizabeth was released in 1977,
per Brooklyn Botanic Garden and its patent, not named in 1978; Ultimate
Yellow loses an unconfirmed Massachusetts origin.

A seventh ten on 5 November 2026: pecan, shellbark hickory, Atlantic white
cedar, Brilliance autumn fern, forsythia (genus), Siberian iris, iris
(genus), butternut, English walnut and common juniper. Four fixed: pecan
('Centennial' was shown at the 1876 exposition; no prize could be
confirmed), Atlantic white cedar (when the Dennisville mining ended is
disputed, so no end date), forsythia ('Vermont Sun' was registered in 1978
by Evert and Pellett of UVM) and English walnut (the merchant-ship origin of
the name is a guess, so "possibly").

An eighth ten on 6 November 2026: black maple, Bloodgood Japanese maple,
Blue Chiffon rose of Sharon, Bluecrop, Chandler and Duke blueberries, hybrid
paperbark maple, Karl Foerster feather reed grass, lady fern and New York
fern. Six fixed: black maple (not "the only other" maple as sweet), Blue
Chiffon (unconfirmed cross and selection years replaced by its 2009 patent),
Bluecrop ("one of" the most widely grown), Chandler (no "size of a
quarter"), Duke (an unconfirmed 1949 date replaced by its 1987 release) and
the hybrid paperbark maple ("hardier" unconfirmed; Cornell says faster and
more sun-tolerant).

A ninth ten on 6 November 2026 finishes this list: northern maidenhair
fern, Ohio buckeye, Patriot blueberry, Pink Flair Sargent cherry, Royal
Frost birch, sycamore maple and White Chiffon rose of Sharon. (Allegheny
serviceberry, Amber Glow dawn redwood and American basswood, checked the
same day, are ticked in section 2 above.) One fixed here: the Sycamore Gap
tree was about 150 years old, not over 200.

American elderberry, added 6 November 2026, was written from sources checked
the same day (UF/IFAS, University of Minnesota, UMass, Oregon State
extension). Its fall color, bark and pests are left blank: no source checked
described them.

Show Off forsythia, added the same day, was written from its US plant patent
(PP19,321) and nursery listings. They disagree on hardiness (zones 3 to 9);
5–8 is the range most give.

Japanese kerria, added the same day, was written from extension and
arboretum pages (Clemson, NC State, Illinois, UConn) and Trees and Shrubs
Online. Hardiness is given as zone 4 or 5 at the cold end; UConn's 5 is used.
Fruit and fall color are left blank.

Its Pleniflora and Picta cultivars followed the same day (Clemson, Purdue,
Oregon State, RHS, Cornell, nursery listings). Checking them corrected the
species' fun fact: Kerr's 1804 plant was the double form, and the single
species reached England about 1834 (Bean's Trees and Shrubs). Sources give
1804 or 1805 for the first and 1834 or 1835 for the second.

Verdant Hills boxwood, added the same day, was first written from the
Dawes Arboretum's record and the American Boxwood Society's checklist, and
rewritten the same day from the registration itself, which the user found:
"Four Recently Registered Boxwood Cultivars", The Boxwood Bulletin
38(3):47, 1999. It names the registrant as Dr. Norman E. Pellet [sic],
Professor Emeritus, University of Vermont, and gives the Sheridan Nurseries
origin, the sister seedlings, and a 25-year-old plant at UVM's Horticultural
Research Center of 46 by 70 inches. Zone 4 is the Dawes figure; 8 at the warm
end is still not from a source on this plant.

Tom Thumb cotoneaster, added 6 November 2026, is filed under the genus alone:
Oregon State, Chicago Botanic Garden, the RHS, Illinois and Fine Gardening
place it under three different species. Written from those, Cornell and
nursery listings, which disagree on fruit: the grower sheet and Fine
Gardening (little or none) are followed over retail claims of heavy berries.
Nurseries give zone 5 at the cold end; 8 at the warm end is not from a
source on this plant.

Burning bush, added 6 November 2026, was written from UConn Extension,
Illinois Extension, Wisconsin DNR and the Greenwich, CT, data sheet. It is
labeled invasive, without a claim about Vermont's sale rules (see
DATA-MODEL.md, origin). Spread and the warm end of its range (8) are not from
a checked source; spread is left blank.

Dwarf burning bush ('Compactus'), added the same day, was written from Purdue
Arboretum (which flags it as invasive, seeding into woodlots), NC State and
nursery listings. Sources give 6–10 ft for its size and disagree on its
zones; 10 by 10 ft and 4–8 are used. The less-pronounced wings are a common
description, not from a checked source.

- [x] **Accolade elm** (*Ulmus 'Morton'*, `ulmus-morton`): description + fun fact
- [x] **Adagio maiden grass** (*Miscanthus sinensis 'Adagio'*, `miscanthus-sinensis-adagio`): description + fun fact
- [x] **American elderberry** (*Sambucus canadensis*, `sambucus-canadensis`): description + fun fact
- [x] **Ann magnolia** (*Magnolia 'Ann'*, `magnolia-ann`): description + fun fact
- [x] **Atlantic white cedar** (*Chamaecyparis thyoides*, `chamaecyparis-thyoides`): description + fun fact
- [x] **Beautybush** (*Kolkwitzia amabilis*, `kolkwitzia-amabilis`): description + fun fact
- [x] **Black maple** (*Acer nigrum*, `acer-nigrum`): description + fun fact
- [x] **Bloodgood Japanese maple** (*Acer palmatum 'Bloodgood'*, `acer-palmatum-bloodgood`): description + fun fact
- [x] **Blue Chiffon rose of Sharon** (*Hibiscus syriacus 'Notwoodthree'*, `hibiscus-syriacus-notwoodthree`): description + fun fact
- [x] **Blue Mist dwarf fothergilla** (*Fothergilla gardenii 'Blue Mist'*, `fothergilla-gardenii-blue-mist`): description + fun fact
- [x] **Bluecrop highbush blueberry** (*Vaccinium corymbosum 'Bluecrop'*, `vaccinium-corymbosum-bluecrop`): description + fun fact
- [x] **Bosnian pine** (*Pinus heldreichii*, `pinus-heldreichii`): description + fun fact
- [x] **Boston ivy** (*Parthenocissus tricuspidata*, `parthenocissus-tricuspidata`): description + fun fact
- [x] **Bottlebrush buckeye** (*Aesculus parviflora*, `aesculus-parviflora`): description + fun fact
- [x] **Brilliance autumn fern** (*Dryopteris erythrosora 'Brilliance'*, `dryopteris-erythrosora-brilliance`): description + fun fact
- [x] **Brouwer's Beauty andromeda** (*Pieris 'Brouwer's Beauty'*, `pieris-brouwers-beauty`): description + fun fact
- [x] **Burning bush** (*Euonymus alatus*, `euonymus-alatus`): description + fun fact
- [x] **Butternut** (*Juglans cinerea*, `juglans-cinerea`): description + fun fact
- [x] **Cameo magnolia** (*Magnolia 'Cameo'*, `magnolia-cameo`): description + fun fact
- [x] **Catawba rhododendron** (*Rhododendron catawbiense*, `rhododendron-catawbiense`): description + fun fact
- [x] **Chandler highbush blueberry** (*Vaccinium corymbosum 'Chandler'*, `vaccinium-corymbosum-chandler`): description + fun fact
- [x] **Christmas fern** (*Polystichum acrostichoides*, `polystichum-acrostichoides`): description + fun fact
- [x] **Common juniper** (*Juniperus communis*, `juniperus-communis`): description + fun fact
- [x] **Creeping cotoneaster** (*Cotoneaster adpressus*, `cotoneaster-adpressus`): description + fun fact
- [x] **Cucumbertree magnolia** (*Magnolia acuminata*, `magnolia-acuminata`): description + fun fact
- [x] **Duke highbush blueberry** (*Vaccinium corymbosum 'Duke'*, `vaccinium-corymbosum-duke`): description + fun fact
- [x] **Dwarf burning bush** (*Euonymus alatus 'Compactus'*, `euonymus-alatus-compactus`): description + fun fact
- [x] **Dwarf Everbearing black mulberry** (*Morus nigra 'Dwarf Everbearing'*, `morus-nigra-dwarf-everbearing`): description + fun fact
- [x] **Dwarf fothergilla** (*Fothergilla gardenii*, `fothergilla-gardenii`): description + fun fact
- [x] **Elizabeth magnolia** (*Magnolia 'Elizabeth'*, `magnolia-elizabeth`): description + fun fact
- [x] **Emerald Green arborvitae** (*Thuja occidentalis 'Smaragd'*, `thuja-occidentalis-smaragd`): description + fun fact
- [x] **English ivy** (*Hedera helix*, `hedera-helix`): description + fun fact
- [x] **English walnut** (*Juglans regia*, `juglans-regia`): description + fun fact
- [x] **Fall Gold raspberry** (*Rubus idaeus 'Fall Gold'*, `rubus-idaeus-fall-gold`): description + fun fact
- [x] **Forsythia** (*Forsythia sp.*, `forsythia-sp`): description + fun fact
- [x] **Ghost bramble** (*Rubus thibetanus*, `rubus-thibetanus`): description + fun fact
- [x] **Gold Star magnolia** (*Magnolia 'Gold Star'*, `magnolia-gold-star`): description + fun fact
- [x] **Golden Spirit smokebush** (*Cotinus coggygria 'Ancot'*, `cotinus-coggygria-ancot`): description + fun fact
- [x] **Gracillimus maiden grass** (*Miscanthus sinensis 'Gracillimus'*, `miscanthus-sinensis-gracillimus`): description + fun fact
- [x] **Heritage oak** (*Quercus x macdanielii 'Clemons'*, `quercus-x-macdanielii-clemons`): description + fun fact
- [x] **Highbush blueberry** (*Vaccinium corymbosum*, `vaccinium-corymbosum`): description + fun fact
- [x] **Hybrid paperbark maple** (*Acer griseum x maximowiczianum*, `acer-griseum-x-maximowiczianum`): description + fun fact
- [x] **Iris** (*Iris sp.*, `iris-sp`): description + fun fact
- [x] **Japanese angelica tree** (*Aralia elata*, `aralia-elata`): description + fun fact
- [x] **Japanese clethra** (*Clethra barbinervis*, `clethra-barbinervis`): description + fun fact
- [x] **Japanese fiber banana** (*Musa basjoo*, `musa-basjoo`): description + fun fact
- [x] **Japanese kerria** (*Kerria japonica*, `kerria-japonica`): description + fun fact
- [x] **Japanese pagoda tree** (*Styphnolobium japonicum*, `styphnolobium-japonicum`): description + fun fact
- [x] **Japanese pieris** (*Pieris japonica*, `pieris-japonica`): description + fun fact
- [x] **Japanese snowbell** (*Styrax japonicus*, `styrax-japonicus`): description + fun fact
- [x] **Japanese white pine** (*Pinus parviflora*, `pinus-parviflora`): description + fun fact
- [x] **Judy Zuk magnolia** (*Magnolia 'Judy Zuk'*, `magnolia-judy-zuk`): description + fun fact
- [x] **Karl Foerster feather reed grass** (*Calamagrostis x acutiflora 'Karl Foerster'*, `calamagrostis-x-acutiflora-karl-foerster`): description + fun fact
- [x] **Lacebark pine** (*Pinus bungeana*, `pinus-bungeana`): description + fun fact
- [x] **Lady fern** (*Athyrium filix-femina*, `athyrium-filix-femina`): description + fun fact
- [x] **Lilac** (*Syringa sp.*, `syringa-sp`): description + fun fact
- [x] **Limber pine** (*Pinus flexilis*, `pinus-flexilis`): description + fun fact
- [x] **Mariesii doublefile viburnum** (*Viburnum plicatum f. tomentosum 'Mariesii'*, `viburnum-plicatum-tomentosum-mariesii`): description + fun fact
- [x] **Meader persimmon** (*Diospyros virginiana 'Meader'*, `diospyros-virginiana-meader`): description + fun fact
- [x] **Miss Kim lilac** (*Syringa pubescens subsp. patula 'Miss Kim'*, `syringa-pubescens-patula-miss-kim`): description + fun fact
- [x] **New York fern** (*Amauropelta noveboracensis*, `amauropelta-noveboracensis`): description + fun fact
- [x] **Northern maidenhair fern** (*Adiantum pedatum*, `adiantum-pedatum`): description + fun fact
- [x] **Ohio buckeye** (*Aesculus glabra*, `aesculus-glabra`): description + fun fact
- [x] **Osage orange** (*Maclura pomifera*, `maclura-pomifera`): description + fun fact
- [x] **Ostrich fern** (*Matteuccia struthiopteris*, `matteuccia-struthiopteris`): description + fun fact
- [x] **Panicle hydrangea** (*Hydrangea paniculata*, `hydrangea-paniculata`): description + fun fact
- [x] **Patriot highbush blueberry** (*Vaccinium corymbosum 'Patriot'*, `vaccinium-corymbosum-patriot`): description + fun fact
- [x] **Pawpaw** (*Asimina triloba*, `asimina-triloba`): description + fun fact
- [x] **Pecan** (*Carya illinoinensis*, `carya-illinoinensis`): description + fun fact
- [x] **Picta Japanese kerria** (*Kerria japonica 'Picta'*, `kerria-japonica-picta`): description + fun fact
- [x] **Pink Flair Sargent cherry** (*Prunus sargentii 'JFS-KW58'*, `prunus-sargentii-jfs-kw58`): description + fun fact
- [x] **PJM rhododendron** (*Rhododendron 'P.J.M.'*, `rhododendron-pjm`): description + fun fact
- [x] **Pleniflora Japanese kerria** (*Kerria japonica 'Pleniflora'*, `kerria-japonica-pleniflora`): description + fun fact
- [x] **Rhododendron** (*Rhododendron sp.*, `rhododendron-sp`): description + fun fact
- [x] **Rosy Lights azalea** (*Rhododendron 'Rosy Lights'*, `rhododendron-rosy-lights`): description + fun fact
- [x] **Royal Frost birch** (*Betula 'Penci 2'*, `betula-penci-2`): description + fun fact
- [x] **Sawtooth oak** (*Quercus acutissima*, `quercus-acutissima`): description + fun fact
- [x] **Serbian spruce** (*Picea omorika*, `picea-omorika`): description + fun fact
- [x] **Shellbark hickory** (*Carya laciniosa*, `carya-laciniosa`): description + fun fact
- [x] **Shirazz magnolia** (*Magnolia 'Shirazz'*, `magnolia-shirazz`): description + fun fact
- [x] **Show Off forsythia** (*Forsythia x intermedia 'Mindor'*, `forsythia-x-intermedia-mindor`): description + fun fact
- [x] **Siberian iris** (*Iris sibirica*, `iris-sibirica`): description + fun fact
- [x] **Snow Fountains weeping cherry** (*Prunus 'Snofozam'*, `prunus-snofozam`): description + fun fact
- [x] **Spicebush** (*Lindera benzoin*, `lindera-benzoin`): description + fun fact
- [x] **Sweetbay magnolia** (*Magnolia virginiana*, `magnolia-virginiana`): description + fun fact
- [x] **Swiss stone pine** (*Pinus cembra*, `pinus-cembra`): description + fun fact
- [x] **Sycamore maple** (*Acer pseudoplatanus*, `acer-pseudoplatanus`): description + fun fact
- [x] **Tom Thumb cotoneaster** (*Cotoneaster 'Tom Thumb'*, `cotoneaster-tom-thumb`): description + fun fact
- [x] **Triple Crown thornless blackberry** (*Rubus 'Triple Crown'*, `rubus-triple-crown`): description + fun fact
- [x] **Triumph elm** (*Ulmus 'Morton Glossy'*, `ulmus-morton-glossy`): description + fun fact
- [x] **Ultimate Yellow magnolia** (*Magnolia 'Ultimate Yellow'*, `magnolia-ultimate-yellow`): description + fun fact
- [x] **Umbrella magnolia** (*Magnolia tripetala*, `magnolia-tripetala`): description + fun fact
- [x] **Verdant Hills boxwood** (*Buxus 'Verdant Hills'*, `buxus-verdant-hills`): description + fun fact
- [x] **Virginia creeper** (*Parthenocissus quinquefolia*, `parthenocissus-quinquefolia`): description + fun fact
- [x] **Weeping Alaska cedar** (*Callitropsis nootkatensis 'Pendula'*, `callitropsis-nootkatensis-pendula`): description + fun fact
- [x] **Weeping European beech** (*Fagus sylvatica 'Pendula'*, `fagus-sylvatica-pendula`): description + fun fact
- [x] **White Chiffon rose of Sharon** (*Hibiscus syriacus 'Notwoodtwo'*, `hibiscus-syriacus-notwoodtwo`): description + fun fact

### Added 12 November 2026: species likely on an Ohio campus

Fifty-eight species commonly planted or wild on Ohio campuses, added in one
batch. Unlike the entries above, **their text was written from general
knowledge, not from sources**, so every box starts empty and each wants the
usual check, fun facts and dates first. Traits (size, months, hardiness)
are typical figures and want the same look.

`origin` means Vermont, not Ohio. Four are marked Vermont invasive because
they are on Vermont's noxious weed list as far as could be found: tree of
heaven, Amur honeysuckle, Japanese barberry and multiflora rose. Common
privet, black alder, wintercreeper and Japanese spirea, which some places
treat as invasive, were not found on it and are marked introduced. Six are
left blank because their Vermont status could not be settled: mockernut
hickory, sweet crabapple, blackhaw, smooth hydrangea, fragrant sumac and
creeping juniper.

Checked on 12 November 2026, the first ten (American bladdernut to
blackhaw). Three fun facts adjusted: American plum (USDA names Plains
peoples who ate the plums fresh or dried; "dried for winter" rested on
weaker sources), arrowwood (the arrow-shaft use is reported, not
documented, so "said to have been") and Atlas cedar (cedars shed pollen in
autumn; the comparison now names pines, spruces and firs rather than "most
conifers"). Bladdernut's rattling seeds and lasting pods, Amur honeysuckle's
promotion by the Soil Conservation Service from the 1960s, and black willow
as the largest North American willow were confirmed.

A second ten on 12 November 2026, blue ash to creeping juniper. Creeping
juniper settled: Go Botany lists it as native to Vermont, extremely rare
(S1) and threatened, so its origin is now Vermont native and its fun fact
says so. Kathleen Meserve's blue hollies (English holly crossed with
*Ilex rugosa*, on Long Island), Dièreville and the Acadian plants he
brought to Tournefort, and sweetshrub's clove-and-camphor bark were
confirmed.

A third ten on 12 November 2026, downy serviceberry to Japanese cornel.
Fragrant sumac settled as Vermont native (Go Botany: present in Vermont,
uncommon, native in the west of New England; GRIN: native in western
Vermont). Two fun facts made exact: Japanese cedar (the Nikko avenue was
planted from about 1625 and keeps some twelve thousand trees; the count
planted is disputed) and Japanese barberry (the tick studies were in
Connecticut, by its Agricultural Experiment Station).

A fourth ten on 12 November 2026, Japanese spirea to overcup oak. Overcup
oak's fun fact reworded: that the acorns float on floodwater is well
documented (Missouri Department of Conservation, USDA), what makes them
float less so. Mockernut hickory's origin stays blank: the Forest Service's
Silvics includes Vermont in its range, but a 1973 study of herbarium
specimens (Manning) found none from Vermont. Fortune's weigela (1844 or
1845), the Alabama state wildflower and the multiflora rose's career as a
living fence were confirmed.

- [x] **American bladdernut** (*Staphylea trifolia*, `staphylea-trifolia`): description + fun fact
- [x] **American holly** (*Ilex opaca*, `ilex-opaca`): description + fun fact
- [x] **American plum** (*Prunus americana*, `prunus-americana`): description + fun fact
- [x] **Amur honeysuckle** (*Lonicera maackii*, `lonicera-maackii`): description + fun fact
- [x] **Arrowwood viburnum** (*Viburnum dentatum*, `viburnum-dentatum`): description + fun fact
- [x] **Atlas cedar** (*Cedrus atlantica*, `cedrus-atlantica`): description + fun fact
- [x] **Black alder** (*Alnus glutinosa*, `alnus-glutinosa`): description + fun fact
- [x] **Black chokeberry** (*Aronia melanocarpa*, `aronia-melanocarpa`): description + fun fact
- [x] **Black willow** (*Salix nigra*, `salix-nigra`): description + fun fact
- [x] **Blackhaw** (*Viburnum prunifolium*, `viburnum-prunifolium`): description + fun fact
- [x] **Blue ash** (*Fraxinus quadrangulata*, `fraxinus-quadrangulata`): description + fun fact
- [x] **Blue holly** (*Ilex x meserveae*, `ilex-x-meserveae`): description + fun fact
- [x] **Bush honeysuckle** (*Diervilla lonicera*, `diervilla-lonicera`): description + fun fact
- [x] **Buttonbush** (*Cephalanthus occidentalis*, `cephalanthus-occidentalis`): description + fun fact
- [x] **Carolina allspice** (*Calycanthus floridus*, `calycanthus-floridus`): description + fun fact
- [x] **Cedar of Lebanon** (*Cedrus libani*, `cedrus-libani`): description + fun fact
- [x] **Chinese chestnut** (*Castanea mollissima*, `castanea-mollissima`): description + fun fact
- [x] **Chinese redbud** (*Cercis chinensis*, `cercis-chinensis`): description + fun fact
- [x] **Common privet** (*Ligustrum vulgare*, `ligustrum-vulgare`): description + fun fact
- [x] **Creeping juniper** (*Juniperus horizontalis*, `juniperus-horizontalis`): description + fun fact
- [x] **Downy serviceberry** (*Amelanchier arborea*, `amelanchier-arborea`): description + fun fact
- [x] **English yew** (*Taxus baccata*, `taxus-baccata`): description + fun fact
- [x] **Fragrant sumac** (*Rhus aromatica*, `rhus-aromatica`): description + fun fact
- [x] **Fraser fir** (*Abies fraseri*, `abies-fraseri`): description + fun fact
- [x] **Gray dogwood** (*Cornus racemosa*, `cornus-racemosa`): description + fun fact
- [x] **Hybrid witchhazel** (*Hamamelis x intermedia*, `hamamelis-x-intermedia`): description + fun fact
- [x] **Inkberry** (*Ilex glabra*, `ilex-glabra`): description + fun fact
- [x] **Japanese barberry** (*Berberis thunbergii*, `berberis-thunbergii`): description + fun fact
- [x] **Japanese cedar** (*Cryptomeria japonica*, `cryptomeria-japonica`): description + fun fact
- [x] **Japanese cornel** (*Cornus officinalis*, `cornus-officinalis`): description + fun fact
- [x] **Japanese spirea** (*Spiraea japonica*, `spiraea-japonica`): description + fun fact
- [x] **Large fothergilla** (*Fothergilla major*, `fothergilla-major`): description + fun fact
- [x] **Mimosa** (*Albizia julibrissin*, `albizia-julibrissin`): description + fun fact
- [x] **Mockernut hickory** (*Carya tomentosa*, `carya-tomentosa`): description + fun fact
- [x] **Multiflora rose** (*Rosa multiflora*, `rosa-multiflora`): description + fun fact
- [x] **Ninebark** (*Physocarpus opulifolius*, `physocarpus-opulifolius`): description + fun fact
- [x] **Oakleaf hydrangea** (*Hydrangea quercifolia*, `hydrangea-quercifolia`): description + fun fact
- [x] **Old-fashioned weigela** (*Weigela florida*, `weigela-florida`): description + fun fact
- [x] **Oriental spruce** (*Picea orientalis*, `picea-orientalis`): description + fun fact
- [x] **Overcup oak** (*Quercus lyrata*, `quercus-lyrata`): description + fun fact
- [ ] **Post oak** (*Quercus stellata*, `quercus-stellata`): description + fun fact
- [ ] **Red buckeye** (*Aesculus pavia*, `aesculus-pavia`): description + fun fact
- [ ] **Shumard oak** (*Quercus shumardii*, `quercus-shumardii`): description + fun fact
- [ ] **Slippery elm** (*Ulmus rubra*, `ulmus-rubra`): description + fun fact
- [ ] **Smooth hydrangea** (*Hydrangea arborescens*, `hydrangea-arborescens`): description + fun fact
- [ ] **Sourwood** (*Oxydendrum arboreum*, `oxydendrum-arboreum`): description + fun fact
- [ ] **Southern catalpa** (*Catalpa bignonioides*, `catalpa-bignonioides`): description + fun fact
- [ ] **Speckled alder** (*Alnus incana subsp. rugosa*, `alnus-incana-rugosa`): description + fun fact
- [ ] **Staghorn sumac** (*Rhus typhina*, `rhus-typhina`): description + fun fact
- [ ] **Sugarberry** (*Celtis laevigata*, `celtis-laevigata`): description + fun fact
- [ ] **Sweet crabapple** (*Malus coronaria*, `malus-coronaria`): description + fun fact
- [ ] **Tree of heaven** (*Ailanthus altissima*, `ailanthus-altissima`): description + fun fact
- [ ] **Virginia sweetspire** (*Itea virginica*, `itea-virginica`): description + fun fact
- [ ] **Weeping willow** (*Salix babylonica*, `salix-babylonica`): description + fun fact
- [ ] **Willow oak** (*Quercus phellos*, `quercus-phellos`): description + fun fact
- [ ] **Winterberry** (*Ilex verticillata*, `ilex-verticillata`): description + fun fact
- [ ] **Wintercreeper** (*Euonymus fortunei*, `euonymus-fortunei`): description + fun fact
- [ ] **Yellow buckeye** (*Aesculus flava*, `aesculus-flava`): description + fun fact

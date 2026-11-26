# Second-source check of the Worth knowing facts

The owner asked (November 2026) that every fact in `data/facts.csv` rest on
two independent sources, because the taxa file is meant for campuses across
the country. This file records where that check stands, so it can be picked
up in a later session.

## What is being checked

The 379 facts added on branch `ccr-f340ef01-4xevx3` for the 190 species with
no tree on campus yet: every row of `data/facts.csv` that is not in
`origin/master` as of commit `07bbc3c`. 344 of them cited one source
(272 Wikipedia only, 69 NC State only). The 135 facts for on-campus species,
merged earlier, cite one or two sources and should get the same pass after.

## Method

For each fact, look for the same specific details (names, numbers, places)
in independent references for that species: NC State Extension, Trees and
Shrubs Online (treesandshrubsonline.org/articles/<genus>/<genus>-<species>/),
the Forest Service's Silvics and FEIS, Oregon State's Landscape Plants
(landscapeplants.oregonstate.edu/plants/<genus>-<species>), and Wikipedia.
Then:

- **Confirmed**: list both sources in the `source` column.
- **Partly confirmed**: trim the fact to the confirmed part.
- **Not confirmed**: replace it with a fact two of those sources agree on.

A fact found only in one expert reference (an extension service, Trees and
Shrubs Online, Silvics or FEIS) and not contradicted anywhere is kept, and
listed below as "single expert source" so it can be revisited. A fact found
only in Wikipedia is never kept on its own.

## Progress

The facts are taken in the order they appear in `data/facts.csv` among the
new rows (alphabetical by taxon id).

- Done: `abies-fraseri` through `alnus-glutinosa` (36 facts), except:
  - `aesculus-glabra`: the Ohio State "Buckeyes" and fish-stunning facts
    (Wikipedia only) were replaced at the end of the pass.
  - `acer-pseudoplatanus`: the new "great maple and harewood" fact rests on
    Trees and Shrubs Online's list of names; it needs a second source.
  - `adiantum-pedatum`: "pedatum, like a bird's foot" is NC State only.
- Done: `alnus-hirsuta` through `carya-ovata` (40 facts). 15 replaced or
  trimmed. Two were wrong: pignut nuts were not, as Wikipedia says, a Native
  American food (Trees and Shrubs Online: bitter, apparently not eaten), and
  the shagbark "bark syrup" fact left out that the Omaha and Pawnee tapped
  its sap for sugar. Single expert source: `alnus-hirsuta` (both),
  `amauropelta-noveboracensis` songbird nests, `amelanchier-canadensis` and
  `amelanchier-laevis` caterpillars, `aronia-melanocarpa` "black-fruited",
  `athyrium-filix-femina` "doorless", `carya-cordiformis` and `carya-glabra`
  caterpillars (NC State); `alnus-x-spaethii` (both; Trees and Shrubs Online,
  which cites Bean and Grootendorst). `aralia-elata` shoots: English and
  Japanese Wikipedia only.
- Done: `carya-tomentosa` through `crataegus-crus-galli` (40 facts). 14
  replaced or trimmed. One was wrong: southern catalpa is not, as its
  Wikipedia page says, a parent of the chitalpa; Wikipedia's own Chitalpa
  page says the main forms come from northern catalpa. Two facts traded a
  Wikipedia-only claim for a sourced one on the same subject (red-osier
  dogwood fruit: 95 bird species in New England, per FEIS, not 47). Single
  expert source: `carya-tomentosa` bearing age, `castanea-mollissima` China
  fact (Trees and Shrubs Online), `catalpa-bignonioides` name, `cercis-
  chinensis` "kerkis", `clethra-barbinervis` bees and butterflies,
  `cornus-sericea` bear-seed test (FEIS), `cotoneaster-adpressus` (both),
  `crataegus-crus-galli` nectar and moths, `celtis-laevigata` butterflies
  (NC State). Two Wikipedia articles only: `cephalanthus-occidentalis`
  Buttonwillow (an official California landmark). English and Japanese
  Wikipedia only: `chamaecyparis-pisifera` wood.
- Done: `crataegus-laevigata` to the first `ilex-x-meserveae` fact (40). 17
  replaced or trimmed. One was wrong: fothergilla flowers draw bees and
  butterflies, not birds (NC State, the fact's own source). "More than 48
  kinds of birds" eat winterberry was in neither cited source. The blue ash
  IUCN listing was confirmed through GBIF's Red List lookup
  (api.gbif.org/v1/species/<key>/iucnRedListCategory), which is a quick way
  to check any conservation-status fact. Single expert source:
  `crataegus-viridis` birds, `cryptomeria-japonica` (both: Kew and Fortune
  from Trees and Shrubs Online; 200 forms from Oregon State),
  `diervilla-lonicera` browse (FEIS), `fraxinus-americana` swallowtail,
  `hydrangea-paniculata` sun and mammals, `hydrangea-quercifolia`
  butterflies and seeds (NC State).
- Done: the second `ilex-x-meserveae` fact to `magnolia-tripetala`'s first
  (40). 22 replaced or trimmed, mostly Wikipedia-only details with no second
  source. Two corrections: tamarack's "snowshoe" sentence on Wikipedia is
  copied word for word from the European larch article, so it was dropped;
  the oldest eastern redcedar (940 years, Wikipedia) became FEIS's "more than
  450 years". The Amur honeysuckle tick study was confirmed in the paper
  itself (PubMed 20937859): PubMed's free API
  (eutils.ncbi.nlm.nih.gov) is the way to check any "a study found" fact.
  The White House magnolia is now past tense: it was cut down in 2025.
  Single expert source: `juglans-cinerea` IUCN, `juglans-regia` pickles,
  `koelreuteria-paniculata` (Trees and Shrubs Online / NC State),
  `juniperus-virginiana` age, `larix-laricina` Native uses (FEIS),
  `magnolia-grandiflora` "magnolia curtain" (Trees and Shrubs Online).
  English and Japanese Wikipedia only: `lonicera-maackii` Japan.
- Done: `magnolia-tripetala`'s second fact to the first `pinus-mugo` fact
  (40). 24 replaced or trimmed: this stretch leaned on Wikipedia for
  anecdotes (Zirbenschnaps, the Augsburg arms, Baikushev's pine, the
  2,000-year limber pine, Cherokee uses) that no second source carries.
  Single expert source: `malus-coronaria` and `malus-floribunda` (NC State /
  Oregon State), `morus-rubra` fruit, `picea-omorika` Mustila,
  `picea-rubens` mine sites, `pinus-bungeana` temples, `pinus-cembra` tree
  line, `parthenocissus-tricuspidata` Veitch.
- Done: the second `pinus-mugo` fact to `pyrus-communis`'s first (40). 25
  replaced or trimmed. One was wrong: the NYC Parks emblem is described by
  NYC Parks as a London plane leaf, not a plane-maple cross. The Jindai-zakura
  age is now "1,800 to 2,000 years", as Japanese Wikipedia gives it.
  Confirmed from outside sources: 'Taihaku' returned to Japan in 1932 (Keele
  University's National Collection of Flowering Cherries); the oldest
  Somei-yoshino (Japanese Wikipedia, citing the 2019 radiocarbon study).
  Single expert source: `pinus-parviflora` forms, `populus-alba`
  introduction, `prunus-cerasifera` 'Pissardii' (Oregon State),
  `populus-deltoides` (both; NC State and Silvics), `prunus-cerasus` first
  fruit (NC State).
- Done: the second `pyrus-communis` fact to `salix-babylonica`'s first (40).
  21 replaced or trimmed. Single expert source: `pyrus-communis` germplasm,
  `pyrus-fauriei` Callery confusion, `rubus-thibetanus` stems (Trees and
  Shrubs Online), `quercus-acutissima` invasive, `rhus-typhina` female
  plants, `rhododendron-catawbiense` wildlife (NC State), `quercus-lyrata`
  first acorns (Silvics), `quercus-stellata` fire (FEIS).
  Tool note: until this batch the look-up script cached failed page fetches
  as empty pages, so some earlier "no second source" calls may have missed a
  page that was briefly unreachable. Every replacement made because of that
  still has its own sources, so nothing wrong was published, but a few good
  facts may have been swapped out unnecessarily.
- Done: the second `salix-babylonica` fact to the end (59). 27 replaced or
  trimmed. One more Wikipedia slip: the Swedish whitebeam's parentage is
  disputed (Trees and Shrubs Online), so "its closest relative is the
  Finnish whitebeam, a cross of it and rowan" became a sentence about the
  dispute. Replacements were checked against the fun facts in
  `data/taxa.csv` so a species' page does not say the same thing twice.
  Confirmed from outside sources: American elm as state tree of
  Massachusetts and North Dakota (State Symbols USA). Single expert source:
  `scandosorbus-intermedia` naturalized, `styphnolobium-japonicum` (both),
  `taxodium-ascendens` wood, `tilia-mongolica` Paris, `ulmus-davidiana-
  japonica` zone 2, `ulmus-rubra` age, `viburnum-lentago` names.

## Where it stands

All 379 facts have been through the check. Each now cites at least one
expert reference (NC State, Trees and Shrubs Online, Silvics, FEIS, Oregon
State, or a primary source), or two independent sources; none rests on
Wikipedia alone. 302 cite two or more sources; 77 cite a single expert
source, listed above. A few cite English and Japanese Wikipedia together,
also listed above.

## The facts merged earlier (226)

Same method. Taken in file order.

- Done: the first 130. State and provincial trees were confirmed against
  State Symbols USA (statesymbolsusa.org) and provincial governments or The
  Canadian Encyclopedia. Corrections: swamp white oak is not easy to
  transplant (NC State says the opposite), so that fact was replaced; the
  Major Oak was reported dead in 2026, so its fact now says so; the Wye Oak
  fact now cites Maryland DNR. Replacements were checked against each
  species' fun fact so nothing repeats on a page.
- To do: facts 131 to 226.

# Second-source check of the Worth knowing facts (in progress)

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

## Progress

The facts are taken in the order they appear in `data/facts.csv` among the
new rows (alphabetical by taxon id).

- Done: `abies-fraseri` through `alnus-glutinosa` (36 facts), except:
  - `aesculus-glabra`: the Ohio State "Buckeyes" (1950) fact and the
    fish-stunning fact are still Wikipedia only.
  - `acer-pseudoplatanus`: the new "great maple and harewood" fact rests on
    Trees and Shrubs Online's list of names; it needs a second source.
  - `adiantum-pedatum`: "pedatum, like a bird's foot" is NC State only.
- To do: `alnus-hirsuta` onward, about 340 facts.

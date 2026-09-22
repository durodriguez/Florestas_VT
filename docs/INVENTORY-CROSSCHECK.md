# The two inventories disagree about 165 trees

The university has been inventoried twice. The 2014 walk-through
(`public/field/reference.csv`, 2,502 tagged trees) and the ArcGIS mapping of
2023–24 (`data/plants.csv`) were done by different people, nine years apart.
**950 tags appear in both.**

Nothing had ever compared what the two say about those 950. The ArcGIS import
does check for species conflicts, but only against rows already in
`plants.csv`, and at import time that file held **six**. Five trees were
compared; one was flagged. The other 945 comparisons were never made.

```
npm run check:inventories            # the summary and the disagreements
npm run check:inventories -- --all   # also the harmless ones
npm run check:inventories -- --csv   # data/species-disagreements.csv, to take into the field
```

## What it found

| | | |
| --- | ---: | ---: |
| In both files, so comparable | 950 | |
| The two agree | 711 | 74.8% |
| One is simply more specific | 74 | 7.8% |
| **They disagree** | **165** | **17.4%** |

Of the 165, **53 disagree about the genus** — a spruce against a fir, not a
close call — and **112 about the species** within an agreed genus.

The 74 in the middle row are the reason this check needed care. 2014 often
records "Cherry" where ArcGIS says *Prunus sargentii*, and "Oak-English" where
ArcGIS says the 'Fastigiata' cultivar. Nobody is wrong. Counting those as
conflicts would have reported 240 and buried the 165 that matter, so
`compareTaxa()` walks genus → species → infraspecific → cultivar and treats a
rank only one side names as silence rather than contradiction.

## Most of it is 16 arguments, not 165

**90 of the 165 are one of sixteen pairs, repeated:**

| Trees | The map says | 2014 said |
| ---: | --- | --- |
| 14 | Swamp white oak | Bur oak |
| 11 | Littleleaf linden | European linden |
| 8 | Paper birch | River birch |
| 7 | Colorado blue spruce | White spruce |
| 7 | American basswood | European linden |
| 6 | River birch | Paper birch |
| 5 | Bur oak | Swamp white oak |
| 4 each | Sweetgum / Northern red oak / Northern red oak / Freeman's maple / American sycamore | Black tupelo / Pin oak / Scarlet oak / Red maple / London planetree |
| 3 each | Douglas fir / Baldcypress / Red maple / White spruce | Balsam fir / Dawn redwood / Silver maple / Norway spruce |

They run in blocks of consecutive tags — nine of those eleven lindens are
UVM-1047 through UVM-1064, and eight of the paper birches are UVM-1477 through
UVM-1485 — which is what a planting looks like when one surveyor
labelled the whole row one way and the other labelled it the other. **Settle
the pair at one tree and the rest of the row goes with it.**

Every pair on that list is also a genuinely hard call in the field: bur against
swamp white oak, paper against river birch, red against scarlet against pin
oak, sycamore against London plane. That is the shape of two careful people
disagreeing, not of one being careless.

## Some of them are probably not the same tree

Disagreement rates by what the 2014 sheet said the tree was:

| Age class in 2014 | Compared | Disagree | |
| --- | ---: | ---: | ---: |
| Young | 336 | 85 | **25.3%** |
| New planting | 31 | 7 | 22.6% |
| Semi-mature | 306 | 43 | 14.1% |
| Mature | 274 | 31 | **11.3%** |

A young tree is more than twice as likely to disagree as a mature one. Some of
that is that saplings are harder to name — but nine years is also long enough
for a 2-inch sapling to die and be replaced, with the tag moving to whatever
was planted in its place. **UVM-1699 is exactly that shape**: a 2-inch young
white fir in 2014, a white spruce on the map now.

The mature ones cannot be explained that way. A 32-inch tree in 2014 is still
there. **UVM-2553** (northern red oak on the map, scarlet oak at 32 inches in
2014) and **UVM-1679** (blue spruce now, an 18-inch white spruce in 2014) are
disagreements about a large, long-lived, unmistakable tree, and one of the two
files is simply wrong about it.

So the report carries the 2014 diameter, age class and condition on every row.
Without them a disagreement cannot be read.

## It does not change any record

Neither file is authoritative. 2014 was slower and done on foot; ArcGIS is
newer and was mapped at speed. Picking a winner in bulk would be inventing
certainty that nobody has.

It also does not write observations. An observation is a record that somebody
went and looked on a given day, and adding 165 of them dated today would say
that a survey happened that did not. The report is a worklist, and the
worklist is the honest artifact.

`--csv` writes `data/species-disagreements.csv`, sorted worst-first, with both
claims and the 2014 measurements beside them. That file is regenerated, never
hand-edited.

## One thing it did fix

The check reported UVM-0231 as a **genus** disagreement: Alaska cedar on the
map, Nootka falsecypress in 2014. They are the same tree. The species has moved
between *Chamaecyparis*, *Xanthocyparis*, *Cupressus* and *Callitropsis*, and
`taxa.csv` was carrying two of those names as two separate taxa.

That is a bug in this project's own data, not a disagreement between the
inventories, and it split four trees' identity depending on which source had
named them. `chamaecyparis-nootkatensis` is gone; both of its names are now
aliases of `callitropsis-nootkatensis`.

A sweep for other taxa sharing a species epithet across genera found no second
case — the rest are ordinary Latin, *alba* and *nigra* on a dozen unrelated
trees.

## What to do with it

1. Take `data/species-disagreements.csv` into the field, worst first.
2. Start with the sixteen repeated pairs — one tree each settles most of a row.
3. Prioritise the mature trees. They cannot be explained by replanting, so one
   of the two files is wrong, and a mature tree is the easiest to name.
4. Record what is found as an ordinary observation, through the field app, on
   the day it is looked at.

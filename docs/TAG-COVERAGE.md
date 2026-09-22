# What became of the 2014 tags

The 2014 inventory tagged **2,502 trees**, numbered 1 to 2555. Only **950** of
those numbers are on the map. That looks like catastrophic loss, and the first
job is to find out whether it is.

```
npm run check:coverage           # the accounting, and the gaps worth walking
npm run check:coverage -- --csv  # data/coverage-gaps.csv
```

## The accounting

| The 2014 side | |
| --- | ---: |
| Tagged in 2014, numbers 1–2555 | 2,502 |
| On the map today | 950 |
| **Missing from the map** | **1,552** |

| What the map holds instead | |
| --- | ---: |
| Carrying a 2014 number | 950 |
| Carrying a real metal tag above 2555 | 399 |
| Carrying no readable tag at all | 703 |
| | **2,052** |

Those 703 are numbered `UVM-4001` and up. **That block is this project's own
invention**, issued by the importer to trees with nothing on the trunk. They
are not tags in the 4000s and nobody will find one stamped on a tree.

The 399 are different: real metal, numbered above anything 2014 issued, so put
on the trees by somebody between 2014 and 2023.

## How much could renumbering explain?

| | |
| --- | ---: |
| Missing 2014 tags | 1,552 |
| Trees that could be a renumbered one, at most | 1,102 |
| **Left over even then** | **450** |

That ceiling assumes every new tag and every untagged tree is a 2014 tree in
disguise, which is certainly too generous. **So at least 450 of the 2014 trees
are not on the map under any number**, and the true figure is higher.

## One thing is settled

**Map tags inside 1–2555 that 2014 never issued: zero.**

Every legacy number on the map is a number 2014 used. Nothing was quietly
renumbered *within* the old range — whatever happened, it did not scramble the
original sequence. The check prints this figure every run, and if it ever stops
being zero that conclusion has to be revisited.

## The missing tags are not scattered

They form **332 runs of consecutive numbers**. 891 of the 1,552 — **57%** — sit
in a run of ten or more. Only 161 are an isolated single number. The longest
run is **192 consecutive tags, 1101 through 1292**.

A tag can fall off one tree. It does not fall off 192 in a row. So the long
runs are a stretch nobody walked, or a block that never reached the export —
not tag loss, and not renumbering either.

## Different parts of campus tell different stories

| Area | 2014 tag | New tag | Untagged | Not traceable to 2014 |
| --- | ---: | ---: | ---: | ---: |
| Central | 478 | 135 | 225 | 43% |
| Athletic | 292 | 80 | 210 | 50% |
| Redstone | 146 | 104 | 226 | **69%** |
| Trinity | 34 | 80 | 42 | **78%** |

The old green keeps most of its numbering. Redstone and Trinity have largely
lost theirs. Trinity is also the area whose boundary was only just corrected,
and the one that carries the Ira Allen School frontage — it has been rebuilt
around more than the centre of campus has.

## The species of the missing say which story applies

For each gap the report names what the 2014 sheet said those trees were, and
that single column separates the causes:

- **Tags 809–818** — ten missing numbers between two trees **11 metres apart**.
  In 2014 they were one white spruce and nine paper birches, every one 2 inches
  and young. Ten saplings in eleven metres is a nursery row, or a single
  clump-form birch whose stems were each given a tag in 2014 and counted once
  in 2023. That is not eleven lost trees.
- **Tags 674–710** — 37 missing, **100% young** in 2014. A young planting that
  did not survive its first decade reads exactly like this.
- **Tags 1101–1292** — 192 missing across **33 species**, mostly mature. No
  planting looks like that. That is somebody's afternoon route.

So the 1,552 are at least four different things — removals, lost tags,
renumbering, and campus that was never walked — in proportions that vary by
area, and the committed data cannot separate them tree by tree.

## Why it cannot be settled at a desk

`public/field/reference.csv` has **no coordinates**: `Tree`, `Common_Name`,
`Botanical`, `DBH`, `Age_Class`, `Condition` and nothing else. So a missing
2014 tag cannot be matched to a nearby untagged tree by position, which is the
one comparison that would settle it.

Matching by size is out too — the ArcGIS layer carries no trunk diameter for
UVM trees, which is the same gap that blocks [to-do #7](TODO.md) on i-Tree.

**Two things would change that**, and both are somebody's to ask for rather
than something to compute:

- **A 2014 source file with coordinates**, if one exists. The copy in this
  repository may be a reduced export of something richer.
- **Anything in the ArcGIS layer this import did not read.** It takes
  `OBJECTID`, `Species`, `Tag_ID`, `GlobalID`, `Health`, `CreationDate` and the
  geometry. If the layer also carries a comment or previous-tag field, that is
  the answer sitting in a column nobody has looked at.

## The cheap way to settle it

The report ranks gaps by missing numbers per metre of path — the most
unanswered questions for the least walking:

| Gone | Tags | Between | Apart | Area | 2014 called them |
| ---: | --- | --- | ---: | --- | --- |
| 10 | 809–818 | #808–#819 | **11 m** | central | mostly paper birch, nearly all young |
| 59 | 1943–2001 | #1942–#2002 | 95 m | redstone | 16 spp, mostly Norway maple |
| 13 | 2212–2224 | #2211–#2225 | 22 m | athletic | 4 spp, mostly hackberry |
| 80 | 912–991 | #911–#992 | 145 m | central | 10 spp, mostly red oak, nearly all young |

Walk one and read the trunks:

- **Tags in the 2556+ range** → renumbering, and the hypothesis is confirmed.
- **Bare trunks** → the tags came off and the trees are still there.
- **No trees** → they were removed, and the 2014 file is a record of what used
  to be on campus.

Eleven metres answers the first question. That is the whole experiment.

## What this is not

It changes no record and writes no observation. It cannot: nothing here
establishes what happened to any individual tree, only what the shape of the
loss looks like in aggregate. Findings come back through the field app like any
other survey.

## The one confirmed case

Tree **105** wears tag **3497** today — a number squarely in the new-tag range.
It was surveyed in November 2023 under its *old* number, so that re-tagging
happened afterwards, and there is no `UVM-3497` on the map.

It is proof that UVM re-tags trees, which is what makes this hypothesis worth
testing. It is not proof that the 1,552 went that way, because the 2023 survey
already predates it. See [to-do #13](TODO.md) — the conversation with grounds
is the same conversation.

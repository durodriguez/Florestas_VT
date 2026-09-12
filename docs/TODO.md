# To-do

Recorded 11 September 2026, from a list you sent. Nothing here is built yet —
this file exists so none of it gets lost. Each item has the ask, then what I'd
suggest and what it would cost.

Roughly in the order I'd do them: 6 is small and independent, and 4 is a
writing job more than a coding one. 8 and 9 are entangled with each other and
with the ArcGIS import, so they want one design decision rather than two. 7 and
10 are the big ones.

**1, 2, 3, 5 and 11 are done** — marked below.

---

## 1. Rename `memorial`, add `dedication_label` — ✅ done, 11 September 2026

**Ask.** `plants.csv`'s `memorial` column should cover gift, dedicated and
memorial trees generally, marked `yes` or blank. A second column holds the note
— "in memory of John Dewey", "A gift from the class of 1985", "Dedicated to xyz".

**Built.** `memorial` became a single `dedication_label` column. A tree is a
gift, memorial or dedicated one exactly when somebody has written down what its
plaque says.

It shipped first as a flag *plus* a label, on my recommendation. You pushed
back, and you were right: I had already made the label imply the flag, so the
flag's only unique contribution was one rare, temporary state — and it cost a
constant, a validation rule, a consistency warning, boolean coercion across
four spellings, and five tests. Two columns that must agree are where a
hand-edited CSV drifts. The rare state is better said in the label itself:
*"Gift of the class of 19??, rest illegible"* says what was seen and why.

What the simplification costs: a source with a yes/no `memorial` column, mapped
onto this one, would put "Yes" on a public record as plaque wording. Both the
build and the importer refuse a label that is only a boolean word.

Searching the map by plaque wording works: "John Dewey" finds the linden.

## 2. Dedication in the survey app — ✅ done, 12 September 2026

**Ask.** The surveyor should be able to tick that a tree is a gift/memorial/
dedicated tree and write a note about it.

**Built.** A *This tree has a plaque* tickbox reveals a field for what it says,
using the same show-on-demand pattern as the species-mismatch flag, so the form
does not grow for the 95% of trees with no plaque. It prompts for a
transcription rather than a summary: transcription is a reliable field task and
summarising is not.

The tickbox is pure UI state and is never stored — with one column, a tree is
dedicated exactly when the wording is filled in. That makes two behaviours
necessary rather than optional:

- **Ticked with an empty field refuses to save.** It would record nothing at
  all, and the surveyor's finding would vanish between the phone and the CSV.
  The message says so and suggests what to type instead.
- **Unticking clears the field**, so wording typed and then dismissed cannot
  leak into the export.

The saved list marks a tree carrying a plaque, so it is visible without opening
the record.

## 3. `geolocation_notes`, right of `lng` — ✅ done, 11 September 2026

**Ask.** Rename the `notes` column and move it to the right of `lng`. (You
chose `geolocation_notes` over my suggested `coordinates_notes`.)

**Built.** Because to-do 11 had already moved `notes` onto `observations.csv`,
this was an *add* rather than a rename: `plants.csv` gains
`geolocation_notes` immediately after `lng`, and the six existing remarks —
all positional — moved into it.

The split I flagged when recording this is now real. The field app writes both
columns from one form: GPS accuracy and whether the pin was moved go to
`geolocation_notes`, and everything the surveyor typed or flagged goes to the
observation's `notes`. So "leaning badly" and "GPS ±3 m" no longer share a
column.

`geolocation_notes` is not shipped to the browser at all, which settles the
first half of to-do 6 for free: "Position set by pin on imagery" no longer
appears on the public record, because it never reaches it.

## 4. A "fun fact" column — undecided

**Ask.** Either in `taxa.csv` (generic to the species) or in `plants.csv`
(specific to the tree). Still deciding.

**Suggestion.** Both, and they are different things, which is why the choice
feels hard:

- `taxa.csv` → `fun_fact`. One line per species, written once, shown on every
  tree of that species. 257 rows to fill, but it is library work you can do at a
  desk, and it pays off ~2,500 times over.
- `plants.csv` → something like `story`. This tree, this spot. "Planted by the
  Class of 1902." "The oldest ginkgo in Vermont." Almost always blank, and each
  one has to be found individually — but these are the ones people remember.

If you only want one now, take the `taxa.csv` one: it is bounded, you can write
it without leaving your desk, and it makes every marker on the map more
interesting immediately. The per-tree stories can arrive later as a column added
to a file that already exists.

Both need a source rule, or the map ends up asserting folklore. I'd write it
down: fun facts are horticultural or historical, and anything about a specific
UVM tree needs someone who can vouch for it.

**Cost.** Column: trivial. Filling 257 fun facts: a day of writing, and — as
with the trait fill — expect roughly one in six to need a botanist's correction.

## 5. Species autocomplete in the survey app — ✅ done, 11 September 2026

**Ask.** Typing a few digits of a tag auto-populates; typing a species name does
not. It should, from `taxa.csv`, for the many trees with no tag.

**Built.** The species box suggests from `taxa.csv` as you type and records the
`taxon_id`, not just the text — so the importer has nothing left to resolve.
Both names search, part-words match ("sug map" finds sugar maple), aliases are
searchable, and equally good matches are ranked by how many of that species are
already mapped. Free text still saves and is flagged in the notes.

Two things worth knowing, both found by driving the real app rather than by
reasoning about it:

- Typing a species' **full correct name** without tapping a suggestion counts
  as picked. The first version told you *Metasequoia glyptostroboides* was not
  on the list, when it is.
- A name **two taxa share** is not a match. "Swedish whitebeam" is both
  *Sorbus intermedia* and *Sorbus hybrida*, and only the surveyor can say
  which, so the app asks instead of choosing.

The list is `public/field/species.json`, ~38 kB, cached on the device for
offline use, and versioned so a phone picks up a new one rather than serving
its first copy forever.

## 6. Finalise the detail panel

**Ask.** The look is right; the contents need deciding. Two specifics:
"position set by pin on imagery" should not appear — irrelevant to most users.
And `arboretum@uvm.edu` is a placeholder that needs to be a real address.

**Suggestion.** The positioning line is **already gone** — to-do 3 moved it to
`geolocation_notes`, which is never sent to the browser.

Beyond that, I'd propose the panel earns its space in this order: species and
common name; the photo; what makes this tree interesting (dedication, story, fun
fact); what it is (type, origin, mature size); measurements, if any; then
provenance (surveyed date, campus) in small type at the bottom. Right now
measurements sit higher than they deserve, given that almost no tree has any.

The email is yours to choose — but it should be a shared mailbox, not a person.
Whoever is answering these in 2029 is not whoever set it up.

**Cost.** Small once the content decisions are made. The decisions are the work.

## 7. Ecosystem services — the i-Tree question

**Ask.** Purdue and Missouri both show carbon sequestered, air pollution
removed, avoided runoff, and a dollar value. Missouri says "Powered by i-Tree"
(<https://www.itreetools.org/>). How hard would this be here?

**Short answer.** The software is the easy part. The data is the blocker, and
right now it is total.

**How it actually works.** i-Tree Eco is a USDA Forest Service model. Per-tree
benefits are a function of **species + trunk diameter (DBH) + location**, with
crown and condition refining it. Location sets the local climate, pollution
concentrations and rainfall; species sets growth rate and leaf area; DBH sets
the size, and it dominates — a 30-inch oak does not do twice the work of a
15-inch one, it does roughly four times. Those tables are published, and both
sites you looked at are showing precomputed numbers, not calling a live service.
Nothing about a static site prevents doing the same: `npm run data` computes a
number per tree at build time, and the map just displays it.

**The blocker.** Of six plants in `data/plants.csv`, **none** has a DBH. Without
DBH there is no calculation — not a rough one, not a defaulted one. Any number
shown would be invented, which is worse than showing nothing on a page with
UVM's name on it.

**So the order is:**

1. Capture DBH during survey. The field app already has the box; it needs to
   become expected rather than optional, and the ArcGIS data should be checked
   for a DBH field before anyone re-measures 2,000 trees by hand.
2. Once a real fraction of trees have DBH, add the calculation.
3. Show benefits only on trees that have one, plus a campus-wide total that
   says how many trees it covers. "2,061 trees sequester X" when 300 have been
   measured is a fabrication; "the 300 trees measured so far sequester X" is a
   fact, and a better argument for finishing the survey.

**Three ways to get the numbers,** cheapest first:

- **Export to i-Tree and import the results.** Run the inventory through i-Tree
  Eco (free, desktop), get benefits back per tree, store them as columns.
  Authoritative, zero modelling on our side, and the honest answer to "where did
  this number come from". Downside: a manual step to repeat after each survey.
- **Implement the published coefficients ourselves.** A species-group × DBH
  lookup, done at build time. Fully automatic, but it is our arithmetic, and
  getting a species group wrong is a silent error.
- **i-Tree API.** Check whether the current API suits a batch build step; it is
  designed around interactive use, and a build that depends on someone else's
  uptime is a build that breaks on a Tuesday.

I'd go with the first, and say "Powered by i-Tree" the way Missouri does,
because it would actually be true.

**Cost.** The display and the build step: a day or two. The DBH survey: months
of fieldwork, unless UVM's data already has it.

## 8. Matching surveyed trees to untagged mapped trees

**Ask.** Once the sustainability office data is in, many mapped trees will have
no tag. A surveyor standing in front of a tree needs to match it to one of them.
Open to suggestions.

**Suggestion.** Match on **position**, not identity — position is the one thing
the surveyor and the map both have.

In the field app, when GPS has a fix and no tag has been entered, list the
nearest unsurveyed mapped trees within ~20 m, nearest first, each showing
distance, species and direction. Tap one to claim it; the record carries that
tree's id instead of creating a new one. Species acts as a tiebreak, not a
filter — three maples at 8, 11 and 14 m is the common case, and the surveyor
looking at the trees is better placed to pick than any sorting rule.

Three things this needs to get right:

- **An explicit "none of these — new tree".** Phone GPS under a canopy is
  routinely 5–10 m out, and the map's own positions are imperfect. A flow that
  assumes the tree must be in the list will silently merge two trees into one,
  which is the one error that is genuinely hard to undo later.
- **Claims are provisional until import.** Two surveyors on the same afternoon
  can claim the same tree. Let the import detect it rather than the app trying
  to prevent it; it already has the machinery for conflicts.
- **Distance in metres and a compass bearing**, not a map pin. Reading "7 m
  northeast" beats interpreting a blue dot at arm's length in sunlight.

This wants the mapped trees bundled into the PWA the same way as #5 — do the
two together, since they share the plumbing.

**Cost.** Medium-large — the most intricate item after #7, because the failure
mode is data corruption rather than an ugly screen. Two or three days, and it
needs a real test on campus before it is trusted.

## 9. Renumbering tags by campus

**Ask.** `CTR0001` Central, `CNT0001` Centennial, `RST0001` Redstone, `ATH0001`
Athletic, `TRT0001` Trinity, `SST0001` Spear Street — matched back to the legacy
`UVM-0001` numbers.

**Suggestion.** Two things make this cheaper than it looks and one makes it
riskier.

Cheap: `npm run areas` already derives the campus from coordinates by
point-in-polygon, so the prefix is **generated, never typed** — no one decides
which campus a tree is in, and no one can get it wrong. Generating the numbers
is an afternoon.

Also cheap: keep `UVM-0001` as its own column, permanently. The legacy numbers
are stamped into metal on the trees. Whatever the database calls a tree, the
tag on its trunk still says `UVM-0762`, and a surveyor must be able to type that
and find it — for as long as those tags are on those trees, which is decades.
So: new id as the key, legacy id as a searchable second column, both shown.

The risk: a tree's campus can change. Not often, but boundaries get redrawn, and
a tree near a line can land on the other side of it. If the id encodes the
campus, either the id becomes wrong or the tree gets renumbered — and a
renumbered tree breaks every link, bookmark and QR code pointing at it. The
identifier should be permanent; the campus is already a column that can change
freely.

**My honest recommendation:** the campus prefix is genuinely useful in the
field, where knowing a number's campus at a glance saves time. But treat it as a
**label**, not the primary key — the URL, the QR code and the database key stay
on a number that never changes, and the campus code is displayed alongside it.
You get the readability without betting the permalinks on a polygon.

If you'd rather the prefixed number be the real id, that is a defensible call —
but then decide *now* what happens when a boundary moves, because deciding later
means deciding it while something is already broken.

**Cost.** Generating them: an afternoon. Deciding what is permanent: worth a
conversation before anything is generated.

## 10. Photos without overloading the repo

**Ask.** Photos of trees, ideally in different seasons, without the repository
becoming unmanageable.

**Suggestion.** Sizing first, because it decides everything: 2,500 trees × 4
seasons = 10,000 photos. At phone-camera size (~4 MB) that is 40 GB, which is
impossible. At 1600 px web size (~250 KB) it is 2.5 GB — still too much for a
normal Git repo, which starts hurting around 1 GB and where *every version of
every photo is kept forever*.

Realistically:

- **A gallery is not the goal; one good photo per tree is.** 2,500 × 250 KB =
  600 MB. Seasons multiply it by four for a feature most visitors will use on a
  handful of trees.
- **Store photos outside Git.** An institutional bucket (UVM ETS almost
  certainly has one), or a CDN, with the repo holding only filenames. This is
  what I'd push for: it separates "data that changes" from "images that
  accumulate", and it is the only option that still works at 10,000 photos.
- **Git LFS** is the middle road — photos versioned alongside the data, but
  GitHub's LFS quota is small and paid, and it complicates every clone. Fine for
  hundreds, not thousands.
- **Committing resized photos directly** is fine for a few hundred and becomes
  irreversible pain later, because rewriting history to remove them breaks every
  existing clone.

Whichever way: **resize on capture, in the field app, before the photo is ever
saved.** 1600 px on the long edge, stripped of EXIF except the coordinates. Not
doing this at the source is the decision that cannot be undone.

Seasonal photos, if you want them, are then a column of filenames per season
rather than a different storage system — worth designing for now even if only
one photo per tree is ever filled in.

**Cost.** Field-app resizing: half a day, and worth doing before the next survey
regardless of where the files end up. Storage: depends entirely on what UVM can
offer, which is worth asking about in the same conversation as the ETS request.

## 11. Updating the data over time — ✅ done, 11 September 2026

**Ask.** The system handles a one-time inventory well. It needs to support an
inventory in 2026, an update in 2028, and keeping the history.

**Built.** `plants.csv` now holds identity only — what a tree is and where it
stands. Every measurement moved to `data/observations.csv`, one row per plant
per visit, append-only. The map shows each plant's most recent observation, so
nothing about it looks different; the detail panel grows a **Survey history**
section once a plant has been visited twice, with a line saying how much the
trunk grew between the first and last measured visit.

The importer no longer overwrites anything measured: a re-survey appends an
observation, and only a correction to the tree's *identity* touches
`plants.csv`. Re-importing the same export is refused, because the tree already
has an observation on that date.

Two things fell out of it worth knowing:

- A plant with **no observations at all** is now a valid, normal record — a
  tree somebody plotted but nobody has surveyed. That is most of what the
  ArcGIS import will hand us, and it would have needed inventing otherwise.
- Removal is a final observation with `status: removed`, not an edit. The
  tree's whole life stays readable, which is what makes a "trees we have lost"
  view possible later.

Still open, deliberately: `status` is derived from the latest observation
rather than cached on `plants.csv`. Deriving cannot drift; caching would make
"show me the removed trees" a one-file lookup. Worth revisiting only if that
query gets slow, which at 2,061 rows it will not.


---

## Also outstanding (not code)

- **Permission from `ecamire@uvm.edu`** before the 2,061 ArcGIS records go into
  `data/` or get published. Hard blocker — that data is access-controlled.
- **Tag 762** needs an in-person check: 13 m position disagreement and a species
  conflict (recorded *Quercus michauxii*; ArcGIS says swamp white oak).
- **Botanist review** of the authored descriptions and traits in `taxa.csv`.
- **Official UVM V mark** from UVM Communications.
- **ETS request** for `arboretum.uvm.edu/explorer/`.

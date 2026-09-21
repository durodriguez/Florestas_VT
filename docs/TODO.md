# To-do

Recorded 11 September 2026, from a list you sent. Nothing here is built yet —
this file exists so none of it gets lost. Each item has the ask, then what I'd
suggest and what it would cost.

Roughly in the order I'd do them: 7, 10 and 12 are the big ones.

**1, 2, 3, 4, 5, 6, 8 and 11 are done** — marked below. **10 is part done.**

The ArcGIS import landed on 21 September 2026 and moved three of these: it
settled the numbering question at the heart of **9**, it left **7** blocked for
the same reason as before (2,052 trees and still not one trunk diameter), and
it makes **12** more attractive, because the campus now has enough trees on it
for Burlington's street trees to sit beside rather than carry.

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

## 4. A "fun fact" column — ✅ done, 12 September 2026

**Ask.** Either in `taxa.csv` (generic to the species) or in `plants.csv`
(specific to the tree). Still deciding.

**Built.** Both, because they are two different things — which is what made the
choice feel hard.

- `taxa.csv` gets **`fun_fact`**: one line about the species, written once and
  shown on every one of that species on campus. All 257 are filled in.
- `plants.csv` gets **`story`**: one line about an individual tree. Blank
  everywhere today, deliberately — a story about a specific UVM tree needs
  someone who can vouch for it, and inventing one would be exactly what the
  source rule forbids.

The source rule is written down in `docs/DATA-MODEL.md`, because no validator
can check whether a fact is true. A fun fact is horticultural or historical and
checkable; a story needs a person or a record behind it; and blank is a
perfectly good answer. `npm run data` polices the one thing a machine can — a
240-character cap, so neither column becomes a second description.

**On accuracy.** All 257 facts were authored here. Seven were spot-checked
against published sources and two needed correcting — the Hiroshima ginkgos are
a kilometre or two from the blast, not within a mile, and the Tidal Basin story
belonged to the Yoshino cherry rather than to Japanese flowering cherry. That is
worse than the roughly one-in-six measured on the horticultural columns, and it
is the expected direction: facts carrying dates and numbers are easier to get
slightly wrong. Worth a read-through by someone who knows the subject before
this goes public.

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

## 6. Finalise the detail panel — ✅ done, 18 September 2026

**Ask.** The look was right; the contents needed deciding. Specifically:
"position set by pin on imagery" should not appear, and the contact address
needed to be real.

**The address.** `campustrees@uvm.edu`, deliberately not `arboretum@`: a UVM
arboretum has not been discussed or approved, so the map should not assert the
name anywhere a reader can see it. Three other places carried the word and were
changed with it — the mailto subject line (which arrived in a reader's inbox as
"Arboretum record UVM-0493", and is now derived from `siteName` so the two
cannot drift apart), the Export CSV filename, and the survey app's browser tab.

The address is a **placeholder and does not yet receive mail**. A visitor who
writes in gets a bounce rather than silence, but the correction is lost either
way. Worth revisiting when a real mailbox exists — it is one line in
`data/config.json`.

**Still open, deliberately:** `config.json`'s `publicUrl` is
`https://uvm.edu/arboretum`. That is what QR codes encode and what gets stamped
into metal labels, so it asserts the same unapproved name somewhere far more
permanent than a page string — and it does not resolve. The honest placeholder
would be the GitHub Pages URL, which works today.

**The panel.** The positioning line went with to-do 3. The rest:

- **"This specimen" reordered** around what someone standing under the tree
  actually wonders: Location, Condition, Planted (with age), then the
  measurements, then Last surveyed and Coordinates as provenance. Measurements
  used to sit above condition and age despite almost no tree having any.
- **Coordinates stay**, last, at six decimals.
- **"On campus: N mapped plants" stays**, and the button below it shrank from
  "See all N Littleleaf linden" to **"Show all"** — the row above already says
  what and how many.
- **Notes came off**, and not only off the panel: an observation's `notes` is
  now internal, absent from `plants.json` entirely and dropped as a column from
  the map's Export CSV. Not sending it is a stronger guarantee than filtering
  it, and a downloaded file travels further than a panel row does.

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

**Since the ArcGIS import (21 September 2026):** the tree count went from 6 to
2,052 and the blocker did not move. The ArcGIS layer records a position, a
species and a health rating, and **no trunk diameter at all**. The 2014
inventory does hold a DBH for 950 of these trees, joinable by tag — but those
measurements are twelve years old, and DBH is the input i-Tree is most
sensitive to, so stale numbers would produce confident-looking wrong answers.
Deliberately left out of the import; worth revisiting only as its own decision.

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

## 8. Matching surveyed trees to untagged mapped trees — ✅ done, 21 September 2026

**Ask.** Once the sustainability office data is in, many mapped trees will have
no tag. A surveyor standing in front of a tree needs to match it to one of them.

**Built.** Leave the tag box empty and, once there is a fix, the survey app
lists the mapped trees within 25 m — nearest first, as "3 m northeast" with the
species. Tap one and the record becomes a visit to that tree rather than a new
accession; the species is seeded from the map's record to confirm or correct.

`public/field/trees.json` carries the mapped trees to the phone, cached for
offline use and versioned, exactly as the species list is.

The three things the note said this had to get right:

- **"None of these — it is a new tree"** is a button, not a fallthrough.
- **Claims are provisional until import.** Two surveyors claiming the same tree
  on the same day collide on the `(plant_id, surveyed_on)` rule that came out of
  to-do 11 — verified, and it needed no new code.
- **Metres and a compass point**, not a map pin.

Two departures from the recorded suggestion, both deliberate:

- **All nearby trees are offered, not only the unsurveyed ones.** Filtering by
  survey state would have made re-surveying an untagged tree impossible, since
  proximity is the only way to find one. Surveyed trees are offered and labelled.
- **A claim does not move the tree.** The export carries the position the map
  already has, and leaves `geolocation_notes` blank so the existing one
  survives. Standing three metres away is not evidence about where a tree is,
  and without this every claim would quietly drag a curated position onto a
  footpath — once per visit, invisibly. Dragging the pin onto the crown is the
  deliberate act that says the map is wrong, and then the surveyor wins.

**Worth knowing:** with six mapped trees this is hard to exercise for real. It
comes into its own with the ArcGIS import, which is what it was built for.
It still wants a genuine test on campus before it is trusted.

## 9. Renumbering tags by campus

> **Now live, not hypothetical.** The ArcGIS import issued numbers for 2,046
> trees on the rule below: a tagged tree keeps the number stamped on its tag,
> and the ~700 untagged ones were issued from a block starting `UVM-4001`. So
> the legacy numbers are already the primary key and already permanent, which
> is what this item recommends. What is left is the *label* — showing a
> campus-prefixed form alongside the accession — and that is still worth doing
> and still cheap.


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

## 10. Photos without overloading the repo — partly done, 21 September 2026

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

**Built so far.**

- **The field app resizes on capture** — 1200 px on the long edge, WebP where
  the phone can encode it and JPEG otherwise, at quality 0.72. That is the
  decision that cannot be undone, so it is made. A survey photo now lands at
  roughly 120 KB instead of 4 MB. One correction to what I said earlier: WebP
  came out about **10%** smaller than JPEG on a real survey photo at matched
  quality, not the 40–60% I first claimed. Don't plan storage around the big
  number.
- **Photos can live anywhere** — `photoBaseUrl` in `data/config.json`. Empty
  means "beside the site, in `photos/`", which is what happens today. Set it to
  a UVM address and every photo is fetched from there instead, with no code
  change and nothing in the repository but filenames. A filename that is
  already a full `https://` address is used as-is, so one collection can mix
  sources.
- **A page per species**, which is the Purdue-style explorer. See below.

**Species pages.** `npm run data` writes a static page for every taxon into
`public/species/<taxon-id>/index.html`, plus an index at `public/species/`.
They are plain HTML with one shared stylesheet: no JavaScript, readable by a
search engine, and fast on a phone in a field. Nothing on them is newly
authored — every word is already in `taxa.csv`.

Each page carries the description and fun fact, a characteristics table that
shows **only the facts that are recorded** (a species with no bark note shows
no bark row, rather than an em dash that reads as "somebody looked and found
nothing"), any campus photos of that species with the accession they came
from, and how many are mapped and on which campus. The map's detail panel
links out to it, and the page links back to the map filtered to that species,
so the two halves are a loop.

They are generated, not committed — `public/species/` is in `.gitignore`, the
same arrangement as the QR labels. The URLs are `/species/tilia-cordata/`,
which is what would be handed to UVM as-is if the site ever moves to a
university address.

**Still open.** Where the photos actually live. SharePoint is ruled out (the
`:f:` share link is a folder *view* with no file path to append, it is
auth-gated and CORS-blocked, the token expires, and a personal OneDrive is
tied to one person's account — it would break the day you leave). What is
wanted is a plain public folder on a UVM web host, which is the ETS
conversation. Multiple photos per species also still needs a place to put them:
today a page shows the photos taken of *mapped trees* of that species, which is
one per surveyed tree, not a curated seasonal set.

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


## 12. Burlington's street trees, inside the campus boundary

**Ask.** Take the Burlington tree inventory, keep the trees that fall inside the
campus boundary, and show them on the map — **off by default**, behind a filter
checkbox. They are not part of the UVM inventory and must stay visibly separate,
but being able to look up the trees along Main Street or College Street is worth
having. Any species not already in `taxa.csv` would need adding.

**On the name.** Of your two, *City Trees* beats *BTV Trees* — BTV is the
airport code and locals' shorthand, and half this map's audience is a visiting
parent who has never seen it. But I would go further and call it **Burlington
street trees**: it says both whose they are and what they are. These are
right-of-way trees, which is precisely why they line Main and College, and
"street trees" tells a visitor why the campus lawns are empty of them.

**Keep them in their own file.** `data/city-trees.csv`, merged into
`plants.json` at build time with a `source` field, rather than rows in
`plants.csv`. Two independent reasons land on the same structure:

- `plants.csv` means *the UVM collection*. Accession numbers, QR labels and the
  survey workflow all assume it. `npm run labels` must never print a label for a
  tree the university does not own, and `npm run import` must never renumber
  one. A separate file makes that impossible rather than merely discouraged.
- The licence points the same way (below).

They should still be real `Plant` objects in the runtime dataset, though —
search, the detail panel, deep links and clustering all work on those, and
looking up a Main Street tree *is* the feature. What changes is that they
default to hidden, draw differently, and carry no accession.

**Numbering.** Keep Burlington's own id with a prefix — `BTV-12345` — never a
`UVM-` number. A UVM accession implies UVM stewardship and a QR label on the
trunk, and once issued it is permanent.

**Licence — check before building.** The Burlington-area inventories in UVM's
FEMC archive are **CC BY-SA 4.0**, not public domain. Attribution is easy and we
would want to credit them anyway. ShareAlike is the part to think about: it
requires derivative works to carry the same licence, and how far that reaches
into a combined dataset is genuinely murky for data-plus-software. Keeping the
city data in its own file, attributed, with its licence recorded next to it, is
the structure least likely to create a problem — which is the same structure the
editorial argument already wanted. Worth confirming which source the CSV came
from (the FEMC archive and Burlington's own BTVstat / Navigate Burlington portal
may carry different terms) and asking whoever at UVM handles licensing.

**Clipping.** The machinery exists: `campusAt()` in `scripts/lib/geo.mjs` is the
same point-in-polygon test `npm run areas` uses. One caveat that matters here —
a right-of-way tree sits in the strip between the pavement and the kerb, and
whether that is inside the traced boundary depends on whether the boundary was
traced to the property line or the street centreline. **The trees you most want
are exactly the ones most likely to fall just outside.** Expect to clip to the
boundary *plus a buffer* of a few metres, and to eyeball the result along Main
Street before trusting it.

**Species coverage is measurable before committing.** `npm run check:species`
already reports resolution against `taxa.csv` for any CSV. Run it on the clipped
subset first. Two things known from the full city file: the best-resolving
column is `botanic`, not `species` (which holds things like `ash,gr patmore`),
and over a thousand rows are `Malus spp` — genus-level, which resolves to
`malus-sp` and should stay genus-level rather than being guessed at. The clipped
subset should score better than the whole city did, since street trees near
campus are the common ones.

**Make the separation visible, not just structural.** A city tree on the map
must not look like a UVM tree — a different marker (hollow rather than filled
reads well at a glance), and a detail panel that says plainly it is a City of
Burlington street tree, outside the UVM collection, with no accession and no QR.

**Watch the counts.** `taxa[].count` drives "N mapped plants" on every record
and the unreferenced-taxa warning in the build. Decide whether city trees count
toward it — I would say no by default — or the map will quietly start
overstating the size of the university's collection.

**Record the snapshot.** Burlington's inventory has its own survey dates and
will drift from ours. Note where the file came from and when it was downloaded,
and expect to refresh it rather than maintain it.

**Cost.** Medium. The clip, the merge and the filter are each small and the
species check is a script that exists. The work is in the decisions above and in
verifying the clip along the streets you actually care about.

---

## Also outstanding (not code)

- ~~**Permission from `ecamire@uvm.edu`**~~ — **resolved, 21 September 2026.**
  Erin Camire, who did the survey as a UVM undergraduate, has since graduated;
  permission to use the data is in hand and the layer is imported. See
  [ARCGIS-IMPORT.md](ARCGIS-IMPORT.md). Her email is *not* carried into the
  repository: the `Creator` and `Editor` columns are dropped on import, and the
  credit lives in the docs instead.
- **Tag 762** needs an in-person check: 13 m position disagreement and a species
  conflict (recorded *Quercus michauxii*; ArcGIS says swamp white oak). The
  import now records this on the tree's 2023 observation, so it is in the data
  rather than only in this list.
- **15 more tags need an in-person check** — 8 numbers found on two different
  trees, 7 the surveyor could not read (`1818 or 1942`). `grep 'TAG ' data/observations.csv`
  lists them.
- **10 ArcGIS records did not import** — 8 need identifying, 2 need a position.
- **Botanist review** of the authored descriptions and traits in `taxa.csv`.
- **Official UVM V mark** from UVM Communications.
- **ETS request** for `arboretum.uvm.edu/explorer/`.

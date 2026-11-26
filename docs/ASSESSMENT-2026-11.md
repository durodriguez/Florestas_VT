# UVM Trees: where it stands, and what would make it better

*An assessment written 26 November 2026, at the owner's request. Nothing in the
data, code or pages was changed to write it.*

**How to read this.** Sections 1 to 3 describe what is in the repository today,
and every number in them was counted from the repository on 26 November 2026:
from `data/*.csv`, from the output of `npm run data`, from
`docs/SPECIES-PROGRESS.md`, and from running the tests (`npx vitest run`).
Sections 4 and 5 are **suggestions**: my opinions, not facts about the repo.

---

## The short version

You have built something much larger than a campus tree map. It is a complete
small system: a public map, a page for every species, a field guide for people
walking on campus, two walking tours, a phone app for surveying trees, a console
for grounds staff, desk tools for fixing positions and boundaries, and a data
pipeline that refuses to publish bad data. It is well tested and unusually well
documented, and it costs nothing to run.

Its biggest gaps are not in the software. They are in the **data about the
trees themselves** (fewer than half have a trunk size, 17 have a height, 51
have a photo), in **a few things that must be settled before it goes on a UVM
address** (contact email, web address, who can open the staff console, licensing
sign-off), and in the fact that **updating it still needs someone comfortable
with GitHub**. To use it at other campuses, the main job is to separate the
parts that are about trees in general (species pages, facts, range maps), which
any campus could reuse, from the parts that are about UVM.

---

## 1. What the project is and does today

### The numbers

| | Count | Where it comes from |
|---|---|---|
| Plants in the inventory | **2,155** (2,146 standing; the rest removed or not found) | `npm run data` |
| Survey visits on record | **3,290**, and 1,024 plants have been visited more than once | `data/observations.csv` |
| Plants with a trunk size measured | **996** (about 46%) | `data/observations.csv` |
| Plants with a height measured | **17** | `data/observations.csv` |
| Plants with a photo taken on campus | **51** | `data/observations.csv`, `public/photos/` |
| Burlington street trees shown inside the campus boundary | **358**, all with i-Tree benefit estimates | `data/city-trees.csv`, `data/itree-city-trees.csv` |
| Species, hybrids, cultivars and genera in the species list | **419** (about 128 of them on campus, about 290 not yet mapped) | `data/taxa.csv`, `docs/SPECIES-PROGRESS.md` |
| Species pages | **419**, plus an index and a progress page | `npm run data` |
| Species pages with every item filled | **250 of 418** scored (92% of all items filled) | `docs/SPECIES-PROGRESS.md` |
| Description and fun fact | on all **418** species rows | `data/taxa.csv` |
| "Worth knowing" facts | **640**, covering 320 species; 523 cite more than one source | `data/facts.csv`, `docs/FACT-CHECK.md` |
| Photos of bark, leaves, flowers and fruit (linked, not stored) | **1,069**: 609 from iNaturalist, 460 from Wikimedia Commons | `data/part-photos.csv` |
| Native range maps | **172** | `data/ranges/` |
| Crown shapes recorded | **264** species | `data/crown-forms.csv` |
| Habitat notes | **333** species | `data/habitat.csv` |
| Other names people use for a species | **286** | `data/species-aliases.csv` |
| Walking tours | **2** (*Giants of the Green*, 10 stops; *Native or not*, 12 stops) | `data/tours.csv`, `data/tour-stops.csv` |
| Campus areas | 6 collections (Central 891 plants, Athletic 594, Redstone 514, Trinity 156) | `data/plants.csv` |
| Tree tops found in LiDAR, for the position editor | **8,284** | `data/crown-peaks.csv` |
| Automated tests | **803, all passing**, in 55 test files (run took about 3 seconds) | `npx vitest run` |
| Data checks | `npm run data` passed with 2 warnings (one fun fact is 251 characters, over the 240 limit; 275 species are on no tree yet, which is expected) | `npm run data` |
| Project documentation | 23 documents in `docs/`, about 7,800 lines | `docs/` |
| Changes recorded | 907 commits; 513 of them in November 2026 alone | `git log` |

**Who surveyed the trees** (from `data/observations.csv`): 2,051 visits by Erin
Camire (2023–24 ArcGIS layer), 934 from UVM's 2014 inventory, 154 recorded with
the field app (initials EMR), and 120 from the 2022 Dendrology class.

### The main parts

- **The map** (`/`). Every tree, shrub and vine, searchable and filterable by
  campus, type, family, origin, condition, size, flowering month and dedication.
  Trees can be colored by type, origin, condition, area, **season** (what each
  tree is doing this month) or **how long ago it was measured**. Each tree's
  record shows its measurements with their dates, its "notable" status (largest
  of its kind, only one on campus, and so on, worked out live from the data),
  walking directions and a share button. Burlington's street trees can be
  switched on as a separate layer. QR labels can be printed for any tree.
- **Species pages** (`/species/`). One plain web page per species, built ahead
  of time so they load fast on a phone and can be found by search engines. Each
  has a drawing to scale beside a person, the newest campus photo, a
  description, facts, a month-by-month calendar, a native range map, photos of
  each part, where it grows on campus, and a table of characteristics.
- **The field guide** (`/fieldguide/`). The same trees for someone standing
  among them: a full-screen map in this month's colors and up to four trees
  nearby "worth the walk", with the reason and the distance.
- **Walking tours.** Two tours, each shareable by link or QR code.
- **The field survey app** (`/field/`). Installs on a phone, works offline,
  checks GPS accuracy, takes photos, and exports a file the importer reads.
- **The steward console** (`/steward/`). For grounds staff and planners: how
  complete the inventory is, collection health (including the 10-20-30
  diversity guideline and pest exposure), worklists, a planting plan, exports,
  and a review inbox for survey files (built, but switched off).
- **Desk tools.** A boundary tracer (`/tracer/`), a position editor
  (`/positions/`, with LiDAR tree tops to snap to) and an image calibration
  tool (`/imagery/`).
- **The data pipeline.** Spreadsheets (`data/*.csv`) are the master copy. One
  command checks every row and builds the site's files; bad data stops the
  build. Importers exist for field-app files, the UVM ArcGIS layer, the city's
  street-tree file and position corrections. Every change goes through GitHub,
  so every change has an author and a date and can be undone.
- **Publishing.** Every change to the main branch rebuilds and publishes the
  site on GitHub Pages automatically (`.github/workflows/deploy.yml`), and every
  push is checked first (`.github/workflows/ci.yml`). I did not check whether the
  live site is up; that would have needed the network.

---

## 2. Strengths

1. **It refuses bad data.** The build checks every row and stops on a mistyped
   coordinate or an unknown species, and the importers do a dry run first and
   write nothing if any row has a problem. This is the most important property
   a long-lived inventory can have.
2. **It is honest about what it knows.** Every measurement shows its date and
   age, the map can show how old the measurements are, "notable" claims wait
   until enough trees have been measured, hand-drawn boundaries are labelled as
   estimates, and the city's trees are kept apart from UVM's. Many inventories
   quietly present 10-year-old numbers as current; this one does not.
3. **History is kept, not overwritten.** A re-survey adds a visit rather than
   replacing the old one (3,290 visits for 2,155 plants), and removed trees keep
   working from their old QR labels.
4. **It costs nothing and has very little to break.** No server, no database,
   no accounts, no API keys, two main code libraries. It would run from any web
   host, and the README's aim, that a student could pick it up in an afternoon
   and it still builds in five years, is realistic.
5. **It is well tested.** 803 tests, all passing, plus checks on every push.
6. **The species content is unusually good for a campus site.** 419 pages, 92%
   complete, with descriptions, 640 facts that were checked against a second
   source (`docs/FACT-CHECK.md`), range maps for North America, Europe and East
   Asia, and properly credited photos of each part of the tree.
7. **It is built for phones outdoors.** Fast static pages, an offline field app,
   "near me", a field guide that picks trees around you, and QR labels.
8. **It serves three audiences from one set of data**: visitors (map, species
   pages, field guide, tours), surveyors (field app) and grounds staff
   (steward console, worklists, exports), and they can never disagree because
   they read the same files.
9. **The paperwork is excellent.** Every decision, data source, licence and open
   question is written down in plain language (`docs/`, `data/SOURCES.md`).
   Someone taking this over would not be guessing.
10. **Unusual extras**: season coloring, champion-tree points, LiDAR tree tops
    for fixing positions, i-Tree benefit estimates for the city trees, and a
    cross-check against the 2014 inventory that lists every disagreement.

---

## 3. Weaknesses and risks

### Gaps in the tree data (the biggest weakness)

- **Most trees have no measurements.** 996 of 2,155 have a trunk size; only 17
  have a height; 51 have a photo taken on campus. Champion points, "tallest"
  and "widest crown" claims, and any future benefit estimates for UVM's own
  trees all depend on these.
- **Known errors waiting for fieldwork** (`docs/TODO.md`): 165 trees where the
  2014 and 2023–24 inventories disagree about the species (item 14); 1,552 of
  the 2014 tags not on the map (item 15); the Redstone white pine grove mapped
  in the wrong places (item 19); tag 762 and 15 other tags needing an in-person
  check; 10 ArcGIS records that did not import.
- **Campus boundaries are hand-drawn estimates** until someone traces them with
  `/tracer/` (`docs/CAMPUS-AREAS.md`).
- **Dedications and stories are thin**: 6 dedications and no tree stories yet
  (the dawn redwood's story is waiting on permission, per `docs/TODO.md`).

### Gaps in the species pages (`docs/SPECIES-PROGRESS.md`)

- 168 of 418 pages have a gap. Most often missing: bark photo (85 pages), the
  three "worth knowing" facts (74), fruit photo (66), flower photo (65), leaf
  photo (37). `docs/PHOTO-GAPS.md` still has 12 unticked lines.
- 16 pages for plants that **are** on campus have gaps, mostly cultivars such
  as Green Giant arborvitae and Tom Thumb cotoneaster.
- The scale drawing on each page is generated by code and, in your own words
  in `docs/TODO.md` item 25, "looks rough". The illustrated-plate replacement is
  waiting on your go-ahead.
- One fun fact (taxa row 170) is 251 characters, over the 240 limit; the build
  warns about it.

### Content accuracy

- The descriptions and fun facts in `taxa.csv` were rewritten in September 2026
  "from general knowledge and not checked against sources"
  (`docs/SPECIES-TEXT-REVIEW.md`). Every box in that review file is now ticked,
  but `docs/TODO.md` ("Also outstanding") still lists a **botanist review** as
  not done. It is worth confirming which is true: the ticks show the claims were
  checked, but not that someone who knows the trees has read them.
- The *Native or not* tour went on the map before anyone walked it
  (`docs/TOUR-DRAFTS.md`).

### Fragile parts and outside dependencies

- **Photos and map tiles come from other people's servers.** The 1,069 part
  photos are loaded from iNaturalist and Wikimedia Commons, and the map tiles
  from OpenStreetMap and Esri's free services, which expect modest traffic.
  If any of them changes its rules (as CARTO did in August 2026, per
  `docs/DEPLOY.md`), pages lose photos or the map loses its background. Wikimedia
  already throttles this project's scripts.
- **Updating needs GitHub.** Every change, including a day of field surveys,
  goes through a programmer-style workflow. The review inbox that would let
  staff approve survey files in a browser is built but switched off
  (`docs/STEWARD.md`).
- **The steward console is not locked.** Anyone with the address can open it
  (`docs/DEPLOY.md`, handover checklist).
- **Placeholders before going on a UVM address** (`docs/DEPLOY.md`): the contact
  email `campustrees@uvm.edu` does not exist yet, `publicUrl` must be final
  before any QR labels are printed, ShareAlike licensing needs a UVM sign-off,
  and the ETS request for `arboretum.uvm.edu` is outstanding.
- **The README is out of date.** It says 2,060 plants, 257 species and 364 city
  trees; the build today reports 2,155, 419 and 358. Small, but it is the first
  thing a newcomer reads.

### Maintenance burden

- **A lot to look after for one person.** Seven separate tools (map, species
  pages, field guide, field app, steward console, tracer, position editor,
  imagery), about 24,000 lines of code and scripts, and about 7,800 lines of
  documentation. The pace of November (513 commits) shows how much is being
  added; the risk is that more is built than anyone can keep checked.
- **Some single files are very large**: the field app's main file is 2,154
  lines and the position editor's 1,120, which makes them harder for the next
  person to change safely.
- **Generated status in documents**: `SPECIES-PROGRESS.md` is regenerated, but
  most other status lives in hand-written documents (TODO.md alone is 1,489
  lines), which can drift from the data, as the README already has.

### What would block use at other campuses

- **One repository holds both the reusable part and the UVM part.** The species
  library (`taxa.csv`, facts, ranges, part photos, crown forms, habitats,
  aliases) is useful to any campus in the country; the plants, campus areas,
  tours, city-tree layer and photos are UVM's. Today another campus would have
  to copy everything and delete UVM, then could not easily receive later
  improvements to the species pages.
- **UVM and Burlington are written into the code in places.** `data/config.json`
  already holds the name, prefix, map centre and bounds, which is a good start,
  but UVM, Vermont or Burlington appear in 31 source files (many only in
  comments), and some features are Vermont-specific: the "Vermont-invasive"
  origin (18 species), the Burlington street-tree layer and its i-Tree file, the
  six UVM campus names, and the ArcGIS importer built for UVM's layer.
- **Range maps cover 172 of 419 entries**, from Little's atlas (US trees) and
  European and Asian sources; species common at southern or western campuses
  would need more.
- **"Native" means native to Vermont.** Another campus needs "native to here".
- **Getting started requires a developer** (npm, git, the command line).

---

## 4. Ideas to make it even better (suggestions)

Ranked by value to visitors against effort. "Effort" is a rough guess: *small*
is an evening or a session, *medium* a few sessions, *large* weeks.

### Quick wins

| # | Idea | Value | Effort | Why |
|---|---|---|---|---|
| 1 | **Fix the README numbers, and have the build write them** | Medium | Small | The first page anyone reads should be right; generating the numbers stops it drifting again. |
| 2 | **Shorten the one long fun fact** | Low | Small | Clears the build's only content warning. |
| 3 | **"Did you know…?" card on the map** (TODO item 21) | High | Small | You already have 640 checked facts and the data to count things like "27 ginkgos on campus"; it makes the first visit memorable. |
| 4 | **Third tour, plus a seasonal one** (e.g. spring bloom, fall color) | High | Small | Tours are the most visitor-friendly feature and there are only two; the season data already says what is worth seeing each month. |
| 5 | **Walk the *Native or not* tour once** and fix any stop | Medium | Small (an hour outdoors) | It is live but unwalked; a wrong tree on a tour is the most visible kind of error. |
| 6 | **A "most wanted photos" list on the site** asking visitors to post to iNaturalist | Medium | Small | Turns the 85 missing bark photos into something students can help with; the process in `PHOTO-GAPS.md` already exists. |
| 7 | **Lock or hide the steward console properly** before the UVM launch | Medium | Small | Removes the one exposure on the handover list. |

### Bigger ideas

| # | Idea | Value | Effort | Why |
|---|---|---|---|---|
| 8 | **A measuring push with a student crew** using the basic field app (TODO item 18) | Very high | Medium (build) + fieldwork | Trunk size on the other ~1,150 trees, heights and photos unlock champion points, "tallest" claims, real worklists and benefit estimates. Dendrology classes already contributed 120 visits in 2022. |
| 9 | **Switch on the review inbox** (TODO item 22) | High | Medium | Lets a grounds staff member approve a day's survey in a browser, so the site no longer depends on one person who knows GitHub. |
| 10 | **i-Tree benefits for UVM's own trees** (TODO item 7) | High | Medium, after item 8 | "Campus trees store X tons of carbon and are worth $Y a year" is the number administrators and visitors quote; it is already done for the city trees. |
| 11 | **Split the species library from the campus data** | Very high for other campuses | Large | Make the species pages, facts, ranges and photos one shared library, and each campus a small folder of its own trees, areas, tours and settings. This is the key step toward a national version. |
| 12 | **A "new campus" starter**: a settings file plus an importer for a plain spreadsheet (species, latitude, longitude) | High for other campuses | Medium, after 11 | Most campuses have a spreadsheet or an ArcGIS layer; a generic importer and a "native to this state" setting would let one be running in a day. |
| 13 | **Host the part photos with the site** instead of linking them | Medium | Medium | Removes dependence on Wikimedia and iNaturalist servers and the throttling problem; needs care with credits and a decision on repository size (TODO item 10). |
| 14 | **Field-guide illustrations** (TODO item 25) | High (looks) | Medium | Replaces the rough drawings; needs your go-ahead and a check that the image generator's terms allow publishing. |
| 15 | **Tree Campus Higher Education and ArbNet accreditation** (TODO items 23, 24) | High (recognition) | Medium, mostly paperwork | The inventory, tours and labels already cover much of what they ask for; recognition helps the case for the UVM domain and for other campuses. |
| 16 | **Stories and dedications**: a simple way for alumni and staff to send a tree's story | Medium | Medium | Only 6 dedications and no stories yet; stories are what people remember and share. |
| 17 | **Accessibility and language check** (screen readers, color-blind-safe colors, a Spanish version of species pages) | Medium | Medium | Widens the audience, and universities increasingly require it. |
| 18 | **Simple, privacy-friendly visit counts** | Medium | Small | Without them there is no way to know which features visitors use, which makes it hard to choose what to build next or to make the case to UVM. |
| 19 | **Lighten the maintenance load**: pause new tools, split the largest files, and keep status in generated pages rather than long documents | Medium (long-term) | Medium | Keeps the project something a student can actually take over. |

**If I had to pick three:** the measuring push (8), switching on the review
inbox (9), and splitting the species library from UVM's data (11). The first
makes the map richer for visitors, the second makes it sustainable, and the
third is what makes the national version possible.

---

## 5. Decisions only you can make

1. **The UVM launch:** the final web address (before any labels are printed),
   the contact email, and whether to pursue ETS hosting now.
2. **Who checks the text:** is the species-text review finished, or does a
   botanist still need to read it?
3. **Who updates the site after you:** whether to switch on the review inbox,
   and who at UVM would approve survey files.
4. **The steward console:** public-but-unlinked, or behind a login?
5. **Photos:** keep linking to Wikimedia and iNaturalist, or host the photos
   with the site (and accept a larger repository)?
6. **The survey crew:** whether to build the basic field app and recruit
   students or a class for a measuring push, and when.
7. **The illustrations:** go-ahead (or not) for the field-guide plates, and the
   prompt.
8. **Other campuses:** whether to split the species library into its own shared
   project now, before more UVM-specific features are added, and which campus
   to try second.
9. **Scope:** whether to pause new tools for a while and put the effort into
   data and polish.

---

*Method: counts from `data/*.csv` (Python, read only), `npm run data` and
`npx vitest run` on a fresh clone of `master` at commit `6e4f133`. Running the
build left the tracked files unchanged. No network was used apart from git; no
Wikimedia Commons traffic.*

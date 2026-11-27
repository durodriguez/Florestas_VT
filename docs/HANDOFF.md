# Picking up the project

A note for whoever opens this repository next, person or Claude session. It
says where things stand, how the owner likes to work, and what is worth doing
next. Written 26 November 2026, at the end of a long session.

## Where things stand

- **The site:** a map of 2,155 plants (2,146 shown), 419 species pages, a
  field guide, two walking tours, an offline field-survey app, a steward
  console and desk tools. `npm run data` builds it; `npx vitest run` runs the
  803 tests, all passing. See [README.md](../README.md).
- **The full review:** [ASSESSMENT-2026-11.md](ASSESSMENT-2026-11.md) covers
  strengths, weaknesses, risks, 19 ranked ideas and the owner's open decisions.
  Read it before planning new work.
- **Recently finished (November 2026):**
  - Every species page has three *Worth knowing* items; so does every genus
    page. 640 facts in `data/facts.csv`, all checked against a second source,
    none resting on Wikipedia alone ([FACT-CHECK.md](FACT-CHECK.md)).
  - Range maps for North America, Europe, Japan and Korea (172).
  - Ginkgo's *Where it grows wild* rewritten from the International Biological
    Flora account.
- **Decided, not to be reopened without the owner:**
  - **No China range maps and no ginkgo map.** Range maps are drawn only from
    public sources; data that has to be requested from authors is out
    ([SPECIES-PAGES.md](SPECIES-PAGES.md), East Asia section).

## How the owner works

- **The owner is not a programmer.** Explain in plain words, briefly, without
  jargon. Say what changed on the site, not which files.
- **Nothing is merged until the owner says so** ("merge it"). Work on a branch,
  push it, and report; then open a pull request and merge it with a merge
  commit only on that word.
- **Scope:** only UVM Trees work belongs here (see [CLAUDE.md](../CLAUDE.md)).
  Ask where anything else should go.
- **Reliability first.** The species material is meant for campuses across the
  country, so every fact needs a source, and preferably two independent ones.
  - A fact may rest on one *expert* source (an extension service, Trees and
    Shrubs Online, Silvics, FEIS, Oregon State, or the original study), never
    on Wikipedia alone.
  - Check new facts against their sources after writing them, and check them
    against the species' fun fact in `data/taxa.csv` so a page never says the
    same thing twice.
  - Facts are at most 240 characters; fun facts too.
- **Photos:** clean, natural close-ups of the plant only; no hands, coins,
  rulers or other objects in the frame.
- **Licences:** the project is educational and non-commercial; openly licensed
  material that fits may be used, with credit.

## Working gently with outside sites

- **Wikimedia Commons throttles this project.** Check only the photos you
  changed: `npm run check:photos -- <taxon_id>`. Ask about many files in one
  request, wait a few seconds between requests, and back off when refused.
  A full photo check is for occasional audits only.
  ([SPECIES-PAGES.md](SPECIES-PAGES.md), "Adding photos".)
- Morton Arboretum, eFloras, Dryad and Wiley pages are blocked from cloud
  sessions; NC State, Trees and Shrubs Online, the Forest Service (Silvics,
  FEIS), Oregon State, GBIF, PubMed and Wikipedia's raw pages are reachable.
- **Scheduled sessions** (set up from a chat) cannot push to this repository
  unless the repository is added to the scheduled task's sources. Schedule in
  the owner's time zone (Vermont, `America/New_York`), and check the date: it
  is easy to be a day off near midnight UTC.

## What to do next

0. **Know it by, in progress (26 November 2026).** The section now takes
   written tiles: any part, two photos side by side, a prose note.
   243 species are done, most planted first; the method, the book it
   follows and the list of what is left are in
   [KNOW-IT-BY.md](KNOW-IT-BY.md). To find the next species, list those with
   four photos and no rows in `data/know-it-by.csv`, by campus count.

From the assessment and the progress reports, roughly in order of value:

1. **Owner decisions** listed in section 5 of the assessment: the final web
   address and contact email, locking the steward console, whether a botanist
   still needs to read the species text, hosting photos, and pausing new tools.
2. **Quick wins:** a "Did you know…?" card on the map, a third and a seasonal
   tour, walking the *Native or not* tour once, a "most wanted photos" list.
3. **Species pages:** 74 pages still lack three *Worth knowing* items, almost
   all cultivars and varieties, which show only their own fun fact. The
   owner has been offered two routes and not chosen: write facts for them, or
   show the species' facts on each cultivar page, labelled as the species'.
   Missing part photos are listed in
   [SPECIES-PROGRESS.md](SPECIES-PROGRESS.md) and [PHOTO-GAPS.md](PHOTO-GAPS.md).
4. **Single-source facts:** 145 facts rest on one expert source; they are
   listed in [FACT-CHECK.md](FACT-CHECK.md) if a second source is wanted.
5. **Bigger work:** a student measuring push, the review inbox, and splitting
   the species library from UVM's own data (assessment, section 4).

The long list of planned work is [TODO.md](TODO.md).

## Default method (owner's standing rule, November 2026)

Everything written about plants is drafted from memory first, then checked
against several sources (not one site) and revised; see CLAUDE.md. In
November 2026, 989 of the 1,113 Know it by notes cited NC State alone,
because they were written by reading NC State's pages first. They are
all being redone by the default method, the species most planted on
campus first: not only those citing NC State, but every note written
before the rule, since all of them began from a source page (Trees and
Shrubs Online, Silvics, FEIS and Oregon State as well). A note redone this
way keeps its row; its text, source and source_url change. Progress: the
redone species are listed in KNOW-IT-BY.md, "Redone by the default
method".

Paused 27 November 2026 at the owner's request, unmerged on the session
branch: 123 species (468 notes) redone, 187 species (669 notes) left. The
next in line are acer-tataricum, acer-truncatum, adiantum-pedatum and the
buckeyes. Order: most trees on campus first, then alphabetical.

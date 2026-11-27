# Know it by rewrite tools

Small helpers used in November 2026 to redo the Know it by notes by the
default method (CLAUDE.md): draft from memory, check against several
sources, revise. They are working aids, not part of the build. Scratch
files go to `$KIB_WORK` (default `/tmp/kib`). Run from the repository root.

| Tool | What it does |
| --- | --- |
| `next.py [n]` | How many species are left, and the next `n` in order (most trees on campus first, then alphabetical). "Done" is read from docs/KNOW-IT-BY.md, "Redone by the default method". |
| `ctx.py id ...` | For each taxon: what the notes must not repeat (description, fun fact, Characteristics, facts) and its tiles (label, parts). Read this, not the old note text, before drafting. |
| `fetch.sh "id\|morton-slug\|silvics-slug\|feis-path" ...` | Caches Morton Arboretum, Trees and Shrubs Online, Silvics and FEIS pages as text. Morton slugs are guesses from the common name; a 3,888-byte file is Morton's not-found page. Oregon State: `get.sh osu-<id> https://landscapeplants.oregonstate.edu/plants/<id>`. |
| `ev.sh id [extra-regex] [n]` | Pulls the sentences about bark, leaves, flowers, fruit and so on from the cached pages, to check a draft against. |
| `redo.py notes.json` | Replaces text, source and source_url of existing rows, keyed by taxon and parts: `[{"t":id,"p":parts,"x":text,"s":sources,"u":urls}]`. |
| `commit.sh "id id ..."` | Lists the species as redone in docs/KNOW-IT-BY.md, rebuilds, tests, commits and pushes. Set `KIB_TRAILER` to the commit trailer lines your session requires. |
| `append.py rows.json` | Adds new Know it by rows (a fourth tile). |
| `cands.py` / `rows.sh` | iNaturalist candidate photos as a contact sheet; `pick.py key idx taxon part "matches"` adds one. |
| `ovcands.py key "query" 20` | Openverse candidates (Flickr and Commons, licenses we accept). Anonymous use: 20 results at most, about one search a minute; it waits and retries. |
| `ncphotos.py slug` | Lists an NC State Plant Toolbox entry's photos with credit and license, to find photos to trace to their originals. |

Each batch: `next.py 6`, `ctx.py` the six, draft every note from memory,
`fetch.sh` and `ev.sh` to check, revise (cut what no source bears out; cite
the sources that confirmed it, never one site by habit), `redo.py`,
`commit.sh`.

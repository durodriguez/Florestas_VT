# The field survey app

An installable web app at **`/field/`** on the same site as the map. It records
one tree at a time — tag, species, position, measurements, photo — stores
everything on the phone, and exports a CSV that `npm run import` reads.

There is no server and no account. Nothing leaves the device until you export.

## Installing it

Open `<your site>/field/` in Chrome on Android, then **⋮ → Add to Home screen**.
It then launches full-screen like any other app and works with no signal.

Load it once on wifi before going out: that first load is what caches both the
app and the 2014 tree list for offline use.

## Using it

1. **Type the tag number** stamped on the metal tag. The app shows what the
   records say that tree is, and fills in the species.
2. **Confirm the species.** Start typing and the box suggests matches from
   `taxa.csv`; pick one and the app records the taxon itself, not just the
   text. If the tree in front of you is not what the record claims, **just
   record what it is** — the app notices the disagreement by itself. This is
   the part worth doing carefully; it turns a measuring round into a
   verification pass over eleven-year-old data.
3. **Check the position.** The accuracy chip shows how good the GPS fix is.
   Tap the map to drop the pin on the tree's crown — on satellite imagery this
   usually beats the receiver, especially under canopy.
4. Measure, photograph, note, save. The form clears for the next tree.

### When the tree is not what 2014 says

There used to be a tickbox here reading *This is not what the 2014 record
says*. It is gone, and nothing replaced it on the form.

The 2014 file is an eleven-year-old claim, not a fact: the identification may
have been wrong to begin with, the tree may have been removed and replaced with
the tag staying on the spot, a loose tag may have been nailed to a neighbour, or
the entry may have been genus-level and you can now be specific. So the
disagreement matters. But the app already knows about it — the species box
resolves to a `taxon_id`, and so does the 2014 name — which made the tickbox a
trap: the most valuable finding of the survey depended on somebody remembering
to declare something the app could see for itself.

Now it detects it. Correct the species, and the tag card says:

> 2014 recorded this tag as **Picea abies**. You have recorded **Picea
> pungens**, which is saved as a correction.

Nothing to click, and **no warning when you save** — correcting an old
identification is the work, not a mistake to confirm. The record is marked
*species changed* in the saved list, and the export carries a line naming both
species so whoever adjudicates it does not have to open the 2014 file.

Picking the same taxon under a different name does not count: *Norway spruce*
and *Picea abies* are one taxon, and the app compares ids rather than text.

If you can see it is wrong but cannot say what it is, write that in the notes
— "not a spruce, needles all wrong" is more use to the desk than a bare flag
would have been.

**Dedication plaques.** Tick *This tree has a plaque* and a field appears for
what it says. Transcribe it rather than summarising it — transcription is a
reliable field task and summarising is not.

The tickbox is only there to keep the field off screen for the 95% of trees
with no plaque; nothing about it is stored. A tree counts as dedicated exactly
when the wording is filled in, which is why saving with the box ticked and the
field empty is refused: it would record nothing at all, and the finding would
vanish between the phone and the CSV. If you cannot read the whole plaque, type
what you can and say so — *"Gift of the class of 19??, rest illegible"* is a
real record. Unticking clears the field, so text typed and then dismissed
cannot leak into the export.

The GPS accuracy and whether you moved the pin are exported separately from
your notes, into `geolocation_notes` — so a remark about how the position was
fixed stays beside the coordinates it describes, and out of the public record,
where it answers a question no visitor is asking.

**Year planted** takes a four-digit year, or press **Unknown**. The two are
different findings: Unknown means the surveyor checked and nobody knows, while
leaving it blank means nobody has looked yet. Unknown is written into the notes
so that distinction survives the export. A year outside 1700 to the present is
refused as a typo.

Trees with no tag: press **No tag**, type the species, and carry on. The
importer issues a fresh accession number for them.

### Photos

Every shot is resized before it is stored — 1200 px on the long edge, with the
EXIF rotation baked in, so a portrait photo is not filed sideways. A phone
produces about 4 MB and 12 megapixels a shot; the map shows a photo a few
hundred pixels wide.

It is written as **WebP** where the device can write one, and JPEG where it
cannot. The fallback is not a formality: a browser asked for a format it cannot
encode does not fail, it quietly returns PNG — several times *larger* than the
JPEG it was meant to beat. Safari only learned to write WebP from a canvas in
17, and iPhones are most of what a surveyor will be holding.

At 1200 px and quality 0.72 a real survey photo lands at 228 kB, against 540 kB
at the 1600 px / 0.82 used before — the cheapest saving available, and it
applies to every photo taken from here on. On that same photo WebP came in about
10% under JPEG at matched quality. Useful across a few thousand trees, but not the 40-60%
sometimes quoted for the format — that figure compares against an unoptimised
original, and these are already resized. The filename extension follows whatever
was actually produced.

### Trees with no tag

Most of campus is mapped without ever having been tagged — an inventory gives
you a position and a species, not a number on a trunk. So for most trees there
is nothing to type in the tag box, and the app matches on **position** instead,
which is the one thing you and the map both have.

Leave the tag box empty and, once there is a fix, **Mapped trees near you**
lists what the map has within 25 m, nearest first:

> **3 m northeast** — Littleleaf linden *Tilia cordata*

Tap one and the rest of the form fills in against that tree: the record becomes
a visit to it rather than a new accession, and the species is seeded from the
map's record for you to confirm or correct.

- **Nearest first, and nothing else.** Not sorted by species, not preferring the
  ones nobody has surveyed. Three maples at 8, 11 and 14 m is the ordinary case,
  and you are the one who can tell which is which — a clever sort would just
  make one of them look like the answer.
- **"None of these — it is a new tree" is a real answer.** A fix under a canopy
  is routinely 5–10 m out and the map's own positions are imperfect. Use it
  whenever you are not sure: a wrong claim merges two trees into one, which is
  the one mistake that is genuinely hard to undo later.
- **A tree that has already been surveyed is still offered**, and says so. An
  untagged tree can only ever be found this way, so hiding it would make
  re-surveying it impossible rather than merely awkward.
- **Type a tag and the list disappears.** A number read off a trunk is certain;
  position is the fallback for when there is no number, not a second opinion
  about one.

**Claiming a tree does not move it.** The export carries the position the map
already has, not where you were standing — you are three metres away, and that
is not new evidence about where the tree is. If the map has it in the wrong
place, drag the pin onto the crown: that is the deliberate act that says so, and
then your position wins.

Every claim is recorded with the distance it was made from, so whoever imports
the data can weigh it — `npm run import` lists them, and a match at 20 m
deserves more doubt than one at 3 m. If two surveyors claim the same tree on the
same day, the import refuses both rather than guessing.

### The species box

Most trees on campus have no metal tag, so for most of them the tag lookup
cannot help and the name is typed. Typed names go wrong in every way a name
can — *Acer platenoides*, `Sugar Maple `, `quercus rubra` — and each one is a
row the importer stops on weeks later, by which time the tree is a hundred
miles away and nobody remembers which one it was.

So the list comes to the field. Type two characters and the box suggests
matches from the same `taxa.csv` the importer resolves against, showing the
common name, the scientific name, and how many of that species are already
mapped. Pick one and the app records its **`taxon_id`**, which leaves the
importer nothing to resolve.

- **Both names search.** "sugar maple" and "Acer saccharum" find the same tree,
  and so does "sug map" — every word you type only has to start a word in the
  name. Accents, capitals and apostrophes are folded away, by the same function
  the importer uses, so the phone and the desk agree about what "Scot's pine"
  means.
- **The commonest tree comes first** among equally good matches, ranked by how
  many are already on the map. On 2,000 trees with a long tail, that is the
  difference between "map" reaching sugar maple and reaching paperbark maple.
- **Typing the whole name is enough.** Spell a species correctly and it counts
  as picked; you do not have to tap the suggestion to confirm what you already
  spelled.
- **A name two taxa share is not a match.** Both *Sorbus intermedia* and
  *Sorbus hybrida* are called Swedish whitebeam, and only the person under the
  tree can say which — so the app asks rather than choosing.
- **Free text always saves.** A species not on the list is the most interesting
  thing you can find, and the app takes what you type and flags it in the notes
  for the desk. An autocomplete that refused unknown input would be worse than
  none at all.

The list is fetched once and kept on the device, so it works with no signal. It
is `public/field/species.json`, regenerated by `npm run data` from `taxa.csv`
and `data/species-aliases.csv` — about 38 kB for 257 taxa. Nothing needs doing
to publish an updated one: the URL carries the data version, so a phone picks
up a new list on its next load rather than serving the first one it ever saw
out of the service worker cache forever.

### The app will not let you save a bad position

Above ±10 m it refuses, because a fix that loose puts the tree in the wrong bed
and nobody will notice until the map looks wrong. Either wait for the fix to
tighten, or tap the pin onto the tree yourself — placing it by hand overrides
the check, since you can see more than the receiver can.

## Getting the data back

On the **Saved** screen:

- **Download CSV** — the survey records.
- **Download photos (zip)** — unzip into `public/photos/`.

Then at a computer:

```bash
npm run import -- survey-2026-09-01.csv
npm run import -- survey-2026-09-01.csv --write
npm run data
```

Export before you finish for the day. The records live only in that browser's
storage; clearing site data or losing the phone loses the work.

## A tag is looked up, not turned into an accession

Tag `772` used to *become* accession `UVM-0772`. It no longer does, because
that welded a permanent identifier to a piece of metal that gets replaced —
and one already has: `UVM-0105` wears tag 3497.

The tag now lives in its own column, and typing a number into the app searches
it. Type `772` and you reach the tree wearing 772, whatever its accession says.
Re-surveying still works the way it always did: type the number again next year
and the importer adds an observation rather than a second record.

A number nobody has on file is a tree nobody has recorded, so it gets an
accession from the untagged block with its tag beside it. A mistyped tag
therefore creates a spurious tree rather than being refused — which is what the
position-collision check and the dry run are for. Read the dry run.

See [the accession and the tag](FIELD-SURVEY.md#the-accession-and-the-tag).

## Tag lookup: two sets of records, newest first

A typed tag is checked against **the current inventory first**, and only then
against the 2014 file.

The order matters. `data/plants.csv` holds 2,052 trees surveyed in 2023-24, and
the 2014 inventory knows nothing about any of them planted since. Asking 2014
first meant a surveyor could type a tag that exists, stand in front of the tree
wearing it, and be told *"No tree 3235 in the 2014 inventory"* — which is how
this was found. Where both know a tag, the newer identification is the one
worth seeding.

The current inventory reaches the phone as `public/field/trees.json`, which the
app already carried for matching an untagged tree by position. A hit shows the
accession, that the tree is already on the map, and when it was last surveyed:

```
Thuja occidentalis
Northern white cedar
UVM-3235 · already on the map · last surveyed 2023-11-10
```

A miss now says **"No tree 3235 in the records"** rather than blaming 2014, and
offers neighbouring tags from both sets, since a tag that has lost a digit could
belong to either.

Two things the lookup will not do:

- **It never overwrites the surveyor's own typing.** A species the surveyor
  entered themselves survives any tag change; only an autofilled value is
  replaced. Where the two disagree, the form says so and files it as a
  correction.
- **It clears an autofilled species on a miss.** Correcting a tag from 763 to
  9999 used to leave *Betula nigra* sitting in the box, and a filled box looks
  the same whether or not it still means anything.

### The 2014 reference

The fallback is the 2014 inventory, published at
`public/field/reference.csv`. The app fetches it on first load and caches it,
so surveyors never have to do anything — open the app and tag lookup works.

**It is FEMC's data, CC BY-SA 4.0**, and this app redistributes a copy of it.
The credit rides in the map's attribution line and the full citation is in
[data/SOURCES.md](../data/SOURCES.md). Anyone replacing this file is taking on
that attribution too.

Only the columns the lookup needs are published: tree number, common and
scientific name, DBH, age class and condition. The inventory's free-text
`Notes` column and its care-priority ratings are deliberately left out — they
are not needed to autofill a form, and they are not worth putting on a public
URL. The archived dataset has **12 fields** against these six, and what the
other columns hold has never been checked — see [to-do #16](TODO.md).

A surveyor can still load a different file by hand from the Saved screen, which
overrides the published copy on that device. Any CSV with a tree-number column
and a scientific-name column will do; common header spellings are recognised.

The app works without any reference at all — you just type the species yourself
and lose the cross-check against 2014. The current-inventory lookup is
unaffected either way, since it rides on `trees.json` rather than on this
file.

### Replacing it

Overwrite `public/field/reference.csv` and merge. Phones that have already
cached the old copy keep using it until their app cache is cleared, so bump
`CACHE` in `public/field/sw.js` when the contents change materially.

## Known limits

- **Basemap imagery needs a signal.** Tiles are deliberately not cached — a
  campus-wide basemap would fill the phone. With no signal the pin still works,
  you just place it without the aerial view underneath.
- **Photos are shrunk before they are stored** — 1600 px on the long edge, about
  250–600 kB each, down from roughly 4 MB straight off the camera. That is more
  than the map's record panel can display, and it keeps a day's photographs
  small enough to zip and email off the phone. Even so, photographing all 2,500
  trees would come to well over a gigabyte, which is more than a GitHub Pages
  site can hold: photograph selectively — specimen trees, defects, anything a
  future surveyor will want to see rather than re-walk.
- **One device, one dataset.** Two surveyors produce two CSVs; the importer
  merges them and flags any trees recorded twice.

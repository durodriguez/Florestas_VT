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

1. **Type the tag number** stamped on the metal tag. The app shows what the 2014
   inventory says that tree is, and fills in the species.
2. **Confirm the species.** If the tree in front of you is not what the record
   claims, tick the mismatch box — it is written into the notes so the desk can
   resolve it. This is the part worth doing carefully; it turns a measuring
   round into a verification pass over eleven-year-old data.
3. **Check the position.** The accuracy chip shows how good the GPS fix is.
   Tap the map to drop the pin on the tree's crown — on satellite imagery this
   usually beats the receiver, especially under canopy.
4. Measure, photograph, note, save. The form clears for the next tree.

Trees with no tag: press **No tag**, type the species, and carry on. The
importer issues a fresh accession number for them.

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
npm run import -- survey-2026-09-01.csv --adopt-tags
npm run import -- survey-2026-09-01.csv --adopt-tags --write
npm run data
```

Export before you finish for the day. The records live only in that browser's
storage; clearing site data or losing the phone loses the work.

## Physical tags become accession numbers

`--adopt-tags` registers a metal tag as the tree's permanent accession: tag
`772` becomes `UVM-0772`. UVM already has thousands of durably tagged trees, so
inventing a parallel numbering scheme would only create ambiguity in the field.

Re-surveying is then automatic — type `772` again next year and the importer
updates `UVM-0772` rather than creating a second record.

The flag is off by default, so a mistyped tag on an ordinary import is still
refused rather than silently creating a bogus record.

## The 2014 reference

Tag lookup uses the 2014 inventory, published at
`public/field/reference.csv`. The app fetches it on first load and caches it,
so surveyors never have to do anything — open the app and tag lookup works.

Only the columns the lookup needs are published: tree number, common and
scientific name, DBH, age class and condition. The inventory's free-text
`Notes` column and its care-priority ratings are deliberately left out — they
are not needed to autofill a form, and they are not worth putting on a public
URL.

A surveyor can still load a different file by hand from the Saved screen, which
overrides the published copy on that device. Any CSV with a tree-number column
and a scientific-name column will do; common header spellings are recognised.

The app works without any reference at all — you just type the species yourself
and lose the cross-check against 2014.

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

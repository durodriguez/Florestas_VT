# Correcting tree positions at a desk

The 2023–24 layer puts some trees in the wrong place — by up to 41 m in the
Redstone white pine grove, and onto a parking lot in places (see
[to-do #19](TODO.md)). The field app can fix one tree at a time, standing under
it. **`/positions/`** fixes them by the hundred, at a desk, on satellite imagery.

## Using it

Open `<your site>/positions/` on a laptop or desktop. Every standing tree on the
map is a dot on the imagery: **blue** for evergreens, **green** for deciduous
trees, **pink** for anything else — because a dark conifer crown against bare
branches is how a misplaced pine gets noticed. Zoom in and each dot is labelled
with its tag number, or `#` and its accession if it has none.

- **Drag any dot** onto the crown it belongs to. There is no separate select
  step; pressing on a dot picks it up.
- A plain click selects a tree without moving it. The panel shows what it is.
- With a tree selected, the **arrow keys** nudge it 0.2 m (1 m with Shift).
- **Ctrl+Z** (⌘Z on a Mac) undoes the last move; **Esc** deselects.
- Type a **tag or UVM number** in the search box and press Enter to jump to it.
- Moved trees turn **gold**, with a dashed line back to where the record had
  them. **Reset** on any move puts that tree back.

Every move is kept in the browser as it is made, so closing the tab or a crash
loses nothing; the bar says so, and says plainly if the browser refuses to
save. The moves live in that one browser on that one computer until exported.

## Getting the moves onto the map

1. **Export moves** downloads `positions-<date>.csv`.
2. Apply it:

   ```bash
   npm run positions -- positions-2026-10-06.csv           # dry run: what would change
   npm run positions -- positions-2026-10-06.csv --write   # apply
   npm run data
   ```

3. Commit and merge as usual. The public map shows the new positions on the
   next deploy. Open `/positions/` again afterwards and the saved moves are
   recognised as applied and cleared from the list.

## What a correction is, and is not

**It is not a survey visit.** Nobody stood at the tree, so nothing is written
to `observations.csv`: the public map's *Last surveyed* date and survey history
are exactly what they were. What changes in `plants.csv` is `lat`, `lng`,
`geolocation_notes` — set to *Position corrected on imagery, &lt;date&gt;*, a
column that is never sent to the public map — and `collection_id` if the tree
has crossed into another campus.

**An old export cannot undo newer work.** Each move carries where the tree was
when it was picked up. If the record has moved more than 0.5 m since — another
export applied first, a field survey moved the pin — that row is refused, and
nothing in the file is written until it is resolved:

```
✗ UVM-3326 has moved 7.6 m since this file was made — move it again in /positions/
```

The page does the same check when it opens: a saved move whose tree has moved
by other means is shown in red and left out of the export.

**Long moves are applied but listed.** Anything over 100 m is reported for a
second look, because a tree dragged that far is as likely the wrong dot as a
badly mapped one.

## Who can use it

The page is on the public site, like `/tracer/`, but it changes nothing by
itself: all it can do is hand the person using it a file. Only a commit to
`data/plants.csv` changes the map. It is marked `noindex`, so search engines
leave it out.

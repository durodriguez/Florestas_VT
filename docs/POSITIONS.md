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

## Your own imagery, privately

**My imagery** in the side panel lays your own images — Google Earth prints,
for instance — over the satellite layer, under the trees. They are read from
your disk and kept in **this browser only** (its IndexedDB storage): never
uploaded, committed or published. That is the condition for using Google
Earth prints at all; Earth's terms do not allow them to be served as a map
layer, and this repository and its site are public ([to-do #17](TODO.md)).

1. **Add images and .geprint files** — choose the images and their `.geprint`
   files together. A pair is matched by name: `UVM_Campus_MainSt.jpg` with
   `UVM_Campus_MainSt.geprint`.
2. Each image is placed from its `.geprint` first. That is **a rough guess**:
   the file records Earth's camera, not the image's corners, and the corners
   depend on a field of view it does not store. Expect it tens of metres out.
3. **Align** each image by matching points. Click a sharp feature on your
   image — a building corner, a path junction — then the same feature on the
   satellite map, which is shown with your image hidden. Two points fix it, if
   they are spread across and down the image; each one after that improves it,
   and the panel says how far the points disagree, in metres. Zoom in to click:
   the precision is the screen pixel. Aim for four or five points and under a
   metre.
4. **Four or more points switch on the tilt correction.** With two or three,
   the image is stretched as a rectangle — which fits a tilted print in one
   place and not another, metres out elsewhere. From four, it is warped into
   the slightly uneven four-sided shape a tilted camera actually produces, and
   fits the whole print. Four points always fit exactly, which proves nothing:
   **six or more** let the residual say how good it is. If a mis-matched point
   would fold the image into a bow-tie, the tool refuses the warp, keeps the
   stretch, and says so — undo the worst point (the panel names it) and redo it.
5. Every image aligned teaches the tool Earth's real field of view and offset,
   so the next ones start closer.

Overlapping images simply lie on top of each other; nothing is stitched or
trimmed. Only images in view are drawn, so fourteen large prints do not slow
the page. **Opacity** blends them with the satellite layer; **Show** turns them
all off.

Two limits to know. **The images stay with that browser** — another computer,
another browser, or clearing site data means adding and aligning them again.
**The tilt correction removes the tilt, not everything.** Campus is not flat,
and Google's imagery and the satellite layer each correct for hills in their
own way, so some mismatch varies from place to place and no single warp
removes it. Tall buildings lean, so align on features at ground level. The
residual the panel reports is the honest measure of what is left; where it
matters, align with points around the trees you are working on.

Whether positions traced off Google's imagery may go into a published dataset
is a question for Google's terms, not for this tool; check before relying on
it for many trees.

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

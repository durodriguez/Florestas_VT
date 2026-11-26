# The field guide

`/fieldguide/` is the campus's trees for someone standing among them. The
explorer at `/` is the whole collection, searched and filtered; the field guide
opens on the trees around the visitor, in this month's colors, with a page for
each tree. It reads the same data files and uses the same rules as the explorer
(`src/season.ts`, `src/notable.ts`, `src/measured.ts`), so the two never
disagree; only the way in differs. The code is in `src/fieldguide/`.

## Phase 1 (November 2026)

- **The map.** Full screen, every tree drawn (no clusters), colored by what its
  species is doing this month: flowers in their color, fruit, fall color,
  evergreen, in leaf or bare. A chip at the top counts what is in
  flower, fruit or color. Notable trees (the largest trunks measured on campus, the largest of a species, the only one of its kind) carry a white star on UVM green; tapping one opens the tree. Streets or satellite, from the switch at top right;
  the button under it returns to where you are.
- **Around you.** A sheet along the bottom (a card at the left on a desktop)
  with up to four trees near you worth the walk, each with its reason and its
  distance and direction: the nearest notable tree, the nearest in flower,
  fruit or color, the nearest with a photo, then the next best. Never two of
  the same kind of tree. If too few are within 150 m, it looks to 300 m, then
  600 m. The picks are ringed in gold on the map, and change only when you
  have walked 25 m, so they do not shuffle as you go. The rules are in
  `src/fieldguide/picks.ts`, with tests.
- **Without your location** (refused, unavailable, or more than 3 km from
  campus) it shows the trees around the University Green and says so.
- **Around a spot you pick.** A tap or click on open ground drops a pin, and
  the tab becomes "Around the pin": the same four picks, by the same rules,
  around the pin instead of you, with distances from it. A tap on a tree
  still opens the tree, so in a dense spot zoom in to tap between them. A
  double tap zooms and drops no pin. "Back to where you are" (or "Back to the
  University Green" without your location) and the ◎ button lift the pin.
  While a pin is down, walking does not reshuffle the picks.
- **The map's credits** (Leaflet, OpenStreetMap) sit at the bottom right on a
  desktop and at the top left, above the month, on a phone, where the sheet
  leaves them in view.
- **A tree's page.** Tapping a tree or a card opens it over the map. Since
  November 2026 it is laid out as the report's mock-up was:
  - **the photo**: on a screen 60rem (960 px) wide or more, it fills the left
    half of the screen at full height and stays put while the page scrolls
    beside it; narrower, it sits above the page. Either way it is cropped
    to fill its frame, aimed a little above the middle, where a crown usually is, with when it was taken. A tap on it (or on ⤢)
    opens the whole photo, uncropped, on black; the phone's back button
    closes it. With no photo, a panel in the tree's season color;
  - its number, campus and tag; its name, scientific name, family and
    origin; its notable notes and its story;
  - **two tiles** (`src/fieldguide/tiles.ts`): its size (trunk diameter, else
    height, else crown spread, else its condition), and what it is doing this
    month. A tree whose species is not known yet has no "right now", so it
    shows its condition instead, in one tile if that is all there is. Dates
    are the year only ("2014, 12 years ago"), so a tile fits one line. Under
    them, one line with whatever the tiles leave out: condition, year
    planted, last survey;
  - **its year** (`src/fieldguide/year.ts`): a table of leaves, flowers and
    fruit (cones for conifers) across the months, each in the color the tree
    shows: green in leaf, the fall color in October, every flower and fruit
    in its real color (a ginkgo's green flowers, a spruce's brown cones), this
    month marked. Under it the same in words, and "Table shows typical months
    for this species": they are the species' months from `taxa.csv`, not
    dates seen on this tree. Unlike the map's season colors and the "right
    now" tile, which count only what a passer-by would notice, the table
    shows everything;
  - what to look for, the fun fact, a dedication plaque if it has one;
  - **others of its kind**: how many more of its species stand on campus,
    how far and which way the nearest is, and a small map of them all with
    this one ringed. Tapping a dot opens that tree;
  - links to its record in the explorer, its species page and walking
    directions.

  Its address names the tree (`/fieldguide/?plant=UVM-4715`), so the phone's
  back button returns to the map and the page can be shared.

## Phase 2 (November 2026)

- **Tours.** A "Tours" tab beside "Around you" lists the walking tours from
  `data/tours.csv`, each with its stops, its length and, once your location
  is known, how far the first stop is. Starting one numbers its stops on the
  map, joined in order, with the other trees faded, and turns the sheet to
  the stop you are on: its note, how far it is from you, and a button to the
  next stop with its distance and direction. A stop's page carries the same
  note and the same button. If you are nearer the last stop than the first,
  the guide offers to walk the tour in reverse. A tree page for a stop
  offers "Walk the tour from here" when no tour is under way. The address
  carries the tour and the stop (`?tour=giants-of-the-green&stop=3`).
  On a phone the stop's note is shown whole (until November 2026 it was cut
  to three lines). On a phone the grip at the top of the sheet is a divider,
  on every tab (Around you, Tours, and while a tour is walked; until 27
  November 2026 only the last): drag it down for more map, up for more of
  the sheet (no taller than its contents need, nor 85% of the screen), or
  focus it and use the arrow keys; a double-tap puts it back. The height is remembered in
  this browser only (`src/fieldguide/sheet-split.ts`).
- **Links both ways with the explorer.** The explorer has a "Field guide"
  link in its top bar, an "In the field guide" button on each standing
  tree's record, and "Walk it with the field guide" under each tour. The
  guide links back from each tree's page and from the tour being walked.
  The rules for the year and the walk are in `src/fieldguide/year.ts` and
  `src/fieldguide/walk.ts`, with tests.

It uses the same public basemaps as the explorer. QR labels still point to the
explorer.

## Limits

It needs a connection: the map tiles come from outside servers, and nothing is
kept for use offline.

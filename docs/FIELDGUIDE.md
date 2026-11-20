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
  flower, fruit or color. Streets or satellite, from the switch at top right;
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
- **A tree's page.** Tapping a tree or a card opens it over the map. It shows:
  - the photo and when it was taken, or a panel in its season's color where
    there is none;
  - its notable notes, its story, and what it is doing this month;
  - trunk, height, spread, year planted, condition and last survey, each
    with its date;
  - **its year**: twelve months in the species' colors, this month outlined,
    and the same in words ("Pink flowers in May. Red fruit from September to
    November."). These are the species' usual months from `taxa.csv`, not
    dates seen on this tree, and the page says so;
  - what to look for, the fun fact, and a dedication plaque if it has one;
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

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
- **A tree's page.** Tapping a tree or a card opens it over the map: the photo,
  or a panel in its season's color where there is none; its notable notes; what
  it is doing this month; trunk, height, spread and condition, each measurement
  with its date; what to look for; the fun fact; and a link to its record in
  the explorer. Its address names the tree (`/fieldguide/?plant=UVM-4715`), so
  the phone's back button returns to the map and the page can be shared.

It uses the same public basemaps as the explorer. QR labels still point to the
explorer.

## Planned

Phase 2: a fuller tree page (a strip of the tree's year, a small map of the
others of its species), the walking tours, and links both ways with the
explorer.

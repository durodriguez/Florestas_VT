# Missing photos

The species pages' **Know it by** section shows a photo of each species' bark,
leaves, flowers and fruit (SPECIES-PAGES.md). These are the ones still
missing: no photo on Wikimedia Commons or iNaturalist showed the right part
of the right species clearly enough to be sure. Each line says when to look
and which trees on campus to try first (the largest measured).

Tick a line off (`[x]`) once its photo is in `data/part-photos.csv`.
`npm run data` warns about any line still unticked whose photo has been
added, so the list does not go stale.

## How a photo gets onto a page

The pages link to photos rather than holding them, and only from Wikimedia
Commons or iNaturalist, so a photo needs to be posted to one of them first,
under a license that allows reuse with credit (CC0, CC BY or CC BY-SA):

- **iNaturalist** is the easier: post the photo as an observation of the
  species, with its license set to CC BY (Account settings → Content &
  display → default photo license). Once others confirm the species it
  becomes research grade, and its link can go in `part-photos.csv`.
- **Wikimedia Commons** takes an upload with its own licensing form.

A close photo of the one part, in focus, works best: the tile is small.

## The list

- [ ] **Colorado blue spruce**, pollen cones (`picea-pungens`, flowers).
  Small, reddish, at the branch tips in May, before the new shoots open.
  Try UVM-0593 and UVM-0576 (Central Campus), UVM-2852 (Athletic Campus).
- [ ] **Japanese zelkova**, flowers (`zelkova-serrata`, flowers). Tiny and
  greenish, along the new shoots in April as the leaves open; easy to miss.
  Any of the zelkovas on Redstone Campus, such as UVM-4520 to UVM-4526.
- [ ] **Japanese zelkova**, fruit (`zelkova-serrata`, fruit). Small, hard,
  lopsided, brown, along the twigs in September and October. The same trees.
- [ ] **American hornbeam**, catkins (`carpinus-caroliniana`, flowers).
  Hanging green catkins in April and May. Try UVM-2400, UVM-1489 and
  UVM-2415 (Athletic Campus).
- [ ] **Bur oak**, catkins (`quercus-macrocarpa`, flowers). Hanging
  yellow-green catkins in May, with the new leaves. Try UVM-2324 and
  UVM-2323 (Athletic Campus).
- [ ] **Washington hawthorn**, bark (`crataegus-phaenopyrum`, bark). Any
  time of year. Try UVM-0355, UVM-0353 and UVM-0354 (Central Campus).
- [ ] **Sargent cherry**, bark (`prunus-sargentii`, bark). Polished
  red-brown with horizontal bands, any time of year. Try UVM-0747 (Central
  Campus), the largest measured, and UVM-2498 (Trinity Campus).
- [ ] **Sargent cherry**, fruit (`prunus-sargentii`, fruit). Small dark
  cherries in June and July; birds take them fast. The same trees.
- [ ] **Lombardy poplar**, bark (`populus-nigra`, bark). Any time. Its
  campus trees stand in rows; any of them.
- [ ] **Lombardy poplar**, catkins (`populus-nigra`, flowers). Reddish male
  catkins in March and April, before the leaves.
- [ ] **American chestnut**, burs (`castanea-dentata`, fruit). Spiny burs
  in September; rare on sprouts that are still small.
- [ ] **Scotch pine**, needles (`pinus-sylvestris`, leaves). Short, twisted,
  blue-green pairs; any time.
- [ ] **Scotch pine**, cones (`pinus-sylvestris`, fruit). Small, pointed,
  gray-brown, any time.

# Image calibration

`/imagery/` is an internal desk tool for aerial images of campus: add them,
align them to the satellite map, and make new images from them, merged where
they overlap, clipped to campus or to one campus area, and compressed. It is
meant for a laptop or desktop, like the [positions tool](POSITIONS.md).

## The source images

The source images are the ones the positions tool calls *My imagery*. **The
two pages share them**: both are on one site, so they read and write the same
store in the browser. An image added or aligned in either page shows in the
other after a reload, and removing one in either removes it from both.
Alignment files exported from either page import into both.

Adding and aligning work exactly as in the positions tool, which
[POSITIONS.md](POSITIONS.md#your-own-imagery-privately) describes in full:

1. **Add images and .geprint files**, chosen together. A Google Earth print and
   its `.geprint` are matched by name; the `.geprint` places the image roughly.
2. **Align** each image: click a sharp feature on your image, then the same
   feature on the satellite map. Two points place it; four or more correct its
   tilt; six or more let the reported error mean something.
3. **Export alignments** saves the matched points (a few kilobytes, no
   images), and **Import alignments** puts them back on any computer.

The number beside each image is its stacking order: where images overlap, the
one with the lowest measured error (1) is on top. A merge uses the same order.

## Making an image

**Tick** the images to work with in the list, then fill in **Make image**:

- **Clip to** keeps only what lies inside the campus boundary or one campus
  area. Outside it the image is transparent (WebP, PNG) or white (JPEG).
  Holes in an area stay holes.
- **Detail** is the pixel size. *Finest of the images* matches the sharpest
  ticked image. The page shows the size of the result before it is made, and
  rounds to the nearest finer step of the map's grid (0.5 m asked can be
  0.43 m made).
- **Format** and **Quality**: WebP is small and keeps transparency; JPEG is
  understood everywhere but has no transparency; PNG is lossless and large.

One image ticked makes a recompressed copy of it, laid on the map's grid; two
or more are merged into one. Where they overlap, the better-ranked image wins
outright: there is no blending, so a seam shows where two images disagree.

**The size limit.** A browser can hold an image of only so many pixels while
it works, so the page stops at 60 megapixels and makes the image coarser if
the request is bigger, saying so before you make it. An 8,000-pixel print
covering about a kilometre is roughly 0.1–0.2 m per pixel; the whole campus
boundary at that detail would be several hundred megapixels, so a campus-wide
image comes out coarser, around half a metre per pixel. Clip to one campus
area for more detail.

## Made images

Made images are kept in this browser, in a store of their own, and drawn on
the map above the source images. Each can be hidden, removed, or exported.

**Export .zip** saves three files:

- the image itself (`.webp`, `.jpg` or `.png`);
- a placement file (`.json`) that this page reads back with **Import .zip**;
- a world file (`.wld`) that QGIS and other GIS programs read to place the
  image. Its coordinates are Web Mercator metres: set the layer's CRS to
  **EPSG:3857**.

Every made image is drawn on the Web Mercator grid at a whole zoom level, the
same grid the web maps use. That keeps the way open to showing made images on
the public map, the survey app or the positions tool later.

## Campus tile layer

A made image is one big picture, and a browser has to unpack all of it to
show any of it. The satellite layer is fast for a different reason: it comes
as small tiles, 256 pixels square, with a separate set for every zoom, and the
browser only ever loads the twenty or thirty tiles on screen. **Campus tile
layer** makes the same thing from your images, so a whole campus at full
detail pans and zooms as smoothly as the satellite layer.

1. **Tick** the aligned images to use. Images not aligned yet are left out.
2. **Clip to** is the campus boundary unless changed; tiles outside it are not
   made at all.
3. **Finest** is zoom 20 (0.11 m per pixel, about the detail of a Google Earth
   print) or zoom 19 (0.21 m, a quarter of the tiles).
4. **Build tiles.** The page works through the area in blocks of 16 × 16
   tiles, drawing each from the images, best-ranked on top where they
   overlap, then makes every zoom out from the one below, down to zoom 14. It
   says how far it has got and about how long is left; **Stop** abandons the
   build and keeps nothing.

The page estimates the tile count and size first. For the whole campus
boundary at zoom 20 the upper bound is about 14,000 tiles; tiles with nothing
in them are skipped, so it is fewer. On a test with two print-sized images,
about 1,200 tiles at zoom 20 took 20 seconds, so a whole campus should take
minutes rather than hours, on a laptop. Storage per tile depends on the
images; expect a few hundred megabytes for the campus at zoom 20.

The tile set is then a layer like any other. It is listed under **Campus tile
layer** (Show, Hide, Remove), and appears in the layers list at the top right
of this page, of the [positions tool](POSITIONS.md), and of the survey app, on
the same computer and browser, as *Campus tiles: (name)*, off until ticked. A
phone that never built one sees nothing new. Tiles stay in the browser that
built them; to move a set to another computer, build it there.

To rebuild after aligning better, build a new set and remove the old one.

## What may be published

Nothing on this page is uploaded: sources and made images stay in the browser
until you export them. **That matters for Google Earth prints.** Google's terms
do not allow its imagery to be served as a map layer, and an image made from
Google Earth prints is still Google's imagery. Such images may be used
privately, on this page and in the positions tool, but not published on the
site or committed to this repository, which is public.

Images you took yourself (a drone, for example), or imagery whose license
allows publishing, can go further. Vermont's statewide orthophotos are worth
checking for that; their license has not been checked here. Check the license
of each source before a made image goes on any public map.

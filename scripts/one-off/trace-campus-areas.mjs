#!/usr/bin/env node
// ONE-OFF, retained for provenance. Generates the PROVISIONAL geometry in
// data/campus-areas.geojson.
//
// Why provisional: UVM publishes campus boundaries on https://www.uvm.edu/map/,
// but this sandbox cannot make outbound requests to uvm.edu (nor to OSM's
// Overpass or Nominatim APIs), so the real geometry could not be downloaded.
// These polygons were georeferenced by hand from a screenshot of that map.
//
// The screenshot has no scale bar, so the scale was pinned three ways and the
// estimates were made to agree at ~2.5 m/pixel:
//   1. Trinity Campus to Redstone Campus reads as 474 px; those campuses are
//      roughly 0.010-0.011 degrees of latitude apart (~1.2 km).
//   2. At 2.5 m/px the whole image is 2.3 x 2.0 km, which puts I-89 exit 14
//      ~700 m east of the athletic fields and the Winooski River ~1.5 km north
//      of Trinity. Both match the real distances.
//   3. The traced boundary covers ~261,000 px², which at 2.5 m/px is 1.63 km²
//      = ~400 acres, against UVM's commonly cited ~460-acre main campus.
//
// The origin is the one hard anchor available: the six trees surveyed in
// September 2026, whose phone GPS the surveyor verified on the ground. Their
// mean position is 44.476325, -73.194933, in the south-east of Central Campus.
//
// Expect these polygons to be off by 100-300 m. They are deliberately drawn as
// simple blocks rather than detailed outlines so that nobody mistakes them for
// surveyed data. Replace them by tracing over satellite imagery at /tracer/.
//
// Usage: node scripts/one-off/trace-campus-areas.mjs > data/campus-areas.geojson

// Pixel -> WGS84, derived above. Web Mercator's longitude scale is the latitude
// scale divided by cos(latitude); at 44.478 degrees that factor is 0.71325.
const M_PER_PX = 2.5;
const DEG_LAT_PER_PX = M_PER_PX / 111_130;
const DEG_LNG_PER_PX = DEG_LAT_PER_PX / Math.cos((44.478 * Math.PI) / 180);
const ANCHOR = { x: 330, y: 340, lat: 44.476325, lng: -73.194933 };

const round = (n) => Number(n.toFixed(6));
const project = ([x, y]) => [
  round(ANCHOR.lng + (x - ANCHOR.x) * DEG_LNG_PER_PX),
  round(ANCHOR.lat - (y - ANCHOR.y) * DEG_LAT_PER_PX),
];

/** Pixel rings read off the screenshot, clockwise. */
const PIXELS = {
  boundary: [
    [100, 205], [205, 150], [290, 55], [505, 55], [600, 165], [740, 180],
    [740, 330], [700, 450], [520, 520], [455, 530], [450, 620], [395, 745],
    [230, 740], [175, 700], [175, 470], [115, 430],
  ],
  central: [[200, 180], [390, 180], [390, 380], [200, 380]],
  trinity: [[290, 55], [400, 55], [400, 165], [290, 165]],
  centennial: [[405, 105], [570, 105], [570, 215], [405, 215]],
  redstone: [[175, 520], [300, 520], [300, 740], [175, 740]],
  athletic: [[300, 600], [430, 600], [430, 745], [300, 745]],
};

const AREAS = [
  {
    key: 'boundary',
    area_id: 'campus-boundary',
    name: 'UVM campus',
    kind: 'boundary',
    color: '#154734',
    description: 'The outer edge of university land in Burlington.',
  },
  {
    key: 'central',
    area_id: 'central',
    name: 'Central Campus',
    kind: 'campus',
    color: '#154734',
    description: 'The academic core, from the Green east to East Avenue.',
  },
  {
    key: 'trinity',
    area_id: 'trinity',
    name: 'Trinity Campus',
    kind: 'campus',
    color: '#1d6fe0',
    description: 'The former Trinity College grounds, north of Colchester Avenue.',
  },
  {
    key: 'centennial',
    area_id: 'centennial',
    name: 'Centennial Campus',
    kind: 'campus',
    color: '#8a5a00',
    description: 'East of East Avenue, running into Centennial Woods.',
  },
  {
    key: 'redstone',
    area_id: 'redstone',
    name: 'Redstone Campus',
    kind: 'campus',
    color: '#a3123a',
    description: 'The residential campus on the old Redstone estate.',
  },
  {
    key: 'athletic',
    area_id: 'athletic',
    name: 'Athletic Campus',
    kind: 'campus',
    color: '#6b21a8',
    description: 'Playing fields, the track and the athletic facilities.',
  },
];

const features = AREAS.map(({ key, ...properties }) => {
  const ring = PIXELS[key].map(project);
  ring.push(ring[0]); // GeoJSON polygon rings must close.
  return {
    type: 'Feature',
    properties: { ...properties, provisional: true },
    geometry: { type: 'Polygon', coordinates: [ring] },
  };
});

process.stdout.write(
  JSON.stringify(
    {
      type: 'FeatureCollection',
      comment:
        'PROVISIONAL geometry, hand-georeferenced from a screenshot of ' +
        'https://www.uvm.edu/map/ and expected to be off by 100-300 m. ' +
        'Replace it by tracing over satellite imagery at /tracer/, then drop ' +
        'the downloaded file in here. Clear "provisional" once the geometry ' +
        'is real. See docs/CAMPUS-AREAS.md.',
      features,
    },
    null,
    2,
  ) + '\n',
);

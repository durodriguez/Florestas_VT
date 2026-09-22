// Vermont State Plane to latitude and longitude.
//
// Burlington publishes its tree inventory in the state's own grid, not in
// degrees: `X` and `Y` are NAD83 / Vermont (EPSG:32145) in **US survey feet**.
// That is not a guess — 68 of the 14,429 rows carry both the feet columns and
// metre ones, and the ratio between them is 3937/1200 to six decimal places on
// every one of them.
//
// There is no projection library in this project and adding one to convert a
// single file would be the larger change, so the inverse Transverse Mercator
// is spelled out here. It is the standard series (Snyder, USGS Professional
// Paper 1395) and it is tested against the projection's own origin, where the
// answer is known exactly, and against the metre columns in the source file.

/** Metres in one US survey foot. Exactly 1200/3937, not 0.3048. */
export const US_SURVEY_FOOT = 1200 / 3937;

/** NAD83 / Vermont. https://epsg.io/32145 */
export const VT_STATE_PLANE = {
  a: 6378137.0,              // GRS80 semi-major axis, metres
  e2: 0.0066943800229007913, // first eccentricity squared
  k0: 0.999964285,           // scale factor on the central meridian (1 - 1/28000)
  lat0: 42.5,                // latitude of origin, degrees
  lon0: -72.5,               // central meridian, degrees
  falseEasting: 500000,
  falseNorthing: 0,
};

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

/** Meridional arc from the equator to `phi` (radians). */
function meridionalArc(phi, a, e2) {
  return a * (
    (1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * phi
    - ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * phi)
    + ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * phi)
    - ((35 * e2 ** 3) / 3072) * Math.sin(6 * phi)
  );
}

/**
 * Easting and northing in **metres** to `{ lat, lng }` in degrees.
 *
 * @param {number} easting
 * @param {number} northing
 * @param {object} [crs] one of the projections above
 */
export function inverseTransverseMercator(easting, northing, crs = VT_STATE_PLANE) {
  const { a, e2, k0, lat0, lon0, falseEasting, falseNorthing } = crs;
  const ep2 = e2 / (1 - e2);                       // second eccentricity squared
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));

  const M = meridionalArc(rad(lat0), a, e2) + (northing - falseNorthing) / k0;
  const mu = M / (a * (1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256));

  // Footpoint latitude: the latitude whose meridional arc is M.
  const phi1 = mu
    + ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu)
    + ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu)
    + ((151 * e1 ** 3) / 96) * Math.sin(6 * mu)
    + ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);

  const sin1 = Math.sin(phi1);
  const cos1 = Math.cos(phi1);
  const tan1 = Math.tan(phi1);

  const C1 = ep2 * cos1 ** 2;
  const T1 = tan1 ** 2;
  const N1 = a / Math.sqrt(1 - e2 * sin1 ** 2);
  const R1 = (a * (1 - e2)) / (1 - e2 * sin1 ** 2) ** 1.5;
  const D = (easting - falseEasting) / (N1 * k0);

  const lat = phi1 - ((N1 * tan1) / R1) * (
    D ** 2 / 2
    - ((5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * ep2) * D ** 4) / 24
    + ((61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * ep2 - 3 * C1 ** 2) * D ** 6) / 720
  );

  const lng = rad(lon0) + (
    D
    - ((1 + 2 * T1 + C1) * D ** 3) / 6
    + ((5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * ep2 + 24 * T1 ** 2) * D ** 5) / 120
  ) / cos1;

  return { lat: deg(lat), lng: deg(lng) };
}

/** The same, taking the feet the Burlington file actually contains. */
export function fromStatePlaneFeet(xFeet, yFeet, crs = VT_STATE_PLANE) {
  return inverseTransverseMercator(xFeet * US_SURVEY_FOOT, yFeet * US_SURVEY_FOOT, crs);
}

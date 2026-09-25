// Burlington's street trees, clipped to the campus boundary.
//
// These are **not** part of the UVM collection and the whole design turns on
// keeping that true. They live in their own file, they carry `BTV-` ids rather
// than accessions, and nothing that belongs to the university's collection —
// `npm run import`, `npm run labels`, the accession sequence — can reach them.
// A separate file makes that impossible rather than merely discouraged.
//
// Why they are worth having anyway: Main Street, College Street and Colchester
// Avenue run through the middle of campus, and their trees are as much a part
// of walking across it as the ones the university owns. A visitor does not care
// who holds the deed.

import { resolveSpecies } from './species.mjs';
import { campusAt } from './geo.mjs';
import { fromStatePlaneFeet } from './vtsp.mjs';

/** Column order of data/city-trees.csv. */
export const CITY_TREE_COLUMNS = [
  'city_id',
  'taxon_id',
  'lat',
  'lng',
  'collection_id',
  'dbh_in',
  'height_ft',
  'spread_ft',
  'condition',
  'planted_year',
  'address',
  'recorded_on',
  'source_id',
];

/**
 * `site_typ` in the source. Only `T` is a standing tree.
 *
 * The codes are not documented in the export, so these readings come from the
 * data: `T` and `S` both carry a species and a diameter, `R` and `P` mostly
 * carry neither and `P` has a diameter of zero. That reads as tree, stump,
 * removed and vacant planting site.
 *
 * Only `T` is imported. Being wrong about `S` costs 58 records inside the
 * boundary; being wrong the other way would draw stumps on a map of trees, so
 * the safer error is the one taken.
 */
export const STANDING_TREE = 'T';

/**
 * Burlington scores condition 0-100; this project names five grades. The four
 * values that actually occur inside the boundary are 50, 70, 80 and 90.
 *
 * A mapping, not a measurement — which is why it is written down here rather
 * than buried in an expression.
 */
export function conditionFromScore(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return '';
  if (n >= 90) return 'excellent';
  if (n >= 75) return 'good';
  if (n >= 60) return 'fair';
  if (n >= 40) return 'poor';
  if (n > 0) return 'dead';
  return '';
}

/** "284 east av" as somebody would write it on an envelope. */
export function formatAddress(number, street) {
  const num = String(number ?? '').trim();
  const st = String(street ?? '').trim()
    .replace(/\s+/g, ' ')
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\bAv\b/, 'Ave')
    .replace(/\bSt\b/, 'St');
  if (!st) return '';
  return num ? `${num} ${st}` : st;
}

/** The date part of one of the source's timestamps, or '' if there is none. */
export function recordedOn(value) {
  const m = String(value ?? '').trim().match(/^(\d{4})[/-](\d{2})[/-](\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

const coord = (n) => n.toFixed(6);

/**
 * A positive measurement as the source wrote it, or '' for the 0s and blanks —
 * nought inches or nought feet is a field left empty, not a measurement.
 */
function measure(value) {
  const n = Number(String(value ?? '').trim());
  return Number.isFinite(n) && n > 0 ? String(n) : '';
}

/** A planting year, or '' for the 0s and blanks the source is full of. */
function plantedYear(value) {
  const n = Number(String(value ?? '').trim());
  return Number.isInteger(n) && n > 1800 && n <= new Date().getFullYear() ? String(n) : '';
}

/**
 * @param {object} args
 * @param {object[]} args.rows        parsed rows of Burlington's CSV export
 * @param {Map} args.speciesLookup    from buildSpeciesLookup
 * @param {object} args.campusAreas   data/campus-areas.geojson
 * @returns {{
 *   inserts: object[],
 *   skipped: Record<string, number>,
 *   unknownSpecies: Map<string, number>,
 *   summary: object
 * }}
 */
export function importCityTrees({ rows, speciesLookup, campusAreas }) {
  const inserts = [];
  const skipped = {};
  const unknownSpecies = new Map();
  const byArea = {};
  const seen = new Set();
  let offCampus = 0;

  const skip = (reason) => { skipped[reason] = (skipped[reason] ?? 0) + 1; };

  for (const row of rows) {
    const x = Number(row.X);
    const y = Number(row.Y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) { skip('no position'); continue; }

    const { lat, lng } = fromStatePlaneFeet(x, y);
    const area = campusAt(lng, lat, campusAreas);
    // The clip. Most of Burlington's 14,429 trees are nowhere near campus and
    // are not this project's business.
    if (!area) { offCampus += 1; continue; }

    if (String(row.site_typ ?? '').trim() !== STANDING_TREE) {
      skip(`site_typ ${String(row.site_typ ?? '').trim() || '(blank)'} — not a standing tree`);
      continue;
    }

    const name = String(row.botanic ?? '').trim();
    const taxonId = name ? resolveSpecies(name, speciesLookup) : undefined;
    if (!taxonId) {
      if (name && taxonId === undefined) unknownSpecies.set(name, (unknownSpecies.get(name) ?? 0) + 1);
      skip(name ? 'species not resolved' : 'no species recorded');
      continue;
    }

    // site_id is Burlington's own public identifier and is unique across the
    // clip, so it is what the map shows. GlobalID is kept as provenance for the
    // same reason the ArcGIS import keeps one: a re-clip has to recognise this
    // row rather than add it again.
    const siteId = String(row.site_id ?? '').trim();
    if (!siteId) { skip('no site_id'); continue; }
    const cityId = `BTV-${siteId}`;
    if (seen.has(cityId)) { skip('duplicate site_id'); continue; }
    seen.add(cityId);

    byArea[area] = (byArea[area] ?? 0) + 1;
    inserts.push({
      city_id: cityId,
      taxon_id: taxonId,
      lat: coord(lat),
      lng: coord(lng),
      collection_id: area,
      dbh_in: measure(row.diameter),
      // Feet, like the university's own height_ft and spread_ft. The export
      // does not say so; the values do — 10 to 45 on campus, in steps of 5,
      // which is a street tree in feet and nothing at all in metres.
      height_ft: measure(row.height),
      spread_ft: measure(row.spread),
      condition: conditionFromScore(row.conditn),
      planted_year: plantedYear(row.planted),
      address: formatAddress(row.add_num, row.add_str),
      recorded_on: recordedOn(row.modified),
      source_id: String(row.GlobalID ?? '').trim(),
    });
  }

  // Stable, so a re-clip produces the same file and the diff shows only what
  // actually changed in Burlington's records.
  inserts.sort((a, b) => Number(a.city_id.slice(4)) - Number(b.city_id.slice(4)));

  return {
    inserts,
    skipped,
    unknownSpecies,
    summary: {
      read: rows.length,
      offCampus,
      kept: inserts.length,
      skipped: Object.values(skipped).reduce((n, v) => n + v, 0),
      byArea,
      withDbh: inserts.filter((r) => r.dbh_in).length,
      withHeight: inserts.filter((r) => r.height_ft).length,
      withSpread: inserts.filter((r) => r.spread_ft).length,
      withYear: inserts.filter((r) => r.planted_year).length,
    },
  };
}

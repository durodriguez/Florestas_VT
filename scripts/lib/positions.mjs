// Applying position corrections made in /positions/ to plants.csv.
//
// A correction is not a visit. It changes a plant's lat, lng and
// geolocation_notes — the last of which never leaves the repository — and, if
// the tree has crossed a campus boundary, its collection_id. It writes nothing
// to observations.csv, so "Last surveyed" and the survey history on the public
// map are exactly what they were.
//
// Pure: takes rows and moves, returns what would change and what is wrong.
// The script around it does the reading, the reporting and the writing.

import { campusAt } from './geo.mjs';

/** A move this far from the position on file was made against other data. */
export const STALE_M = 0.5;
/** Moves longer than this are applied, but listed for a second look. */
export const LONG_MOVE_M = 100;

const R = 6371008.8;
const rad = (d) => (d * Math.PI) / 180;
export function metres(lat1, lng1, lat2, lng2) {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const num = (v) => (v === undefined || String(v).trim() === '' ? NaN : Number(v));

/**
 * @param {object[]} plantRows   data/plants.csv as objects
 * @param {object[]} moveRows    the file /positions/ exports
 * @param {object}   opts
 * @param {[[number,number],[number,number]]} opts.bounds  config.map.bounds
 * @param {object}   [opts.areas] campus-areas.geojson, to re-file a tree that crosses a boundary
 * @returns {{ updates: {plant_id: string, changes: object, metres: number}[], issues: {level: string, message: string}[] }}
 */
export function applyPositions(plantRows, moveRows, { bounds, areas } = {}) {
  const byId = new Map(plantRows.map((p) => [String(p.plant_id ?? '').trim(), p]));
  const updates = [];
  const issues = [];
  const seen = new Set();
  const err = (message) => issues.push({ level: 'error', message });
  const warn = (message) => issues.push({ level: 'warning', message });

  for (const m of moveRows) {
    const id = String(m.plant_id ?? '').trim();
    if (!id) { err('a row has no plant_id'); continue; }
    if (seen.has(id)) { err(`${id} appears twice — export again from /positions/`); continue; }
    seen.add(id);

    const plant = byId.get(id);
    if (!plant) { err(`${id} is not in plants.csv`); continue; }

    const [fromLat, fromLng, lat, lng] = [m.from_lat, m.from_lng, m.lat, m.lng].map(num);
    if ([fromLat, fromLng, lat, lng].some(Number.isNaN)) { err(`${id}: a coordinate is missing or not a number`); continue; }

    // The check that keeps an old export from undoing newer work: the move
    // was made from where the record had the tree then, and must still be.
    const drift = metres(Number(plant.lat), Number(plant.lng), fromLat, fromLng);
    if (drift > STALE_M) {
      err(`${id} has moved ${drift.toFixed(1)} m since this file was made — move it again in /positions/`);
      continue;
    }

    if (bounds) {
      const [[s, w], [n, e]] = bounds;
      if (lat < s || lat > n || lng < w || lng > e) { err(`${id}: ${lat}, ${lng} is outside the campus bounds`); continue; }
    }

    const moved = metres(fromLat, fromLng, lat, lng);
    if (moved < 0.1) continue;
    if (moved > LONG_MOVE_M) warn(`${id} moves ${moved.toFixed(0)} m — check it is the tree you meant`);

    const on = String(m.moved_on ?? '').trim();
    const changes = {
      lat: lat.toFixed(6),
      lng: lng.toFixed(6),
      geolocation_notes: `Position corrected on imagery${on ? `, ${on}` : ''}`,
    };
    if (areas) {
      const campus = campusAt(lng, lat, areas);
      const was = String(plant.collection_id ?? '').trim();
      if (campus && campus !== was) {
        changes.collection_id = campus;
        warn(`${id} crosses into ${campus} (was ${was || 'none'})`);
      }
    }
    updates.push({ plant_id: id, changes, metres: moved });
  }
  return { updates, issues };
}

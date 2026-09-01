// Turns a raw field-survey export into rows that satisfy the plants.csv schema.
// Kept free of filesystem access so the test suite can exercise it directly.
//
// Field crews produce messy data by nature: common names instead of taxon ids,
// "EXC" instead of "excellent", area names instead of ids, coordinates in
// whatever format the app happened to emit. Everything here is about absorbing
// that variation without silently guessing — anything ambiguous stops the row
// and is reported, rather than being imported wrong.

import { CONDITIONS } from './vocab.mjs';

const trim = (v) => (typeof v === 'string' ? v.trim() : v ?? '');

/** Loose header match: "DBH (in)" and "dbh_in" are the same column. */
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Decimal degrees, or degrees-minutes-seconds as field apps often emit it.
 * Returns null for blanks and NaN for anything unparseable.
 */
export function parseCoord(value) {
  const raw = trim(value);
  if (raw === '') return null;

  const plain = Number(raw);
  if (Number.isFinite(plain)) return plain;

  // 44°28'40.5"N  /  44 28 40.5 N  /  73d 11m 44s W
  const dms = raw.match(
    /^(-?\d+(?:\.\d+)?)\s*[°d:\s]\s*(\d+(?:\.\d+)?)\s*['m:\s]\s*(\d+(?:\.\d+)?)?\s*["s]?\s*([NSEW])?$/i,
  );
  if (dms) {
    const [, d, m, s, hemi] = dms;
    const deg = Math.abs(Number(d)) + Number(m) / 60 + Number(s ?? 0) / 3600;
    const negative = Number(d) < 0 || /[SW]/i.test(hemi ?? '');
    return negative ? -deg : deg;
  }

  // 44.4779 N  /  73.1955 W
  const hemi = raw.match(/^(-?\d+(?:\.\d+)?)\s*([NSEW])$/i);
  if (hemi) {
    const n = Number(hemi[1]);
    return /[SW]/i.test(hemi[2]) ? -Math.abs(n) : n;
  }

  return NaN;
}

/**
 * A single cell holding both coordinates. Handles "lat, lng", WKT
 * "POINT(lng lat)" as QGIS exports it, and GeoJSON-ish "[lng, lat]".
 * Returns { lat, lng } or null.
 */
export function parseLatLng(value) {
  const raw = trim(value);
  if (raw === '') return null;

  const wkt = raw.match(/^POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)$/i);
  if (wkt) return { lat: Number(wkt[2]), lng: Number(wkt[1]) };

  const bracketed = raw.match(/^\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\]$/);
  if (bracketed) return { lat: Number(bracketed[2]), lng: Number(bracketed[1]) };

  const pair = raw.split(/\s*[,;]\s*/);
  if (pair.length === 2) {
    const a = parseCoord(pair[0]);
    const b = parseCoord(pair[1]);
    if (Number.isFinite(a) && Number.isFinite(b)) return { lat: a, lng: b };
  }
  return null;
}

const NUMERIC_FIELDS = new Set(['dbh_in', 'height_ft', 'spread_ft', 'planted_year']);

/**
 * Did a re-survey actually change this field? Compared loosely on purpose:
 * "20" and "20.0" are the same measurement, and consumer GPS returns slightly
 * different coordinates every visit — reporting either as a change would bury
 * the real edits in noise.
 */
function isChanged(field, oldValue, newValue, movedMeters, oldRow, newRow) {
  const old = trim(oldValue);

  if (field === 'lat' || field === 'lng') {
    const moved = metersBetween(
      Number(oldRow.lat), Number(oldRow.lng),
      Number(newRow.lat), Number(newRow.lng),
    );
    return Number.isFinite(moved) ? moved > movedMeters : old !== newValue;
  }

  if (NUMERIC_FIELDS.has(field)) {
    if (old === '') return true;
    return Number(old) !== Number(newValue);
  }

  return old !== newValue;
}

/** Great-circle distance in metres, for spotting a plant already on file. */
function metersBetween(aLat, aLng, bLat, bLng) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function num(value) {
  const raw = trim(value);
  if (raw === '') return null;
  // Tolerate a unit typed into the cell ("32.5 in", "68ft"), but require what
  // remains to be entirely numeric — stripping non-digits from "twelve" would
  // otherwise leave an empty string and quietly import it as zero.
  const cleaned = raw.replace(/\s*(inches|inch|in|feet|foot|ft|cm|mm|m|"|')\s*$/i, '').trim();
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return NaN;
  return Number(cleaned);
}

/** Resolve each schema field to the source header that carries it. */
export function resolveColumns(headers, columnAliases) {
  const present = new Map(headers.map((h) => [norm(h), h]));
  const resolved = {};
  const usedHeaders = new Set();

  for (const [field, aliases] of Object.entries(columnAliases)) {
    for (const alias of aliases) {
      const header = present.get(norm(alias));
      if (header !== undefined) {
        resolved[field] = header;
        usedHeaders.add(header);
        break;
      }
    }
  }
  const unmapped = headers.filter((h) => !usedHeaders.has(h) && trim(h) !== '');
  return { resolved, unmapped };
}

/** Highest existing sequence for `PREFIX-YEAR-NNNN`, so numbering continues. */
export function nextSequence(existingIds, prefix, year) {
  const re = new RegExp(`^${prefix}-${year}-(\\d+)$`, 'i');
  let max = 0;
  for (const id of existingIds) {
    const m = String(id).match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

/** `UVM-2026-0001` for a newly issued number, `UVM-0772` for an adopted tag. */
const formatAccession = (prefix, year, seq) =>
  year === null
    ? `${prefix}-${String(seq).padStart(4, '0')}`
    : `${prefix}-${year}-${String(seq).padStart(4, '0')}`;

function buildSpeciesLookup(taxaRows) {
  // Exact identifiers (taxon_id, scientific name, common name) are what a
  // surveyor actually writes down. "Genus species" assembled from the columns
  // is a convenience fallback, and must never make an exact name ambiguous —
  // otherwise adding Acer platanoides 'Crimson King' would block every plain
  // Acer platanoides from importing.
  const exact = new Map();
  const derived = new Map();

  const add = (map, key, id) => {
    const k = norm(key);
    if (!k) return;
    // A name that maps to two taxa is ambiguous; remember that so we can refuse
    // it rather than silently picking the first.
    if (map.has(k) && map.get(k) !== id) map.set(k, null);
    else map.set(k, id);
  };

  for (const t of taxaRows) {
    const id = trim(t.taxon_id);
    if (!id) continue;
    add(exact, id, id);
    add(exact, t.scientific_name, id);
    add(exact, t.common_name, id);
    if (trim(t.genus) && trim(t.species)) add(derived, `${t.genus} ${t.species}`, id);
  }

  const lookup = new Map(derived);
  for (const [key, id] of exact) lookup.set(key, id);
  return lookup;
}

function buildCollectionLookup(collectionRows) {
  const lookup = new Map();
  for (const c of collectionRows) {
    const id = trim(c.collection_id);
    if (!id) continue;
    lookup.set(norm(id), id);
    lookup.set(norm(c.name), id);
  }
  return lookup;
}

function buildConditionLookup(conditionAliases) {
  const lookup = new Map();
  for (const value of CONDITIONS) lookup.set(norm(value), value);
  for (const [value, aliases] of Object.entries(conditionAliases ?? {})) {
    for (const alias of aliases) lookup.set(norm(alias), value);
  }
  return lookup;
}

/**
 * @returns {{
 *   inserts: object[], updates: {plant_id: string, changes: object}[],
 *   issues: {row: number, level: 'error'|'warning', message: string}[],
 *   unknownSpecies: Map<string, number>, unmapped: string[], summary: object
 * }}
 */
export function importSurvey({
  rows,
  headers,
  mapping,
  taxaRows,
  plantRows,
  collectionRows,
  config,
  year = new Date().getFullYear(),
  duplicateMeters = 2,
  movedMeters = 0.5,
  adoptTags = false,
}) {
  const { resolved, unmapped } = resolveColumns(headers, mapping.columns);
  const species = buildSpeciesLookup(taxaRows);
  const collections = buildCollectionLookup(collectionRows);
  const conditions = buildConditionLookup(mapping.conditions);

  const existing = new Map(plantRows.map((p) => [trim(p.plant_id), p]));
  const prefix = config.accessionPrefix ?? 'PLANT';
  const bounds = config?.map?.bounds;

  let seq = nextSequence(existing.keys(), prefix, year);
  const takenIds = new Set(existing.keys());

  const inserts = [];
  const updates = [];
  const issues = [];
  const unknownSpecies = new Map();

  const get = (row, field) => (resolved[field] ? trim(row[resolved[field]]) : '');

  rows.forEach((row, i) => {
    const n = i + 2; // header is line 1
    const error = (message) => issues.push({ row: n, level: 'error', message });
    const warn = (message) => issues.push({ row: n, level: 'warning', message });

    // Skip rows that are entirely blank — trailing lines are common in exports.
    if (Object.values(row).every((v) => trim(v) === '')) return;

    // --- species -----------------------------------------------------------
    const speciesRaw = get(row, 'species');
    if (!speciesRaw) {
      error('no species recorded');
      return;
    }
    const taxonId = species.get(norm(speciesRaw));
    if (taxonId === undefined) {
      unknownSpecies.set(speciesRaw, (unknownSpecies.get(speciesRaw) ?? 0) + 1);
      error(`species "${speciesRaw}" is not in taxa.csv`);
      return;
    }
    if (taxonId === null) {
      error(`species "${speciesRaw}" matches more than one taxon — use the taxon_id`);
      return;
    }

    // --- coordinates -------------------------------------------------------
    let lat = parseCoord(get(row, 'lat'));
    let lng = parseCoord(get(row, 'lng'));
    if (lat === null && lng === null) {
      const combined = parseLatLng(get(row, 'latlng'));
      if (combined) ({ lat, lng } = combined);
    }
    if (lat === null || lng === null || Number.isNaN(lat) || Number.isNaN(lng)) {
      error('could not read a latitude and longitude');
      return;
    }
    if (bounds) {
      const [[minLat, minLng], [maxLat, maxLng]] = bounds;
      if (lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) {
        warn(`${lat}, ${lng} is outside the campus bounds — check for a swapped or unsigned coordinate`);
      }
    }

    // --- condition ---------------------------------------------------------
    const conditionRaw = get(row, 'condition');
    let condition = '';
    if (conditionRaw) {
      const match = conditions.get(norm(conditionRaw));
      if (!match) {
        error(`condition "${conditionRaw}" is not recognised — add it to survey/mapping.json`);
        return;
      }
      condition = match;
    }

    // --- collection --------------------------------------------------------
    const collectionRaw = get(row, 'collection');
    let collection = '';
    if (collectionRaw) {
      const match = collections.get(norm(collectionRaw));
      if (!match) {
        error(`area "${collectionRaw}" is not in collections.csv`);
        return;
      }
      collection = match;
    }

    // --- measurements ------------------------------------------------------
    const measures = {};
    for (const field of ['dbh_in', 'height_ft', 'spread_ft', 'planted_year']) {
      const v = num(get(row, field));
      if (Number.isNaN(v)) {
        error(`"${get(row, field)}" in ${field} is not a number`);
        return;
      }
      measures[field] = v === null ? '' : String(v);
    }

    const record = {
      taxon_id: taxonId,
      lat: lat.toFixed(6),
      lng: lng.toFixed(6),
      collection_id: collection,
      ...measures,
      condition,
      status: 'active',
      surveyed_on: get(row, 'surveyed_on'),
      surveyor: get(row, 'surveyor'),
      photo: get(row, 'photo'),
      memorial: get(row, 'memorial'),
      notes: get(row, 'notes'),
    };

    // --- new accession, or an update to an existing one --------------------
    // --- new accession, or an update to an existing one --------------------
    const tag = get(row, 'plant_id');
    if (tag) {
      // A bare number is a physical tag stamped on the tree. Its accession is
      // that number in the project's prefix form, so a surveyor reading "772"
      // off a metal tag and the record UVM-0772 are the same tree.
      const bareTag = /^\d+$/.test(tag);
      const asAccession = bareTag ? formatAccession(prefix, null, Number(tag)) : tag;
      const known = existing.has(tag) ? tag : existing.has(asAccession) ? asAccession : null;

      if (!known) {
        if (adoptTags && bareTag) {
          // First survey of an already-tagged tree: adopt the tag as its
          // accession rather than issuing a parallel number nobody can read
          // in the field.
          if (takenIds.has(asAccession)) {
            error(`tag "${tag}" maps to ${asAccession}, which is already in use`);
            return;
          }
          takenIds.add(asAccession);
          inserts.push({ plant_id: asAccession, ...record });
          return;
        }
        error(
          `tag "${tag}" is not an existing accession — leave the column blank to assign a new ` +
          'one, or pass --adopt-tags to register physical tags as accession numbers',
        );
        return;
      }
      // Only carry across what the surveyor actually recorded, so a re-survey
      // that skipped a field does not blank out good data already on file.
      const before = existing.get(known);
      const changes = {};
      for (const [k, v] of Object.entries(record)) {
        if (v === '') continue;
        if (!isChanged(k, before[k], v, movedMeters, before, record)) continue;
        changes[k] = v;
      }
      if (Object.keys(changes).length === 0) {
        warn(`tag "${tag}" re-surveyed with no changed values`);
        return;
      }
      updates.push({ plant_id: known, changes });
      return;
    }

    let id = formatAccession(prefix, year, seq++);
    while (takenIds.has(id)) id = formatAccession(prefix, year, seq++);
    takenIds.add(id);
    inserts.push({ plant_id: id, ...record });
  });

  // A field export carries no accession for a new plant, so importing the same
  // file twice would add every tree again. Flag inserts that land on top of a
  // plant of the same species already on file.
  const duplicates = [];
  if (duplicateMeters > 0) {
    for (const insert of inserts) {
      const lat = Number(insert.lat);
      const lng = Number(insert.lng);
      const near = plantRows.find(
        (p) =>
          trim(p.taxon_id) === insert.taxon_id &&
          trim(p.status || 'active') === 'active' &&
          metersBetween(lat, lng, Number(p.lat), Number(p.lng)) <= duplicateMeters,
      );
      if (near) {
        duplicates.push({ plant_id: insert.plant_id, existing: trim(near.plant_id) });
        issues.push({
          row: 0,
          level: 'warning',
          message: `${insert.plant_id} sits within ${duplicateMeters} m of existing ${trim(near.plant_id)} (same species)`,
        });
      }
    }
    // A handful of collisions is plausible in a hedge or a clump. Most of the
    // batch colliding means the file has already been imported.
    if (inserts.length >= 3 && duplicates.length > inserts.length / 2) {
      issues.push({
        row: 0,
        level: 'error',
        message:
          `${duplicates.length} of ${inserts.length} new plants duplicate existing records — ` +
          'this file looks like it has already been imported. Re-run with --allow-duplicates if it really is new planting.',
      });
    }
  }

  return {
    inserts,
    updates,
    duplicates,
    issues,
    unknownSpecies,
    unmapped,
    resolved,
    summary: {
      read: rows.length,
      inserts: inserts.length,
      updates: updates.length,
      duplicates: duplicates.length,
      errors: issues.filter((i) => i.level === 'error').length,
      warnings: issues.filter((i) => i.level === 'warning').length,
    },
  };
}

/** Paste-ready taxa.csv stubs for species the survey found but the list lacks. */
export function taxaStubs(unknownSpecies) {
  return [...unknownSpecies.keys()].map((name) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `${slug},${name},,,,,,,tree,deciduous,,,,,,,,,,`;
  });
}

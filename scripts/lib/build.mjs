// Pure data-transformation logic: CSV rows in, validated dataset out.
// Kept free of filesystem access so the test suite can exercise it directly.

import {
  CONDITIONS, STATUSES, ORIGINS, PLANT_TYPES, DEDICATED,
  TAXON_REQUIRED, PLANT_REQUIRED, OBSERVATION_REQUIRED,
  TAXON_NUMERIC, PLANT_NUMERIC, OBSERVATION_NUMERIC,
  OBSERVATION_COLUMNS, PLANT_FIELDS, OBSERVATION_FIELDS,
} from './vocab.mjs';
import { buildSpeciesLookup } from './species.mjs';

const trim = (v) => (typeof v === 'string' ? v.trim() : v ?? '');

/** Parse a numeric cell. Returns null for blanks, NaN for junk. */
function num(value) {
  const raw = trim(value);
  if (raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

/** "4,5" or "4;5" or "4 5" -> [4, 5] */
function monthList(value) {
  const raw = trim(value);
  if (raw === '') return [];
  return raw
    .split(/[,;\s]+/)
    .filter(Boolean)
    .map(Number)
    .filter((m) => Number.isInteger(m) && m >= 1 && m <= 12);
}

/** "yellow-green" / "Yellow Green" -> normalised lowercase token */
const token = (value) => trim(value).toLowerCase().replace(/\s+/g, '-');

function enumIndex(value, list) {
  return list.indexOf(token(value));
}

/**
 * Survey dates are compared as strings to order a plant's history, which is
 * only correct for zero-padded ISO dates — "2026-9-1" would sort after
 * "2026-10-14" and silently make the wrong observation the current one.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Is a position inside the configured map bounds? Catches swapped lat/lng. */
function inBounds(lat, lng, config) {
  const [[south, west], [north, east]] = config.map.bounds;
  return lat >= south && lat <= north && lng >= west && lng <= east;
}

export function buildDataset({ taxaRows, plantRows, observationRows = [], collectionRows, trails, campusAreas, aliasRows = [], config }) {
  const errors = [];
  const warnings = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);
  const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

  // ---- collections -------------------------------------------------------
  const collections = [];
  const collectionIndex = new Map();
  collectionRows.forEach((row, i) => {
    const where = `collections.csv row ${i + 2}`;
    const id = trim(row.collection_id);
    if (!id) return err(where, 'missing collection_id');
    if (collectionIndex.has(id)) return err(where, `duplicate collection_id "${id}"`);
    collectionIndex.set(id, collections.length);
    collections.push({
      id,
      name: trim(row.name) || id,
      color: trim(row.color) || '#6b7280',
      description: trim(row.description),
    });
  });

  // ---- taxa --------------------------------------------------------------
  const taxa = [];
  const taxonIndex = new Map();
  taxaRows.forEach((row, i) => {
    const where = `taxa.csv row ${i + 2}`;
    const id = trim(row.taxon_id);

    for (const field of TAXON_REQUIRED) {
      if (!trim(row[field])) err(where, `missing required field "${field}"`);
    }
    if (!id) return;
    if (taxonIndex.has(id)) return err(where, `duplicate taxon_id "${id}"`);

    for (const field of TAXON_NUMERIC) {
      if (Number.isNaN(num(row[field]))) err(where, `"${field}" is not a number: "${row[field]}"`);
    }

    const type = token(row.plant_type);
    if (type && !PLANT_TYPES.includes(type)) {
      err(where, `plant_type "${row.plant_type}" is not one of: ${PLANT_TYPES.join(', ')}`);
    }
    const origin = token(row.origin);
    if (origin && !ORIGINS.includes(origin)) {
      err(where, `origin "${row.origin}" is not one of: ${ORIGINS.join(', ')}`);
    }

    taxonIndex.set(id, taxa.length);
    taxa.push({
      id,
      sci: trim(row.scientific_name),
      common: trim(row.common_name),
      family: trim(row.family),
      genus: trim(row.genus),
      species: trim(row.species),
      infra: trim(row.infraspecific),
      cultivar: trim(row.cultivar),
      type,
      origin,
      flowerColor: token(row.flower_color),
      flowerMonths: monthList(row.flower_months),
      fruitColor: token(row.fruit_color),
      fruitMonths: monthList(row.fruit_months),
      fallColor: token(row.fall_color),
      matureHeightFt: num(row.mature_height_ft),
      matureSpreadFt: num(row.mature_spread_ft),
      bark: trim(row.bark_profile),
      pests: trim(row.pest_resistance),
      soil: trim(row.soil_preference),
      zones: trim(row.hardiness_zones),
      wikipedia: trim(row.wikipedia_url),
      description: trim(row.description),
      count: 0, // filled in below
    });
  });

  // ---- plants ------------------------------------------------------------
  // Identity only: what the tree is and where it stands. Nothing here is a
  // measurement, so a re-survey never rewrites one of these rows.
  const bounds = config?.map?.bounds;
  const plantsMeta = [];
  const seenPlantIds = new Set();

  plantRows.forEach((row, i) => {
    const where = `plants.csv row ${i + 2}`;
    const id = trim(row.plant_id);

    for (const field of PLANT_REQUIRED) {
      if (!trim(row[field])) err(where, `missing required field "${field}"`);
    }
    if (!id) return;
    if (seenPlantIds.has(id)) return err(where, `duplicate plant_id "${id}"`);
    seenPlantIds.add(id);

    const taxonId = trim(row.taxon_id);
    const tIdx = taxonIndex.get(taxonId);
    if (tIdx === undefined) {
      return err(where, `taxon_id "${taxonId}" has no matching row in taxa.csv`);
    }

    const lat = num(row.lat);
    const lng = num(row.lng);
    if (lat === null || Number.isNaN(lat) || lng === null || Number.isNaN(lng)) {
      return err(where, `lat/lng must both be numbers (got "${row.lat}", "${row.lng}")`);
    }
    if (bounds) {
      const [[minLat, minLng], [maxLat, maxLng]] = bounds;
      if (lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) {
        warn(where, `${lat}, ${lng} falls outside the campus bounds in data/config.json`);
      }
    }

    for (const field of PLANT_NUMERIC) {
      if (Number.isNaN(num(row[field]))) err(where, `"${field}" is not a number: "${row[field]}"`);
    }

    const collectionId = trim(row.collection_id);
    let cIdx = -1;
    if (collectionId) {
      const found = collectionIndex.get(collectionId);
      if (found === undefined) {
        err(where, `collection_id "${collectionId}" has no matching row in collections.csv`);
      } else {
        cIdx = found;
      }
    } else {
      warn(where, 'no collection_id set');
    }

    // A measurement left on a plants.csv row is data that will never be read:
    // the map takes every one of these from the latest observation. Say so
    // rather than dropping it, because the number itself may be the only copy.
    for (const field of OBSERVATION_COLUMNS) {
      if (field === 'plant_id') continue;
      if (trim(row[field]) !== '') {
        err(
          where,
          `"${field}" belongs in observations.csv, not plants.csv — move it to a row ` +
            `for ${id} with the date it was recorded` +
            // "notes" is the one that splits two ways, and sending a remark
            // about the coordinates off to observations.csv would file it
            // under a visit rather than beside the position it describes.
            (field === 'notes' ? ', or into geolocation_notes if it is about the position' : ''),
        );
      }
    }

    // "yes" or blank, and nothing else: this drives a banner on the public
    // record, so a stray value must not quietly read as false.
    const dedicatedRaw = token(row.dedicated);
    if (dedicatedRaw && dedicatedRaw !== DEDICATED) {
      err(where, `dedicated must be "${DEDICATED}" or blank, got "${row.dedicated}"`);
    }
    const label = trim(row.dedication_label);
    // A tree with plaque wording on file is self-evidently a dedicated one, so
    // render it as such — but say so, because the blank flag is a slip and the
    // next person to filter on that column will not find this tree.
    if (label && !dedicatedRaw) {
      warn(where, `has a dedication_label but dedicated is blank — set dedicated to "${DEDICATED}"`);
    }

    plantsMeta.push({
      id,
      taxon: tIdx,
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      collection: cIdx,
      planted_year: num(row.planted_year),
      dedicated: dedicatedRaw === DEDICATED || Boolean(label) ? 1 : 0,
      dedication_label: label || null,
    });
  });

  // ---- observations ------------------------------------------------------
  // One row per plant per visit, appended and never overwritten. The map shows
  // the most recent; the rest is what makes growth over time answerable.
  const history = new Map();
  const seenObservations = new Set();

  observationRows.forEach((row, i) => {
    const where = `observations.csv row ${i + 2}`;
    const id = trim(row.plant_id);
    const date = trim(row.surveyed_on);

    for (const field of OBSERVATION_REQUIRED) {
      if (!trim(row[field])) err(where, `missing required field "${field}"`);
    }
    if (!id || !date) return;
    if (!seenPlantIds.has(id)) {
      return err(where, `plant_id "${id}" has no matching row in plants.csv`);
    }
    if (!ISO_DATE.test(date)) {
      return err(where, `surveyed_on "${date}" must be a date as YYYY-MM-DD`);
    }
    // Two observations of one tree on one day are a file imported twice far
    // more often than they are two crews measuring the same trunk, and only one
    // of them can be the latest — so which reading the map shows would come
    // down to row order.
    const key = `${id}\u0000${date}`;
    if (seenObservations.has(key)) {
      return err(where, `${id} already has an observation dated ${date}`);
    }
    seenObservations.add(key);

    for (const field of OBSERVATION_NUMERIC) {
      if (Number.isNaN(num(row[field]))) err(where, `"${field}" is not a number: "${row[field]}"`);
    }

    let condIdx = -1;
    if (trim(row.condition)) {
      condIdx = enumIndex(row.condition, CONDITIONS);
      if (condIdx === -1) {
        err(where, `condition "${row.condition}" is not one of: ${CONDITIONS.join(', ')}`);
      }
    }

    const statusRaw = trim(row.status) || 'active';
    const statusIdx = enumIndex(statusRaw, STATUSES);
    if (statusIdx === -1) {
      err(where, `status "${statusRaw}" is not one of: ${STATUSES.join(', ')}`);
    }

    if (!history.has(id)) history.set(id, []);
    history.get(id).push({
      surveyed_on: date,
      surveyor: trim(row.surveyor) || null,
      dbh_in: num(row.dbh_in),
      height_ft: num(row.height_ft),
      spread_ft: num(row.spread_ft),
      condition: condIdx,
      status: statusIdx === -1 ? 0 : statusIdx,
      photo: trim(row.photo) || null,
      notes: trim(row.notes) || null,
    });
  });

  for (const series of history.values()) {
    series.sort((a, b) => a.surveyed_on.localeCompare(b.surveyed_on));
  }

  // ---- plants + their latest observation ---------------------------------
  // Flattened together here so the map, the filters and the clustering carry on
  // seeing one row per plant and need to know nothing about the history.
  const plantRowsOut = [];
  const historyOut = {};
  const NO_SURVEY = {
    surveyed_on: null, surveyor: null, dbh_in: null, height_ft: null, spread_ft: null,
    condition: -1, status: STATUSES.indexOf('active'), photo: null, notes: null,
  };

  for (const plant of plantsMeta) {
    const series = history.get(plant.id) ?? [];
    // A mapped tree nobody has surveyed yet is a normal state, not an error —
    // it is most of what a municipal inventory gives you.
    const latest = series.at(-1) ?? NO_SURVEY;

    const record = {
      plant_id: plant.id,
      taxon: plant.taxon,
      lat: plant.lat,
      lng: plant.lng,
      collection: plant.collection,
      dbh_in: latest.dbh_in,
      height_ft: latest.height_ft,
      spread_ft: latest.spread_ft,
      condition: latest.condition,
      planted_year: plant.planted_year,
      status: latest.status,
      surveyed_on: latest.surveyed_on,
      surveyor: latest.surveyor,
      photo: latest.photo,
      dedicated: plant.dedicated,
      dedication_label: plant.dedication_label,
      notes: latest.notes,
      surveys: series.length,
    };

    if (record.status === STATUSES.indexOf('active')) taxa[plant.taxon].count += 1;
    plantRowsOut.push(PLANT_FIELDS.map((f) => record[f]));
    // One observation is already on the row above; sending it a second time
    // would double the file to say nothing new.
    if (series.length > 1) {
      historyOut[plant.id] = series.map((o) => OBSERVATION_FIELDS.map((f) => o[f]));
    }
  }

  // Once a full species list is loaded, most taxa legitimately have no mapped
  // plant yet — the list runs ahead of the survey by design. Summarise rather
  // than emitting a line each, which would bury the warnings that matter.
  const unused = taxa.filter((t) => t.count === 0);
  if (unused.length) {
    const sample = unused.slice(0, 5).map((t) => t.id).join(', ');
    warn(
      'taxa.csv',
      `${unused.length} taxa are not referenced by any active plant ` +
        `(${sample}${unused.length > 5 ? ', …' : ''}) — expected while the species ` +
        'list runs ahead of the survey',
    );
  }

  // ---- trails ------------------------------------------------------------
  const trailFeatures = (trails?.features ?? []).map((f, i) => {
    const where = `trails.geojson feature ${i}`;
    const stops = f.properties?.stops ?? [];
    for (const stop of stops) {
      if (!seenPlantIds.has(stop)) {
        warn(where, `stop "${stop}" is not a plant_id in plants.csv`);
      }
    }
    if (f.geometry?.type !== 'LineString') {
      err(where, `geometry must be a LineString, got "${f.geometry?.type}"`);
    }
    return f;
  });

  // ---- species aliases ---------------------------------------------------
  // Not used by the map, which only ever sees canonical names — but validated
  // here so a broken alias fails the build rather than surfacing months later
  // as an import that silently drops a thousand trees.
  const { conflicts } = buildSpeciesLookup(taxaRows, aliasRows);
  for (const c of conflicts) {
    err('species-aliases.csv', `alias "${c.alias}": ${c.reason}`);
  }
  const aliasCount = aliasRows.filter((r) => trim(r.alias)).length;

  // ---- campus areas ------------------------------------------------------
  // The campus outline and its five named sub-campuses, drawn as an optional
  // overlay. Geometry only: nothing else in the dataset depends on it, so a bad
  // ring degrades the overlay rather than the map.
  const areaFeatures = [];
  const seenAreaIds = new Set();
  let provisionalAreas = 0;
  (campusAreas?.features ?? []).forEach((f, i) => {
    const where = `campus-areas.geojson feature ${i}`;
    const props = f.properties ?? {};
    const id = trim(props.area_id);
    if (!id) return err(where, 'missing area_id');
    if (seenAreaIds.has(id)) return err(where, `duplicate area_id "${id}"`);
    if (props.kind !== 'boundary' && props.kind !== 'campus') {
      return err(where, `kind must be "boundary" or "campus", got "${props.kind}"`);
    }
    if (f.geometry?.type !== 'Polygon' && f.geometry?.type !== 'MultiPolygon') {
      return err(where, `geometry must be a Polygon or MultiPolygon, got "${f.geometry?.type}"`);
    }
    const rings = f.geometry.type === 'Polygon' ? f.geometry.coordinates : f.geometry.coordinates.flat();
    for (const ring of rings) {
      if (!Array.isArray(ring) || ring.length < 4) {
        return err(where, 'each ring needs at least 4 positions (first repeated as last)');
      }
      const [fx, fy] = ring[0];
      const [lx, ly] = ring[ring.length - 1];
      if (fx !== lx || fy !== ly) return err(where, 'ring is not closed — repeat the first position as the last');
      // A ring outside the configured map bounds is almost always lat/lng
      // written the wrong way round, which is invisible on screen: the shape
      // simply never appears.
      for (const [lng, lat] of ring) {
        if (!inBounds(lat, lng, config)) {
          return err(where, `position ${lat}, ${lng} is outside the map bounds — are lat and lng swapped?`);
        }
      }
    }
    seenAreaIds.add(id);
    if (props.provisional) provisionalAreas++;
    areaFeatures.push({
      type: 'Feature',
      properties: {
        area_id: id,
        name: trim(props.name) || id,
        kind: props.kind,
        color: trim(props.color) || '#154734',
        description: trim(props.description),
        provisional: Boolean(props.provisional),
      },
      geometry: f.geometry,
    });
  });
  // collections.csv drives the map's campus-area filter; campus-areas.geojson
  // draws the polygons. They are separate files because a collection can be a
  // bed finer than a campus, but where they share an id they should agree, and
  // an id in one and not the other is almost always a rename that stopped
  // half-way — a filter option with no shape, or a shape nothing can filter to.
  for (const feature of areaFeatures) {
    if (feature.properties.kind !== 'campus') continue;
    const index = collectionIndex.get(feature.properties.area_id);
    if (index === undefined) {
      warn(
        'campus-areas.geojson',
        `"${feature.properties.area_id}" has no matching collection_id in collections.csv, ` +
          'so it is drawn on the map but cannot be filtered by',
      );
      continue;
    }
    const collection = collections[index];
    if (collection.name !== feature.properties.name) {
      warn('collections.csv', `"${collection.id}" is named "${collection.name}" but the map area says "${feature.properties.name}"`);
    }
    if (collection.color !== feature.properties.color) {
      warn('collections.csv', `"${collection.id}" is ${collection.color} but the map area is drawn ${feature.properties.color}`);
    }
  }

  if (provisionalAreas > 0) {
    warn(
      'campus-areas.geojson',
      `${provisionalAreas} of ${areaFeatures.length} areas are still flagged provisional — ` +
        'the boundaries are estimates. Trace the real ones at /tracer/ (docs/CAMPUS-AREAS.md)',
    );
  }

  const dataset = {
    generatedAt: new Date().toISOString(),
    config,
    vocab: {
      conditions: CONDITIONS,
      statuses: STATUSES,
      plantTypes: PLANT_TYPES,
      origins: ORIGINS,
    },
    collections,
    taxa,
    trails: { type: 'FeatureCollection', features: trailFeatures },
    campusAreas: { type: 'FeatureCollection', features: areaFeatures },
    counts: {
      taxa: taxa.length,
      plants: plantRowsOut.length,
      observations: seenObservations.size,
      resurveyed: Object.keys(historyOut).length,
      unsurveyed: plantsMeta.filter((p) => !history.has(p.id)).length,
      active: plantRowsOut.filter((r) => r[PLANT_FIELDS.indexOf('status')] === STATUSES.indexOf('active')).length,
      collections: collections.length,
      trails: trailFeatures.length,
      campusAreas: areaFeatures.length,
      aliases: aliasCount,
    },
  };

  return {
    dataset,
    plants: {
      fields: PLANT_FIELDS,
      rows: plantRowsOut,
      observationFields: OBSERVATION_FIELDS,
      history: historyOut,
    },
    errors,
    warnings,
  };
}

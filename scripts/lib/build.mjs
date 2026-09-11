// Pure data-transformation logic: CSV rows in, validated dataset out.
// Kept free of filesystem access so the test suite can exercise it directly.

import {
  CONDITIONS, STATUSES, ORIGINS, PLANT_TYPES,
  TAXON_REQUIRED, PLANT_REQUIRED, TAXON_NUMERIC, PLANT_NUMERIC, PLANT_FIELDS,
} from './vocab.mjs';

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

/** Is a position inside the configured map bounds? Catches swapped lat/lng. */
function inBounds(lat, lng, config) {
  const [[south, west], [north, east]] = config.map.bounds;
  return lat >= south && lat <= north && lng >= west && lng <= east;
}

export function buildDataset({ taxaRows, plantRows, collectionRows, trails, campusAreas, config }) {
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
  const bounds = config?.map?.bounds;
  const plantRowsOut = [];
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

    const record = {
      plant_id: id,
      taxon: tIdx,
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      collection: cIdx,
      dbh_in: num(row.dbh_in),
      height_ft: num(row.height_ft),
      spread_ft: num(row.spread_ft),
      condition: condIdx,
      planted_year: num(row.planted_year),
      status: statusIdx === -1 ? 0 : statusIdx,
      surveyed_on: trim(row.surveyed_on) || null,
      surveyor: trim(row.surveyor) || null,
      photo: trim(row.photo) || null,
      memorial: trim(row.memorial) || null,
      notes: trim(row.notes) || null,
    };

    if (record.status === STATUSES.indexOf('active')) taxa[tIdx].count += 1;
    plantRowsOut.push(PLANT_FIELDS.map((f) => record[f]));
  });

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
      active: plantRowsOut.filter((r) => r[PLANT_FIELDS.indexOf('status')] === STATUSES.indexOf('active')).length,
      collections: collections.length,
      trails: trailFeatures.length,
      campusAreas: areaFeatures.length,
    },
  };

  return {
    dataset,
    plants: { fields: PLANT_FIELDS, rows: plantRowsOut },
    errors,
    warnings,
  };
}

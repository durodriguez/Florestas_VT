// Turning UVM's ArcGIS tree layer into plants and observations.
//
// The layer is the canonical map of the campus collection: 2,061 points
// surveyed between October 2023 and May 2024. It carries four things we want —
// a position, a tag number, a common name and a health rating — and several we
// deliberately drop, including the surveyor's email address, which appears on
// every row and has no business in a published dataset.
//
// The hard part is identity. Only about two thirds of the records carry a
// usable tag; the rest read "Young", or are blank, or say "1818 or 1942"
// because the surveyor could not tell which tag they were looking at. A few
// tag numbers appear on two clearly different trees. None of that is bad
// surveying — it is what a real inventory of a real campus looks like — but it
// means an accession number cannot simply be the tag.

import { resolveSpecies } from './species.mjs';
import { campusAt } from './geo.mjs';
import { CONDITIONS } from './vocab.mjs';

/** Where accession numbers for untagged trees start. Above the highest tag. */
export const UNTAGGED_BLOCK_START = 4001;

/** Two positions further apart than this are not the same tree by accident. */
export const POSITION_CONFLICT_M = 5;

const pad = (n) => String(n).padStart(4, '0');
export const accessionFor = (n) => `UVM-${pad(n)}`;

/** ArcGIS writes "Good", "Good " and "good" for the same thing. */
export function normalizeCondition(value) {
  const v = String(value ?? '').trim().toLowerCase();
  return CONDITIONS.includes(v) ? v : '';
}

/**
 * What a Tag_ID actually says. The field is free text, so it is read rather
 * than parsed: a tag we can trust, a tag we cannot, or no tag at all.
 */
export function readTag(raw) {
  const value = String(raw ?? '').trim();
  if (!value || /^young$/i.test(value)) return { kind: 'none' };
  if (/^\d+$/.test(value)) return { kind: 'number', number: Number(value) };
  // "1818 or 1942" — the surveyor saw a tag and could not read it with
  // confidence. The tree is real; the number is not usable as an identifier.
  if (/\bor\b/i.test(value)) return { kind: 'uncertain', text: value };
  return { kind: 'unreadable', text: value };
}

/** Metres between two positions. */
export function distanceMeters(aLat, aLng, bLat, bLng) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** ArcGIS epoch milliseconds to the YYYY-MM-DD an observation is filed under. */
export function surveyDate(ms) {
  if (!Number.isFinite(ms)) return '';
  return new Date(ms).toISOString().slice(0, 10);
}

const coord = (n) => n.toFixed(6);

/**
 * True when the row on file names a species inside the genus the source only
 * named. "Cedar" resolves to `thuja-sp`; a tree somebody has since identified
 * as `thuja-occidentalis` does not disagree with that, it sharpens it.
 *
 * Worth separating, because the two need opposite handling: a disagreement is
 * a question for the field, and a refinement is work already done. Reporting
 * a refinement as a conflict would ask somebody to re-check a tree that has
 * just been checked.
 */
export function isRefinement(sourceTaxonId, existingTaxonId, taxaById) {
  const src = taxaById?.get(sourceTaxonId);
  const cur = taxaById?.get(existingTaxonId);
  if (!src || !cur) return false;
  const genus = String(src.genus ?? '').trim().toLowerCase();
  if (!genus || genus !== String(cur.genus ?? '').trim().toLowerCase()) return false;
  // The source has to be the vaguer of the two: genus named, species blank.
  return !String(src.species ?? '').trim() && Boolean(String(cur.species ?? '').trim());
}

/**
 * @param {object} args
 * @param {object[]} args.features       GeoJSON features from the ArcGIS layer
 * @param {object[]} args.plants         existing data/plants.csv rows
 * @param {object[]} args.observations   existing data/observations.csv rows
 * @param {Map} args.speciesLookup       from buildSpeciesLookup
 * @param {Map} args.taxaById            taxa rows by id, for genus comparison
 * @param {object} args.campusAreas      data/campus-areas.geojson
 * @param {string} args.surveyor         who to credit on the observations
 * @returns {{
 *   inserts: object[], observations: object[],
 *   conflicts: {plant_id: string, kind: string, message: string}[],
 *   refinements: {plant_id: string, message: string}[],
 *   skipped: {objectId: number, reason: string, detail: string}[],
 *   summary: object
 * }}
 */
export function importArcgis({
  features,
  plants = [],
  observations = [],
  speciesLookup,
  taxaById,
  campusAreas,
  surveyor = '',
}) {
  const inserts = [];
  const newObservations = [];
  const conflicts = [];
  const refinements = [];
  const skipped = [];
  let matched = 0;

  // Every accession already spoken for: rows on file, and rows this run has
  // issued. A re-run must land on the same numbers, so features are walked in
  // OBJECTID order and nothing depends on iteration order elsewhere.
  const taken = new Set(plants.map((p) => String(p.plant_id).trim()));
  const byId = new Map(plants.map((p) => [String(p.plant_id).trim(), p]));
  // A tag identifies a tagged tree on a re-import. An untagged one has nothing
  // of its own, so the layer's GlobalID is kept as its provenance: without it
  // a second run would issue fresh numbers and quietly double a third of the
  // map. The id is a random UUID and says nothing about who recorded it.
  const bySource = new Map(
    plants.filter((p) => String(p.source_id ?? '').trim())
      .map((p) => [String(p.source_id).trim(), String(p.plant_id).trim()]),
  );
  const observed = new Set(
    observations.map((o) => `${String(o.plant_id).trim()}|${String(o.surveyed_on).trim()}`),
  );

  // A tag seen earlier in this run. The second tree wearing it cannot have the
  // same accession, so it is issued from the untagged block and flagged.
  const tagUsed = new Map();
  let nextUntagged = UNTAGGED_BLOCK_START;
  const issueUntagged = () => {
    while (taken.has(accessionFor(nextUntagged))) nextUntagged += 1;
    const id = accessionFor(nextUntagged);
    nextUntagged += 1;
    return id;
  };

  const ordered = [...features].sort(
    (a, b) => (a.properties?.OBJECTID ?? 0) - (b.properties?.OBJECTID ?? 0),
  );

  for (const feature of ordered) {
    const p = feature.properties ?? {};
    const objectId = p.OBJECTID;

    const position = feature.geometry?.coordinates;
    if (!position || position.length < 2) {
      skipped.push({ objectId, reason: 'no position', detail: String(p.Species ?? '') });
      continue;
    }
    const [lng, lat] = position;

    const rawSpecies = String(p.Species ?? '').trim();
    // Three outcomes, and they mean different things: a taxon_id, null for a
    // name the alias table knows is not a species, and undefined for a name
    // nobody has ever classified. The last is the one that should stop a run.
    const taxonId = rawSpecies ? resolveSpecies(rawSpecies, speciesLookup) : null;
    if (!taxonId) {
      // "ID Needed" is five trees nobody could name. A plant row needs a
      // species, and inventing one would be worse than leaving them out until
      // somebody walks over and looks.
      skipped.push({
        objectId,
        reason: !rawSpecies ? 'no species recorded'
          : taxonId === null ? 'not a species'
          : 'species name not in taxa.csv',
        detail: rawSpecies || '(blank)',
      });
      continue;
    }

    const tag = readTag(p.Tag_ID);
    const sourceId = String(p.GlobalID ?? '').trim();
    const notes = [];
    let plantId;

    // Without a stable id and without a tag there is no way to recognise this
    // tree again, so a re-import would add it a second time. Refuse it rather
    // than plant a row that silently duplicates later.
    if (!sourceId && tag.kind !== 'number') {
      skipped.push({
        objectId,
        reason: 'no tag and no stable id',
        detail: rawSpecies,
      });
      continue;
    }

    const seenBefore = sourceId ? bySource.get(sourceId) : undefined;
    if (seenBefore) {
      // This exact feature already has a row. Whatever its tag says now, it
      // keeps the accession it was given, so numbers never shift underfoot.
      plantId = seenBefore;
      if (tag.kind === 'number') tagUsed.set(tag.number, plantId);
    } else if (tag.kind === 'number') {
      const candidate = accessionFor(tag.number);
      if (tagUsed.has(tag.number)) {
        plantId = issueUntagged();
        notes.push(
          `TAG DISPUTED: tag ${tag.number} is also on ${tagUsed.get(tag.number)} — check in person`,
        );
      } else {
        tagUsed.set(tag.number, candidate);
        plantId = candidate;
      }
    } else if (tag.kind === 'uncertain' || tag.kind === 'unreadable') {
      plantId = issueUntagged();
      notes.push(`TAG UNCERTAIN: recorded as "${tag.text}" — check in person`);
    } else {
      plantId = issueUntagged();
    }

    const condition = normalizeCondition(p.Health);
    const surveyedOn = surveyDate(p.CreationDate);
    const collectionId = campusAt(lng, lat, campusAreas) ?? '';

    const existing = byId.get(plantId);
    if (existing) {
      // The tree is already on file, from our own fieldwork. Its position and
      // species were established by someone standing under it, which beats a
      // point digitised from imagery, so neither is overwritten — but a
      // disagreement is worth knowing about, and a report scrolls past. The
      // note rides on the observation, where it stays until somebody settles it.
      matched += 1;
      const onFileTaxon = String(existing.taxon_id).trim();
      if (onFileTaxon !== taxonId) {
        if (isRefinement(taxonId, onFileTaxon, taxaById)) {
          // Not a disagreement. Say so, and leave no note on the tree: there
          // is nothing here for anybody to go and check.
          refinements.push({
            plant_id: plantId,
            message: `ArcGIS says "${rawSpecies}" (${taxonId}); identified here as ${onFileTaxon}`,
          });
        } else {
          const message = `on file as ${onFileTaxon}; ArcGIS says "${rawSpecies}" (${taxonId})`;
          conflicts.push({ plant_id: plantId, kind: 'species', message });
          notes.push(`SPECIES CONFLICT: ${message} — check in person`);
        }
      }
      const away = distanceMeters(Number(existing.lat), Number(existing.lng), lat, lng);
      if (away > POSITION_CONFLICT_M) {
        const message = `ArcGIS puts it ${away.toFixed(0)} m from the recorded position`;
        conflicts.push({ plant_id: plantId, kind: 'position', message });
        notes.push(`POSITION CONFLICT: ${message} — position on file was kept`);
      }
    } else {
      taken.add(plantId);
      inserts.push({
        plant_id: plantId,
        taxon_id: taxonId,
        lat: coord(lat),
        lng: coord(lng),
        geolocation_notes: 'Mapped in UVM\'s ArcGIS tree layer, 2023–24',
        collection_id: collectionId,
        planted_year: '',
        dedication_label: '',
        story: '',
        source_id: sourceId,
      });
      if (sourceId) bySource.set(sourceId, plantId);
    }

    // The append-only rule, enforced: a plant already carrying an observation
    // on this date is not observed twice, so re-running changes nothing.
    const key = `${plantId}|${surveyedOn}`;
    if (surveyedOn && !observed.has(key)) {
      observed.add(key);
      newObservations.push({
        plant_id: plantId,
        surveyed_on: surveyedOn,
        surveyor,
        dbh_in: '',
        height_ft: '',
        spread_ft: '',
        condition,
        status: 'active',
        photo: '',
        notes: notes.join('; '),
      });
    }
  }

  return {
    inserts,
    observations: newObservations,
    conflicts,
    refinements,
    skipped,
    summary: {
      read: features.length,
      inserted: inserts.length,
      observed: newObservations.length,
      matchedExisting: matched,
      tagged: tagUsed.size,
      untagged: nextUntagged - UNTAGGED_BLOCK_START,
      skipped: skipped.length,
      conflicts: conflicts.length,
      refinements: refinements.length,
      noCollection: inserts.filter((r) => !r.collection_id).length,
    },
  };
}

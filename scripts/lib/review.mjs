// What a survey file would change, for the steward console's review inbox.
//
// The inbox is where survey uploads wait for a person to approve them. This
// runs a file through the real importer (import.mjs) as a dry run, against the
// data as it stands, and lays out what it would do in terms an approver can
// check: the new trees, the visits, the corrections with their before and
// after, the trees renumbered to their tags, the notes the survey app left for
// the desk, and any error, which blocks the whole file exactly as it blocks
// `npm run import`. Nothing is written. See docs/STEWARD.md.

import { importSurvey } from './import.mjs';
import { QA_NOTE } from './vocab.mjs';

const trim = (v) => (v ?? '').toString().trim();

/** Metres between two points (equirectangular: plenty for a campus). */
function metres(aLat, aLng, bLat, bLng) {
  const rad = Math.PI / 180;
  const x = (bLng - aLng) * rad * Math.cos(((aLat + bLat) / 2) * rad);
  const y = (bLat - aLat) * rad;
  return 6371008.8 * Math.hypot(x, y);
}

/**
 * @param {object} args  everything importSurvey takes (rows, headers, mapping,
 *   taxaRows, plantRows, observationRows, collectionRows, campusAreas, config,
 *   renumberedRows), plus `file`, its name.
 */
export function reviewSubmission(args) {
  const r = importSurvey(args);
  const taxa = new Map(args.taxaRows.map((t) => [trim(t.taxon_id), t]));
  const plants = new Map(args.plantRows.map((p) => [trim(p.plant_id), p]));
  const renamedTo = new Map(r.renumbers.map((x) => [x.to, x.from]));
  // A tree as it stands on file, under its number now or the one this file retires.
  const onFile = (id) => plants.get(id) ?? plants.get(renamedTo.get(id) ?? '');
  const common = (taxonId) => trim(taxa.get(trim(taxonId))?.common_name) || trim(taxonId);
  const campus = (id) => trim(args.collectionRows.find((c) => trim(c.collection_id) === trim(id))?.name) || null;

  const notes = r.observations.flatMap((o) => String(o.notes ?? '').split('. ')
    .map((part) => part.trim()).filter((part) => QA_NOTE.test(part))
    .map((note) => ({ plant: o.plant_id, note })));

  const corrections = r.updates.map((u) => {
    const before = onFile(u.plant_id) ?? {};
    const changes = Object.entries(u.changes)
      .filter(([k]) => k !== 'lat' && k !== 'lng')
      .map(([field, to]) => ({ field, from: trim(before[field]), to: trim(to) }));
    const moved = u.changes.lat || u.changes.lng
      ? {
        from: [Number(before.lat), Number(before.lng)],
        to: [Number(u.changes.lat ?? before.lat), Number(u.changes.lng ?? before.lng)],
      }
      : null;
    return {
      plant: u.plant_id, common: common(u.changes.taxon_id ?? before.taxon_id),
      changes, moved: moved && { ...moved, metres: Math.round(metres(...moved.from, ...moved.to) * 10) / 10 },
    };
  });

  const errors = r.issues.filter((i) => i.level === 'error');
  return {
    file: args.file,
    rows: r.summary.read,
    dates: [...new Set(r.observations.map((o) => o.surveyed_on).filter(Boolean))].sort(),
    status: errors.length ? 'blocked' : 'ready',
    summary: {
      newTrees: r.inserts.length, visits: r.observations.length, corrections: r.updates.length,
      renumbered: r.renumbers.length, alreadyOnFile: r.reimported.length,
      errors: errors.length, warnings: r.issues.length - errors.length, notes: notes.length,
    },
    newTrees: r.inserts.map((p) => ({
      plant: p.plant_id, tag: trim(p.tag), common: common(p.taxon_id),
      lat: Number(p.lat), lng: Number(p.lng), campus: campus(p.collection_id),
    })),
    visits: r.observations.map((o) => {
      const p = onFile(o.plant_id) ?? r.inserts.find((i) => i.plant_id === o.plant_id) ?? {};
      return {
        plant: o.plant_id, common: common(p.taxon_id), date: trim(o.surveyed_on),
        dbh: trim(o.dbh_in), condition: trim(o.condition), status: trim(o.status), photo: Boolean(trim(o.photo)),
        lat: Number(p.lat), lng: Number(p.lng),
      };
    }),
    corrections,
    renumbered: r.renumbers.map((x) => ({ from: x.from, to: x.to, tag: x.tag, common: common(onFile(x.from)?.taxon_id) })),
    issues: r.issues.map((i) => ({ row: i.row, level: i.level, message: i.message })),
    notes,
  };
}

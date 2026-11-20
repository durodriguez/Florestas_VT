/**
 * Walking tours: data/tours.csv names each tour, data/tour-stops.csv lists its
 * stops in order, each a tree and a one-line note on why it is there.
 *
 * Plain CSV like everything else a person edits here, and no drawn path: the
 * map joins the stops in order, so writing a tour needs a spreadsheet, not
 * mapping software. The length is the straight-line distance between stops,
 * which is shorter than the walk; the map says so.
 */

/** Meters between two points, by the haversine formula. */
function meters(a, b) {
  const R = 6371008.8;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const trim = (v) => (v ?? '').toString().trim();

/**
 * @param {Array<Record<string,string>>} tourRows   tours.csv
 * @param {Array<Record<string,string>>} stopRows   tour-stops.csv
 * @param {(id: string) => ({ lat: number, lng: number, active: boolean } | undefined)} plantAt
 */
export function buildTours(tourRows, stopRows, plantAt) {
  const errors = [];
  const warnings = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);
  const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

  const tours = new Map();
  tourRows.forEach((row, i) => {
    const where = `tours.csv row ${i + 2}`;
    const id = trim(row.tour_id);
    for (const field of ['tour_id', 'name', 'description']) {
      if (!trim(row[field])) err(where, `missing required field "${field}"`);
    }
    if (!id) return;
    if (tours.has(id)) return err(where, `duplicate tour_id "${id}"`);
    tours.set(id, { id, name: trim(row.name), description: trim(row.description), stops: [] });
  });

  stopRows.forEach((row, i) => {
    const where = `tour-stops.csv row ${i + 2}`;
    const tour = tours.get(trim(row.tour_id));
    if (!tour) return err(where, `tour_id "${trim(row.tour_id)}" is not in tours.csv`);
    const stop = Number(trim(row.stop));
    if (!Number.isInteger(stop) || stop < 1) return err(where, `stop "${trim(row.stop)}" is not a whole number from 1`);
    if (tour.stops.some((s) => s.stop === stop)) return err(where, `${tour.id} already has a stop ${stop}`);
    const plantId = trim(row.plant_id);
    const plant = plantAt(plantId);
    if (!plant) return err(where, `plant_id "${plantId}" is not in plants.csv`);
    if (!plant.active) warn(where, `${plantId} is no longer standing; take it off ${tour.id}`);
    if (tour.stops.some((s) => s.plantId === plantId)) return err(where, `${plantId} is on ${tour.id} twice`);
    tour.stops.push({ stop, plantId, note: trim(row.note), at: plant });
  });

  const out = [];
  for (const tour of tours.values()) {
    if (tour.stops.length < 2) {
      warn('tours.csv', `${tour.id} has ${tour.stops.length} stop(s); a tour needs at least two, so it is left off the map`);
      continue;
    }
    tour.stops.sort((a, b) => a.stop - b.stop);
    let length = 0;
    for (let i = 1; i < tour.stops.length; i++) length += meters(tour.stops[i - 1].at, tour.stops[i].at);
    out.push({
      id: tour.id,
      name: tour.name,
      description: tour.description,
      lengthM: Math.round(length),
      stops: tour.stops.map((s) => ({ plantId: s.plantId, note: s.note })),
    });
  }
  return { tours: out, errors, warnings };
}

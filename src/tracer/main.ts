/**
 * Boundary tracer — an internal tool, not part of the public map.
 *
 * Two ways to work, because they cost wildly different amounts of clicking:
 *
 * **Split** carves the sub-campuses out of the already-traced outer boundary.
 * You draw a rough shape over the part of campus that belongs to an area and it
 * is intersected with whatever is still unassigned, so the outer side of every
 * piece snaps to the real boundary and only the *internal* edges are ever drawn
 * by hand. Four rough shapes plus "give the rest" divides campus into five.
 *
 * **Trace** is the from-scratch mode: click every vertex yourself. That is what
 * the outer boundary needed, and it is the fallback for redoing any one area.
 *
 * It writes nothing: the only output is a downloaded GeoJSON file.
 */
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import type { CampusAreaProps, Dataset } from '../types';
import {
  ACRES_PER_M2, areaM2, carve, subtractAll, toGeometry, toMultiPoly,
  type MultiPoly, type Ring,
} from './split';

type Mode = 'split' | 'trace';

const base = import.meta.env.BASE_URL;
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const els = {
  areas: el<HTMLUListElement>('areas'),
  intro: el<HTMLParagraphElement>('intro'),
  hint: el<HTMLDivElement>('hint'),
  commit: el<HTMLButtonElement>('commit'),
  undoPoint: el<HTMLButtonElement>('undo-point'),
  cancel: el<HTMLButtonElement>('cancel'),
  rest: el<HTMLButtonElement>('rest'),
  undoStep: el<HTMLButtonElement>('undo-step'),
  reset: el<HTMLButtonElement>('reset'),
  download: el<HTMLButtonElement>('download'),
  load: el<HTMLInputElement>('load'),
  modeSplit: el<HTMLButtonElement>('mode-split'),
  modeTrace: el<HTMLButtonElement>('mode-trace'),
};

// ---- map ------------------------------------------------------------------

const dataset: Dataset = await fetch(`${base}data/dataset.json?v=${__DATA_VERSION__}`).then((r) => {
  if (!r.ok) throw new Error(`Could not load dataset.json (HTTP ${r.status}). Run \`npm run data\` first.`);
  return r.json();
});

const cfg = dataset.config.map;
const map = L.map('map', { center: cfg.center, zoom: cfg.zoom, minZoom: cfg.minZoom, maxZoom: cfg.maxZoom });

// Satellite first: you trace against what is on the ground, not against a
// street cartographer's idea of where the campus edge is.
const imagery = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: cfg.maxZoom, maxNativeZoom: 19, attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics' },
).addTo(map);
const streets = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: cfg.maxZoom,
  maxNativeZoom: 19,
  attribution: '&copy; OpenStreetMap contributors',
});
L.control.layers({ Satellite: imagery, Streets: streets }, {}, { position: 'bottomright' }).addTo(map);

// Panes, so the fills never end up on top of the shape being drawn.
map.createPane('remaining').style.zIndex = '390';
map.createPane('areas').style.zIndex = '400';
map.createPane('draft').style.zIndex = '450';

// ---- state ----------------------------------------------------------------

interface AreaState {
  props: CampusAreaProps;
  geometry: MultiPoly;
  /** False once this area's geometry comes from tracing or carving. */
  provisional: boolean;
  layer: L.Polygon | null;
  row: HTMLLIElement;
}

const areas: AreaState[] = dataset.campusAreas.features.map((f) => ({
  props: f.properties,
  geometry: toMultiPoly(f.geometry),
  provisional: f.properties.provisional,
  layer: null,
  row: document.createElement('li'),
}));

const boundary = areas.find((a) => a.props.kind === 'boundary');
const campuses = areas.filter((a) => a.props.kind === 'campus');

let mode: Mode = boundary && !boundary.provisional ? 'split' : 'trace';
let active: AreaState | null = null;
let draft: L.LatLng[] = [];

/** Enough state to undo one assignment, kept as plain geometry. */
interface Snapshot {
  areas: { geometry: MultiPoly; provisional: boolean }[];
}
const history: Snapshot[] = [];

const snapshot = (): Snapshot => ({
  areas: areas.map((a) => ({ geometry: a.geometry, provisional: a.provisional })),
});
const restore = (s: Snapshot): void => {
  s.areas.forEach((saved, i) => {
    areas[i]!.geometry = saved.geometry;
    areas[i]!.provisional = saved.provisional;
  });
};

/** Campus land no sub-campus has claimed yet. */
function unassigned(): MultiPoly {
  if (!boundary || boundary.geometry.length === 0) return [];
  return subtractAll(boundary.geometry, campuses.map((c) => (c.provisional ? [] : c.geometry)));
}

// ---- drawing --------------------------------------------------------------

const remainingLayer = L.polygon([], {
  pane: 'remaining',
  color: '#154734',
  weight: 1,
  opacity: 0.5,
  fillColor: '#154734',
  fillOpacity: 0.12,
  interactive: false,
}).addTo(map);

const draftLayer = L.polygon([], {
  pane: 'draft',
  color: '#ffd100',
  weight: 3,
  fillColor: '#ffd100',
  fillOpacity: 0.25,
  dashArray: '6 5',
  interactive: false,
}).addTo(map);
const draftVertices = L.layerGroup([], { pane: 'draft' } as L.LayerOptions).addTo(map);

/** Leaflet wants [lat, lng] nested per ring; the model holds [lng, lat]. */
const toLatLngs = (mp: MultiPoly): L.LatLngExpression[][][] =>
  mp.map((poly) => poly.map((ring) => ring.map(([lng, lat]) => [lat, lng] as L.LatLngExpression)));

function redraw(): void {
  const rest = mode === 'split' ? unassigned() : [];
  remainingLayer.setLatLngs(toLatLngs(rest));

  for (const area of areas) {
    area.layer?.remove();
    area.layer = null;
    // In split mode the boundary is the backdrop, drawn as the remainder; an
    // outline on top of every carved edge would just be noise.
    if (mode === 'split' && area.props.kind === 'boundary') continue;
    if (area.geometry.length === 0) continue;
    const settled = !area.provisional;
    area.layer = L.polygon(toLatLngs(area.geometry), {
      pane: 'areas',
      color: area.props.color,
      weight: settled ? 2 : 1,
      opacity: settled ? 0.95 : 0.5,
      dashArray: settled ? undefined : '4 6',
      fillColor: area.props.color,
      fillOpacity: settled ? 0.28 : 0.06,
      interactive: false,
    }).addTo(map);
  }

  draftLayer.setLatLngs(draft.length > 1 ? [draft] : []);
  draftVertices.clearLayers();
  draft.forEach((latlng, i) => {
    L.circleMarker(latlng, {
      pane: 'draft',
      radius: 4,
      color: '#000',
      weight: 2,
      fillColor: '#ffd100',
      fillOpacity: 1,
      interactive: false,
    })
      .bindTooltip(String(i + 1), { direction: 'top' })
      .addTo(draftVertices);
  });

  renderPanel(rest);
}

// ---- panel ----------------------------------------------------------------

const acres = (mp: MultiPoly) => Math.round(areaM2(mp) * ACRES_PER_M2);

function statusFor(area: AreaState): string {
  if (area.provisional) return 'estimated';
  if (area.geometry.length === 0) return 'empty';
  return `${acres(area.geometry)} acres`;
}

function renderPanel(rest: MultiPoly): void {
  const restAcres = acres(rest);

  els.intro.textContent =
    mode === 'split'
      ? 'Draw a rough shape over the part of campus that belongs to an area. It is trimmed to the campus boundary, so you can scribble well outside the edge — only the lines between areas need care.'
      : 'Click every point along an area\'s edge. Use this for the outer boundary, or to redo one area from scratch.';

  for (const area of areas) {
    const disabled = mode === 'split' && area.props.kind === 'boundary';
    area.row.className = `area${area === active ? ' is-active' : ''}${disabled ? ' is-disabled' : ''}`;
    area.row.style.setProperty('--area-color', area.props.color);
    area.row.tabIndex = disabled ? -1 : 0;
    area.row.innerHTML = '';
    const name = document.createElement('span');
    name.className = 'area-name';
    name.textContent = area.props.name;
    const meta = document.createElement('span');
    meta.className = `area-meta${area.provisional ? '' : ' is-done'}`;
    meta.textContent = disabled ? `${acres(area.geometry)} acres · traced` : statusFor(area);
    area.row.append(name, meta);
  }

  const enough = draft.length >= 3;
  els.commit.textContent = active
    ? mode === 'split'
      ? `Assign this shape to ${active.props.name}`
      : `Save this outline as ${active.props.name}`
    : 'Pick an area first';
  els.commit.disabled = !active || !enough;
  els.undoPoint.disabled = draft.length === 0;
  els.cancel.disabled = draft.length === 0;
  els.rest.disabled = mode !== 'split' || !active || restAcres <= 0 || draft.length > 0;
  els.undoStep.disabled = history.length === 0;
  els.download.disabled = !areas.some((a) => !a.provisional);

  if (!active) {
    els.hint.textContent =
      mode === 'split'
        ? restAcres > 0
          ? `${restAcres} acres unassigned. Pick an area to carve it out of.`
          : 'Every acre is assigned. Download the file, or pick an area to redo it.'
        : 'Pick an area to trace.';
  } else if (!enough) {
    els.hint.textContent = `Click at least ${3 - draft.length} more point${3 - draft.length === 1 ? '' : 's'} for ${active.props.name}.`;
  } else {
    els.hint.textContent =
      mode === 'split'
        ? `${draft.length} points. Assign it, or keep clicking. ${restAcres} acres still unassigned.`
        : `${draft.length} points. Save it, or keep clicking — the shape closes itself.`;
  }
}

// ---- actions --------------------------------------------------------------

function selectArea(area: AreaState | null): void {
  if (area && mode === 'split' && area.props.kind === 'boundary') return;
  active = area === active ? null : area;
  draft = [];
  redraw();
}

function commitDraft(): void {
  if (!active || draft.length < 3) return;
  const ring: Ring = draft.map((p) => [p.lng, p.lat]);
  history.push(snapshot());

  if (mode === 'trace') {
    active.geometry = [[[...ring, ring[0]!]]];
    active.provisional = false;
  } else {
    const { assigned } = carve(unassigned(), ring);
    if (assigned.length === 0) {
      history.pop();
      els.hint.textContent = 'That shape does not overlap any unassigned campus land. Try again over the boundary.';
      return;
    }
    // The remainder is derived from what every area holds, so assigning to one
    // area is the whole edit — there is no separate remainder to keep in step.
    active.geometry = assigned;
    active.provisional = false;
  }

  draft = [];
  active = null;
  redraw();
}

function giveRest(): void {
  if (!active || mode !== 'split') return;
  const rest = unassigned();
  if (rest.length === 0) return;
  history.push(snapshot());
  active.geometry = rest;
  active.provisional = false;
  active = null;
  redraw();
}

map.on('click', (e: L.LeafletMouseEvent) => {
  if (!active) {
    els.hint.textContent = 'Pick an area on the left first.';
    return;
  }
  draft.push(e.latlng);
  redraw();
});

els.commit.addEventListener('click', commitDraft);
els.rest.addEventListener('click', giveRest);
els.undoPoint.addEventListener('click', () => { draft.pop(); redraw(); });
els.cancel.addEventListener('click', () => { draft = []; redraw(); });
els.undoStep.addEventListener('click', () => {
  const previous = history.pop();
  if (previous) restore(previous);
  draft = [];
  redraw();
});
els.reset.addEventListener('click', () => {
  // Only the sub-campuses: throwing away a hand-traced outer boundary because
  // someone wanted to redo the splits would be a genuinely costly mistake.
  history.push(snapshot());
  for (const campus of campuses) {
    const original = dataset.campusAreas.features.find((f) => f.properties.area_id === campus.props.area_id)!;
    campus.geometry = toMultiPoly(original.geometry);
    campus.provisional = original.properties.provisional;
  }
  active = null;
  draft = [];
  redraw();
});

function setMode(next: Mode): void {
  mode = next;
  active = null;
  draft = [];
  els.modeSplit.setAttribute('aria-checked', String(next === 'split'));
  els.modeTrace.setAttribute('aria-checked', String(next === 'trace'));
  els.modeSplit.classList.toggle('is-on', next === 'split');
  els.modeTrace.classList.toggle('is-on', next === 'trace');
  redraw();
}
els.modeSplit.addEventListener('click', () => setMode('split'));
els.modeTrace.addEventListener('click', () => setMode('trace'));

// ---- file in, file out ----------------------------------------------------

els.load.addEventListener('change', async () => {
  const file = els.load.files?.[0];
  if (!file) return;
  try {
    const loaded = JSON.parse(await file.text()) as typeof dataset.campusAreas;
    let matched = 0;
    for (const feature of loaded.features ?? []) {
      const area = areas.find((a) => a.props.area_id === feature.properties?.area_id);
      if (!area || !feature.geometry) continue;
      area.geometry = toMultiPoly(feature.geometry);
      area.provisional = Boolean(feature.properties.provisional);
      matched++;
    }
    history.length = 0;
    active = null;
    draft = [];
    setMode(boundary && !boundary.provisional ? 'split' : 'trace');
    els.hint.textContent = `Loaded ${matched} area${matched === 1 ? '' : 's'} from ${file.name}.`;
  } catch {
    els.hint.textContent = `${file.name} is not readable GeoJSON.`;
  } finally {
    // Let the same file be picked again after an edit on disk.
    els.load.value = '';
  }
});

els.download.addEventListener('click', () => {
  const features = areas.map((area) => ({
    type: 'Feature' as const,
    properties: { ...area.props, provisional: area.provisional },
    geometry: toGeometry(area.geometry),
  })).filter((f) => f.geometry !== null);

  const real = features.filter((f) => !f.properties.provisional).length;
  const body = JSON.stringify(
    {
      type: 'FeatureCollection',
      comment:
        `Drawn over satellite imagery on ${new Date().toISOString().slice(0, 10)}. ` +
        `${real} of ${features.length} areas are real; any still marked provisional ` +
        'are the hand-drawn estimates. See docs/CAMPUS-AREAS.md.',
      features,
    },
    null,
    2,
  ) + '\n';

  const url = URL.createObjectURL(new Blob([body], { type: 'application/geo+json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'campus-areas.geojson';
  link.click();
  URL.revokeObjectURL(url);
});

// ---- wire up --------------------------------------------------------------

for (const area of areas) {
  area.row.addEventListener('click', () => selectArea(area));
  area.row.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectArea(area); }
  });
  els.areas.append(area.row);
}

const extent = L.geoJSON(dataset.campusAreas).getBounds();
map.fitBounds(extent.isValid() ? extent : L.latLngBounds(cfg.bounds), { padding: [40, 40] });
setMode(mode);

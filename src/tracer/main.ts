/**
 * Boundary tracer — an internal tool, not part of the public map.
 *
 * UVM publishes campus boundaries on https://www.uvm.edu/map/ but does not
 * offer them as a download, so data/campus-areas.geojson ships with hand-drawn
 * estimates. This page turns "fix the boundaries" from a GIS job into clicking
 * around the edge of campus on satellite imagery.
 *
 * It writes nothing: the only output is a downloaded GeoJSON file that replaces
 * data/campus-areas.geojson.
 */
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import type { CampusAreaProps, Dataset } from '../types';

type Ring = L.LatLng[];

const base = import.meta.env.BASE_URL;
const els = {
  areas: document.getElementById('areas') as HTMLUListElement,
  hint: document.getElementById('hint') as HTMLDivElement,
  undo: document.getElementById('undo') as HTMLButtonElement,
  clear: document.getElementById('clear') as HTMLButtonElement,
  download: document.getElementById('download') as HTMLButtonElement,
};

const dataset: Dataset = await fetch(`${base}data/dataset.json?v=${__DATA_VERSION__}`).then((r) => {
  if (!r.ok) throw new Error(`Could not load dataset.json (HTTP ${r.status}). Run \`npm run data\` first.`);
  return r.json();
});

const cfg = dataset.config.map;
const map = L.map('map', {
  center: cfg.center,
  zoom: cfg.zoom,
  minZoom: cfg.minZoom,
  maxZoom: cfg.maxZoom,
});

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

/** One row per area in the file, holding whatever has been traced so far. */
interface AreaState {
  props: CampusAreaProps;
  /** The shape as shipped, kept so an untraced area survives the download. */
  original: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  ring: Ring;
  traced: boolean;
  outline: L.Polygon;
  vertices: L.LayerGroup;
  row: HTMLLIElement;
}

const areas: AreaState[] = dataset.campusAreas.features.map((f) => {
  const props = f.properties;
  const state: AreaState = {
    props,
    original: f.geometry,
    ring: [],
    traced: false,
    outline: L.polygon([], { color: props.color, weight: 2, fillOpacity: 0.12, interactive: false }),
    vertices: L.layerGroup(),
    row: document.createElement('li'),
  };
  state.outline.addTo(map);
  state.vertices.addTo(map);
  return state;
});

// The shapes currently in the file, drawn faintly underneath as a guide to
// roughly where each area is. They are estimates, so they are a hint about
// which part of campus to look at, not something to trace over exactly.
const guides = L.geoJSON(dataset.campusAreas, {
  interactive: false,
  style: (f) => ({
    color: (f?.properties as CampusAreaProps).color,
    weight: 1,
    opacity: 0.5,
    dashArray: '4 6',
    fill: false,
  }),
}).addTo(map);

let active: AreaState | null = null;

function selectArea(area: AreaState | null): void {
  active = area;
  for (const a of areas) a.row.classList.toggle('is-active', a === area);
  render();
}

map.on('click', (e: L.LeafletMouseEvent) => {
  if (!active) {
    els.hint.textContent = 'Pick an area on the left first.';
    return;
  }
  active.ring.push(e.latlng);
  active.traced = true;
  render();
});

els.undo.addEventListener('click', () => {
  active?.ring.pop();
  // Undoing back to nothing means the area was never really traced, so it
  // falls back to its shipped geometry rather than downloading as empty.
  if (active && active.ring.length === 0) active.traced = false;
  render();
});

els.clear.addEventListener('click', () => {
  if (!active) return;
  active.ring = [];
  active.traced = false;
  render();
});

els.download.addEventListener('click', download);

function render(): void {
  for (const a of areas) {
    a.outline.setLatLngs(a.ring);
    a.vertices.clearLayers();
    if (a === active) {
      a.ring.forEach((latlng, i) => {
        L.circleMarker(latlng, {
          radius: 4,
          color: '#fff',
          weight: 2,
          fillColor: a.props.color,
          fillOpacity: 1,
        })
          .bindTooltip(String(i + 1), { direction: 'top' })
          .addTo(a.vertices);
      });
    }
    const points = a.ring.length;
    const status = a.traced
      ? `${points} point${points === 1 ? '' : 's'}${points > 2 ? '' : ' — need at least 3'}`
      : a.props.provisional ? 'estimated' : 'from file';
    a.row.innerHTML = '';
    const name = document.createElement('span');
    name.className = 'area-name';
    name.textContent = a.props.name;
    const meta = document.createElement('span');
    meta.className = `area-meta${a.traced && points > 2 ? ' is-done' : ''}`;
    meta.textContent = status;
    a.row.append(name, meta);
    a.row.style.setProperty('--area-color', a.props.color);
  }

  els.undo.disabled = !active || active.ring.length === 0;
  els.clear.disabled = els.undo.disabled;

  const usable = areas.filter((a) => a.traced && a.ring.length > 2);
  const unfinished = areas.filter((a) => a.traced && a.ring.length <= 2);
  els.download.disabled = usable.length === 0 || unfinished.length > 0;

  if (unfinished.length > 0) {
    els.hint.textContent = `${unfinished[0]!.props.name} needs at least 3 points.`;
  } else if (active) {
    els.hint.textContent = active.ring.length
      ? `Tracing ${active.props.name}. Click to add points; the shape closes itself.`
      : `Click around the edge of ${active.props.name}.`;
  } else {
    els.hint.textContent = 'Pick an area to start.';
  }
}

/** Leaflet rings are open; GeoJSON rings repeat the first position as the last. */
function toGeoJsonRing(ring: Ring): number[][] {
  const round = (n: number) => Number(n.toFixed(6));
  const positions = ring.map((p) => [round(p.lng), round(p.lat)]);
  positions.push(positions[0]!);
  return positions;
}

function download(): void {
  const features = areas.map((a) => ({
    type: 'Feature' as const,
    properties: {
      area_id: a.props.area_id,
      name: a.props.name,
      kind: a.props.kind,
      color: a.props.color,
      description: a.props.description,
      // A traced area is real; an untraced one keeps whatever it had.
      provisional: a.traced ? false : a.props.provisional,
    },
    geometry: a.traced
      ? { type: 'Polygon' as const, coordinates: [toGeoJsonRing(a.ring)] }
      : a.original,
  }));

  const traced = features.filter((f) => !f.properties.provisional).length;
  const body = JSON.stringify(
    {
      type: 'FeatureCollection',
      comment:
        `Traced over satellite imagery on ${new Date().toISOString().slice(0, 10)}. ` +
        `${traced} of ${features.length} areas are real; any still marked provisional ` +
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
}

for (const area of areas) {
  area.row.className = 'area';
  area.row.tabIndex = 0;
  area.row.addEventListener('click', () => selectArea(area === active ? null : area));
  area.row.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectArea(area === active ? null : area);
    }
  });
  els.areas.append(area.row);
}

// Open on the areas themselves rather than on config.map.bounds, which is a
// deliberately generous box: fitting that would start you zoomed out past the
// point where campus edges are visible on the imagery.
const guideBounds = guides.getBounds();
map.fitBounds(guideBounds.isValid() ? guideBounds : L.latLngBounds(cfg.bounds), { padding: [40, 40] });
render();

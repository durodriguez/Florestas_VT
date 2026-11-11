/**
 * Image calibration (`/imagery/`): an internal desk tool for aerial images.
 * Add and align them as in the positions tool, then make new images from
 * them: merged where they overlap, clipped to campus, compressed.
 */

import 'leaflet/dist/leaflet.css';
import '../positions/styles.css';
import './styles.css';

import L from 'leaflet';
import type { Dataset } from '../types';
import { initSideSplit } from '../positions/split';
import { initImages, esc } from './images';
import { initProducts, make, MAX_PIXELS, plan, type Clip, type Format } from './products';
import { buildTiles, initTiles, tilePlan } from './tiles';

const BASE = import.meta.env.BASE_URL;
const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element: ${id}`);
  return el as T;
};

// ---------------------------------------------------------------- map

const map = L.map($('map'), { zoomControl: true, maxZoom: 22 });
map.setView([44.4777, -73.1956], 16);
const satellite = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 22, maxNativeZoom: 20, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' },
).addTo(map);
const streets = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 22, maxNativeZoom: 19, attribution: '© OpenStreetMap contributors',
});
const layers = L.control.layers({ Satellite: satellite, Streets: streets }, undefined, { position: 'topright', collapsed: false }).addTo(map);
L.control.scale({ imperial: false }).addTo(map);

// Campus lines above every image, and never in the way of a click.
map.createPane('campus');
map.getPane('campus')!.style.zIndex = '300';
map.getPane('campus')!.style.pointerEvents = 'none';

initSideSplit($('map').parentElement!, document.querySelector<HTMLElement>('.side')!, $('side-split'), () => map.invalidateSize());

// ---------------------------------------------------------------- modules

const images = initImages(map, {
  onAligning: (on) => document.body.classList.toggle('is-aligning', on),
  onSelection: () => { updatePlan(); updateTilePlan(); },
});
const products = initProducts(map);
const tiles = initTiles(map, layers);

map.on('click', (e: L.LeafletMouseEvent) => { images.click(e.latlng); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && images.isAligning()) images.cancel();
});

// ---------------------------------------------------------------- campus

/** The clip shapes, by the value of their option. */
const clips = new Map<string, Clip>();

async function loadCampus(): Promise<void> {
  const res = await fetch(`${BASE}data/dataset.json?v=${__DATA_VERSION__}`);
  if (!res.ok) throw new Error(`dataset.json: ${res.status}`);
  const dataset = (await res.json()) as Dataset;
  const features = dataset.campusAreas.features;
  const select = $<HTMLSelectElement>('make-clip');
  // The boundary first, then the areas by name: each its own layer, so any
  // one can be shown alone over the images.
  const ordered = [
    ...features.filter((f) => f.properties.kind === 'boundary'),
    ...features.filter((f) => f.properties.kind !== 'boundary').sort((a, b) => a.properties.name.localeCompare(b.properties.name)),
  ];
  for (const f of ordered) {
    const outline = f.properties.kind === 'boundary';
    const label = outline ? 'Campus boundary' : f.properties.name;
    const layer = L.geoJSON(f, {
      pane: 'campus',
      interactive: false,
      style: {
        color: outline ? '#ffd100' : '#ffffff',
        weight: outline ? 3 : 1.8,
        opacity: 0.95,
        dashArray: f.properties.provisional ? '6 6' : undefined,
        fill: false,
      },
      onEachFeature: (_f, l) => {
        if (outline) return;
        l.bindTooltip(esc(f.properties.name), { permanent: true, direction: 'center', className: 'campus-name', interactive: false, pane: 'campus' });
      },
    }).addTo(map);
    layers.addOverlay(layer, `${label}${f.properties.provisional ? ' (approximate)' : ''}`);
    clips.set(f.properties.area_id, { name: label, geometry: f.geometry as Clip['geometry'] });
    select.add(new Option(label, f.properties.area_id));
    $<HTMLSelectElement>('tiles-clip').add(new Option(label, f.properties.area_id, outline, outline));
  }
  map.fitBounds(L.geoJSON(ordered[0]).getBounds());
}

// ---------------------------------------------------------------- make

const quality = $<HTMLInputElement>('make-quality');
const format = $<HTMLSelectElement>('make-format');

function options() {
  const mppVal = $<HTMLSelectElement>('make-mpp').value;
  const clipId = $<HTMLSelectElement>('make-clip').value;
  return {
    name: $<HTMLInputElement>('make-name').value,
    sources: images.chosen(),
    clip: clipId ? clips.get(clipId) ?? null : null,
    mpp: mppVal ? Number(mppVal) : null,
    format: format.value as Format,
    quality: Number(quality.value) / 100,
  };
}

function updatePlan(): void {
  const o = options();
  const n = o.sources.length;
  const unaligned = o.sources.filter((s) => !s.aligned).map((s) => s.id);
  $('make-sources').textContent = n === 0
    ? 'Tick the images to use in the list above.'
    : `${n} image${n === 1 ? '' : 's'} ticked: ${n === 1 ? 'it will be recompressed onto the map grid' : 'they will be merged into one'}.` +
      (unaligned.length ? ` Not aligned yet, so placed only roughly: ${unaligned.join(', ')}.` : '');
  const p = n ? plan(o) : null;
  const go = $<HTMLButtonElement>('make-go');
  if (!p) {
    $('make-plan').textContent = '';
    go.disabled = true;
    return;
  }
  if (typeof p === 'string') {
    $('make-plan').textContent = p;
    go.disabled = true;
    return;
  }
  const px = p.grid.width * p.grid.height;
  $('make-plan').textContent =
    `${p.grid.width.toLocaleString()} × ${p.grid.height.toLocaleString()} pixels at ${p.mpp.toFixed(2)} m per pixel` +
    ` (${(px / 1e6).toFixed(1)} megapixels).` +
    (p.capped ? ` Coarser than asked: more would pass the ${MAX_PIXELS / 1e6}-megapixel limit a browser can hold.` : '');
  go.disabled = false;
}

for (const id of ['make-clip', 'make-mpp', 'make-format']) $(id).addEventListener('change', updatePlan);
quality.addEventListener('input', () => { $('make-quality-val').textContent = quality.value; });
format.addEventListener('change', () => { $('make-quality-row').hidden = format.value === 'image/png'; });

$('make-go').addEventListener('click', () => {
  const go = $<HTMLButtonElement>('make-go');
  const msg = $('make-msg');
  go.disabled = true;
  const started = performance.now();
  make(options(), (t) => { msg.textContent = t; })
    .then((p) => {
      products.add(p);
      const secs = ((performance.now() - started) / 1000).toFixed(0);
      msg.textContent = `Made ${p.name} in ${secs} s.` +
        (options().format === 'image/webp' && p.format !== 'image/webp' ? ' This browser cannot write WebP, so it is a PNG.' : '');
      void renderUsage();
    })
    .catch((err: Error) => { msg.textContent = `Could not make it: ${err.message}`; })
    .finally(() => updatePlan());
});

// ---------------------------------------------------------------- tiles

let stopTiles = false;

function tileOptions() {
  const clipId = $<HTMLSelectElement>('tiles-clip').value;
  return {
    name: $<HTMLInputElement>('tiles-name').value,
    sources: images.chosen(),
    clip: clipId ? clips.get(clipId) ?? null : null,
    maxZ: Number($<HTMLSelectElement>('tiles-zoom').value),
  };
}

function updateTilePlan(): void {
  const o = tileOptions();
  const p = tilePlan(o);
  const go = $<HTMLButtonElement>('tiles-go');
  if (typeof p === 'string') {
    $('tiles-plan').textContent = p;
    go.disabled = true;
    return;
  }
  const skipped = o.sources.filter((s) => !s.aligned).length;
  // A third more for the zooms out; 15–40 kB a tile is typical of aerial WebP.
  const all = Math.round(p.tiles * 4 / 3);
  $('tiles-plan').textContent =
    `At most ${p.tiles.toLocaleString()} tiles at the finest zoom, ${all.toLocaleString()} in all, ` +
    `roughly ${Math.round((all * 15) / 1000)}–${Math.round((all * 40) / 1000)} MB. Tiles with nothing in them are skipped, so usually fewer.` +
    (skipped ? ` ${skipped} ticked image(s) not aligned yet are left out.` : '');
  go.disabled = false;
}

for (const id of ['tiles-clip', 'tiles-zoom']) $(id).addEventListener('change', updateTilePlan);
$('tiles-stop').addEventListener('click', () => { stopTiles = true; });
$('tiles-go').addEventListener('click', () => {
  const go = $<HTMLButtonElement>('tiles-go');
  const stop = $('tiles-stop');
  const msg = $('tiles-msg');
  go.disabled = true;
  stop.hidden = false;
  stopTiles = false;
  const started = performance.now();
  void navigator.storage?.persist?.().catch(() => undefined);
  buildTiles(tileOptions(), (t) => { msg.textContent = t; }, () => stopTiles)
    .then((t) => {
      tiles.added(t);
      const mins = (performance.now() - started) / 60000;
      msg.textContent = `Built ${t.name}: ${t.tiles.toLocaleString()} tiles in ${mins >= 1 ? `${mins.toFixed(1)} min` : `${Math.round(mins * 60)} s`}. It is on the map, and in the layers list (top right).`;
      void renderUsage();
    })
    .catch((err: Error) => { msg.textContent = err.message === 'Stopped.' ? 'Stopped; nothing kept.' : `Could not build the tiles: ${err.message}`; })
    .finally(() => { stop.hidden = true; updateTilePlan(); });
});

async function renderUsage(): Promise<void> {
  try {
    const est = await navigator.storage?.estimate?.();
    $('usage').textContent = est?.usage && est.usage >= 1e6 ? `Using ${(est.usage / 1e6).toFixed(0)} MB of this browser's storage.` : '';
  } catch { /* not shown */ }
}

loadCampus()
  .catch((err: Error) => { $('make-msg').textContent = `The campus areas did not load: ${err.message}`; })
  .finally(() => { updatePlan(); updateTilePlan(); void renderUsage(); });

// For the browser test.
Object.assign(window as unknown as Record<string, unknown>, { __imagery: { images, products, tiles, map } });

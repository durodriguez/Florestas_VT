import 'leaflet/dist/leaflet.css';
import './styles.css';

import L from 'leaflet';
import { loadData } from '../data';
import { normalizeTag } from '../accession';
import { TYPE_LABELS } from '../palette';
import type { Plant } from '../types';
import { initImagery } from './imagery';
import { parsePeaks, type Peak, type PeaksFile } from './peaks';
import { loadCrowns, nearRings, readCrownFiles, saveCrowns, type SavedCrowns } from './crowns';
import {
  applyMove, movedMeters, movesToCsv, reconcile, today,
  type Move, type Moves,
} from './moves';

const BASE = import.meta.env.BASE_URL;
const STORE = 'uvm-tree-positions/moves';
const DRAG_PX = 3;

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element: ${id}`);
  return el as T;
};
const esc = (v: string): string =>
  v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// Bright enough to read on aerial imagery, which is mostly canopy, grass and
// asphalt: the public map's two greens disappear into the first two. Evergreen
// and deciduous are told apart because that is what the imagery shows — a dark
// conifer crown against bare branches is how a misplaced pine gets noticed.
const FILL: Record<string, string> = {
  'evergreen-tree': '#38d1e6',
  'deciduous-tree': '#a6e34f',
};
const OTHER_FILL = '#f2a7d2';
const MOVED_FILL = '#ffd100';

let plants: Plant[] = [];
const byId = new Map<string, Plant>();
/** Where the data has each tree — the `from` of any new move. */
const home = new Map<string, [number, number]>();
const dots = new Map<string, L.CircleMarker>();
let moves: Moves = {};
let stale = new Set<string>();
let selected: string | null = null;
const undoStack: Array<{ id: string; prev: Move | undefined }> = [];
/** LiDAR crown peaks, if the build has them. */
let peaks: Peak[] = [];

// ---------------------------------------------------------------- map

const map = L.map($('map'), { zoomControl: true, maxZoom: 22, preferCanvas: true });
// A view from the start, not only once the trees arrive: saved imagery is
// restored before then, and Leaflet cannot place anything on a map with none.
map.setView([44.4777, -73.1956], 17);
const imagery = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 22, maxNativeZoom: 20, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' },
).addTo(map);
const streets = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 22, maxNativeZoom: 19, attribution: '© OpenStreetMap contributors',
});
const layersControl = L.control.layers({ 'Satellite': imagery, 'Streets': streets }, undefined, { position: 'topright' }).addTo(map);

// Campus outlines: above the surveyor's own imagery (250), below the trees.
map.createPane('campus');
map.getPane('campus')!.style.zIndex = '300';
map.getPane('campus')!.style.pointerEvents = 'none';
L.control.scale({ imperial: false }).addTo(map);

// Generous tolerance: a 6 px dot is a small target, and the job is grabbing
// hundreds of them.
const renderer = L.canvas({ padding: 0.5, tolerance: 5 });
const ghostLayer = L.layerGroup().addTo(map);
const dotLayer = L.layerGroup().addTo(map);
const labelLayer = L.layerGroup().addTo(map);
const peakLayer = L.layerGroup();
const crownLayer = L.layerGroup();
/** Where crowns are kept from a city-wide file: inside the campus boundary, or within 30 m of it. */
let crownArea: ((lat: number, lng: number) => boolean) | null = null;

const fillFor = (p: Plant): string =>
  moves[p.id] ? MOVED_FILL : (FILL[p.taxon.type] ?? OTHER_FILL);

function styleDot(id: string): void {
  const dot = dots.get(id);
  const p = byId.get(id);
  if (!dot || !p) return;
  const isSel = id === selected;
  dot.setStyle({
    radius: isSel ? 9 : 6,
    color: isSel ? '#ff2d55' : moves[id] ? '#154734' : '#ffffff',
    weight: isSel ? 3 : 1.5,
    fillColor: fillFor(p),
    fillOpacity: 0.95,
  });
  if (isSel) dot.bringToFront();
}

/** Where the record had a moved tree, and a line from there to where it is now. */
function drawGhosts(): void {
  ghostLayer.clearLayers();
  for (const m of Object.values(moves)) {
    L.polyline([m.from, m.to], { renderer, color: '#ffd100', weight: 1.5, dashArray: '4 4', interactive: false }).addTo(ghostLayer);
    L.circleMarker(m.from, { renderer, radius: 3, color: '#ffd100', weight: 1, fillColor: '#000', fillOpacity: 0.5, interactive: false }).addTo(ghostLayer);
  }
}

/** Tag numbers on the imagery, once zoomed in far enough for them to fit. */
function drawLabels(): void {
  labelLayer.clearLayers();
  if (map.getZoom() < 19) return;
  const view = map.getBounds().pad(0.1);
  for (const p of plants) {
    const at = dots.get(p.id)!.getLatLng();
    if (!view.contains(at)) continue;
    L.marker(at, {
      interactive: false,
      keyboard: false,
      icon: L.divIcon({ className: 'tree-label', html: esc(p.tag || p.id.replace(/^UVM-/, '#')), iconSize: [0, 0], iconAnchor: [-8, 6] }),
    }).addTo(labelLayer);
  }
}
map.on('moveend zoomend', drawLabels);

// ---------------------------------------------------------------- dragging

// Leaflet cannot drag a circle marker, and a draggable L.Marker for each of
// two thousand trees would be slow. So the drag is done by hand: press on a
// dot, the map stops panning, the dot follows the pointer, and letting go is
// the move. Press-and-release without travelling is a click, which selects.
let drag: { id: string; x: number; y: number; travelled: boolean } | null = null;
/** When the last drag ended: the release can arrive as a click on the map. */
let dragEndedAt = 0;

function startDrag(id: string, e: L.LeafletMouseEvent): void {
  L.DomEvent.stop(e.originalEvent);
  // Stopping the press also stops the browser moving focus, so a cursor left
  // in the search box would keep the arrow keys and Ctrl+Z for itself.
  (document.activeElement as HTMLElement | null)?.blur();
  drag = { id, x: e.originalEvent.clientX, y: e.originalEvent.clientY, travelled: false };
  map.dragging.disable();
  select(id, false);
}

document.addEventListener('mousemove', (e) => {
  if (!drag) return;
  if (!drag.travelled && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < DRAG_PX) return;
  drag.travelled = true;
  map.getContainer().classList.add('is-dragging');
  dots.get(drag.id)!.setLatLng(map.mouseEventToLatLng(e));
});

document.addEventListener('mouseup', () => {
  if (!drag) return;
  const { id, travelled } = drag;
  drag = null;
  dragEndedAt = Date.now();
  map.dragging.enable();
  map.getContainer().classList.remove('is-dragging');
  if (travelled) {
    const at = dots.get(id)!.getLatLng();
    commit(id, [at.lat, at.lng]);
  }
});

// ---------------------------------------------------------------- moves

function commit(id: string, to: [number, number]): void {
  undoStack.push({ id, prev: moves[id] });
  moves = applyMove(moves, id, home.get(id)!, to, today());
  stale.delete(id);
  afterChange(id);
}

function revert(id: string, prev: Move | undefined): void {
  const next = { ...moves };
  if (prev) next[id] = prev;
  else delete next[id];
  moves = next;
  afterChange(id);
}

function afterChange(id: string): void {
  const m = moves[id];
  dots.get(id)?.setLatLng(m ? m.to : home.get(id)!);
  styleDot(id);
  drawGhosts();
  drawLabels();
  save();
  renderMoves();
  renderSelected();
}

function undo(): void {
  const last = undoStack.pop();
  if (!last) return;
  revert(last.id, last.prev);
  select(last.id, false);
}

// ---------------------------------------------------------------- storage

/**
 * Kept in this browser after every move, so a closed tab or a crash loses
 * nothing. Browser storage can be cleared or refused, so the bar says plainly
 * when it is not working — and the export is the copy that counts.
 */
function save(): void {
  const state = $('save-state');
  try {
    localStorage.setItem(STORE, JSON.stringify(moves));
    const n = Object.keys(moves).length;
    state.textContent = n ? 'Saved in this browser' : '';
    state.classList.remove('is-warn');
  } catch {
    state.textContent = 'Not saving in this browser — export before you close it';
    state.classList.add('is-warn');
  }
}

function load(): Moves {
  try {
    const raw = localStorage.getItem(STORE);
    return raw ? (JSON.parse(raw) as Moves) : {};
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------- panel

function describe(id: string): { tag: string; species: string } {
  const p = byId.get(id);
  return { tag: p?.tag ?? '', species: p?.taxon.sci ?? '' };
}

function renderMoves(): void {
  const list = Object.values(moves).sort((a, b) => b.on.localeCompare(a.on) || a.id.localeCompare(b.id));
  // Newest first by the order they were made this session, where known.
  const order = new Map(undoStack.map((u, i) => [u.id, i]));
  list.sort((a, b) => (order.get(b.id) ?? -1) - (order.get(a.id) ?? -1));

  $('move-count').textContent = String(list.length);
  $('moves-empty').hidden = list.length > 0;
  $<HTMLButtonElement>('export').disabled = list.length - stale.size <= 0;
  $<HTMLButtonElement>('clear').disabled = list.length === 0;
  $<HTMLButtonElement>('undo').disabled = undoStack.length === 0;
  $('export').textContent = list.length ? `Export ${list.length - stale.size} move(s)` : 'Export moves';

  $('moves').innerHTML = list.map((m) => {
    const p = byId.get(m.id);
    const isStale = stale.has(m.id);
    return `<li class="${isStale ? 'is-stale' : ''}">
      <button type="button" class="go" data-go="${esc(m.id)}">
        <span class="mv-id">${esc(m.id)}</span>
        <span class="mv-meta">${p?.tag ? `tag ${esc(p.tag)} · ` : ''}${esc(p?.taxon.common ?? '')} · ${movedMeters(m).toFixed(1)} m${isStale ? ' · changed since — move again' : ''}</span>
      </button>
      <button type="button" class="ghost-btn" data-reset="${esc(m.id)}">Reset</button>
    </li>`;
  }).join('');
}

function renderSelected(): void {
  const card = $('selected');
  const p = selected ? byId.get(selected) : undefined;
  if (!p) {
    card.hidden = true;
    card.innerHTML = '';
    return;
  }
  const m = moves[p.id];
  card.hidden = false;
  card.innerHTML = `
    <span class="id">${esc(p.id)} ${p.tag ? `<span class="tag-chip">Tag ${esc(p.tag)}</span>` : '<span class="tag-chip">No tag</span>'}</span>
    <span class="name">${esc(p.taxon.common)}</span>
    <span class="sci">${esc(p.taxon.sci)}</span>
    <span>${esc(TYPE_LABELS[p.taxon.type] ?? p.taxon.type)}${p.collection ? ` · ${esc(p.collection.name)}` : ''}</span>
    ${m
      ? `<span class="moved">Moved ${movedMeters(m).toFixed(1)} m</span>
         <button type="button" class="ghost-btn" data-reset="${esc(p.id)}">Put it back where the record has it</button>`
      : '<span class="hint">Not moved. Drag the dot, or use the arrow keys.</span>'}
`;
}

function select(id: string | null, pan: boolean): void {
  const prev = selected;
  selected = id;
  if (prev) styleDot(prev);
  if (id) {
    styleDot(id);
    if (pan) map.setView(dots.get(id)!.getLatLng(), Math.max(map.getZoom(), 20));
  }
  renderSelected();
}

function find(query: string): void {
  const msg = $('find-msg');
  const q = query.trim();
  if (!q) return;
  const id = q.toUpperCase();
  const tag = normalizeTag(q);
  const hit = byId.get(id) ?? byId.get(`UVM-${id}`) ?? plants.find((p) => tag !== null && normalizeTag(p.tag) === tag);
  msg.classList.toggle('is-err', !hit);
  msg.textContent = hit ? '' : `No mapped tree with tag or number “${q}”.`;
  if (hit) select(hit.id, true);
}

// ---------------------------------------------------------------- wiring

$('moves').addEventListener('click', (e) => {
  const el = e.target as HTMLElement;
  const reset = el.closest<HTMLElement>('[data-reset]');
  if (reset) return resetTree(reset.dataset.reset!);
  const go = el.closest<HTMLElement>('[data-go]');
  if (go) select(go.dataset.go!, true);
});
$('selected').addEventListener('click', (e) => {
  const el = e.target as HTMLElement;
  const reset = el.closest<HTMLElement>('[data-reset]');
  if (reset) resetTree(reset.dataset.reset!);
});

function resetTree(id: string): void {
  undoStack.push({ id, prev: moves[id] });
  revert(id, undefined);
  stale.delete(id);
  renderMoves();
}

$('undo').addEventListener('click', undo);
$('clear').addEventListener('click', () => {
  const n = Object.keys(moves).length;
  if (!confirm(`Clear all ${n} move(s)? Export first if you want to keep them — this cannot be undone.`)) return;
  const ids = Object.keys(moves);
  moves = {};
  stale = new Set();
  undoStack.length = 0;
  for (const id of ids) afterChange(id);
});

$('export').addEventListener('click', () => {
  const list = Object.values(moves).filter((m) => !stale.has(m.id));
  const csv = movesToCsv(list, describe);
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `positions-${today()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
});

$<HTMLInputElement>('find').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') find((e.target as HTMLInputElement).value);
});

// Clicking empty map deselects. A click on a dot never reaches here: the dot
// stops it on mousedown.
// The trees step aside while an image is being aligned: clicks then belong
// to the alignment, and the dots would hide the features being matched.
const myImagery = initImagery(map, {
  onAligning: (on) => {
    for (const layer of [dotLayer, labelLayer, ghostLayer]) {
      if (on) map.removeLayer(layer);
      else layer.addTo(map);
    }
    map.getContainer().classList.toggle('is-aligning', on);
    if (on) select(null, false);
    else drawLabels();
  },
});

map.on('click', (e: L.LeafletMouseEvent) => {
  if (myImagery.click(e.latlng)) return;
  if (Date.now() - dragEndedAt > 300) select(null, false);
});

document.addEventListener('keydown', (e) => {
  const typing = (e.target as HTMLElement).closest('input, textarea');
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) {
    e.preventDefault();
    undo();
    return;
  }
  if (typing) return;
  if (e.key === 'Escape') {
    if (myImagery.isAligning()) return myImagery.cancel();
    return select(null, false);
  }
  const step = { ArrowUp: [1, 0], ArrowDown: [-1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
  if (!step || !selected) return;
  e.preventDefault();
  // Metres to degrees at this latitude; 0.2 m is about two imagery pixels.
  const metres = e.shiftKey ? 1 : 0.2;
  const at = dots.get(selected)!.getLatLng();
  const dLat = (step[0]! * metres) / 111_320;
  const dLng = (step[1]! * metres) / (111_320 * Math.cos((at.lat * Math.PI) / 180));
  commit(selected, [at.lat + dLat, at.lng + dLng]);
});

window.addEventListener('beforeunload', (e) => {
  // Saved already; this only catches a browser that refused to save.
  if (Object.keys(moves).length && $('save-state').classList.contains('is-warn')) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ---------------------------------------------------------------- start

loadData(BASE).then(({ dataset, plants: all }) => {
  // Lines only, in colours that read on aerial imagery — the explorer's
  // dark greens and tinted fills vanish into canopy. Never interactive: a
  // polygon that took clicks would make the trees inside it undraggable.
  const campus = L.geoJSON(dataset.campusAreas, {
    pane: 'campus',
    interactive: false,
    style: (f) => {
      const outline = f?.properties?.kind === 'boundary';
      return {
        color: outline ? '#ffd100' : '#ffffff',
        weight: outline ? 3 : 1.5,
        opacity: outline ? 0.95 : 0.75,
        dashArray: f?.properties?.provisional ? '6 6' : undefined,
        fill: false,
      };
    },
    onEachFeature: (f, layer) => {
      if (f.properties?.kind !== 'campus') return;
      layer.bindTooltip(esc(String(f.properties.name)), {
        permanent: true, direction: 'center', className: 'campus-name', interactive: false, pane: 'campus',
      });
    },
  }).addTo(map);
  const provisional = dataset.campusAreas.features.some((f) => f.properties.provisional);
  layersControl.addOverlay(campus, `Campus boundary${provisional ? ' (approximate)' : ''}`);

  const cfg = dataset.config.map;
  map.setView(cfg.center, 17);

  // Standing trees only: a removed or missing one has nowhere to be moved to.
  plants = all.filter((p) => p.status === 'active');
  for (const p of plants) {
    byId.set(p.id, p);
    home.set(p.id, [p.lat, p.lng]);
  }

  const saved = reconcile(load(), home);
  moves = saved.moves;
  stale = new Set(saved.stale);
  const notes: string[] = [];
  if (saved.applied.length) notes.push(`${saved.applied.length} saved move(s) are already on the map and were cleared.`);
  if (saved.stale.length) notes.push(`${saved.stale.length} tree(s) moved by something else since — shown in red, left out of the export.`);
  if (saved.missing.length) notes.push(`${saved.missing.length} saved move(s) were for trees no longer on the map.`);
  $('moves-note').hidden = notes.length === 0;
  $('moves-note').textContent = notes.join(' ');

  for (const p of plants) {
    const m = moves[p.id];
    const dot = L.circleMarker(m ? m.to : [p.lat, p.lng], { renderer, bubblingMouseEvents: false })
      .bindTooltip(
        `${esc(p.id)}${p.tag ? ` · tag ${esc(p.tag)}` : ''} · ${esc(p.taxon.common)}`,
        { direction: 'top', offset: [0, -6] },
      )
      .on('mousedown', (e: L.LeafletMouseEvent) => startDrag(p.id, e))
      .addTo(dotLayer);
    dots.set(p.id, dot);
    styleDot(p.id);
  }
  drawGhosts();
  drawLabels();
  save();
  renderMoves();

  const boundary = dataset.campusAreas.features.find((f) => f.properties.kind === 'boundary');
  if (boundary?.geometry.type === 'MultiPolygon') {
    crownArea = nearRings(boundary.geometry.coordinates.map((poly) => poly[0] as Array<[number, number]>), 30);
  } else if (boundary?.geometry.type === 'Polygon') {
    crownArea = nearRings([boundary.geometry.coordinates[0] as Array<[number, number]>], 30);
  }
  restoreCrowns();
  // The LiDAR layer is extra: if it fails, the tool still works without it.
  loadPeaks().catch((err: Error) => { $('lidar-msg').textContent = `LiDAR layer not loaded: ${err.message}`; });
}).catch((err: Error) => {
  $('find-msg').textContent = `Could not load the trees: ${err.message}`;
  $('find-msg').classList.add('is-err');
});

// ---------------------------------------------------------------- LiDAR

async function loadPeaks(): Promise<void> {
  const res = await fetch(`${BASE}data/crown-peaks.json?v=${__DATA_VERSION__}`).catch(() => null);
  if (!res?.ok) return;            // a build without the file simply has no LiDAR layer
  peaks = parsePeaks((await res.json()) as PeaksFile);
  for (const p of peaks) {
    L.circleMarker([p.lat, p.lng], {
      renderer, interactive: false, radius: 3, color: '#ff7a00', weight: 1.5, fill: true, fillColor: '#ff7a00', fillOpacity: 0.25,
    }).addTo(peakLayer);
  }
  layersControl.addOverlay(peakLayer, 'LiDAR crown peaks (April 2023)');
  peakLayer.addTo(map);
  $('lidar-count').textContent = peaks.length.toLocaleString();
  $('lidar').hidden = false;
}

// ---------------------------------------------------------------- crowns (SAL, private)

const CROWN = '#c9a2ff';
let crownsShown = false;

function drawCrowns(saved: SavedCrowns | null): void {
  crownLayer.clearLayers();
  $('crowns-remove').hidden = !saved;
  $('crowns-count').textContent = saved ? saved.crowns.length.toLocaleString() : '0';
  $('crowns-msg').textContent = saved
    ? `${saved.name}, loaded ${saved.loaded}. Kept in this browser only.`
    : '';
  if (!saved) {
    if (crownsShown) layersControl.removeLayer(crownLayer);
    map.removeLayer(crownLayer);
    crownsShown = false;
    return;
  }
  for (const c of saved.crowns) {
    L.circle([c.lat, c.lng], { renderer, radius: c.radius, interactive: false, color: CROWN, weight: 1.25, opacity: 0.9, fill: false }).addTo(crownLayer);
    L.circleMarker([c.lat, c.lng], { renderer, radius: 1.5, interactive: false, color: CROWN, weight: 1, fill: true, fillColor: CROWN, fillOpacity: 1 }).addTo(crownLayer);
  }
  if (!crownsShown) layersControl.addOverlay(crownLayer, 'Tree crowns (SAL, my file)');
  crownsShown = true;
  crownLayer.addTo(map);
  // Trees stay on top: they are what gets dragged.
  dotLayer.eachLayer((l) => (l as L.CircleMarker).bringToFront());
  if (selected) styleDot(selected);
}

async function restoreCrowns(): Promise<void> {
  try {
    drawCrowns(await loadCrowns());
  } catch {
    $('crowns-msg').textContent = 'This browser will not store the crowns; they will need loading again next time.';
  }
}

$<HTMLInputElement>('crowns-add').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement;
  const files = [...(input.files ?? [])];
  input.value = '';
  if (!files.length || !crownArea) return;
  const msg = $('crowns-msg');
  msg.textContent = 'Reading…';
  try {
    const area = crownArea;
    const crowns = await readCrownFiles(files, (c) => area(c.lat, c.lng));
    if (!crowns.length) throw new Error('none of its crowns are on or near campus');
    const saved: SavedCrowns = { name: files.map((f) => f.name).join(', '), loaded: today(), crowns };
    drawCrowns(saved);
    try {
      await saveCrowns(saved);
    } catch {
      msg.textContent += ' This browser refused to store them, so they last until the tab closes.';
    }
  } catch (err) {
    msg.textContent = `Could not read it: ${(err as Error).message}.`;
  }
});

$('crowns-remove').addEventListener('click', async () => {
  drawCrowns(null);
  await saveCrowns(null).catch(() => undefined);
});

// Surfaced for the browser test.
Object.assign(window as unknown as Record<string, unknown>, {
  __positions: {
    moves: () => moves,
    at: (id: string) => {
      const ll = dots.get(id)?.getLatLng();
      return ll ? [ll.lat, ll.lng] : null;
    },
    pointOf: (id: string) => {
      const ll = dots.get(id)!.getLatLng();
      const pt = map.latLngToContainerPoint(ll);
      const box = map.getContainer().getBoundingClientRect();
      return [box.left + pt.x, box.top + pt.y];
    },
    selected: () => selected,
    peaks: () => peaks.length,
    crowns: () => crownLayer.getLayers().length / 2,
    imagery: myImagery,
    screenOf: (lat: number, lng: number) => {
      const pt = map.latLngToContainerPoint([lat, lng]);
      const box = map.getContainer().getBoundingClientRect();
      return [box.left + pt.x, box.top + pt.y];
    },
  },
});

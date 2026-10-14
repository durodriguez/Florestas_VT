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
  applyMove, idsInBox, idsInCircle, movedMeters, movesToCsv, reconcile, today,
  type Deletion, type Deletions, type Move, type Moves,
} from './moves';

const BASE = import.meta.env.BASE_URL;
const STORE = 'uvm-tree-positions/moves';
const DEL_STORE = 'uvm-tree-positions/deletions';
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
/** Trees marked as not there, to become not-found observations. */
let deletions: Deletions = {};
let stale = new Set<string>();
/** The trees picked: one by a click, more by Shift+click or an area. */
const picked = new Set<string>();
/** The one picked tree, when exactly one is: the card shows it, the arrow keys move it. */
let selected: string | null = null;
/** Each change remembers what it replaced, for every tree it touched. */
interface Undo { ids: string[]; moves: Array<Move | undefined>; deletions: Array<Deletion | undefined> }
const undoStack: Undo[] = [];
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

// Marked not there: a dark, dashed red ring, still on the map so it can be
// found again and restored before the export.
const DELETED = '#ff2d55';

function styleDot(id: string): void {
  const dot = dots.get(id);
  const p = byId.get(id);
  if (!dot || !p) return;
  const isSel = picked.has(id);
  const gone = !!deletions[id];
  dot.setStyle({
    radius: isSel ? 9 : gone ? 5 : 6,
    color: isSel || gone ? DELETED : moves[id] ? '#154734' : '#ffffff',
    weight: isSel ? 3 : gone ? 2 : 1.5,
    fillColor: gone ? '#1b1b1b' : fillFor(p),
    fillOpacity: gone ? 0.6 : 0.95,
    dashArray: gone && !isSel ? '3 3' : undefined,
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
let drag: { id: string; x: number; y: number; travelled: boolean; locked: boolean } | null = null;
/** When the last drag ended: the release can arrive as a click on the map. */
let dragEndedAt = 0;

function startDrag(id: string, e: L.LeafletMouseEvent): void {
  L.DomEvent.stop(e.originalEvent);
  // Stopping the press also stops the browser moving focus, so a cursor left
  // in the search box would keep the arrow keys and Ctrl+Z for itself.
  (document.activeElement as HTMLElement | null)?.blur();
  dragEndedAt = Date.now();
  // Shift+click or Ctrl+click (⌘ on a Mac) adds a tree to the picked set,
  // or takes it out.
  if (adding(e.originalEvent)) return togglePick(id);
  select(id, false);
  // A tree marked not there stays put (restore it first to move it), but the
  // press is still the dot's: the map must not pan under it either.
  drag = { id, x: e.originalEvent.clientX, y: e.originalEvent.clientY, travelled: false, locked: !!deletions[id] };
  map.dragging.disable();
}

document.addEventListener('mousemove', (e) => {
  if (!drag || drag.locked) return;
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

// ---------------------------------------------------------------- area select

// Rectangle or circle: drag on the map and every standing tree inside is
// picked; with Shift or Ctrl held, added to what is already picked. The
// drawing is handled on the map's container before Leaflet sees the press, so
// a press on a dot draws the area rather than picking the tree up.
//
// The finished shape stays, with handles: a rectangle's four corners resize
// it, a circle's edge handle sets its radius, and the center handle of either
// moves it. The selection follows the shape as it changes. A plain click on a
// tree, Clear selection, Esc or a new shape puts it away.
type AreaMode = 'rect' | 'circle';
let areaMode: AreaMode | null = null;
/** The shape being drawn, between press and release. */
let drawing: { start: L.LatLng; shape: L.Rectangle | L.Circle; add: boolean } | null = null;
/**
 * The shape left on the map. The selection is what was picked before it
 * (`base`, if it was drawn adding) plus the trees inside it, less any taken
 * out by hand since (`excluded`).
 */
let areaSel: {
  shape: L.Rectangle | L.Circle;
  handles: L.Marker[];
  base: Set<string>;
  excluded: Set<string>;
} | null = null;

function setAreaMode(mode: AreaMode | null): void {
  areaMode = mode;
  for (const [id, m] of [['area-rect', 'rect'], ['area-circle', 'circle']] as const) {
    $(id).setAttribute('aria-pressed', String(mode === m));
  }
  map.getContainer().classList.toggle('is-area-mode', !!mode);
  if (!mode && drawing) {
    drawing.shape.remove();
    drawing = null;
    map.dragging.enable();
  }
}

// Drawn on the trees' own canvas: a shape on the map's default renderer gets
// a canvas of its own, laid over the whole map, and that would swallow every
// click meant for a tree from then on.
const AREA_STYLE: L.PathOptions = { renderer, color: '#ff2d55', weight: 2, dashArray: '6 4', fillColor: '#ff2d55', fillOpacity: 0.08, interactive: false };

const adding = (e: MouseEvent): boolean => e.shiftKey || e.ctrlKey || e.metaKey;

function treePoints(): Array<[string, [number, number]]> {
  return [...dots].map(([id, d]) => [id, [d.getLatLng().lat, d.getLatLng().lng]]);
}

function insideShape(shape: L.Rectangle | L.Circle): string[] {
  if (shape instanceof L.Circle) {
    const c = shape.getLatLng();
    return idsInCircle(treePoints(), [c.lat, c.lng], shape.getRadius());
  }
  const b = shape.getBounds();
  return idsInBox(treePoints(), [b.getSouth(), b.getWest()], [b.getNorth(), b.getEast()]);
}

/** Recompute the selection from the shape left on the map. */
function applyArea(): void {
  if (!areaSel) return;
  const ids = new Set([...areaSel.base, ...insideShape(areaSel.shape)]);
  for (const id of areaSel.excluded) ids.delete(id);
  setPicked(ids);
  $('find-msg').classList.remove('is-err');
  $('find-msg').textContent = ids.size ? '' : 'No trees inside that area.';
}

function removeArea(): void {
  if (!areaSel) return;
  areaSel.shape.remove();
  for (const h of areaSel.handles) h.remove();
  areaSel = null;
}

const handleIcon = (cls: string, title: string) => {
  const move = cls === 'is-move';
  const size = move ? 22 : 14;
  return L.divIcon({
    className: `area-handle ${cls}`, iconSize: [size, size], iconAnchor: [size / 2, size / 2],
    html: `<span title="${title}">${move ? '✥' : ''}</span>`,
  });
};

/** A point `metres` east of `at`. */
function east(at: L.LatLng, metres: number): L.LatLng {
  return L.latLng(at.lat, at.lng + metres / (111_320 * Math.cos((at.lat * Math.PI) / 180)));
}

/** Put handles on a finished shape, and keep it and the selection in step with them. */
function keepArea(shape: L.Rectangle | L.Circle, base: Set<string>): void {
  removeArea();
  const handle = (at: L.LatLng, cls: string, title: string) =>
    L.marker(at, { icon: handleIcon(cls, title), draggable: true, autoPan: true, keyboard: false, zIndexOffset: 1000 }).addTo(map);
  const handles: L.Marker[] = [];
  if (shape instanceof L.Circle) {
    const center = handle(shape.getLatLng(), 'is-move', 'Drag to move the circle');
    const edge = handle(east(shape.getLatLng(), shape.getRadius()), 'is-size', 'Drag to resize the circle');
    center.on('drag', () => {
      const r = shape.getRadius();
      shape.setLatLng(center.getLatLng());
      edge.setLatLng(east(center.getLatLng(), r));
      applyArea();
    });
    edge.on('drag', () => {
      shape.setRadius(map.distance(shape.getLatLng(), edge.getLatLng()));
      applyArea();
    });
    handles.push(center, edge);
  } else {
    const corners = () => {
      const b = shape.getBounds();
      return [b.getNorthWest(), b.getNorthEast(), b.getSouthEast(), b.getSouthWest()];
    };
    const place = () => {
      corners().forEach((c, i) => handles[i]!.setLatLng(c));
      handles[4]!.setLatLng(shape.getBounds().getCenter());
    };
    corners().forEach((c, i) => {
      const h = handle(c, 'is-size', 'Drag to resize the rectangle');
      h.on('drag', () => {
        // The opposite corner stays put; this one follows the pointer.
        const opposite = corners()[(i + 2) % 4]!;
        shape.setBounds(L.latLngBounds(opposite, h.getLatLng()));
        place();
        applyArea();
      });
      handles.push(h);
    });
    const move = handle(shape.getBounds().getCenter(), 'is-move', 'Drag to move the rectangle');
    move.on('drag', () => {
      const b = shape.getBounds();
      const c = b.getCenter();
      const to = move.getLatLng();
      const dLat = to.lat - c.lat;
      const dLng = to.lng - c.lng;
      shape.setBounds(L.latLngBounds(
        [b.getSouth() + dLat, b.getWest() + dLng],
        [b.getNorth() + dLat, b.getEast() + dLng],
      ));
      place();
      applyArea();
    });
    handles.push(move);
  }
  // A handle's press is its own: no map click (and so no deselect) after it.
  for (const h of handles) h.on('dragend', () => { dragEndedAt = Date.now(); });
  areaSel = { shape, handles, base, excluded: new Set() };
  applyArea();
}

map.getContainer().addEventListener('mousedown', (e) => {
  if (!areaMode || e.button !== 0) return;
  if ((e.target as HTMLElement).closest('.leaflet-control')) return;
  e.stopPropagation();
  e.preventDefault();
  map.dragging.disable();
  const start = map.mouseEventToLatLng(e);
  const shape = areaMode === 'rect'
    ? L.rectangle(L.latLngBounds(start, start), AREA_STYLE)
    : L.circle(start, { ...AREA_STYLE, radius: 0 });
  drawing = { start, shape: shape.addTo(map), add: adding(e) };
}, true);

document.addEventListener('mousemove', (e) => {
  if (!drawing) return;
  const at = map.mouseEventToLatLng(e);
  if (drawing.shape instanceof L.Circle) drawing.shape.setRadius(map.distance(drawing.start, at));
  else drawing.shape.setBounds(L.latLngBounds(drawing.start, at));
});

document.addEventListener('mouseup', () => {
  if (!drawing) return;
  const { shape, add } = drawing;
  drawing = null;
  dragEndedAt = Date.now();
  map.dragging.enable();
  setAreaMode(null);
  keepArea(shape, add ? new Set(picked) : new Set());
});

$('area-rect').addEventListener('click', () => setAreaMode(areaMode === 'rect' ? null : 'rect'));
$('area-circle').addEventListener('click', () => setAreaMode(areaMode === 'circle' ? null : 'circle'));

// ---------------------------------------------------------------- moves

function remember(ids: string[]): void {
  undoStack.push({ ids, moves: ids.map((id) => moves[id]), deletions: ids.map((id) => deletions[id]) });
}

function commit(id: string, to: [number, number]): void {
  remember([id]);
  moves = applyMove(moves, id, home.get(id)!, to, today());
  stale.delete(id);
  afterChange([id]);
}

/**
 * Mark trees as not there. A tree with a move loses it: there is nothing to
 * move. Asks first when it is more than one, since an area can catch more
 * than was meant.
 */
function deleteTrees(ids: string[]): void {
  const todo = ids.filter((id) => byId.has(id) && !deletions[id]);
  if (!todo.length) return;
  if (todo.length > 1 && !confirm(`Mark ${todo.length} trees as not there? They stay listed, and can be restored, until you export.`)) return;
  remember(todo);
  const nextMoves = { ...moves };
  const nextDel = { ...deletions };
  for (const id of todo) {
    delete nextMoves[id];
    stale.delete(id);
    nextDel[id] = { id, at: home.get(id)!, on: today() };
  }
  moves = nextMoves;
  deletions = nextDel;
  clearPicked();
  afterChange(todo);
}

function restoreTree(id: string): void {
  if (!deletions[id]) return;
  remember([id]);
  const next = { ...deletions };
  delete next[id];
  deletions = next;
  afterChange([id]);
}

function afterChange(ids: string[]): void {
  for (const id of ids) {
    const m = moves[id];
    dots.get(id)?.setLatLng(m ? m.to : home.get(id)!);
    styleDot(id);
  }
  drawGhosts();
  drawLabels();
  save();
  renderMoves();
  renderSelected();
}

function undo(): void {
  const last = undoStack.pop();
  if (!last) return;
  const nextMoves = { ...moves };
  const nextDel = { ...deletions };
  last.ids.forEach((id, i) => {
    const m = last.moves[i];
    const d = last.deletions[i];
    if (m) nextMoves[id] = m; else delete nextMoves[id];
    if (d) nextDel[id] = d; else delete nextDel[id];
  });
  moves = nextMoves;
  deletions = nextDel;
  afterChange(last.ids);
  if (last.ids.length === 1) select(last.ids[0]!, false);
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
    localStorage.setItem(DEL_STORE, JSON.stringify(deletions));
    const n = Object.keys(moves).length + Object.keys(deletions).length;
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

function loadDeletions(): Deletions {
  try {
    const raw = localStorage.getItem(DEL_STORE);
    return raw ? (JSON.parse(raw) as Deletions) : {};
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
  const order = new Map(undoStack.flatMap((u, i) => u.ids.map((id) => [id, i] as const)));
  list.sort((a, b) => (order.get(b.id) ?? -1) - (order.get(a.id) ?? -1));
  const gone = Object.values(deletions).sort((a, b) => (order.get(b.id) ?? -1) - (order.get(a.id) ?? -1) || a.id.localeCompare(b.id));

  const changes = list.length - stale.size + gone.length;
  $('move-count').textContent = String(list.length);
  $('moves-empty').hidden = list.length > 0;
  $<HTMLButtonElement>('export').disabled = changes <= 0;
  $<HTMLButtonElement>('clear').disabled = list.length + gone.length === 0;
  $<HTMLButtonElement>('undo').disabled = undoStack.length === 0;
  $('export').textContent = changes > 0 ? `Export ${changes} change(s)` : 'Export changes';

  $('del-count').textContent = String(gone.length);
  $('deletions-empty').hidden = gone.length > 0;
  $('deletions').innerHTML = gone.map((d) => {
    const p = byId.get(d.id);
    return `<li>
      <button type="button" class="go" data-go="${esc(d.id)}">
        <span class="mv-id">${esc(d.id)}</span>
        <span class="mv-meta">${p?.tag ? `tag ${esc(p.tag)} · ` : ''}${esc(p?.taxon.common ?? '')} · not there</span>
      </button>
      <button type="button" class="ghost-btn" data-restore="${esc(d.id)}">Restore</button>
    </li>`;
  }).join('');

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
  if (picked.size > 1) {
    const ids = [...picked];
    const live = ids.filter((id) => !deletions[id]);
    const shown = ids.slice(0, 12).map((id) => {
      const q = byId.get(id);
      return `<li>${esc(id)}${q?.tag ? ` · tag ${esc(q.tag)}` : ''} · ${esc(q?.taxon.common ?? '')}${deletions[id] ? ' · not there' : ''}</li>`;
    }).join('');
    card.hidden = false;
    card.innerHTML = `
      <span class="name">${ids.length} trees selected</span>
      <ul class="picked-list">${shown}${ids.length > 12 ? `<li>and ${ids.length - 12} more</li>` : ''}</ul>
      ${live.length ? `<button type="button" class="danger-btn" data-delete-picked>Mark ${live.length} as not there</button>` : ''}
      <button type="button" class="ghost-btn" data-clear-picked>Clear selection</button>
      <span class="hint">Shift+click or Ctrl+click a tree to add it or take it out.</span>`;
    return;
  }
  const p = selected ? byId.get(selected) : undefined;
  if (!p) {
    card.hidden = true;
    card.innerHTML = '';
    return;
  }
  const m = moves[p.id];
  const gone = deletions[p.id];
  card.hidden = false;
  card.innerHTML = `
    <span class="id">${esc(p.id)} ${p.tag ? `<span class="tag-chip">Tag ${esc(p.tag)}</span>` : '<span class="tag-chip">No tag</span>'}</span>
    <span class="name">${esc(p.taxon.common)}</span>
    <span class="sci">${esc(p.taxon.sci)}</span>
    <span>${esc(TYPE_LABELS[p.taxon.type] ?? p.taxon.type)}${p.collection ? ` · ${esc(p.collection.name)}` : ''}</span>
    ${gone
      ? `<span class="gone">Marked not there</span>
         <button type="button" class="ghost-btn" data-restore="${esc(p.id)}">Restore it</button>`
      : m
        ? `<span class="moved">Moved ${movedMeters(m).toFixed(1)} m</span>
           <button type="button" class="ghost-btn" data-reset="${esc(p.id)}">Put it back where the record has it</button>`
        : '<span class="hint">Not moved. Drag the dot, or use the arrow keys.</span>'}
    ${gone ? '' : `<button type="button" class="danger-btn" data-delete="${esc(p.id)}">Mark as not there</button>`}
`;
}

/** Make `ids` the whole selection. */
function setPicked(ids: Iterable<string>): void {
  const before = [...picked];
  picked.clear();
  for (const id of ids) picked.add(id);
  selected = picked.size === 1 ? [...picked][0]! : null;
  for (const id of new Set([...before, ...picked])) styleDot(id);
  renderSelected();
}

function clearPicked(): void {
  removeArea();
  setPicked([]);
}

function togglePick(id: string): void {
  if (areaSel) {
    // Kept through later changes to the shape: a tree taken out stays out,
    // one added stays in.
    if (picked.has(id)) { areaSel.base.delete(id); areaSel.excluded.add(id); }
    else { areaSel.base.add(id); areaSel.excluded.delete(id); }
    return applyArea();
  }
  const next = new Set(picked);
  if (next.has(id)) next.delete(id); else next.add(id);
  setPicked(next);
}

function select(id: string | null, pan: boolean): void {
  removeArea();
  setPicked(id ? [id] : []);
  if (id && pan) map.setView(dots.get(id)!.getLatLng(), Math.max(map.getZoom(), 20));
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

for (const list of ['moves', 'deletions', 'selected']) {
  $(list).addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    const reset = el.closest<HTMLElement>('[data-reset]');
    if (reset) return resetTree(reset.dataset.reset!);
    const restore = el.closest<HTMLElement>('[data-restore]');
    if (restore) return restoreTree(restore.dataset.restore!);
    const del = el.closest<HTMLElement>('[data-delete]');
    if (del) return deleteTrees([del.dataset.delete!]);
    if (el.closest('[data-delete-picked]')) return deleteTrees([...picked]);
    if (el.closest('[data-clear-picked]')) return clearPicked();
    const go = el.closest<HTMLElement>('[data-go]');
    if (go) select(go.dataset.go!, true);
  });
}

function resetTree(id: string): void {
  if (!moves[id]) return;
  remember([id]);
  const next = { ...moves };
  delete next[id];
  moves = next;
  stale.delete(id);
  afterChange([id]);
}

$('undo').addEventListener('click', undo);
$('clear').addEventListener('click', () => {
  const n = Object.keys(moves).length + Object.keys(deletions).length;
  if (!confirm(`Clear all ${n} change(s), moves and trees marked not there? Export first if you want to keep them — this cannot be undone.`)) return;
  const ids = [...Object.keys(moves), ...Object.keys(deletions)];
  moves = {};
  deletions = {};
  stale = new Set();
  undoStack.length = 0;
  afterChange(ids);
});

$('export').addEventListener('click', () => {
  const list = Object.values(moves).filter((m) => !stale.has(m.id));
  const csv = movesToCsv(list, describe, Object.values(deletions));
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
    if (areaMode) return setAreaMode(null);
    if (areaSel) return clearPicked();
    return select(null, false);
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && picked.size) {
    e.preventDefault();
    return deleteTrees([...picked]);
  }
  const step = { ArrowUp: [1, 0], ArrowDown: [-1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
  if (!step || !selected || deletions[selected]) return;
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
  if (Object.keys(moves).length + Object.keys(deletions).length && $('save-state').classList.contains('is-warn')) {
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
  // A marked tree no longer standing on the map has had its not-found applied.
  const savedDel = loadDeletions();
  const doneDel = Object.keys(savedDel).filter((id) => !byId.has(id));
  for (const id of doneDel) delete savedDel[id];
  deletions = savedDel;
  for (const id of Object.keys(deletions)) delete moves[id];
  const notes: string[] = [];
  if (doneDel.length) notes.push(`${doneDel.length} tree(s) marked not there are already off the map and were cleared.`);
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
  if ($<HTMLInputElement>('lidar-show').checked) peakLayer.addTo(map);
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
    $<HTMLInputElement>('crowns-show').disabled = true;
    crownsShown = false;
    return;
  }
  for (const c of saved.crowns) {
    L.circle([c.lat, c.lng], { renderer, radius: c.radius, interactive: false, color: CROWN, weight: 1.25, opacity: 0.9, fill: false }).addTo(crownLayer);
    L.circleMarker([c.lat, c.lng], { renderer, radius: 1.5, interactive: false, color: CROWN, weight: 1, fill: true, fillColor: CROWN, fillOpacity: 1 }).addTo(crownLayer);
  }
  if (!crownsShown) layersControl.addOverlay(crownLayer, 'Tree crowns (SAL, my file)');
  crownsShown = true;
  $<HTMLInputElement>('crowns-show').disabled = false;
  if ($<HTMLInputElement>('crowns-show').checked) crownLayer.addTo(map);
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

// The two LiDAR layers turn on and off from the side panel as well as the
// layers button; each follows the other.
const layerToggles: Array<[string, L.LayerGroup]> = [['lidar-show', peakLayer], ['crowns-show', crownLayer]];
for (const [id, layer] of layerToggles) {
  // The box sits in the section's heading: ticking it must not also open or
  // close the section.
  $<HTMLInputElement>(id).closest('label')!.addEventListener('click', (e) => e.stopPropagation());
  $<HTMLInputElement>(id).addEventListener('change', (e) => {
    if ((e.target as HTMLInputElement).checked) layer.addTo(map);
    else map.removeLayer(layer);
  });
}
const syncToggle = (on: boolean) => (e: L.LayersControlEvent) => {
  const hit = layerToggles.find(([, layer]) => layer === e.layer);
  if (hit) $<HTMLInputElement>(hit[0]).checked = on;
};
map.on('overlayadd', syncToggle(true));
map.on('overlayremove', syncToggle(false));

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
    picked: () => [...picked],
    deletions: () => deletions,
    peaks: () => peaks.length,
    layersOn: () => ({ peaks: map.hasLayer(peakLayer), crowns: map.hasLayer(crownLayer) }),
    crowns: () => crownLayer.getLayers().length / 2,
    imagery: myImagery,
    screenOf: (lat: number, lng: number) => {
      const pt = map.latLngToContainerPoint([lat, lng]);
      const box = map.getContainer().getBoundingClientRect();
      return [box.left + pt.x, box.top + pt.y];
    },
  },
});

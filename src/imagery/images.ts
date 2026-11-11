/**
 * The source images: added, placed, aligned by matching points, exported and
 * imported as alignment files.
 *
 * The same store as the positions tool (`/positions/`, "My imagery"): both
 * pages are on one site, so an image added or aligned in either is there in
 * the other after a reload. The alignment files are the same format too, so
 * one exported from either page imports into both.
 *
 * Private by construction: images come from the person's own disk, live in
 * this browser's IndexedDB, and are drawn here. Nothing is uploaded.
 */

import L from 'leaflet';
import {
  calibrate, estimateBounds, fitBounds, fitPlacement, parseGeprint, placementFromBounds, rankImages,
  type Bounds, type Camera, type Pair, type Placement,
} from '../positions/imagery-math';
import { alignmentsToJson, matchAlignments, parseAlignments, type Alignment } from '../positions/alignments';
import { WarpedImage } from '../positions/imagery';

export interface Stored {
  id: string;
  blob: Blob;
  width: number;
  height: number;
  cam: Camera | null;
  pairs: Pair[];
  aligned: Bounds | null;
  rms: number | null;
  hidden: boolean;
}

interface Live extends Stored {
  url: string;
  overlay: WarpedImage;
}

/** What a merge needs of an image: its pixels, its size, and where it lies. */
export interface SourceImage {
  id: string;
  blob: Blob;
  width: number;
  height: number;
  placement: Placement;
  aligned: boolean;
}

// The positions tool's names, so the two pages share one store.
const DB = 'uvm-tree-positions';
const STORE = 'imagery';
const PENDING = 'uvm-tree-positions/pending-alignments';
const PANE = 'source-imagery';

function loadPending(): Alignment[] {
  try {
    const raw = localStorage.getItem(PENDING);
    return raw ? (JSON.parse(raw) as Alignment[]) : [];
  } catch {
    return [];
  }
}

function savePending(list: Alignment[]): void {
  try {
    if (list.length) localStorage.setItem(PENDING, JSON.stringify(list));
    else localStorage.removeItem(PENDING);
  } catch { /* the import message already said what happened */ }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const strip = ({ url: _u, overlay: _o, ...rest }: Live): Stored => rest;
const put = (img: Live) => tx('readwrite', (s) => s.put(strip(img)));
const boxOf = (corners: Array<[number, number]>): L.LatLngBounds => L.latLngBounds(corners);

export const esc = (v: string): string =>
  v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function imageSize(blob: Blob): Promise<[number, number]> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { resolve([img.naturalWidth, img.naturalHeight]); URL.revokeObjectURL(url); };
    img.onerror = () => { reject(new Error('not an image this browser can read')); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

const stem = (name: string): string => name.replace(/\.[^.]+$/, '');

export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export const today = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export interface ImagesHooks {
  /** Entering and leaving alignment, so the rest of the page can step aside. */
  onAligning: (on: boolean) => void;
  /** The selection for merging changed. */
  onSelection: () => void;
}

export function initImages(map: L.Map, hooks: ImagesHooks) {
  map.createPane(PANE);
  map.getPane(PANE)!.style.zIndex = '250';

  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const images: Live[] = [];
  /** Ticked for the next merge. */
  const chosen = new Set<string>();
  let opacity = 1;
  let align: { img: Live; stage: 'image' | 'map'; pending: [number, number] | null; markers: L.LayerGroup } | null = null;

  function boundsOf(img: Stored): Bounds {
    if (img.aligned) return img.aligned;
    if (!img.cam) {
      const c = map.getCenter();
      const half = 500 / (111_320 * Math.cos((c.lat * Math.PI) / 180));
      const halfLat = (500 * img.height) / img.width / 111_320;
      return [[c.lat - halfLat, c.lng - half], [c.lat + halfLat, c.lng + half]];
    }
    const learned = calibrate(
      images.filter((i) => i.aligned && i.cam).map((i) => ({ cam: i.cam!, width: i.width, height: i.height, bounds: i.aligned! })),
    );
    return estimateBounds(img.cam, img.width, img.height, learned);
  }

  function placementOf(img: Stored): Placement {
    const fit = img.pairs.length >= 2 ? fitPlacement(img.pairs, img.width, img.height) : null;
    return fit ?? placementFromBounds(boundsOf(img), img.width, img.height);
  }

  const ranked = (): Live[] =>
    rankImages(images.map((i) => ({ id: i.id, aligned: i.aligned !== null, points: i.pairs.length, rms: i.rms, img: i })))
      .map((r) => r.img);

  /** Only what is in view is drawn: a dozen 8,000-pixel prints decoded at once is gigabytes. */
  function refresh(): void {
    const view = map.getBounds().pad(0.2);
    const order = ranked();
    order.forEach((img, i) => img.overlay.setZ(order.length - i));
    for (const img of images) {
      const corners = placementOf(img).corners;
      img.overlay.setCorners(corners);
      const aligningThis = align?.img === img;
      const want = aligningThis ? align!.stage === 'image' : !img.hidden && !align && view.intersects(boxOf(corners));
      if (want && !map.hasLayer(img.overlay)) img.overlay.addTo(map);
      if (!want && map.hasLayer(img.overlay)) map.removeLayer(img.overlay);
      img.overlay.setOpacity(aligningThis ? 1 : opacity);
    }
  }
  map.on('moveend', refresh);

  function live(s: Stored): Live {
    const url = URL.createObjectURL(s.blob);
    const overlay = new WarpedImage(url, s.width, s.height, PANE);
    overlay.setCorners(placementOf(s).corners);
    return { ...s, url, overlay };
  }

  // ---------------------------------------------------------------- list

  function render(): void {
    $('img-count').textContent = String(images.length);
    $('img-empty').hidden = images.length > 0;
    const stackPlace = new Map(ranked().map((img, i) => [img, i + 1]));
    const byName = [...images].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
    $('img-list').innerHTML = byName.map((img) => {
      const kind = img.aligned ? placementOf(img).kind : null;
      const status = img.aligned
        ? `<span class="img-ok">Aligned · ${kind === 'tilt' ? 'tilt-corrected' : 'stretched'} · ±${(img.rms ?? 0).toFixed(1)} m over ${img.pairs.length} points</span>`
        : `<span class="img-todo">Not aligned${img.cam ? ' · placed from its .geprint' : ' · no .geprint'}</span>`;
      return `<li>
        <span class="img-head">
          <input type="checkbox" class="img-pick" data-img-pick="${esc(img.id)}" ${chosen.has(img.id) ? 'checked' : ''}
                 aria-label="Use ${esc(img.id)} in the next image made" title="Use in the next image made">
          <span class="img-rank" title="Stacking order: 1 is on top where images overlap, here and in a merge">${stackPlace.get(img)}</span>
          <button type="button" class="go img-name" data-img-go="${esc(img.id)}">${esc(img.id)}</button></span>
        ${status}
        <span class="img-actions">
          <button type="button" class="ghost-btn" data-img-align="${esc(img.id)}">${img.aligned ? 'Re-align' : 'Align'}</button>
          <button type="button" class="ghost-btn" data-img-hide="${esc(img.id)}">${img.hidden ? 'Show' : 'Hide'}</button>
          <button type="button" class="ghost-btn" data-img-remove="${esc(img.id)}">Remove</button>
        </span>
      </li>`;
    }).join('');
    renderAlign();
    $<HTMLButtonElement>('align-export').disabled = !images.some((i) => i.pairs.length);
    hooks.onSelection();
  }

  function message(text: string, isErr = false): void {
    const el = $('img-msg');
    el.textContent = text;
    el.classList.toggle('is-err', isErr);
  }

  // ---------------------------------------------------------------- adding

  async function add(files: FileList): Promise<void> {
    const list = [...files];
    const prints = new Map<string, File>();
    for (const f of list) if (/\.geprint$/i.test(f.name)) prints.set(stem(f.name), f);
    const pictures = list.filter((f) => /\.(jpe?g|png|webp)$/i.test(f.name));
    if (!pictures.length) return message('Choose the image files, together with their .geprint files.', true);
    try { await navigator.storage?.persist?.(); } catch { /* best effort */ }

    let added = 0;
    let fromFile = 0;
    const problems: string[] = [];
    for (const f of pictures) {
      message(`Reading ${f.name}…`);
      try {
        const [width, height] = await imageSize(f);
        const print = prints.get(stem(f.name));
        const cam = print ? parseGeprint(await print.text()) : null;
        if (print && !cam) problems.push(`${print.name} has no camera position in it`);
        const id = stem(f.name);
        const old = images.findIndex((i) => i.id === id);
        if (old >= 0) removeLive(images[old]!);
        const img = live({ id, blob: f, width, height, cam, pairs: [], aligned: null, rms: null, hidden: false });
        images.push(img);
        await put(img);
        added += 1;
        const pending = loadPending();
        const waiting = pending.find((a) => a.id === id && a.width === width && a.height === height);
        if (waiting) {
          applyAlignment(img, waiting);
          savePending(pending.filter((a) => a !== waiting));
          fromFile += 1;
        }
      } catch (err) {
        problems.push(`${f.name}: ${(err as Error).message}`);
      }
    }
    const unpaired = pictures.filter((f) => !prints.has(stem(f.name)) && !images.find((i) => i.id === stem(f.name))?.aligned).length;
    message(
      `Added ${added} image(s).` +
      (fromFile ? ` ${fromFile} aligned from an imported file.` : '') +
      (unpaired ? ` ${unpaired} had no matching .geprint and were placed in the middle of the view.` : '') +
      (problems.length ? ` Problems: ${problems.join('; ')}.` : ''),
      problems.length > 0,
    );
    refresh();
    render();
    const first = images.find((i) => !i.aligned);
    if (first) map.fitBounds(boxOf(placementOf(first).corners));
  }

  function removeLive(img: Live): void {
    if (map.hasLayer(img.overlay)) map.removeLayer(img.overlay);
    URL.revokeObjectURL(img.url);
    images.splice(images.indexOf(img), 1);
    chosen.delete(img.id);
  }

  // ---------------------------------------------------------------- aligning

  function startAlign(img: Live): void {
    if (align) stopAlign(false);
    align = { img, stage: 'image', pending: null, markers: L.layerGroup().addTo(map) };
    img.hidden = false;
    hooks.onAligning(true);
    map.fitBounds(boxOf(placementOf(img).corners));
    drawPairMarkers();
    refresh();
    render();
  }

  function stopAlign(keep: boolean): void {
    if (!align) return;
    const { img, markers } = align;
    map.removeLayer(markers);
    align = null;
    hooks.onAligning(false);
    if (keep) void put(img);
    refresh();
    render();
  }

  function drawPairMarkers(): void {
    if (!align) return;
    align.markers.clearLayers();
    align.img.pairs.forEach((p, i) => {
      L.marker([p.lat, p.lng], {
        interactive: false,
        icon: L.divIcon({ className: 'pair-pin', html: String(i + 1), iconSize: [20, 20], iconAnchor: [10, 10] }),
      }).addTo(align!.markers);
    });
  }

  /** A click while aligning. True if it was one, so nothing else acts on it. */
  function click(latlng: L.LatLng): boolean {
    if (!align) return false;
    const { img } = align;
    if (align.stage === 'image') {
      const [px, py] = placementOf(img).toImage(latlng.lat, latlng.lng);
      if (px < 0 || py < 0 || px > img.width || py > img.height) return true;
      align.pending = [px, py];
      align.stage = 'map';
    } else {
      const [px, py] = align.pending!;
      img.pairs = [...img.pairs, { px, py, lat: latlng.lat, lng: latlng.lng }];
      align.pending = null;
      align.stage = 'image';
      refit(img);
      drawPairMarkers();
    }
    refresh();
    renderAlign();
    return true;
  }

  function refit(img: Live): void {
    const stretch = fitBounds(img.pairs, img.width, img.height);
    img.aligned = stretch ? stretch.bounds : null;
    img.rms = stretch ? placementOf(img).rms : null;
    void put(img);
    render();
  }

  function applyAlignment(img: Live, a: Alignment): void {
    img.pairs = a.pairs.map((p) => ({ ...p }));
    if (!img.cam && a.cam) img.cam = a.cam;
    refit(img);
  }

  function renderAlign(): void {
    const box = $('align-panel');
    if (!align) { box.hidden = true; return; }
    const { img, stage } = align;
    const fit = img.pairs.length >= 2 ? fitPlacement(img.pairs, img.width, img.height) : null;
    box.hidden = false;
    $('align-title').textContent = `Aligning ${img.id}`;
    $('align-step').innerHTML = stage === 'image'
      ? `<strong>Point ${img.pairs.length + 1}, step 1:</strong> click a sharp feature on <em>your image</em> — a building corner, a path junction, a lone tree.`
      : `<strong>Point ${img.pairs.length + 1}, step 2:</strong> your image is hidden. Click <em>the same feature</em> on the satellite map.`;
    $('align-fit').innerHTML = img.pairs.length === 0
      ? 'Use points far apart: one near each corner is best.'
      : !fit
        ? `${img.pairs.length} point(s). ${img.pairs.length < 2 ? 'One more' : 'Points further apart, across and down the image,'} needed to place it.`
        : `${img.pairs.length} points · <strong>${fit.kind === 'tilt' ? 'tilt-corrected' : 'stretched'}</strong> · ` +
          `off by ±${fit.rms.toFixed(1)} m on average` +
          ` (worst ${Math.max(...fit.residuals).toFixed(1)} m, point ${fit.residuals.indexOf(Math.max(...fit.residuals)) + 1}).` +
          (fit.note ? ` ${fit.note}` : '') +
          (img.pairs.length < 4
            ? ` ${4 - img.pairs.length} more for the tilt correction.`
            : img.pairs.length === 4 && fit.kind === 'tilt'
              ? ' Four points always fit exactly — add two more to see how good it really is.'
              : '');
    $<HTMLButtonElement>('align-undo').disabled = img.pairs.length === 0 && stage === 'image';
  }

  function undoPoint(): void {
    if (!align) return;
    if (align.stage === 'map') {
      align.stage = 'image';
      align.pending = null;
    } else if (align.img.pairs.length) {
      align.img.pairs = align.img.pairs.slice(0, -1);
      refit(align.img);
      drawPairMarkers();
    }
    refresh();
    renderAlign();
  }

  // ---------------------------------------------------------------- files

  function exportAlignments(): void {
    download(new Blob([alignmentsToJson(images)], { type: 'application/json' }), `alignments-${today()}.json`);
    message(`Exported the alignments of ${images.filter((i) => i.pairs.length).length} image(s). Keep the file with your images.`);
  }

  async function importAlignments(file: File): Promise<void> {
    const parsed = parseAlignments(await file.text());
    if (typeof parsed === 'string') return message(parsed, true);
    const { apply, replacing, wait, mismatched } = matchAlignments(parsed, images);
    if (replacing.length && !confirm(
      `${replacing.length} image(s) here already have different alignment points (${replacing.join(', ')}). Replace them with the ones in the file?`,
    )) {
      return message('Nothing imported.');
    }
    if (align) stopAlign(true);
    for (const a of apply) applyAlignment(images.find((i) => i.id === a.id)!, a);
    const ids = new Set(wait.map((a) => a.id));
    savePending([...loadPending().filter((a) => !ids.has(a.id)), ...wait]);
    refresh();
    render();
    message(
      `Applied ${apply.length} alignment(s).` +
      (wait.length ? ` ${wait.length} will apply when you add their images (${wait.map((a) => a.id).join(', ')}).` : '') +
      (mismatched.length ? ` Not applied — same name but a different image size here: ${mismatched.join(', ')}.` : ''),
      mismatched.length > 0,
    );
  }

  // ---------------------------------------------------------------- wiring

  const setAllHidden = (hidden: boolean) => {
    for (const img of images) {
      if (img.hidden === hidden) continue;
      img.hidden = hidden;
      void put(img);
    }
    refresh();
    render();
  };

  $('img-add').addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    if (input.files?.length) void add(input.files).finally(() => { input.value = ''; });
  });
  $('img-opacity').addEventListener('input', (e) => {
    opacity = Number((e.target as HTMLInputElement).value) / 100;
    refresh();
  });
  $('img-show-all').addEventListener('click', () => setAllHidden(false));
  $('img-hide-all').addEventListener('click', () => setAllHidden(true));
  $('img-pick-all').addEventListener('click', () => {
    const all = images.every((i) => chosen.has(i.id));
    for (const i of images) { if (all) chosen.delete(i.id); else chosen.add(i.id); }
    render();
  });
  $('img-list').addEventListener('change', (e) => {
    const box = (e.target as HTMLElement).closest<HTMLInputElement>('[data-img-pick]');
    if (!box) return;
    const id = box.getAttribute('data-img-pick')!;
    if (box.checked) chosen.add(id); else chosen.delete(id);
    hooks.onSelection();
  });
  $('img-list').addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    const pick = (attr: string) => {
      const id = el.closest<HTMLElement>(`[${attr}]`)?.getAttribute(attr);
      return id ? images.find((i) => i.id === id) : undefined;
    };
    const go = pick('data-img-go');
    if (go) return void map.fitBounds(boxOf(placementOf(go).corners));
    const al = pick('data-img-align');
    if (al) return startAlign(al);
    const hide = pick('data-img-hide');
    if (hide) {
      hide.hidden = !hide.hidden;
      void put(hide);
      refresh();
      return render();
    }
    const rm = pick('data-img-remove');
    if (rm && confirm(`Remove ${rm.id} and its alignment from this browser? The positions tool uses the same images, so it goes from there too. The file on your computer is not touched.`)) {
      if (align?.img === rm) stopAlign(false);
      removeLive(rm);
      void tx('readwrite', (s) => s.delete(rm.id));
      refresh();
      render();
    }
  });
  $('align-done').addEventListener('click', () => stopAlign(true));
  $('align-export').addEventListener('click', exportAlignments);
  $('align-import').addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (f) void importAlignments(f).finally(() => { input.value = ''; });
  });
  $('align-undo').addEventListener('click', undoPoint);

  void (async () => {
    try {
      const stored = await tx<Stored[]>('readonly', (s) => s.getAll() as IDBRequest<Stored[]>);
      // Hidden on every load, without saving that: drawing a dozen large
      // prints at once is slow, and the person shows the ones they need.
      for (const s of stored.sort((a, b) => a.id.localeCompare(b.id))) images.push(live({ ...s, hidden: true }));
    } catch {
      message('This browser will not store images, so they would be lost on reload.', true);
    }
    refresh();
    render();
  })();

  return {
    click,
    isAligning: () => align !== null,
    cancel: () => stopAlign(true),
    /** The ticked images, best first: the order a merge stacks them in. */
    chosen: (): SourceImage[] =>
      ranked()
        .filter((i) => chosen.has(i.id))
        .map((i) => ({ id: i.id, blob: i.blob, width: i.width, height: i.height, placement: placementOf(i), aligned: i.aligned !== null })),
    /** For the browser test. */
    debug: () => images.map((i) => ({ id: i.id, width: i.width, height: i.height, pairs: i.pairs.length, corners: placementOf(i).corners })),
  };
}

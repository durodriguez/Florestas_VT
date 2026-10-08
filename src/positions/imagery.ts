/**
 * The surveyor's own imagery, as a layer under the trees.
 *
 * Private by construction: images are read from the person's own disk, kept in
 * this browser's IndexedDB, and drawn here. Nothing is uploaded, committed or
 * published — which is the condition on using Google Earth prints at all, whose
 * terms do not allow them to be served as a map layer.
 *
 * Each print is placed first from its .geprint (a rough guess), then pinned
 * down by matching points — see imagery-math.ts.
 */

import L from 'leaflet';
import {
  calibrate, estimateBounds, fitBounds, fitPlacement, matrix3dFor, parseGeprint, placementFromBounds, rankImages,
  type Bounds, type Camera, type Pair, type Placement,
} from './imagery-math';
import { alignmentsToJson, matchAlignments, parseAlignments, type Alignment } from './alignments';

interface Stored {
  id: string;
  blob: Blob;
  width: number;
  height: number;
  cam: Camera | null;
  pairs: Pair[];
  /** Set once aligned by points; until then the image sits at its estimate. */
  aligned: Bounds | null;
  rms: number | null;
  hidden: boolean;
}

interface Live extends Stored {
  url: string;
  overlay: WarpedImage;
}

/**
 * An image drawn onto any four corners, not only a rectangle. Leaflet's own
 * image overlay can only stretch a picture to a box, and a tilted print is not
 * a box; this hands the browser a CSS perspective transform that puts each
 * corner exactly where the fit says. Redrawn on every zoom, hidden during the
 * zoom animation itself rather than drawn wrong for a quarter of a second.
 */
class WarpedImage extends L.Layer {
  private el: HTMLImageElement | null = null;
  private corners: Array<[number, number]> = [];
  private opacity = 1;

  constructor(private url: string, private width: number, private height: number, private pane: string) {
    super();
  }

  setCorners(corners: Array<[number, number]>): void {
    this.corners = corners;
    this.update();
  }

  setOpacity(o: number): void {
    this.opacity = o;
    if (this.el) this.el.style.opacity = String(o);
  }

  private z = 0;
  /** Stacking within the imagery pane: higher is drawn on top. */
  setZ(z: number): void {
    this.z = z;
    if (this.el) this.el.style.zIndex = String(z);
  }

  onAdd(map: L.Map): this {
    const el = document.createElement('img');
    el.src = this.url;
    el.alt = '';
    el.draggable = false;
    Object.assign(el.style, {
      position: 'absolute', left: '0', top: '0', transformOrigin: '0 0',
      width: `${this.width}px`, height: `${this.height}px`, maxWidth: 'none',
      pointerEvents: 'none', userSelect: 'none', opacity: String(this.opacity), zIndex: String(this.z),
    });
    map.getPane(this.pane)!.appendChild(el);
    this.el = el;
    map.on('zoomend viewreset', this.update, this);
    map.on('zoomstart', this.hide, this);
    this.update();
    return this;
  }

  onRemove(map: L.Map): this {
    map.off('zoomend viewreset', this.update, this);
    map.off('zoomstart', this.hide, this);
    this.el?.remove();
    this.el = null;
    return this;
  }

  private hide(): void {
    if (this.el) this.el.style.visibility = 'hidden';
  }

  private update(): void {
    const map = this._map as L.Map | undefined;
    if (!this.el || !map || this.corners.length !== 4) return;
    const pts = this.corners.map(([lat, lng]) => {
      const p = map.latLngToLayerPoint([lat, lng]);
      return [p.x, p.y] as [number, number];
    });
    const m = matrix3dFor(this.width, this.height, pts);
    if (!m) return;
    this.el.style.transform = `matrix3d(${m.join(',')})`;
    this.el.style.visibility = '';
  }
}

const DB = 'uvm-tree-positions';
/** Imported alignments whose images have not been added yet. */
const PENDING = 'uvm-tree-positions/pending-alignments';

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
const STORE = 'imagery';
const PANE = 'my-imagery';

// ---------------------------------------------------------------- storage

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

const boxOf = (corners: Array<[number, number]>): L.LatLngBounds => L.latLngBounds(corners);
const put = (img: Live) => tx('readwrite', (s) => s.put(strip(img)));

// ---------------------------------------------------------------- helpers

const esc = (v: string): string =>
  v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function size(blob: Blob): Promise<[number, number]> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { resolve([img.naturalWidth, img.naturalHeight]); URL.revokeObjectURL(url); };
    img.onerror = () => { reject(new Error('not an image this browser can read')); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

const stem = (name: string): string => name.replace(/\.[^.]+$/, '');

// ---------------------------------------------------------------- module

export interface ImageryHooks {
  /** Called on entering and leaving alignment, so the trees can get out of the way. */
  onAligning: (on: boolean) => void;
}

export function initImagery(map: L.Map, hooks: ImageryHooks) {
  map.createPane(PANE);
  // Above the satellite tiles, below the trees.
  map.getPane(PANE)!.style.zIndex = '250';

  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const images: Live[] = [];
  let opacity = 1;
  let showAll = true;
  let align: { img: Live; stage: 'image' | 'map'; pending: [number, number] | null; markers: L.LayerGroup } | null = null;

  /** Where an image lies: its alignment if it has one, otherwise the best guess. */
  function boundsOf(img: Stored): Bounds {
    if (img.aligned) return img.aligned;
    if (!img.cam) {
      // No .geprint: a kilometre-wide guess at the middle of the view, to be
      // aligned by points like any other.
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

  /**
   * Where an image lies, in full: the tilt-corrected fit once it has four good
   * points, the stretch before that, and the estimate before it has any.
   */
  function placementOf(img: Stored): Placement {
    const fit = img.pairs.length >= 2 ? fitPlacement(img.pairs, img.width, img.height) : null;
    return fit ?? placementFromBounds(boundsOf(img), img.width, img.height);
  }

  /**
   * Only what is in view is on the map. Fourteen 8,000-pixel photographs held
   * decoded at once is gigabytes; one or two at a time is fine.
   */
  /** Best first — see rankImages. The list and the stacking both follow it. */
  const ranked = (): Live[] =>
    rankImages(images.map((i) => ({ id: i.id, aligned: i.aligned !== null, points: i.pairs.length, rms: i.rms, img: i })))
      .map((r) => r.img);

  function refresh(): void {
    const view = map.getBounds().pad(0.2);
    // Wherever two overlap, the one with the lowest measured error is on top.
    // Before this the order was whichever the page happened to draw last.
    const order = ranked();
    order.forEach((img, i) => img.overlay.setZ(order.length - i));
    for (const img of images) {
      const corners = placementOf(img).corners;
      img.overlay.setCorners(corners);
      const aligningThis = align?.img === img;
      const want = aligningThis ? align!.stage === 'image' : showAll && !img.hidden && !align && view.intersects(boxOf(corners));
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

  // ---------------------------------------------------------------- panel

  function render(): void {
    $('img-count').textContent = String(images.length);
    $('img-empty').hidden = images.length > 0;
    $('img-list').innerHTML = ranked().map((img, rank) => {
      const kind = img.aligned ? placementOf(img).kind : null;
      const status = img.aligned
        ? `<span class="img-ok">Aligned · ${kind === 'tilt' ? 'tilt-corrected' : 'stretched'} · ±${(img.rms ?? 0).toFixed(1)} m over ${img.pairs.length} points</span>`
        : `<span class="img-todo">Not aligned${img.cam ? ' · placed from its .geprint' : ' · no .geprint'}</span>`;
      return `<li>
        <span class="img-head"><span class="img-rank" title="Stacking order: 1 is on top where images overlap">${rank + 1}</span>
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
    void renderUsage();
    $<HTMLButtonElement>('align-export').disabled = !images.some((i) => i.pairs.length);
  }

  async function renderUsage(): Promise<void> {
    const el = $('img-usage');
    try {
      const est = await navigator.storage?.estimate?.();
      el.textContent = est?.usage && est.usage >= 1e6 ? `Using ${(est.usage / 1e6).toFixed(0)} MB of this browser's storage.` : '';
    } catch {
      el.textContent = '';
    }
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
    // Asked once: without it a browser short of space may quietly clear the lot.
    try { await navigator.storage?.persist?.(); } catch { /* best effort */ }

    let added = 0;
    let fromFile = 0;
    const problems: string[] = [];
    for (const f of pictures) {
      message(`Reading ${f.name}…`);
      try {
        const [width, height] = await size(f);
        const print = prints.get(stem(f.name));
        const cam = print ? parseGeprint(await print.text()) : null;
        if (print && !cam) problems.push(`${print.name} has no camera position in it`);
        const id = stem(f.name);
        const old = images.findIndex((i) => i.id === id);
        if (old >= 0) removeLive(images[old]!);
        const img = live({ id, blob: f, width, height, cam, pairs: [], aligned: null, rms: null, hidden: false });
        images.push(img);
        images.sort((a, b) => a.id.localeCompare(b.id));
        await put(img);
        added += 1;
        // An alignment imported before its image: applied now it is here.
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
    // Only those left sitting at a guess: an image aligned from a file is not.
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
  }

  // ---------------------------------------------------------------- aligning

  /**
   * Matching points, alternating: a feature on the image, then the same
   * feature on the satellite map with the image out of the way. Two pairs,
   * spread across and down the image, fix it; each one after that improves it
   * and shows in the residual.
   */
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

  /** A click while aligning. Returns true if it was one, so the map ignores it. */
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
    // `aligned` stays the straight stretch: it is what teaches the next
    // images their scale and offset. The residual is the best fit's.
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

  // ---------------------------------------------------------------- files

  function exportAlignments(): void {
    const json = alignmentsToJson(images);
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `alignments-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
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
    // Waiting ones replace any older waiting copy of the same image.
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

  // ---------------------------------------------------------------- wiring

  $('img-add').addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    if (input.files?.length) void add(input.files).finally(() => { input.value = ''; });
  });
  $('img-opacity').addEventListener('input', (e) => {
    opacity = Number((e.target as HTMLInputElement).value) / 100;
    refresh();
  });
  $('img-show').addEventListener('change', (e) => {
    showAll = (e.target as HTMLInputElement).checked;
    refresh();
  });
  // Every image's own Show/Hide at once, rather than one by one.
  const setAllHidden = (hidden: boolean) => {
    for (const img of images) {
      if (img.hidden === hidden) continue;
      img.hidden = hidden;
      void put(img);
    }
    if (!hidden && !showAll) {
      showAll = true;
      $<HTMLInputElement>('img-show').checked = true;
    }
    refresh();
    render();
  };
  $('img-show-all').addEventListener('click', () => setAllHidden(false));
  $('img-hide-all').addEventListener('click', () => setAllHidden(true));
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
    if (rm && confirm(`Remove ${rm.id} and its alignment from this browser? The file on your computer is not touched.`)) {
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

  // ---------------------------------------------------------------- start

  void (async () => {
    try {
      const stored = await tx<Stored[]>('readonly', (s) => s.getAll() as IDBRequest<Stored[]>);
      // Hidden on every page load, without saving that: drawing fourteen large
      // prints at once is slow, and the person asks for the ones they need.
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
    /** For the browser test. */
    debug: () => images.map((i) => {
      const p = placementOf(i);
      return { id: i.id, width: i.width, height: i.height, aligned: i.aligned, rms: i.rms, pairs: i.pairs.length, bounds: boundsOf(i), kind: p.kind, corners: p.corners };
    }),
    stage: () => align?.stage ?? null,
  };
}

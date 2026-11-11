/**
 * Made images: one or more aligned source images resampled onto the map's
 * own pixel grid, overlaps resolved best-on-top, optionally clipped to the
 * campus boundary or one campus area, and saved compressed.
 *
 * Kept in this browser (a store of their own, apart from the sources), drawn
 * on the map, and exported as a .zip: the image, a placement file this page
 * reads back, and a world file for GIS programs. Like the sources, nothing is
 * uploaded.
 */

import L from 'leaflet';
import JSZip from 'jszip';
import {
  boxOfGeometry, boxOfPoints, chooseZoom, decodeScale, footprintInGrid, gridBounds, intersectBox, metersPerPixel,
  paint, ringsInGrid, sourceMpp, unionBox, worldFile, type Grid,
} from './raster';
import { download, esc, imageSize, today, type SourceImage } from './images';
import type { Bounds } from '../positions/imagery-math';

export type Format = 'image/webp' | 'image/jpeg' | 'image/png';
type Geometry = { type: 'Polygon'; coordinates: number[][][] } | { type: 'MultiPolygon'; coordinates: number[][][][] };

export interface Clip {
  name: string;
  geometry: Geometry;
}

export interface MakeOptions {
  name: string;
  sources: SourceImage[];
  clip: Clip | null;
  /** Metres per pixel wanted, or null for the finest of the sources. */
  mpp: number | null;
  format: Format;
  /** 0–1, for WebP and JPEG. */
  quality: number;
}

export interface Product {
  id: string;
  name: string;
  blob: Blob;
  format: Format;
  grid: Grid;
  bounds: Bounds;
  mpp: number;
  sources: string[];
  clip: string | null;
  created: string;
  hidden: boolean;
}

/** About 240 MB of pixels while it is made: more than that and a browser tab may give up. */
export const MAX_PIXELS = 60_000_000;
const EXT: Record<Format, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };
const PANE = 'made-imagery';
const DB = 'uvm-imagery';
const STORE = 'products';

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

const nextFrame = () => new Promise<void>((r) => setTimeout(r, 0));
const slug = (s: string) => s.trim().replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'image';

/**
 * What a make would produce, before doing it: the grid, its size, and whether
 * the size had to be cut. Null with a reason when there is nothing to make.
 */
export function plan(opts: Pick<MakeOptions, 'sources' | 'clip' | 'mpp'>): { grid: Grid; mpp: number; capped: boolean } | string {
  if (!opts.sources.length) return 'Tick one or more images in the list first.';
  let box = opts.sources.map((s) => boxOfPoints(s.placement.corners)).reduce(unionBox);
  if (opts.clip) {
    const cut = intersectBox(box, boxOfGeometry(opts.clip.geometry));
    if (!cut) return `None of the ticked images reaches ${opts.clip.name}.`;
    box = cut;
  }
  const finest = Math.min(...opts.sources.map((s) => sourceMpp(s.placement.corners, s.width, s.height)));
  const { grid, capped } = chooseZoom(box, opts.mpp ?? finest, MAX_PIXELS);
  const lat = (box.north + box.south) / 2;
  return { grid, mpp: metersPerPixel(lat, grid.z), capped };
}

/** The image, decoded no larger than the output needs, as RGBA. */
async function decode(src: SourceImage, outMpp: number): Promise<{ data: Uint8ClampedArray; w: number; h: number }> {
  const s = decodeScale(sourceMpp(src.placement.corners, src.width, src.height), outMpp);
  const w = Math.max(1, Math.round(src.width * s));
  const h = Math.max(1, Math.round(src.height * s));
  const bmp = await createImageBitmap(src.blob, s < 1 ? { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' } : {});
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const cw = canvas.width;
  const ch = canvas.height;
  const data = ctx.getImageData(0, 0, cw, ch).data;
  canvas.width = 0;
  return { data, w: cw, h: ch };
}

/** Makes the image. `progress` hears what it is doing, for a page that would otherwise look frozen. */
export async function make(opts: MakeOptions, progress: (text: string) => void): Promise<Product> {
  const p = plan(opts);
  if (typeof p === 'string') throw new Error(p);
  const { grid, mpp } = p;
  const out = new Uint8ClampedArray(grid.width * grid.height * 4);
  // Worst first, best last: each paints over the one before, so the best is on top.
  const order = [...opts.sources].reverse();
  for (const [i, src] of order.entries()) {
    const fp = footprintInGrid(grid, src.placement.corners);
    if (fp.x1 <= fp.x0 || fp.y1 <= fp.y0) continue;
    progress(`Reading ${src.id} (${i + 1} of ${order.length})…`);
    await nextFrame();
    const { data, w, h } = await decode(src, mpp);
    const source = {
      width: src.width, height: src.height, data, dataWidth: w, dataHeight: h,
      toImage: src.placement.toImage, corners: src.placement.corners,
    };
    // In slices, so the page can show progress between them.
    const step = Math.max(1, Math.floor(1_500_000 / Math.max(1, fp.x1 - fp.x0)));
    for (let r = fp.y0; r < fp.y1; r += step) {
      paint(grid, out, source, r, Math.min(fp.y1, r + step));
      progress(`Placing ${src.id} (${i + 1} of ${order.length}): ${Math.round(((r - fp.y0) / (fp.y1 - fp.y0)) * 100)}%`);
      await nextFrame();
    }
  }

  progress('Clipping and compressing…');
  await nextFrame();
  const canvas = document.createElement('canvas');
  canvas.width = grid.width;
  canvas.height = grid.height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(new ImageData(out, grid.width, grid.height), 0, 0);
  if (opts.clip) {
    // Keep only what is inside: holes in a campus area stay holes.
    const path = new Path2D();
    for (const ring of ringsInGrid(opts.clip.geometry, grid)) {
      ring.forEach(([x, y], k) => (k ? path.lineTo(x, y) : path.moveTo(x, y)));
      path.closePath();
    }
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fill(path, 'evenodd');
    ctx.globalCompositeOperation = 'source-over';
  }
  let final = canvas;
  if (opts.format === 'image/jpeg') {
    // JPEG has no transparency: what lies outside becomes white, not black.
    final = document.createElement('canvas');
    final.width = grid.width;
    final.height = grid.height;
    const c2 = final.getContext('2d')!;
    c2.fillStyle = '#ffffff';
    c2.fillRect(0, 0, grid.width, grid.height);
    c2.drawImage(canvas, 0, 0);
  }
  const blob = await new Promise<Blob | null>((r) => final.toBlob(r, opts.format, opts.quality));
  canvas.width = 0;
  final.width = 0;
  if (!blob) throw new Error('The browser could not encode an image this large. Try a coarser resolution.');
  // A browser that cannot write WebP quietly writes PNG instead.
  const format = (blob.type || opts.format) as Format;
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: opts.name.trim() || `image-${today()}`,
    blob, format, grid, bounds: gridBounds(grid), mpp,
    sources: opts.sources.map((s) => s.id), clip: opts.clip?.name ?? null,
    created: new Date().toISOString(), hidden: false,
  };
}

// ---------------------------------------------------------------- export, import

interface Placement {
  kind: 'uvm-imagery/product';
  version: 1;
  name: string;
  image: string;
  crs: 'EPSG:3857';
  zoom: number;
  pixelOrigin: [number, number];
  width: number;
  height: number;
  bounds: Bounds;
  metersPerPixel: number;
  sources: string[];
  clip: string | null;
  created: string;
}

export async function exportZip(p: Product): Promise<Blob> {
  const base = slug(p.name);
  const image = `${base}.${EXT[p.format]}`;
  const placement: Placement = {
    kind: 'uvm-imagery/product', version: 1, name: p.name, image, crs: 'EPSG:3857',
    zoom: p.grid.z, pixelOrigin: [p.grid.x0, p.grid.y0], width: p.grid.width, height: p.grid.height,
    bounds: p.bounds, metersPerPixel: p.mpp, sources: p.sources, clip: p.clip, created: p.created,
  };
  const zip = new JSZip();
  // Stored, not deflated: the image is compressed already.
  zip.file(image, p.blob, { compression: 'STORE' });
  zip.file(`${base}.json`, JSON.stringify(placement, null, 1) + '\n');
  zip.file(`${base}.wld`, worldFile(p.grid));
  return zip.generateAsync({ type: 'blob' });
}

/** A .zip exported from this page, back as a product; or a sentence saying why not. */
export async function importZip(file: File): Promise<Product | string> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    return 'That file is not a .zip exported from this page.';
  }
  const jsonName = Object.keys(zip.files).find((n) => n.endsWith('.json'));
  if (!jsonName) return 'That .zip has no placement (.json) file in it.';
  let pl: Partial<Placement>;
  try {
    pl = JSON.parse(await zip.file(jsonName)!.async('string')) as Partial<Placement>;
  } catch {
    return 'The placement file in that .zip is not readable.';
  }
  if (pl.kind !== 'uvm-imagery/product' || pl.version !== 1 || !pl.image || !pl.pixelOrigin || pl.zoom === undefined) {
    return 'That .zip was not exported from this page.';
  }
  const entry = zip.file(pl.image);
  if (!entry) return `The image ${pl.image} is missing from that .zip.`;
  const ext = pl.image.split('.').pop()!.toLowerCase();
  const format: Format = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : 'image/webp';
  const blob = new Blob([await entry.async('arraybuffer')], { type: format });
  const [w, h] = await imageSize(blob);
  if (w !== pl.width || h !== pl.height) return `${pl.image} is ${w}×${h}, but its placement says ${pl.width}×${pl.height}.`;
  const grid: Grid = { z: pl.zoom, x0: pl.pixelOrigin[0], y0: pl.pixelOrigin[1], width: w, height: h };
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: pl.name ?? pl.image, blob, format, grid, bounds: gridBounds(grid), mpp: pl.metersPerPixel ?? 0,
    sources: pl.sources ?? [], clip: pl.clip ?? null, created: pl.created ?? new Date().toISOString(), hidden: false,
  };
}

// ---------------------------------------------------------------- the list

interface LiveProduct extends Product {
  url: string;
  overlay: L.ImageOverlay;
}

const mb = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} kB`);

export function initProducts(map: L.Map) {
  map.createPane(PANE);
  // Above the sources (250), below the campus lines (300).
  map.getPane(PANE)!.style.zIndex = '260';
  map.getPane(PANE)!.style.pointerEvents = 'none';
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const products: LiveProduct[] = [];
  let opacity = 1;

  const strip = ({ url: _u, overlay: _o, ...rest }: LiveProduct): Product => rest;
  const save = (p: LiveProduct) => tx('readwrite', (s) => s.put(strip(p)));

  function live(p: Product): LiveProduct {
    const url = URL.createObjectURL(p.blob);
    const overlay = L.imageOverlay(url, p.bounds, { pane: PANE, opacity, interactive: false });
    if (!p.hidden) overlay.addTo(map);
    return { ...p, url, overlay };
  }

  function message(text: string, isErr = false): void {
    const el = $('prod-msg');
    el.textContent = text;
    el.classList.toggle('is-err', isErr);
  }

  function render(): void {
    $('prod-count').textContent = String(products.length);
    $('prod-empty').hidden = products.length > 0;
    $('prod-list').innerHTML = [...products].reverse().map((p) => `<li>
      <span class="img-head"><button type="button" class="go img-name" data-prod-go="${esc(p.id)}">${esc(p.name)}</button></span>
      <span class="hint">${p.grid.width.toLocaleString()} × ${p.grid.height.toLocaleString()} px · ${p.mpp.toFixed(2)} m per pixel ·
        ${EXT[p.format].toUpperCase()} · ${mb(p.blob.size)}${p.clip ? ` · clipped to ${esc(p.clip)}` : ''}
        · from ${p.sources.length} image${p.sources.length === 1 ? '' : 's'}</span>
      <span class="img-actions">
        <button type="button" class="ghost-btn" data-prod-hide="${esc(p.id)}">${p.hidden ? 'Show' : 'Hide'}</button>
        <button type="button" class="ghost-btn" data-prod-export="${esc(p.id)}">Export .zip</button>
        <button type="button" class="ghost-btn" data-prod-remove="${esc(p.id)}">Remove</button>
      </span>
    </li>`).join('');
  }

  function addProduct(p: Product): void {
    const lp = live(p);
    products.push(lp);
    void save(lp);
    render();
    map.fitBounds(lp.bounds);
  }

  $('prod-list').addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    const pick = (attr: string) => {
      const id = el.closest<HTMLElement>(`[${attr}]`)?.getAttribute(attr);
      return id ? products.find((p) => p.id === id) : undefined;
    };
    const go = pick('data-prod-go');
    if (go) return void map.fitBounds(go.bounds);
    const hide = pick('data-prod-hide');
    if (hide) {
      hide.hidden = !hide.hidden;
      if (hide.hidden) map.removeLayer(hide.overlay); else hide.overlay.addTo(map);
      void save(hide);
      return render();
    }
    const ex = pick('data-prod-export');
    if (ex) {
      message(`Packing ${ex.name}…`);
      void exportZip(ex).then((zip) => {
        download(zip, `${slug(ex.name)}.zip`);
        message(`Exported ${ex.name}.`);
      });
      return;
    }
    const rm = pick('data-prod-remove');
    if (rm && confirm(`Remove ${rm.name} from this browser? Export it first if you want to keep it.`)) {
      map.removeLayer(rm.overlay);
      URL.revokeObjectURL(rm.url);
      products.splice(products.indexOf(rm), 1);
      void tx('readwrite', (s) => s.delete(rm.id));
      render();
    }
  });
  $('prod-opacity').addEventListener('input', (e) => {
    opacity = Number((e.target as HTMLInputElement).value) / 100;
    for (const p of products) p.overlay.setOpacity(opacity);
  });
  $('prod-import').addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (!f) return;
    void importZip(f).then((r) => {
      if (typeof r === 'string') return message(r, true);
      addProduct(r);
      message(`Imported ${r.name}.`);
    }).finally(() => { input.value = ''; });
  });

  void (async () => {
    try {
      const stored = await tx<Product[]>('readonly', (s) => s.getAll() as IDBRequest<Product[]>);
      for (const p of stored.sort((a, b) => a.created.localeCompare(b.created))) products.push(live(p));
    } catch {
      message('This browser will not store made images, so they would be lost on reload.', true);
    }
    render();
  })();

  return {
    add: addProduct,
    message,
    debug: () => products.map((p) => ({ name: p.name, grid: p.grid, bounds: p.bounds, format: p.format, size: p.blob.size, clip: p.clip })),
  };
}

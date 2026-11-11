/**
 * Building a campus tile set: every aligned image ticked, cut into the same
 * 256-pixel tiles the satellite layer uses, at every zoom from the finest
 * asked down to a whole-campus view, and stored in this browser.
 *
 * The finest zoom is drawn straight from the images, a block of 16 × 16
 * tiles at a time, so the whole campus at full detail never has to fit in
 * one canvas. Each zoom out is then made from the one below it, four tiles
 * shrunk into one, which is quick: the images are not read again.
 */

import L from 'leaflet';
import {
  blocksOf, boxOfGeometry, boxOfPoints, decodeScale, footprintInGrid, intersectBox, metersPerPixel, paint, parentsOf,
  ringsInGrid, sourceMpp, tileHasPixels, tilesCovering, TILE_PX, unionBox,
} from './raster';
import { putMany, request, tileKey, tileRange, TILES, TILESETS } from './db';
import { esc, type SourceImage } from './images';
import { listTileSets, StoredTiles, type TileSet } from './tilelayer';
import type { Clip } from './products';
import { latAt, lngAt } from './raster';

/** 16 × 16 tiles: 4,096 pixels square, 64 MB while it is worked on. */
const BLOCK = 16;
/** Decoded images kept between blocks: a print spans several, and decoding one is slow. */
const KEEP_DECODED = 2;
/** Zoomed out no further: the whole campus is a handful of tiles by here. */
export const MIN_Z = 14;
const QUALITY = 0.8;

const nextFrame = () => new Promise<void>((r) => setTimeout(r, 0));

export interface BuildOptions {
  name: string;
  sources: SourceImage[];
  clip: Clip | null;
  maxZ: number;
}

/** What a build would cover, for the estimate shown before it starts. */
export function tilePlan(o: Pick<BuildOptions, 'sources' | 'clip' | 'maxZ'>): { tiles: number; box: ReturnType<typeof boxOfPoints> } | string {
  const aligned = o.sources.filter((s) => s.aligned);
  if (!aligned.length) return 'Tick one or more aligned images first.';
  let box = aligned.map((s) => boxOfPoints(s.placement.corners)).reduce(unionBox);
  if (o.clip) {
    const cut = intersectBox(box, boxOfGeometry(o.clip.geometry));
    if (!cut) return `None of the ticked images reaches ${o.clip.name}.`;
    box = cut;
  }
  const t = tilesCovering(box, o.maxZ);
  return { tiles: (t.x1 - t.x0) * (t.y1 - t.y0), box };
}

function encode(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('could not encode a tile'))), 'image/webp', QUALITY));
}

export async function buildTiles(
  o: BuildOptions,
  progress: (text: string) => void,
  cancelled: () => boolean,
): Promise<TileSet> {
  const plan = tilePlan(o);
  if (typeof plan === 'string') throw new Error(plan);
  const sources = o.sources.filter((s) => s.aligned);
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const z = o.maxZ;
  const mpp = metersPerPixel((plan.box.north + plan.box.south) / 2, z);
  const blocks = blocksOf(tilesCovering(plan.box, z), z, BLOCK);
  const decoded = new Map<string, { data: Uint8ClampedArray; w: number; h: number }>();
  let made = 0;
  let bytes = 0;
  const started = performance.now();
  /** Tiles stored at the current zoom, as [x, y]: the next zoom out is made from them. */
  let level: Array<[number, number]> = [];

  async function decode(src: SourceImage) {
    const hit = decoded.get(src.id);
    if (hit) {
      // Most recently used goes to the back of the line.
      decoded.delete(src.id);
      decoded.set(src.id, hit);
      return hit;
    }
    const s = decodeScale(sourceMpp(src.placement.corners, src.width, src.height), mpp);
    const w = Math.max(1, Math.round(src.width * s));
    const h = Math.max(1, Math.round(src.height * s));
    const bmp = await createImageBitmap(src.blob, s < 1 ? { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' } : {});
    const c = document.createElement('canvas');
    c.width = bmp.width;
    c.height = bmp.height;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(bmp, 0, 0);
    bmp.close();
    const entry = { data: ctx.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height };
    c.width = 0;
    while (decoded.size >= KEEP_DECODED) decoded.delete(decoded.keys().next().value!);
    decoded.set(src.id, entry);
    return entry;
  }

  const eta = (done: number, total: number) => {
    if (done < 2) return '';
    const left = ((performance.now() - started) / done) * (total - done) / 1000;
    return left > 90 ? ` About ${Math.round(left / 60)} min left.` : ` About ${Math.max(1, Math.round(left))} s left.`;
  };

  try {
    // ---- the finest zoom, from the images
    for (const [bi, grid] of blocks.entries()) {
      if (cancelled()) throw new Error('Stopped.');
      // Best first in `sources`; painted worst first so the best ends on top.
      const here = sources.filter((s) => {
        const f = footprintInGrid(grid, s.placement.corners);
        return f.x1 > f.x0 && f.y1 > f.y0;
      });
      if (!here.length) continue;
      if (o.clip && !intersectBox(boxOfPoints([
        [latAt(grid.y0, z), lngAt(grid.x0, z)], [latAt(grid.y0 + grid.height, z), lngAt(grid.x0 + grid.width, z)],
      ]), boxOfGeometry(o.clip.geometry))) continue;

      progress(`Zoom ${z}: block ${bi + 1} of ${blocks.length}, ${made.toLocaleString()} tiles so far.${eta(bi, blocks.length)}`);
      await nextFrame();
      const out = new Uint8ClampedArray(grid.width * grid.height * 4);
      for (const src of [...here].reverse()) {
        const d = await decode(src);
        paint(grid, out, {
          width: src.width, height: src.height, data: d.data, dataWidth: d.w, dataHeight: d.h,
          toImage: src.placement.toImage, corners: src.placement.corners,
        });
        await nextFrame();
      }
      const canvas = document.createElement('canvas');
      canvas.width = grid.width;
      canvas.height = grid.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.putImageData(new ImageData(out, grid.width, grid.height), 0, 0);
      if (o.clip) {
        const path = new Path2D();
        for (const ring of ringsInGrid(o.clip.geometry, grid)) {
          ring.forEach(([x, y], k) => (k ? path.lineTo(x, y) : path.moveTo(x, y)));
          path.closePath();
        }
        ctx.globalCompositeOperation = 'destination-in';
        ctx.fill(path, 'evenodd');
        ctx.globalCompositeOperation = 'source-over';
      }
      const rgba = o.clip ? ctx.getImageData(0, 0, grid.width, grid.height).data : out;
      const entries: Array<[string, Blob]> = [];
      const cols = grid.width / TILE_PX;
      const rows = grid.height / TILE_PX;
      const tile = document.createElement('canvas');
      tile.width = TILE_PX;
      tile.height = TILE_PX;
      const tctx = tile.getContext('2d')!;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          // Nothing there (outside the clip, or no image reaches): no tile at all.
          if (!tileHasPixels(rgba, grid.width, c, r)) continue;
          tctx.clearRect(0, 0, TILE_PX, TILE_PX);
          tctx.drawImage(canvas, c * TILE_PX, r * TILE_PX, TILE_PX, TILE_PX, 0, 0, TILE_PX, TILE_PX);
          const blob = await encode(tile);
          const tx = grid.x0 / TILE_PX + c;
          const ty = grid.y0 / TILE_PX + r;
          entries.push([tileKey(id, z, tx, ty), blob]);
          level.push([tx, ty]);
          bytes += blob.size;
        }
      }
      canvas.width = 0;
      await putMany(TILES, entries);
      made += entries.length;
    }
    decoded.clear();
    if (!made) throw new Error('No image reached the area chosen, so there were no tiles to make.');

    // ---- each zoom out, from the one below
    for (let pz = z - 1; pz >= MIN_Z; pz--) {
      const parents = parentsOf(level);
      const next: Array<[number, number]> = [];
      const canvas = document.createElement('canvas');
      canvas.width = TILE_PX;
      canvas.height = TILE_PX;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingQuality = 'high';
      let entries: Array<[string, Blob]> = [];
      for (const [i, [px, py]] of parents.entries()) {
        if (cancelled()) throw new Error('Stopped.');
        ctx.clearRect(0, 0, TILE_PX, TILE_PX);
        let any = false;
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
          const blob = await request<Blob | undefined>(TILES, 'readonly', (s) => s.get(tileKey(id, pz + 1, px * 2 + dx, py * 2 + dy)));
          if (!blob) continue;
          const bmp = await createImageBitmap(blob);
          ctx.drawImage(bmp, dx * (TILE_PX / 2), dy * (TILE_PX / 2), TILE_PX / 2, TILE_PX / 2);
          bmp.close();
          any = true;
        }
        if (!any) continue;
        const blob = await encode(canvas);
        entries.push([tileKey(id, pz, px, py), blob]);
        next.push([px, py]);
        bytes += blob.size;
        if (entries.length >= 64 || i === parents.length - 1) {
          await putMany(TILES, entries);
          made += entries.length;
          entries = [];
          progress(`Zoom ${pz}: ${i + 1} of ${parents.length} tiles, ${made.toLocaleString()} in all.`);
          await nextFrame();
        }
      }
      level = next;
    }
  } catch (err) {
    // A half-built set is no use: take its tiles back out.
    progress('Clearing the unfinished tiles…');
    await request(TILES, 'readwrite', (s) => s.delete(tileRange(id))).catch(() => undefined);
    throw err;
  }

  const set: TileSet = {
    id,
    name: o.name.trim() || `campus-${new Date().toISOString().slice(0, 10)}`,
    minZ: MIN_Z,
    maxZ: z,
    bounds: [[plan.box.south, plan.box.west], [plan.box.north, plan.box.east]],
    tiles: made,
    bytes,
    sources: sources.map((s) => s.id),
    clip: o.clip?.name ?? null,
    created: new Date().toISOString(),
  };
  await request(TILESETS, 'readwrite', (s) => s.put(set));
  return set;
}

// ---------------------------------------------------------------- the panel

const mb = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(0)} MB` : `${Math.max(1, Math.round(n / 1e3))} kB`);

export function initTiles(map: L.Map, control: L.Control.Layers) {
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const layers = new Map<string, StoredTiles>();
  let sets: TileSet[] = [];

  function render(): void {
    $('tiles-count').textContent = String(sets.length);
    $('tiles-empty').hidden = sets.length > 0;
    $('tiles-list').innerHTML = [...sets].reverse().map((t) => `<li>
      <span class="img-head"><button type="button" class="go img-name" data-tiles-go="${esc(t.id)}">${esc(t.name)}</button></span>
      <span class="hint">${t.tiles.toLocaleString()} tiles · zoom ${t.minZ}–${t.maxZ} · ${mb(t.bytes)}${t.clip ? ` · clipped to ${esc(t.clip)}` : ''}
        · from ${t.sources.length} image${t.sources.length === 1 ? '' : 's'}</span>
      <span class="img-actions">
        <button type="button" class="ghost-btn" data-tiles-show="${esc(t.id)}">${map.hasLayer(layers.get(t.id)!) ? 'Hide' : 'Show'}</button>
        <button type="button" class="ghost-btn" data-tiles-remove="${esc(t.id)}">Remove</button>
      </span>
    </li>`).join('');
  }

  function adopt(t: TileSet, show: boolean): void {
    const layer = new StoredTiles(t);
    layers.set(t.id, layer);
    control.addOverlay(layer, `Campus tiles: ${esc(t.name)}`);
    if (show) layer.addTo(map);
  }

  $('tiles-list').addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    const pick = (attr: string) => {
      const id = el.closest<HTMLElement>(`[${attr}]`)?.getAttribute(attr);
      return id ? sets.find((t) => t.id === id) : undefined;
    };
    const go = pick('data-tiles-go');
    if (go) return void map.fitBounds(go.bounds);
    const show = pick('data-tiles-show');
    if (show) {
      const layer = layers.get(show.id)!;
      if (map.hasLayer(layer)) map.removeLayer(layer); else layer.addTo(map);
      return render();
    }
    const rm = pick('data-tiles-remove');
    if (rm && confirm(`Remove the tile set ${rm.name} from this browser? It goes from the positions tool and the survey app too.`)) {
      const layer = layers.get(rm.id)!;
      map.removeLayer(layer);
      control.removeLayer(layer);
      layers.delete(rm.id);
      sets = sets.filter((t) => t.id !== rm.id);
      render();
      void request(TILES, 'readwrite', (s) => s.delete(tileRange(rm.id)))
        .then(() => request(TILESETS, 'readwrite', (s) => s.delete(rm.id)));
    }
  });
  map.on('overlayadd overlayremove', render);

  void listTileSets().then((all) => {
    sets = all;
    for (const t of sets) adopt(t, false);
    render();
  });

  return {
    added(t: TileSet): void {
      sets.push(t);
      adopt(t, true);
      render();
    },
    debug: () => sets,
  };
}

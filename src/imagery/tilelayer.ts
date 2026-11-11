/**
 * A campus tile set, drawn the way the satellite layer is: in 256-pixel
 * tiles, only those on screen, a set for every zoom. The tiles come from this
 * browser's store, not from a server, which is why the layer is private to
 * the browser that built it (or imported it).
 *
 * Small on purpose: the positions tool and the survey app import this, and
 * none of the code that builds tiles.
 */

import L from 'leaflet';
import { request, TILES, TILESETS, tileKey } from './db';
import type { Bounds } from '../positions/imagery-math';

export interface TileSet {
  id: string;
  name: string;
  minZ: number;
  maxZ: number;
  bounds: Bounds;
  tiles: number;
  bytes: number;
  sources: string[];
  clip: string | null;
  created: string;
}

export class StoredTiles extends L.TileLayer {
  constructor(private set: TileSet, options: L.TileLayerOptions = {}) {
    super('', {
      minNativeZoom: set.minZ,
      maxNativeZoom: set.maxZ,
      maxZoom: 22,
      bounds: L.latLngBounds(set.bounds),
      // Above the satellite layer, below anything drawn over the map.
      zIndex: 5,
      keepBuffer: 2,
      ...options,
    });
  }

  createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const img = document.createElement('img');
    img.alt = '';
    img.setAttribute('role', 'presentation');
    request<Blob | undefined>(TILES, 'readonly', (s) => s.get(tileKey(this.set.id, coords.z, coords.x, coords.y)))
      .then((blob) => {
        if (!blob) {
          // Outside the campus, or no image there: nothing, not a broken picture.
          img.style.visibility = 'hidden';
          done(undefined, img);
          return;
        }
        const url = URL.createObjectURL(blob);
        img.onload = () => { URL.revokeObjectURL(url); done(undefined, img); };
        img.onerror = () => { URL.revokeObjectURL(url); done(new Error('tile unreadable'), img); };
        img.src = url;
      })
      .catch((err: Error) => done(err, img));
    return img;
  }
}

export async function listTileSets(): Promise<TileSet[]> {
  try {
    const sets = await request<TileSet[]>(TILESETS, 'readonly', (s) => s.getAll() as IDBRequest<TileSet[]>);
    return sets.sort((a, b) => a.created.localeCompare(b.created));
  } catch {
    return [];
  }
}

/**
 * Every tile set this browser holds, as overlays in a layers control, off to
 * start with. Resolves to how many there were; none means nothing is added,
 * which on a phone that never built any is every time.
 */
export async function addTileOverlays(map: L.Map, control: L.Control.Layers | null): Promise<number> {
  const sets = await listTileSets();
  if (!sets.length) return 0;
  const ctl = control ?? L.control.layers(undefined, undefined, { position: 'topright' }).addTo(map);
  for (const set of sets) ctl.addOverlay(new StoredTiles(set), `Campus tiles: ${set.name}`);
  return sets.length;
}

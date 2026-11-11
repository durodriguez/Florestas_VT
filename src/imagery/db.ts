/**
 * The browser store for what the image calibration page makes: made images,
 * and campus tile sets. One database, opened here only, so every page that
 * reads it (the calibration page, the positions tool, the survey app on a
 * laptop) agrees on its version and its stores.
 *
 * The source images are elsewhere, in the positions tool's own store.
 */

const DB = 'uvm-imagery';
/** 1: products. 2: tiles and tilesets. */
const VERSION = 2;
export const PRODUCTS = 'products';
export const TILES = 'tiles';
export const TILESETS = 'tilesets';

let opening: Promise<IDBDatabase> | null = null;

export function openImageryDb(): Promise<IDBDatabase> {
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of [PRODUCTS, TILESETS]) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      // Tiles are keyed "<set>/<z>/<x>/<y>", so one set's tiles are one key range.
      if (!db.objectStoreNames.contains(TILES)) db.createObjectStore(TILES);
    };
    req.onsuccess = () => {
      const db = req.result;
      // Another tab upgrading the database asks this one to let go.
      db.onversionchange = () => { db.close(); opening = null; };
      resolve(db);
    };
    req.onerror = () => { opening = null; reject(req.error); };
    req.onblocked = () => { opening = null; reject(new Error('Close the other tabs of this site and reload: the browser store needs updating.')); };
  });
  return opening;
}

/** One request against one store. */
export async function request<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openImageryDb();
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(store, mode).objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Many writes in one transaction: far faster than one each, for thousands of tiles. */
export async function putMany(store: string, entries: Array<[IDBValidKey, unknown]>): Promise<void> {
  const db = await openImageryDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(store, 'readwrite');
    const s = t.objectStore(store);
    for (const [key, value] of entries) s.put(value, key);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error('The browser refused to store the tiles (is the disk full?).'));
  });
}

/** The key range holding one tile set's tiles, or one zoom of it. */
export const tileRange = (set: string, z?: number): IDBKeyRange => {
  const p = z === undefined ? `${set}/` : `${set}/${z}/`;
  return IDBKeyRange.bound(p, `${p}￿`);
};

export const tileKey = (set: string, z: number, x: number, y: number): string => `${set}/${z}/${x}/${y}`;

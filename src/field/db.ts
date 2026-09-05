/**
 * Offline storage for the field app.
 *
 * Everything a surveyor records lives in IndexedDB on the device until they
 * export it. Nothing is sent anywhere — there is no server — so a lost or wiped
 * phone loses the day's work. The app nags about exporting for that reason.
 */

export interface SurveyRecord {
  /** Local row id, not the accession number. */
  id: number;
  /** Metal tag number from the 2014 inventory, e.g. "772". Blank for a new tree. */
  tag: string;
  /** Scientific name, seeded from the reference and confirmed by the surveyor. */
  species: string;
  /** Set when the surveyor says the tree is not what the 2014 record claims. */
  speciesMismatch: boolean;
  lat: number | null;
  lng: number | null;
  /** GPS accuracy in metres at the moment of capture. */
  accuracy: number | null;
  /** True when the surveyor dragged the pin instead of trusting the fix. */
  pinAdjusted: boolean;
  dbhIn: number | null;
  heightFt: number | null;
  spreadFt: number | null;
  condition: string;
  /**
   * Four-digit year, or null. `plantedUnknown` distinguishes "the surveyor
   * checked and nobody knows" from "the surveyor did not get to it" — the
   * first is a finding, the second is a gap.
   */
  plantedYear: number | null;
  plantedUnknown: boolean;
  notes: string;
  surveyedOn: string;
  surveyor: string;
  photoName: string | null;
  createdAt: number;
}

export interface PhotoBlob {
  name: string;
  blob: Blob;
}

const DB_NAME = 'uvm-field-survey';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('records')) {
        db.createObjectStore('records', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('photos')) {
        db.createObjectStore('photos', { keyPath: 'name' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('could not open the local database'));
  });
  return dbPromise;
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error(`${store} operation failed`));
      }),
  );
}

export const saveRecord = (rec: Omit<SurveyRecord, 'id'> & { id?: number }): Promise<number> =>
  run('records', 'readwrite', (s) => s.put(rec as SurveyRecord) as IDBRequest<number>);

export const allRecords = (): Promise<SurveyRecord[]> =>
  run<SurveyRecord[]>('records', 'readonly', (s) => s.getAll()).then((rows) =>
    rows.sort((a, b) => b.createdAt - a.createdAt),
  );

export const deleteRecord = (id: number): Promise<void> =>
  run('records', 'readwrite', (s) => s.delete(id) as unknown as IDBRequest<void>);

export const savePhoto = (name: string, blob: Blob): Promise<string> =>
  run('photos', 'readwrite', (s) => s.put({ name, blob }) as IDBRequest<string>);

export const getPhoto = (name: string): Promise<PhotoBlob | undefined> =>
  run<PhotoBlob | undefined>('photos', 'readonly', (s) => s.get(name));

export const allPhotos = (): Promise<PhotoBlob[]> =>
  run<PhotoBlob[]>('photos', 'readonly', (s) => s.getAll());

export const deletePhoto = (name: string): Promise<void> =>
  run('photos', 'readwrite', (s) => s.delete(name) as unknown as IDBRequest<void>);

export const setMeta = (key: string, value: unknown): Promise<string> =>
  run('meta', 'readwrite', (s) => s.put({ key, value }) as IDBRequest<string>);

export const getMeta = <T>(key: string): Promise<T | undefined> =>
  run<{ key: string; value: T } | undefined>('meta', 'readonly', (s) => s.get(key)).then(
    (row) => row?.value,
  );

/** Wipe everything. Used only after a confirmed export. */
export async function clearAll(): Promise<void> {
  const db = await open();
  await Promise.all(
    ['records', 'photos'].map(
      (name) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(name, 'readwrite');
          const req = tx.objectStore(name).clear();
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        }),
    ),
  );
}

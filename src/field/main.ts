import 'leaflet/dist/leaflet.css';
import './styles.css';

import L from 'leaflet';
import {
  allPhotos, allRecords, clearAll, deletePhoto, deleteRecord, getPhoto,
  saveRecord, savePhoto, type SurveyRecord,
} from './db';
import {
  Reference, cacheReference, fetchServerReference, loadCachedReference, parseReference,
} from './reference';
import { Gps, accuracyLabel, ACCURACY_WARN_M, type GpsState } from './gps';
import { download, stamp, toCsv, toPhotoZip } from './exporter';
import { kb, shrinkPhoto } from './photo';

const BASE = import.meta.env.BASE_URL;
const CONDITIONS = ['excellent', 'good', 'fair', 'poor', 'dead'];

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element: ${id}`);
  return el as T;
};

const reference = new Reference();
let photoBlob: Blob | null = null;
let photoName: string | null = null;
let pinAdjusted = false;
let plantedUnknown = false;
let manualLatLng: L.LatLng | null = null;

// ---------------------------------------------------------------- map

const map = L.map($('pin-map'), {
  center: [44.4777, -73.1956],
  zoom: 18,
  zoomControl: false,
  attributionControl: false,
});
L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 22, maxNativeZoom: 19 },
).addTo(map);

// Leaflet's default icon resolves image URLs relative to its own CSS, which a
// bundler rewrites — the marker renders broken and cannot be grabbed. Drawing
// the pin as a divIcon avoids any external asset.
const pinIcon = L.divIcon({
  className: 'tree-pin',
  html: '<span class="tree-pin-dot"></span><span class="tree-pin-stem"></span>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});
const pin = L.marker([44.4777, -73.1956], { draggable: true, icon: pinIcon, autoPan: true }).addTo(map);
const accuracyRing = L.circle([44.4777, -73.1956], { radius: 0, color: '#1d6fe0', weight: 1, fillOpacity: 0.1 }).addTo(map);

function movePin(to: L.LatLng): void {
  pin.setLatLng(to);
  manualLatLng = to;
  pinAdjusted = true;
  renderCoords();
}

pin.on('dragend', () => movePin(pin.getLatLng()));

// Tapping is far easier than dragging a small target one-handed in gloves, and
// it does not depend on touch-drag behaviour varying between devices.
map.on('click', (e: L.LeafletMouseEvent) => movePin(e.latlng));

// ---------------------------------------------------------------- gps

const gps = new Gps(onGps);

function onGps(state: GpsState): void {
  const status = $('gps-status');
  const acc = $('gps-accuracy');

  if (state.status === 'denied') {
    status.textContent = 'Location permission denied. Enable it for this site, or drag the pin instead.';
    acc.textContent = '—';
    return;
  }
  if (state.status === 'unavailable') {
    status.textContent = state.message;
    acc.textContent = '—';
    return;
  }
  if (state.status !== 'fixed') {
    status.textContent = 'Waiting for location…';
    acc.textContent = '—';
    return;
  }

  const { fix } = state;
  const label = accuracyLabel(fix.accuracy);
  acc.textContent = label.text;
  acc.className = `accuracy accuracy--${label.level}`;
  status.textContent =
    label.level === 'poor'
      ? 'Fix is weak. Stand in the open, wait a moment, or drag the pin onto the tree.'
      : label.level === 'fair'
        ? 'Usable. Dragging the pin onto the crown is still more accurate.'
        : 'Good fix.';

  accuracyRing.setLatLng([fix.lat, fix.lng]).setRadius(fix.accuracy);
  if (!pinAdjusted) {
    pin.setLatLng([fix.lat, fix.lng]);
    map.setView([fix.lat, fix.lng], Math.max(map.getZoom(), 19));
  }
  renderCoords();
}

function currentLatLng(): { lat: number; lng: number } | null {
  if (manualLatLng) return { lat: manualLatLng.lat, lng: manualLatLng.lng };
  const fix = gps.bestFix;
  return fix ? { lat: fix.lat, lng: fix.lng } : null;
}

function renderCoords(): void {
  const p = currentLatLng();
  $('coords').textContent = p ? `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}` : '—';
}

// ---------------------------------------------------------------- tag lookup

function renderTagLookup(): void {
  const tag = $<HTMLInputElement>('tag').value.trim();
  const box = $('tag-result');

  if (!tag) {
    box.innerHTML = '';
    box.className = 'tag-result';
    return;
  }
  if (reference.size === 0) {
    box.className = 'tag-result tag-result--info';
    box.textContent = 'No 2014 inventory loaded — type the species yourself. Load it from the Saved screen.';
    return;
  }

  const hit = reference.lookup(tag);
  if (hit) {
    box.className = 'tag-result tag-result--hit';
    box.innerHTML =
      `<strong>${escapeHtml(hit.botanical)}</strong>` +
      `<span>${escapeHtml(hit.common)}</span>` +
      `<span class="tag-meta">2014: ${escapeHtml(hit.dbh || '—')}″ DBH · ` +
      `${escapeHtml(hit.ageClass || '—')} · ${escapeHtml(hit.condition || '—')}</span>`;
    const species = $<HTMLInputElement>('species');
    if (!species.value.trim() || species.dataset.autofilled === '1') {
      species.value = hit.botanical;
      species.dataset.autofilled = '1';
    }
    return;
  }

  const near = reference.neighbours(tag);
  box.className = 'tag-result tag-result--miss';
  box.innerHTML =
    `<strong>No tree ${escapeHtml(tag)} in the 2014 inventory.</strong>` +
    (near.length
      ? `<span class="tag-meta">Nearby tags: ${near
          .map((t) => `<button type="button" class="tag-near" data-tag="${escapeHtml(t.tag)}">${escapeHtml(t.tag)} ${escapeHtml(t.common)}</button>`)
          .join(' ')}</span>`
      : '<span class="tag-meta">Check the digits, or record it as a new tree.</span>');
}

// ---------------------------------------------------------------- form

function renderConditions(): void {
  $('condition-seg').innerHTML = CONDITIONS.map(
    (c) =>
      `<button type="button" class="seg-btn" role="radio" aria-checked="false" data-condition="${c}">${c[0]!.toUpperCase()}${c.slice(1)}</button>`,
  ).join('');
}

function selectedCondition(): string {
  return $('condition-seg').querySelector('[aria-checked="true"]')?.getAttribute('data-condition') ?? '';
}

function resetForm(): void {
  for (const id of ['tag', 'species', 'dbh', 'height', 'spread', 'notes', 'planted']) {
    $<HTMLInputElement>(id).value = '';
  }
  setPlantedUnknown(false);
  $<HTMLInputElement>('species').dataset.autofilled = '';
  $<HTMLInputElement>('species-mismatch').checked = false;
  for (const b of $('condition-seg').querySelectorAll('[aria-checked]')) {
    b.setAttribute('aria-checked', 'false');
  }
  clearPhoto();
  $('tag-result').innerHTML = '';
  $('form-error').hidden = true;
  pinAdjusted = false;
  manualLatLng = null;
  gps.reset();
  renderCoords();
}

function clearPhoto(): void {
  photoBlob = null;
  photoName = null;
  $('photo-preview').hidden = true;
  $('photo-size').textContent = '';
  $<HTMLInputElement>('photo').value = '';
  const img = $<HTMLImageElement>('photo-img');
  if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
  img.removeAttribute('src');
}

async function save(): Promise<void> {
  const err = $('form-error');
  const species = $<HTMLInputElement>('species').value.trim();
  const point = currentLatLng();
  const fix = gps.bestFix;

  if (!species) return fail('Enter a species before saving.');

  const plantedRaw = $<HTMLInputElement>('planted').value.trim();
  if (!plantedUnknown && plantedRaw !== '') {
    const year = Number(plantedRaw);
    const thisYear = new Date().getFullYear();
    if (!/^\d{4}$/.test(plantedRaw) || year < 1700 || year > thisYear) {
      return fail(`"${plantedRaw}" is not a planting year. Enter four digits between 1700 and ${thisYear}, or press Unknown.`);
    }
  }
  if (!point) return fail('No position yet. Wait for a fix, or drag the pin onto the tree.');
  if (!pinAdjusted && fix && fix.accuracy > ACCURACY_WARN_M) {
    return fail(
      `The GPS fix is only ±${fix.accuracy.toFixed(0)} m, which will put this tree in the wrong place. ` +
      'Wait for it to improve, or drag the pin onto the tree to override.',
    );
  }

  if (photoBlob) {
    photoName = `${($<HTMLInputElement>('tag').value.trim() || 'untagged')}-${Date.now()}.jpg`;
    await savePhoto(photoName, photoBlob);
  }

  const num = (id: string): number | null => {
    const v = $<HTMLInputElement>(id).value.trim();
    return v === '' ? null : Number(v);
  };

  await saveRecord({
    tag: $<HTMLInputElement>('tag').value.trim(),
    species,
    speciesMismatch: $<HTMLInputElement>('species-mismatch').checked,
    lat: point.lat,
    lng: point.lng,
    accuracy: pinAdjusted ? null : (fix?.accuracy ?? null),
    pinAdjusted,
    dbhIn: num('dbh'),
    heightFt: num('height'),
    spreadFt: num('spread'),
    condition: selectedCondition(),
    plantedYear: plantedUnknown ? null : num('planted'),
    plantedUnknown,
    notes: $<HTMLTextAreaElement>('notes').value.trim(),
    surveyedOn: $<HTMLInputElement>('date').value || stamp(),
    surveyor: $<HTMLInputElement>('surveyor').value.trim(),
    photoName,
    createdAt: Date.now(),
  } as Omit<SurveyRecord, 'id'>);

  resetForm();
  await refreshCount();
  toast('Saved. Ready for the next tree.');

  function fail(message: string): void {
    err.textContent = message;
    err.hidden = false;
    err.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// ---------------------------------------------------------------- saved list

async function renderList(): Promise<void> {
  const rows = await allRecords();
  $('list-empty').hidden = rows.length > 0;
  $('record-list').innerHTML = rows
    .map(
      (r) => `<li>
        <div class="rec">
          <span class="rec-tag">${escapeHtml(r.tag || 'no tag')}</span>
          <span class="rec-species">${escapeHtml(r.species)}</span>
          <span class="rec-meta">${r.dbhIn ? `${r.dbhIn}″ · ` : ''}${escapeHtml(r.condition || '—')}${r.plantedYear ? ` · ${r.plantedYear}` : r.plantedUnknown ? ' · year unknown' : ''}${r.photoName ? ' · photo' : ''}${r.speciesMismatch ? ' · flagged' : ''}</span>
        </div>
        <button type="button" class="ghost-btn" data-delete="${r.id}">Delete</button>
      </li>`,
    )
    .join('');
}

async function refreshCount(): Promise<void> {
  const rows = await allRecords();
  $('saved-count').textContent = String(rows.length);
}

// ---------------------------------------------------------------- reference

async function setReference(trees: ReturnType<typeof parseReference>, persist: boolean): Promise<void> {
  reference.load(trees);
  if (persist) await cacheReference(trees);
  $('ref-status').textContent = `${trees.length.toLocaleString()} trees loaded. Available offline.`;
  renderTagLookup();
}

async function initReference(): Promise<void> {
  const cached = await loadCachedReference();
  if (cached?.length) return setReference(cached, false);

  const fromServer = await fetchServerReference(BASE);
  if (fromServer?.length) return setReference(fromServer, true);

  $('ref-status').textContent =
    'Not loaded. Tag lookup is off until you load the inventory CSV — you can still record trees.';
}

// ---------------------------------------------------------------- misc

function escapeHtml(v: string): string {
  return v.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

let toastTimer: number | undefined;
function toast(message: string): void {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('is-visible'), 3000);
}

function showScreen(which: 'form' | 'list'): void {
  $('screen-form').hidden = which !== 'form';
  $('screen-list').hidden = which !== 'list';
  if (which === 'list') void renderList();
  else setTimeout(() => map.invalidateSize(), 50);
}

// ---------------------------------------------------------------- wiring

renderConditions();
$<HTMLInputElement>('date').value = stamp();

$('tag').addEventListener('input', renderTagLookup);
$('tag-result').addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-tag]');
  if (!btn) return;
  $<HTMLInputElement>('tag').value = btn.dataset.tag!;
  $<HTMLInputElement>('species').dataset.autofilled = '1';
  renderTagLookup();
});
$('tag-new').addEventListener('click', () => {
  $<HTMLInputElement>('tag').value = '';
  $<HTMLInputElement>('species').dataset.autofilled = '';
  renderTagLookup();
  $('species').focus();
});
$('species').addEventListener('input', (e) => {
  (e.target as HTMLInputElement).dataset.autofilled = '';
});

$('condition-seg').addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-condition]');
  if (!btn) return;
  for (const b of $('condition-seg').querySelectorAll('[aria-checked]')) {
    b.setAttribute('aria-checked', String(b === btn));
  }
});

/** Unknown and a typed year are mutually exclusive, so the toggle owns both. */
function setPlantedUnknown(on: boolean): void {
  plantedUnknown = on;
  const btn = $('planted-unknown');
  const input = $<HTMLInputElement>('planted');
  btn.setAttribute('aria-pressed', String(on));
  btn.classList.toggle('is-on', on);
  input.disabled = on;
  if (on) input.value = '';
  $('planted-note').textContent = on
    ? 'Recorded as unknown — a finding in itself, not a blank.'
    : 'Leave blank if you would rather not guess.';
}

$('planted-unknown').addEventListener('click', () => setPlantedUnknown(!plantedUnknown));
$('planted').addEventListener('input', () => {
  if (plantedUnknown) setPlantedUnknown(false);
});

$('photo-btn').addEventListener('click', () => $('photo').click());
$('photo').addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  $('photo-size').textContent = 'Processing…';
  $('photo-preview').hidden = false;

  const shrunk = await shrinkPhoto(file);
  photoBlob = shrunk.blob;

  const img = $<HTMLImageElement>('photo-img');
  if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
  img.src = URL.createObjectURL(shrunk.blob);
  $('photo-size').textContent = shrunk.width
    ? `${shrunk.width}×${shrunk.height} · ${kb(shrunk.blob.size)} (from ${kb(shrunk.originalBytes)})`
    : kb(shrunk.blob.size);
});
$('photo-clear').addEventListener('click', clearPhoto);

$('gps-recapture').addEventListener('click', () => {
  pinAdjusted = false;
  manualLatLng = null;
  gps.reset();
  gps.stop();
  gps.start();
  toast('Re-reading GPS…');
});

$('save').addEventListener('click', () => void save());
$('nav-list').addEventListener('click', () => showScreen('list'));
$('nav-form').addEventListener('click', () => showScreen('form'));

$('record-list').addEventListener('click', async (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-delete]');
  if (!btn) return;
  const id = Number(btn.dataset.delete);
  const rows = await allRecords();
  const row = rows.find((r) => r.id === id);
  if (row?.photoName) await deletePhoto(row.photoName);
  await deleteRecord(id);
  await renderList();
  await refreshCount();
});

$('export-csv').addEventListener('click', async () => {
  const rows = await allRecords();
  if (!rows.length) return toast('Nothing to export yet.');
  download(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }), `survey-${stamp()}.csv`);
  toast(`Exported ${rows.length} record(s).`);
});

$('export-photos').addEventListener('click', async () => {
  const photos = await allPhotos();
  if (!photos.length) return toast('No photos to export.');
  toast('Building zip…');
  download(await toPhotoZip(photos), `survey-photos-${stamp()}.zip`);
});

$('clear-all').addEventListener('click', async () => {
  const rows = await allRecords();
  if (!rows.length) return toast('Nothing saved.');
  if (!confirm(`Delete all ${rows.length} saved record(s) and their photos from this phone? Export first — this cannot be undone.`)) return;
  await clearAll();
  await renderList();
  await refreshCount();
  toast('Cleared.');
});

$('ref-btn').addEventListener('click', () => $('ref-file').click());
$('ref-file').addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    await setReference(parseReference(await file.text()), true);
    toast('Inventory loaded.');
  } catch (err) {
    toast((err as Error).message);
  }
});

// Warn before leaving with unexported work.
window.addEventListener('beforeunload', (e) => {
  if (Number($('saved-count').textContent) > 0) {
    e.preventDefault();
    e.returnValue = '';
  }
});

void initReference();
void refreshCount();
gps.start();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${BASE}field/sw.js`, { scope: `${BASE}field/` }).catch(() => {
      /* offline support is a bonus; the app works without it */
    });
  });
}

// Surfaced for the browser test to drive without a real camera or GPS.
Object.assign(window as unknown as Record<string, unknown>, {
  __field: { getPhoto, allRecords, currentLatLng, isPinAdjusted: () => pinAdjusted },
});

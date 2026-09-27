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
import {
  MAX_SUGGESTIONS, matchExact, resolveExact, searchSpecies, speciesChanged,
  type SpeciesEntry, type Suggestion,
} from './species';
import { getMeta, setMeta } from './db';
import { STATUSES, STATUS_LABELS, absent } from './status';
import {
  describeDistance, likelyDuplicate, mappedByTagOrId, mappedNeighbours, nearbyTrees, NEARBY_COLOURS,
  type MappedTree, type NearbyTree,
} from './nearby';
import { Gps, accuracyLabel, ACCURACY_WARN_M, type GpsState } from './gps';
import { download, stamp, toCsv, toPhotoZip } from './exporter';
import { extensionFor, kb, shrinkPhoto } from './photo';
import { ALL_CARDS, CARDS, visibleCards, type Mode } from './modes';

const BASE = import.meta.env.BASE_URL;
const CONDITIONS = ['excellent', 'good', 'fair', 'poor', 'dead'];

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element: ${id}`);
  return el as T;
};

const referenceFile = new Reference();
let species: SpeciesEntry[] = [];
let suggestions: Suggestion[] = [];
let highlighted = -1;
let photoBlob: Blob | null = null;
let photoName: string | null = null;
let pinAdjusted = false;
let plantedUnknown = false;
let hasPlaque = false;
/**
 * What the records already say about the tag currently in the box, and which
 * records said it. `source` is shown to the surveyor, because "the 2014
 * inventory says maple" and "we surveyed this in 2023 as maple" are different
 * claims and a correction to one is not a correction to the other.
 */
let reference = { species: '', taxonId: '', source: '' };
/** Every plant already on the map, for matching an untagged tree by position. */
let mapped: MappedTree[] = [];
/** The mapped tree the surveyor says this is, if they picked one. */
let claimed: NearbyTree | null = null;
/** How the claim was made: a tag typed, or a tree picked by position. */
let claimedBy: 'tag' | 'position' = 'position';
/**
 * Which kind of visit this is. Asked first, because the 2023-24 inventory put
 * most of campus on the map already: the usual visit is to a tree that is on
 * it, and the question is which one — not what its tag says.
 */
let mode: Mode | null = null;
/** New trees only: whether it wears a metal tag. Null until answered. */
let hasTag: boolean | null = null;
/**
 * Update only: whether the surveyor has said the map has this tree in the
 * wrong place. Until then the map is for finding the tree, and a tap on it
 * must not move a curated position.
 */
let movingTree = false;
/** The dedication text a claimed tree brought with it, to tell an edit from a prefill. */
let prefilledDedication = '';
/** Exactly what the last render put on screen, so a tap cannot mis-resolve. */
let offered: NearbyTree[] = [];
let manualLatLng: L.LatLng | null = null;

// ---------------------------------------------------------------- map

const map = L.map($('pin-map'), {
  center: [44.4777, -73.1956],
  zoom: 18,
  zoomControl: false,
  attributionControl: false,
});
// maxNativeZoom is the last zoom with real pixels behind it; past that Leaflet
// upscales. This sat at 19 while the service publishes 20 over Burlington, so
// every zoom past 19 — which is where you place a pin — was blur rather than
// detail. 0.107 m per pixel now, against 0.213 m. z21 is not published.
L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 22, maxNativeZoom: 20 },
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
// The mapped trees currently on offer, drawn in the same colours as the list
// beside them. Added before the pin so the pin always sits on top of them —
// the pin is what the surveyor is placing, and it must never be hidden.
const nearbyLayer = L.layerGroup().addTo(map);

const pin = L.marker([44.4777, -73.1956], { draggable: true, icon: pinIcon, autoPan: true }).addTo(map);
const accuracyRing = L.circle([44.4777, -73.1956], { radius: 0, color: '#1d6fe0', weight: 1, fillOpacity: 0.1 }).addTo(map);

function movePin(to: L.LatLng): void {
  pin.setLatLng(to);
  manualLatLng = to;
  pinAdjusted = true;
  renderCoords();
}

pin.on('dragend', () => movePin(pin.getLatLng()));

/** Whether a tap or drag on the map places the tree. */
const pinPlaces = (): boolean => mode === 'new' || (mode === 'update' && movingTree);

// Tapping is far easier than dragging a small target one-handed in gloves, and
// it does not depend on touch-drag behaviour varying between devices.
map.on('click', (e: L.LeafletMouseEvent) => {
  if (pinPlaces()) movePin(e.latlng);
});

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
  // Not while an update is moving a tree: the pin is on the tree then, and
  // snapping it back to the surveyor would undo the move they are making.
  if (!pinAdjusted && !movingTree) {
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
  // The offered set is a function of where the surveyor is standing.
  renderNearby();
  renderDuplicate();
  const p = currentLatLng();
  $('coords').textContent = p ? `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}` : '—';
}

let duplicate: NearbyTree | null = null;

/**
 * A new tree placed on top of a mapped one is usually the mapped one. Said,
 * not enforced: a hedge or a clump really does put two trees that close.
 */
function renderDuplicate(): void {
  const box = $('dup-warn');
  const p = currentLatLng();
  duplicate = mode === 'new' && p ? likelyDuplicate(p.lat, p.lng, mapped) : null;
  if (!duplicate) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  box.hidden = false;
  box.innerHTML =
    `<span><strong>${escapeHtml(duplicate.tree.common)}</strong> ${escapeHtml(duplicate.tree.id)} ` +
    `is already mapped ${Math.round(duplicate.meters)} m from the pin.</span>` +
    '<span class="tag-meta">If this is that tree, update it rather than adding it again.</span>' +
    '<button type="button" class="inline-btn" id="dup-update">Update it instead</button>';
}

// ---------------------------------------------------------------- tag lookup

/**
 * Fill the species box from what the records say, unless the surveyor has
 * typed something of their own. Resolving the name here means a tagged tree
 * carries a taxon_id too, rather than only untagged ones getting the benefit.
 */
function seedSpecies(name: string, known: SpeciesEntry | undefined): void {
  const input = $<HTMLInputElement>('species');
  if (input.value.trim() && input.dataset.autofilled !== '1') return;
  if (!name) {
    // A tag that matches nothing must not leave the last tag's species behind
    // it. Correcting 763 to 9999 would otherwise record a new tree as a river
    // birch, and the box looks filled in either way.
    input.value = '';
    delete input.dataset.taxonId;
    delete input.dataset.autofilled;
    renderSpeciesNote();
    closeSuggestions();
    return;
  }
  if (known) {
    setTaxon(known, true);
  } else {
    input.value = name;
    delete input.dataset.taxonId;
    input.dataset.autofilled = '1';
    renderSpeciesNote();
  }
  closeSuggestions();
}

/**
 * The record a species correction is measured against, when no tag is in the
 * box: the claimed tree's own entry on the map, or nothing at all.
 *
 * Every path that drops a tag has to come back through here. Emptying the box
 * used to leave the previous tag's lookup in place, and a tree then claimed by
 * position was compared against it — which put a false "SPECIES CHANGED: 2014
 * record for tag (none) says Acer saccharinum" on UVM-1099 in the 24 September
 * export. The tree is a swamp white oak in both records and always was.
 */
function baselineReference(): typeof reference {
  if (!claimed) return { species: '', taxonId: '', source: '' };
  const entry = resolveExact(claimed.tree.sci, species);
  return { species: claimed.tree.sci, taxonId: entry?.id ?? '', source: 'the inventory' };
}

/** A mapped tree as a claim, measured from wherever the surveyor stands. */
function asClaim(tree: MappedTree): NearbyTree {
  const p = currentLatLng();
  if (!p) return { tree, meters: 0, heading: '' };
  return nearbyTrees(p.lat, p.lng, [tree], { radiusM: Infinity })[0]!;
}

/** The mapped tree a typed tag — or an accession read off the map — names. */
const mappedFor = (typed: string): MappedTree | undefined => mappedByTagOrId(typed, mapped);

function renderTagLookup(): void {
  const tag = $<HTMLInputElement>('tag').value.trim();
  const box = $('tag-result');

  if (!tag) {
    box.innerHTML = '';
    box.className = 'tag-result';
    // A tree claimed by its tag stops being claimed when the tag goes.
    if (claimed && claimedBy === 'tag') claim(null);
    reference = baselineReference();
    renderSpeciesChange();
    return;
  }
  // The current inventory first. It holds every tree surveyed in 2023-24, so
  // it knows about the ones planted since 2014.
  const onMap = mappedFor(tag);
  if (onMap) {
    if (mode === 'update') {
      // Typing the tag is the same answer as picking the tree from the list,
      // and gets the same treatment — including keeping its mapped position.
      box.innerHTML = '';
      box.className = 'tag-result';
      if (claimed?.tree.id !== onMap.id) claim(asClaim(onMap), 'tag');
      return;
    }
    box.className = 'tag-result tag-result--miss';
    box.innerHTML =
      `<strong>Tag ${escapeHtml(tag)} is already on the map</strong>` +
      `<span>${escapeHtml(onMap.common)} · ${escapeHtml(onMap.id)}</span>` +
      '<button type="button" class="inline-btn" data-switch-update>Update that record instead</button>';
    return;
  }
  if (claimed && claimedBy === 'tag') claim(null);

  const hit = referenceFile.size ? referenceFile.lookup(tag) : undefined;
  if (hit) {
    const known = resolveExact(hit.botanical, species);
    reference = { species: hit.botanical, taxonId: known?.id ?? '', source: '2014' };
    box.className = 'tag-result tag-result--hit';
    box.innerHTML =
      `<strong>${escapeHtml(hit.botanical)}</strong>` +
      `<span>${escapeHtml(hit.common)}</span>` +
      `<span class="tag-meta">2014: ${escapeHtml(hit.dbh || '—')}″ DBH · ` +
      `${escapeHtml(hit.ageClass || '—')} · ${escapeHtml(hit.condition || '—')}</span>` +
      (mode === 'update'
        ? '<span class="tag-meta">In the 2014 inventory but not on the map, so to the map it is a new tree.</span>' +
          '<button type="button" class="inline-btn" data-switch-new>Add it as a new tree</button>'
        : '');
    seedSpecies(hit.botanical, known);
    renderSpeciesChange();
    return;
  }

  reference = { species: '', taxonId: '', source: '' };
  seedSpecies('', undefined);
  renderSpeciesChange();
  if (mode === 'new') {
    // A tag nobody has on file is what a new tree's tag usually is.
    box.className = 'tag-result tag-result--info';
    box.innerHTML = `<span>Tag ${escapeHtml(tag)} is not in any record — it will be saved with the new tree.</span>`;
    return;
  }
  // Neighbours from both sets of records, because a tag that lost a digit could
  // belong to either. The current inventory goes first and wins a duplicate.
  const near = new Map<string, string>();
  for (const t of mappedNeighbours(tag, mapped)) {
    near.set(String(Number(t.id.replace(/^UVM-/, ''))), t.common);
  }
  for (const t of referenceFile.neighbours(tag)) {
    if (!near.has(t.tag)) near.set(t.tag, t.common);
  }
  box.className = 'tag-result tag-result--miss';
  box.innerHTML =
    `<strong>No tree ${escapeHtml(tag)} on the map.</strong>` +
    (near.size
      ? `<span class="tag-meta">Nearby tags: ${[...near]
          .map(([t, common]) => `<button type="button" class="tag-near" data-tag="${escapeHtml(t)}">${escapeHtml(t)} ${escapeHtml(common)}</button>`)
          .join(' ')}</span>`
      : '<span class="tag-meta">Check the digits, or clear the box and pick the tree from the list.</span>');
}

// ----------------------------------------------------------- nearby trees

const TREES_KEY = 'mapped-trees';

/**
 * The mapped trees, cached first so matching works the moment the app opens and
 * offline, then refreshed in the background — same shape as the species list,
 * and same reason: a surveyor in a field cannot wait on a fetch.
 */
async function initTrees(): Promise<void> {
  const cached = await getMeta<MappedTree[]>(TREES_KEY);
  if (cached?.length) mapped = cached;
  try {
    // Versioned, because the service worker serves same-origin GETs cache-first
    // and a fixed URL would freeze the map at whatever it held on day one.
    const res = await fetch(`${BASE}field/trees.json?v=${__DATA_VERSION__}`);
    if (!res.ok) return;
    const fresh = (await res.json()) as MappedTree[];
    if (Array.isArray(fresh)) {
      mapped = fresh;
      await setMeta(TREES_KEY, fresh);
      renderNearby();
    }
  } catch {
    /* offline, or nothing published yet — the form still works */
  }
}

/**
 * Offer the mapped trees around the surveyor, while there is no tag to go on.
 *
 * Only with the tag box empty: a number read off a trunk is certain, and
 * position is the fallback for when there is no number, not a second opinion
 * about one.
 */
function renderNearby(): void {
  const box = $('nearby');
  const list = $('nearby-list');
  const point = currentLatLng();
  const typed = $<HTMLInputElement>('tag').value.trim() !== '';

  if (claimed) {
    // The chosen tree stays on the map, ringed, so the surveyor can see which
    // one they said it was — and where the map has it, if that is the question.
    box.hidden = true;
    list.innerHTML = '';
    nearbyLayer.clearLayers();
    L.circleMarker([claimed.tree.lat, claimed.tree.lng], {
      radius: 9, color: '#ffffff', weight: 3, fillColor: '#FFD100', fillOpacity: 1,
      bubblingMouseEvents: false, interactive: false,
    }).addTo(nearbyLayer);
    return;
  }
  if (mode === null) return renderStartMap(point);
  if (mode !== 'update' || typed || !point || mapped.length === 0) {
    box.hidden = true;
    list.innerHTML = '';
    nearbyLayer.clearLayers();
    return;
  }

  const hits = nearbyTrees(point.lat, point.lng, mapped);
  if (hits.length === 0) {
    box.hidden = true;
    list.innerHTML = '';
    nearbyLayer.clearLayers();
    return;
  }

  // Rebuilt rather than moved: the set changes as the fix drifts, and which
  // tree holds which colour changes with it. A stale circle in an old colour
  // would point at the wrong box.
  nearbyLayer.clearLayers();
  hits.forEach((hit, i) => {
    L.circleMarker([hit.tree.lat, hit.tree.lng], {
      radius: 7,
      color: '#ffffff',
      weight: 2,
      fillColor: NEARBY_COLOURS[i % NEARBY_COLOURS.length]!,
      fillOpacity: 0.95,
      // Without this the tap also reaches the map underneath, which reads it
      // as "put the pin here": the claimed tree was moved to wherever the
      // finger landed and marked as positioned on imagery, when a claim must
      // never move a tree.
      bubblingMouseEvents: false,
    })
      // Tapping the circle claims the tree, exactly as tapping its box does.
      // Standing under a tree and pointing at it on the map is the more
      // natural gesture of the two.
      .on('click', () => claim(hit))
      .addTo(nearbyLayer);
  });

  list.innerHTML = hits
    .map((hit, i) => `<li>
      <button type="button" class="nearby-opt" data-nearby="${i}">
        <span class="nearby-dot" style="background:${NEARBY_COLOURS[i % NEARBY_COLOURS.length]}"></span>
        <span class="nearby-dist">${escapeHtml(describeDistance(hit))}</span>
        <span class="nearby-name">${escapeHtml(hit.tree.common)}
          <span class="nearby-sci">${escapeHtml(hit.tree.sci)}</span></span>
        ${hit.tree.surveyed
          ? `<span class="nearby-seen">Already surveyed ${escapeHtml(hit.tree.surveyed)} — claiming it records another visit</span>`
          : ''}
      </button>
    </li>`)
    .join('');
  box.hidden = false;
  // Stashed so a tap looks up what was on screen, rather than recomputing
  // against a fix that may have moved between the render and the finger.
  offered = hits;
}

/**
 * How far the opening map looks. Wider than the pick list, because its job is
 * to answer "is this tree on the map at all?" — and a tree whose mapped
 * position is 30 m off is still on the map.
 */
const START_RADIUS_M = 40;

/**
 * The opening screen: every mapped tree around the surveyor, before they say
 * whether they are adding or updating, so the answer is something they can
 * see rather than guess. Tapping one is the answer — it opens that tree in an
 * update.
 */
function renderStartMap(point: { lat: number; lng: number } | null): void {
  $('nearby').hidden = true;
  $('nearby-list').innerHTML = '';
  nearbyLayer.clearLayers();
  const note = $('start-note');
  if (!point) {
    note.textContent = 'Waiting for your location to show the mapped trees around you…';
    return;
  }
  if (mapped.length === 0) {
    note.textContent = 'The mapped trees have not loaded yet.';
    return;
  }
  const hits = nearbyTrees(point.lat, point.lng, mapped, { radiusM: START_RADIUS_M, limit: Infinity });
  // The nearest keep the colours the update list will give them, so a dot
  // seen here is the same colour in the next step.
  hits.forEach((hit, i) => {
    const colour = i < NEARBY_COLOURS.length ? NEARBY_COLOURS[i]! : '#ffffff';
    L.circleMarker([hit.tree.lat, hit.tree.lng], {
      radius: 7,
      color: i < NEARBY_COLOURS.length ? '#ffffff' : '#101820',
      weight: 2,
      fillColor: colour,
      fillOpacity: 0.95,
      bubblingMouseEvents: false,
    })
      .bindTooltip(`${hit.tree.common} · ${hit.tree.id}`, { direction: 'top', offset: [0, -6] })
      .on('click', () => {
        setMode('update');
        claim(hit);
      })
      .addTo(nearbyLayer);
  });
  const within = `within ${START_RADIUS_M} m of you`;
  note.textContent = hits.length === 0
    ? `No mapped trees ${within}. The tree in front of you is almost certainly a new one.`
    : `${hits.length === 1 ? 'One mapped tree' : `${hits.length} mapped trees`} ${within}. ` +
      'If the tree in front of you is one of them, tap its dot to update it. ' +
      'If it has no dot, it is a new tree.';
}

function renderClaimed(): void {
  const box = $('claimed');
  if (!claimed) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  const t = claimed.tree;
  box.hidden = false;
  box.innerHTML =
    `<span>Updating <strong>${escapeHtml(t.common)}</strong> ${escapeHtml(t.id)}` +
    (t.tag ? ` · tag ${escapeHtml(t.tag)}` : ' · no tag') +
    (claimedBy === 'position' ? ` · ${escapeHtml(describeDistance(claimed))} when you picked it` : '') +
    `<br><span class="tag-meta">${t.surveyed ? `Last surveyed ${escapeHtml(t.surveyed)}` : 'Never surveyed since it was mapped'}</span></span>` +
    '<button type="button" id="claim-clear">Not this tree</button>';
}

function claim(hit: NearbyTree | null, by: 'tag' | 'position' = 'position'): void {
  const wasTag = claimed !== null && claimedBy === 'tag';
  claimed = hit;
  claimedBy = by;
  setMovingTree(false);
  if (hit) {
    // Seed the species from the map's record; the surveyor can still correct
    // it, and correcting it is the point of visiting.
    const entry = resolveExact(hit.tree.sci, species);
    if (entry) setTaxon(entry, true);
    // What the plaque says, as far as the map knows, so it is checked rather
    // than typed again — and so a tree without one can be given one.
    prefilledDedication = hit.tree.dedication ?? '';
    const box = $<HTMLTextAreaElement>('dedication');
    if (prefilledDedication) {
      setHasPlaque(true, false);
      box.value = prefilledDedication;
    } else if (!box.value.trim()) {
      setHasPlaque(false);
    }
    map.setView([hit.tree.lat, hit.tree.lng], Math.max(map.getZoom(), 19));
  } else {
    // Undo only what the claim put there, never what the surveyor typed.
    if (wasTag) $<HTMLInputElement>('tag').value = '';
    if ($<HTMLTextAreaElement>('dedication').value === prefilledDedication) setHasPlaque(false);
    prefilledDedication = '';
    // Only a species the claim filled in; one the surveyor typed stays.
    if ($<HTMLInputElement>('species').dataset.autofilled === '1') {
      $<HTMLInputElement>('species').value = '';
      setTaxon(undefined, false);
    }
    if (wasTag) renderTagLookup();
  }
  // Claiming a tree says which record this visit belongs to, so it also says
  // what a correction would be a correction *of*. Taking that from the claim
  // rather than from whatever was looked up last is the whole fix.
  reference = baselineReference();
  renderClaimed();
  renderNearby();
  renderSpeciesChange();
  renderPlaqueOnRecord();
  renderMode();
}

// ------------------------------------------------------------------- modes

const FOOT = ['update-wait', 'form-error', 'save', 'save-foot'];

function setMode(next: Mode | null): void {
  if (next === mode) return;
  mode = next;
  // A claim, a tag and an absence all belong to one kind of visit. Carried
  // into the other they would say something the surveyor did not.
  if (claimed) claim(null);
  hasTag = null;
  renderHasTag();
  $<HTMLInputElement>('tag').value = '';
  for (const b of $('status-seg').querySelectorAll('[aria-checked]')) {
    b.setAttribute('aria-checked', String(b.getAttribute('data-status') === 'active'));
  }
  applyStatus();
  if (next === 'update') {
    // The pin marks the surveyor again, not a tree they placed for a new one.
    pinAdjusted = false;
    manualLatLng = null;
    const fix = gps.bestFix;
    if (fix) pin.setLatLng([fix.lat, fix.lng]);
  }
  renderMode();
  renderTagLookup();
  renderCoords();
}

function renderMode(): void {
  if (mode) document.body.dataset.mode = mode;
  else delete document.body.dataset.mode;
  for (const b of $('mode-seg').querySelectorAll('[data-mode]')) {
    b.setAttribute('aria-checked', String(b.getAttribute('data-mode') === mode));
  }
  const main = $('screen-form');
  const order = mode ? CARDS[mode] : [];
  for (const id of order) main.appendChild($(id));
  for (const id of FOOT) main.appendChild($(id));
  // An update shows nothing past the map until it knows which tree: every
  // answer after that is an answer about one particular tree.
  const waiting = mode === 'update' && !claimed;
  // Before a choice, the map is shown under the question: whether the tree is
  // already mapped is exactly what decides the answer.
  if (!mode) main.appendChild($('card-position'));
  const shown = new Set(visibleCards(mode, claimed !== null));
  for (const id of ALL_CARDS) $(id).hidden = !shown.has(id);
  $('update-wait').hidden = !waiting;
  for (const id of ['save', 'save-foot']) $(id).hidden = !mode || waiting;
  if (!mode) $('form-error').hidden = true;

  // In a new tree the tag box waits on "yes"; in an update it is always there.
  $('tag-row').hidden = mode === 'new' ? hasTag !== true : claimed !== null && claimedBy === 'position';
  $<HTMLInputElement>('tag').disabled = mode === 'update' && claimed !== null && claimedBy === 'position';
  $('move-tree').hidden = !(mode === 'update' && claimed);
  $('pin-hint-update').textContent = claimed
    ? movingTree
      ? 'Tap the map or drag the pin to where the tree really stands. That position replaces the mapped one.'
      : 'The gold dot is where the map has this tree. Its position is kept unless you say it is wrong.'
    : 'The blue ring is you. Tap a coloured dot, or its line in the list, to pick that tree.';
  if (pin.dragging) {
    if (pinPlaces()) pin.dragging.enable();
    else pin.dragging.disable();
  }
  setTimeout(() => map.invalidateSize(), 50);
}

function renderHasTag(): void {
  for (const b of $('has-tag-seg').querySelectorAll('[data-has-tag]')) {
    const v = b.getAttribute('data-has-tag') === 'yes';
    b.setAttribute('aria-checked', String(hasTag === v));
  }
}

/**
 * Update only. Saying the map is wrong is a deliberate act, so it is a button:
 * the pin jumps to the mapped position and can then be moved. Taking it back
 * restores the mapped position exactly.
 */
function setMovingTree(on: boolean): void {
  movingTree = on;
  const btn = $('move-tree');
  btn.textContent = on ? 'Keep the mapped position' : 'Its mapped position is wrong';
  btn.classList.toggle('is-on', on);
  if (on && claimed) {
    pin.setLatLng([claimed.tree.lat, claimed.tree.lng]);
  } else if (!on && mode === 'update') {
    pinAdjusted = false;
    manualLatLng = null;
    const fix = gps.bestFix;
    if (fix) pin.setLatLng([fix.lat, fix.lng]);
  }
  if (mode) renderMode();
}

// ------------------------------------------------------- species autocomplete

const SPECIES_KEY = 'species-list';

/**
 * The species list, from the cache first so the form is usable the instant the
 * app opens and offline, then refreshed from the server in the background.
 *
 * The other way round would make a surveyor stand in a field waiting on a
 * fetch that is not going to complete.
 */
async function initSpecies(): Promise<void> {
  const cached = await getMeta<SpeciesEntry[]>(SPECIES_KEY);
  if (cached?.length) species = cached;

  try {
    // Versioned because the service worker serves same-origin GETs from its
    // cache first: at a fixed URL the first list a phone ever fetched would be
    // the only list it ever saw, however many species were added since.
    const res = await fetch(`${BASE}field/species.json?v=${__DATA_VERSION__}`);
    if (!res.ok) return;
    const fresh = (await res.json()) as SpeciesEntry[];
    if (Array.isArray(fresh) && fresh.length) {
      species = fresh;
      await setMeta(SPECIES_KEY, fresh);
    }
  } catch {
    /* offline, or no list published yet — typing the name still works */
  }
}

/** The taxon the surveyor actually picked, or '' if they typed free text. */
const pickedTaxon = (): string => $<HTMLInputElement>('species').dataset.taxonId ?? '';

function setTaxon(entry: SpeciesEntry | undefined, autofilled: boolean): void {
  const input = $<HTMLInputElement>('species');
  if (entry) {
    input.value = entry.sci;
    input.dataset.taxonId = entry.id;
  } else {
    delete input.dataset.taxonId;
  }
  input.dataset.autofilled = autofilled ? '1' : '';
  renderSpeciesNote();
}

/**
 * Says whether the name in the box is one the desk will recognise. A surveyor
 * cannot be expected to know what taxa.csv contains, and finding out in October
 * that a name did not resolve is finding out far too late.
 */
function renderSpeciesNote(): void {
  renderSpeciesChange();
  const note = $('species-note');
  const typed = $<HTMLInputElement>('species').value.trim();
  const id = pickedTaxon();

  if (id) {
    const entry = species.find((e) => e.id === id);
    note.className = 'hint species-note species-note--set';
    note.textContent = entry ? `On the list as ${entry.common}.` : 'On the list.';
  } else if (!typed || species.length === 0) {
    note.className = 'hint species-note';
    note.textContent = '';
  } else if (matchExact(typed, species).length > 1) {
    // Two taxa share this name. Only the surveyor, standing under the tree,
    // can say which — so say so rather than picking one of them.
    note.className = 'hint species-note species-note--new';
    note.textContent = 'More than one species goes by that name — pick one from the list.';
  } else if (suggestions.length > 0) {
    // Still mid-word, with matches on screen. Warning that a half-typed name is
    // unknown, directly above a list containing it, is noise.
    note.className = 'hint species-note';
    note.textContent = '';
  } else {
    // Not an error. A tree nobody has recorded before is the most interesting
    // thing a surveyor can find, and it saves exactly as it is typed.
    note.className = 'hint species-note species-note--new';
    note.textContent = 'Not on the species list — saved as typed, and flagged for review.';
  }
}

/**
 * Says so when the recorded species disagrees with the 2014 record, instead of
 * asking the surveyor to declare it. Nothing to click: correcting an
 * eleven-year-old identification is the work, not a mistake to confirm.
 */
function renderSpeciesChange(): void {
  const box = $('species-changed');
  const recorded = $<HTMLInputElement>('species').value.trim();
  if (!speciesChanged(reference.species, reference.taxonId, recorded, pickedTaxon())) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  // Name the tree the way the surveyor identified it. "This tag" was wrong
  // whenever they had claimed one by position, which is most of the untagged
  // campus — and a sentence that describes the wrong thing is not a warning.
  const tag = $<HTMLInputElement>('tag').value.trim();
  const subject = tag ? `tag ${tag}` : claimed ? claimed.tree.id : 'this tree';
  // "Ulmus sp." already ends in a stop; a second one reads as a typo.
  const stop = /\.$/.test(reference.species) ? '' : '.';
  box.hidden = false;
  box.innerHTML =
    `${escapeHtml(reference.source === '2014' ? 'The 2014 file records' : 'The inventory records')} ` +
    `${escapeHtml(subject)} as <strong>${escapeHtml(reference.species)}</strong>${stop} ` +
    `You have recorded <strong>${escapeHtml(recorded)}</strong>, ` +
    'which is saved as a correction.';
}

function closeSuggestions(): void {
  suggestions = [];
  highlighted = -1;
  const list = $('species-list');
  list.hidden = true;
  list.innerHTML = '';
  $('species').setAttribute('aria-expanded', 'false');
  renderSpeciesNote();
}

function renderSuggestions(): void {
  const list = $('species-list');
  if (suggestions.length === 0) return closeSuggestions();

  list.innerHTML = suggestions
    .map(({ entry }, i) => {
      // The count is the only thing on screen that says "this one is all over
      // campus" — worth the room it takes, and omitted at zero rather than
      // printing "0 mapped" against every tree before the first survey lands.
      const count = entry.n > 0 ? `<span class="combo-count">${entry.n} mapped</span>` : '';
      return `<li role="presentation">
        <button type="button" class="combo-opt" role="option" data-index="${i}"
                aria-selected="${i === highlighted}">
          <span class="combo-common">${escapeHtml(entry.common)}</span>
          <span class="combo-sci">${escapeHtml(entry.sci)}</span>
          ${count}
        </button>
      </li>`;
    })
    .join('');
  list.hidden = false;
  $('species').setAttribute('aria-expanded', 'true');
}

function renderSpeciesSearch(): void {
  const input = $<HTMLInputElement>('species');
  // Typing after picking means the pick no longer describes what is in the box.
  delete input.dataset.taxonId;
  // ...unless what is in the box is itself a name on the list. Someone who
  // spells a species correctly should not have to tap a suggestion to confirm
  // it, and must certainly not be told it is unknown.
  const exact = resolveExact(input.value, species);
  if (exact) input.dataset.taxonId = exact.id;
  suggestions = searchSpecies(input.value, species, MAX_SUGGESTIONS);
  highlighted = -1;
  renderSuggestions();
  renderSpeciesNote();
}

function highlight(delta: number): void {
  if (suggestions.length === 0) return;
  highlighted = (highlighted + delta + suggestions.length) % suggestions.length;
  renderSuggestions();
  $('species-list').querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
}

function accept(index: number): void {
  const hit = suggestions[index];
  if (!hit) return;
  setTaxon(hit.entry, false);
  closeSuggestions();
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

function renderStatuses(): void {
  $('status-seg').innerHTML = STATUSES.map(
    (v) => `<button type="button" class="seg-btn" role="radio" aria-checked="${v === 'active'}" data-status="${v}">${STATUS_LABELS[v]}</button>`,
  ).join('');
}

function selectedStatus(): string {
  return $('status-seg').querySelector('[aria-checked="true"]')?.getAttribute('data-status') ?? 'active';
}

/**
 * An absent tree has nothing to measure and no condition — "dead" would say a
 * trunk is standing. The inputs are disabled rather than hidden so the reason
 * stays visible, and cleared so a number typed before the surveyor realised
 * the tree was gone cannot be exported as a measurement of nothing.
 *
 * The photo stays available on purpose: a picture of the empty ground is the
 * evidence, and is the only thing that makes the record checkable later.
 */
function applyStatus(): void {
  const gone = absent(selectedStatus());
  $('measurements-card').classList.toggle('is-void', gone);
  for (const id of ['dbh', 'height', 'spread']) {
    const el = $<HTMLInputElement>(id);
    el.disabled = gone;
    if (gone) el.value = '';
  }
  for (const b of $('condition-seg').querySelectorAll<HTMLButtonElement>('[aria-checked]')) {
    b.disabled = gone;
    if (gone) b.setAttribute('aria-checked', 'false');
  }
}

function resetForm(): void {
  for (const id of ['tag', 'species', 'dbh', 'height', 'spread', 'notes', 'planted']) {
    $<HTMLInputElement>(id).value = '';
  }
  setPlantedUnknown(false);
  setHasPlaque(false);
  reference = { species: '', taxonId: '', source: '' };
  claimed = null;
  prefilledDedication = '';
  movingTree = false;
  renderClaimed();
  setTaxon(undefined, false);
  closeSuggestions();
  for (const b of $('condition-seg').querySelectorAll('[aria-checked]')) {
    b.setAttribute('aria-checked', 'false');
  }
  for (const b of $('status-seg').querySelectorAll('[aria-checked]')) {
    b.setAttribute('aria-checked', String(b.getAttribute('data-status') === 'active'));
  }
  applyStatus();
  clearPhoto();
  $('tag-result').innerHTML = '';
  $('form-error').hidden = true;
  pinAdjusted = false;
  manualLatLng = null;
  gps.reset();
  renderCoords();
  refreshDate();
  setMode(null);
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
  const speciesName = $<HTMLInputElement>('species').value.trim();
  const point = currentLatLng();
  const fix = gps.bestFix;

  // An absent tree is a statement about a record that already exists, so it
  // needs to say which one — "nothing here" is meaningless without a tree it
  // is denying. It does not need a species: nobody can identify what is not
  // there, and the claimed record already carries one.
  const typedTag = $<HTMLInputElement>('tag').value.trim();
  if (mode === 'update' && !claimed) {
    return fail('Say which tree this is first. Type its tag, or pick it from the mapped trees near you.');
  }
  if (mode === 'new') {
    if (hasTag === null) return fail('Say whether the tree has a metal tag.');
    if (hasTag && !typedTag) return fail('Type the tag number, or answer No if it has none.');
    const onMap = hasTag ? mappedFor(typedTag) : undefined;
    if (onMap) {
      return fail(`Tag ${typedTag} is already on the map as ${onMap.id}. Update that record instead of adding it again.`);
    }
  }
  // An absent tree needs no species: nobody can identify what is not there,
  // and the claimed record already carries one.
  const status = mode === 'update' ? selectedStatus() : 'active';
  if (!absent(status) && !speciesName) return fail('Enter a species before saving.');

  const plantedRaw = $<HTMLInputElement>('planted').value.trim();
  if (!plantedUnknown && plantedRaw !== '') {
    const year = Number(plantedRaw);
    const thisYear = new Date().getFullYear();
    if (!/^\d{4}$/.test(plantedRaw) || year < 1700 || year > thisYear) {
      return fail(`"${plantedRaw}" is not a planting year. Enter four digits between 1700 and ${thisYear}, or press Unknown.`);
    }
  }
  // With no separate flag column, a ticked box and an empty field would save
  // nothing at all — the surveyor's finding would vanish between the phone and
  // the CSV. Even "plaque present, wording illegible" survives; a tick does not.
  if (hasPlaque && !$<HTMLTextAreaElement>('dedication').value.trim()) {
    return fail(
      'Type what the plaque says — even "plaque present, wording illegible" is worth ' +
      'recording. Or untick the box if there is no plaque.',
    );
  }
  // A mapped tree keeps its mapped position unless the surveyor moved it, so
  // an update needs no fix at all — only a new or moved tree does.
  const keepsMapped = mode === 'update' && !pinAdjusted;
  if (!point && !keepsMapped) return fail('No position yet. Wait for a fix, or drag the pin onto the tree.');
  if (!keepsMapped && !pinAdjusted && fix && fix.accuracy > ACCURACY_WARN_M) {
    return fail(
      `The GPS fix is only ±${fix.accuracy.toFixed(0)} m, which will put this tree in the wrong place. ` +
      'Wait for it to improve, or drag the pin onto the tree to override.',
    );
  }

  if (photoBlob) {
    // The extension has to follow what the encoder actually produced, not what
    // it was asked for: a device that cannot write WebP hands back a JPEG.
    const stem = (mode === 'new' ? typedTag : claimed?.tree.tag || claimed?.tree.id) || 'untagged';
    photoName = `${stem}-${Date.now()}.${extensionFor(photoBlob)}`;
    await savePhoto(photoName, photoBlob);
  }

  const num = (id: string): number | null => {
    const v = $<HTMLInputElement>(id).value.trim();
    return v === '' ? null : Number(v);
  };

  // Where the record sits: the surveyor's fix for a new or moved tree, and
  // for an update without a fix, the mapped position the exporter keeps anyway.
  const at = point ?? { lat: claimed!.tree.lat, lng: claimed!.tree.lng };

  await saveRecord({
    // The number on the trunk. For an update that is the tree's own tag from
    // the map — an accession typed into the box is carried by claimedPlantId.
    tag: mode === 'new' ? (hasTag ? typedTag : '') : (claimed?.tree.tag ?? ''),
    species: speciesName,
    taxonId: pickedTaxon(),
    referenceSpecies: reference.species,
    referenceTaxonId: reference.taxonId,
    referenceSource: reference.source,
    claimedPlantId: claimed?.tree.id ?? '',
    claimedMeters: claimed && point ? Math.round(claimed.meters) : null,
    claimedLat: claimed?.tree.lat ?? null,
    claimedLng: claimed?.tree.lng ?? null,
    lat: at.lat,
    lng: at.lng,
    accuracy: pinAdjusted || !point ? null : (fix?.accuracy ?? null),
    pinAdjusted,
    dbhIn: num('dbh'),
    heightFt: num('height'),
    spreadFt: num('spread'),
    status,
    condition: selectedCondition(),
    plantedYear: plantedUnknown ? null : num('planted'),
    plantedUnknown,
    notes: $<HTMLTextAreaElement>('notes').value.trim(),
    dedication: $<HTMLTextAreaElement>('dedication').value.trim(),
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
          <span class="rec-tag">${escapeHtml(r.claimedPlantId ? `${r.claimedPlantId} · update` : r.tag ? `tag ${r.tag} · new` : 'new · no tag')}</span>
          <span class="rec-species">${escapeHtml(r.species)}</span>
          <span class="rec-meta">${r.dbhIn ? `${r.dbhIn}″ · ` : ''}${escapeHtml(r.condition || '—')}${r.plantedYear ? ` · ${r.plantedYear}` : r.plantedUnknown ? ' · year unknown' : ''}${r.photoName ? ' · photo' : ''}${r.dedication ? ' · plaque' : ''}${speciesChanged(r.referenceSpecies, r.referenceTaxonId, r.species, r.taxonId) ? ' · species changed' : ''}</span>
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
  referenceFile.load(trees);
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
renderStatuses();
applyStatus();
renderMode();
// The date defaults to today, and keeps defaulting to today. An installed app
// is not reloaded when the phone brings it back, so setting it once at load
// left a phone opened on 23 September filing a 25 September survey under the
// 23rd. It is refreshed whenever the app comes back to the screen and after
// every save — unless the surveyor has typed a date, which is then theirs.
let dateTouched = false;
function refreshDate(): void {
  if (!dateTouched) $<HTMLInputElement>('date').value = stamp();
}
refreshDate();
$('date').addEventListener('input', () => { dateTouched = true; });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshDate();
});

$('tag').addEventListener('input', () => {
  renderTagLookup();
  renderNearby();
});
$('tag-result').addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-tag]');
  if (!btn) return;
  $<HTMLInputElement>('tag').value = btn.dataset.tag!;
  $<HTMLInputElement>('species').dataset.autofilled = '1';
  renderTagLookup();
});
$('species').addEventListener('input', renderSpeciesSearch);
$('species').addEventListener('focus', renderSpeciesSearch);
$('species').addEventListener('keydown', (e) => {
  const key = (e as KeyboardEvent).key;
  if (key === 'ArrowDown' || key === 'ArrowUp') {
    e.preventDefault();
    highlight(key === 'ArrowDown' ? 1 : -1);
  } else if (key === 'Enter') {
    // Enter with nothing highlighted keeps whatever was typed, which is what
    // somebody entering a species the list has never heard of needs it to do.
    if (highlighted >= 0) e.preventDefault();
    accept(highlighted);
    closeSuggestions();
  } else if (key === 'Escape') {
    closeSuggestions();
  }
});
$('species-list').addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-index]');
  if (btn) accept(Number(btn.dataset.index));
});
// A tap outside dismisses the list. Bound on pointerdown rather than click so
// it fires before the keyboard closing shifts the layout under the finger.
document.addEventListener('pointerdown', (e) => {
  if (!(e.target as HTMLElement).closest('.combo')) closeSuggestions();
});

$('nearby-list').addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-nearby]');
  if (btn) claim(offered[Number(btn.dataset.nearby)] ?? null);
});
// Saying no is a first-class answer, not a fallthrough. Without it the flow
// assumes the tree must be one of the offered ones, and a wrong claim merges
// two trees into one — the error that is genuinely hard to undo later.
$('nearby-none').addEventListener('click', () => {
  setMode('new');
  $('card-tag').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
$('mode-seg').addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-mode]');
  if (btn) setMode(btn.dataset.mode as Mode);
});
$('has-tag-seg').addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-has-tag]');
  if (!btn) return;
  hasTag = btn.dataset.hasTag === 'yes';
  if (!hasTag) $<HTMLInputElement>('tag').value = '';
  renderHasTag();
  renderMode();
  renderTagLookup();
  if (hasTag) $('tag').focus();
});
// "Update that record instead" and "Add it as a new tree": the surveyor chose
// the wrong door, and the app can see which one they meant.
$('tag-result').addEventListener('click', (e) => {
  const el = e.target as HTMLElement;
  const tag = $<HTMLInputElement>('tag').value.trim();
  if (el.closest('[data-switch-update]')) {
    const tree = mappedFor(tag);
    setMode('update');
    if (tree) {
      $<HTMLInputElement>('tag').value = tag;
      claim(asClaim(tree), 'tag');
    }
  } else if (el.closest('[data-switch-new]')) {
    setMode('new');
    hasTag = true;
    renderHasTag();
    $<HTMLInputElement>('tag').value = tag;
    renderMode();
    renderTagLookup();
  }
});
$('dup-warn').addEventListener('click', (e) => {
  if (!(e.target as HTMLElement).closest('#dup-update') || !duplicate) return;
  const hit = duplicate;
  setMode('update');
  claim(hit);
});
$('move-tree').addEventListener('click', () => setMovingTree(!movingTree));
$('claimed').addEventListener('click', (e) => {
  if ((e.target as HTMLElement).id === 'claim-clear') claim(null);
});

$('condition-seg').addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-condition]');
  if (!btn) return;
  for (const b of $('condition-seg').querySelectorAll('[aria-checked]')) {
    b.setAttribute('aria-checked', String(b === btn));
  }
});

$('status-seg').addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-status]');
  if (!btn) return;
  for (const b of $('status-seg').querySelectorAll('[aria-checked]')) {
    b.setAttribute('aria-checked', String(b === btn));
  }
  applyStatus();
});

/**
 * The tickbox only decides whether the field is on screen: nothing about it is
 * stored, because a tree is dedicated exactly when somebody wrote down what its
 * plaque says. Unticking clears the text, so a box left off cannot quietly
 * export wording typed before it was turned off.
 */
function setHasPlaque(on: boolean, focus = true): void {
  hasPlaque = on;
  $<HTMLInputElement>('has-plaque').checked = on;
  $('plaque-fields').hidden = !on;
  if (!on) $<HTMLTextAreaElement>('dedication').value = '';
  else if (focus) $('dedication').focus();
  renderPlaqueOnRecord();
}

/**
 * Says what the map already holds, so a plaque on record is confirmed rather
 * than retyped — and so nobody reads an empty box as "no dedication on file".
 */
function renderPlaqueOnRecord(): void {
  const note = $('plaque-on-record');
  note.hidden = !(mode === 'update' && claimed);
  note.textContent = prefilledDedication
    ? 'On record — check it against the plaque and correct it if it differs.'
    : 'No dedication on record for this tree.';
}

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

$('has-plaque').addEventListener('change', () => {
  setHasPlaque($<HTMLInputElement>('has-plaque').checked);
});

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
void initSpecies();
void initTrees();
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
  __field: {
    getPhoto, allRecords, currentLatLng,
    isPinAdjusted: () => pinAdjusted,
    speciesCount: () => species.length,
    treeCount: () => mapped.length,
    claimedId: () => claimed?.tree.id ?? '',
    mode: () => mode,
    pickedTaxon,
  },
});

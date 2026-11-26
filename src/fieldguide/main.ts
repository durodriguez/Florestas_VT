/**
 * The field guide (/fieldguide/): the campus's trees for someone standing
 * among them. The explorer at / is the whole collection, searched and
 * filtered; this opens on the trees around the visitor, in this month's
 * colors, on the walking tours, and on a page for each tree. Same data, same
 * rules (season.ts, notable.ts, measured.ts); only the way in differs. See
 * docs/FIELDGUIDE.md.
 *
 * The address says what is open, so the phone's back button and a shared
 * link both work: ?plant=UVM-0058 for a tree's page, ?tour=<id>&stop=3 for a
 * tour, and both at once for a tree's page opened from a tour.
 */

import 'leaflet/dist/leaflet.css';
import './styles.css';

import L from 'leaflet';
import { loadData } from '../data';
import { basemaps } from '../basemaps';
import { notableFacts } from '../notable';
import { isPale, MONTH_NAMES, SEASON_LABELS, season, summarizeSeason } from '../season';
import { dotScale } from '../tree-display';
import { photoTaken, photoUrl } from '../photos';
import { whenText } from '../measured';
import { distanceMeters } from '../geo';
import { aroundYou, type Pick } from './picks';
import { yearSummary, yearTable } from './year';
import { tilesFor } from './tiles';
import { ORIGIN_LABELS } from '../palette';
import { neighbours, othersOfItsKind, step, stepText } from './walk';
import { initSheetSplit } from './sheet-split';
import type { Dataset, Plant, Tour } from '../types';

const BASE = import.meta.env.BASE_URL;
const MONTH = new Date().getMonth() + 1;
/** Where the guide looks when it cannot see the visitor: the University Green. */
const GREEN = { lat: 44.4782, lng: -73.1993 };
/** Farther than this from the campus, the visitor is not among these trees. */
const AWAY_M = 3000;
/** Closer than this to the first stop, there is no point offering to walk the tour in reverse. */
const NEAR_START_M = 150;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

let dataset: Dataset;
let plants: Plant[] = [];
let byId = new Map<string, Plant>();
let tours: Tour[] = [];
let here = GREEN;
let located = false;
/** A spot picked by tapping the map: "Around you" then shows the trees around it instead. */
let spot: { lat: number; lng: number } | null = null;
let lastPicksAt: { lat: number; lng: number } | null = null;
/** The tour being walked, the stop the visitor is on (0-based), and which way: 1 forward, -1 in reverse. */
let walking: { tour: Tour; stops: Plant[]; index: number; dir: 1 | -1 } | null = null;
/** The tree whose page is open. */
let reading: Plant | null = null;
let kinMap: L.Map | null = null;

const map = L.map($('fg-map'), { zoomControl: false, center: [GREEN.lat, GREEN.lng], zoom: 18, maxZoom: 21 });
const layers = basemaps(21);
layers.Streets!.addTo(map);
L.control.layers({ Streets: layers.Streets!, Satellite: layers.Satellite! }, {}, { position: 'topright' }).addTo(map);
// The map's credits: bottom right on a desktop, where nothing covers them;
// on a phone the sheet fills the bottom, so top left, above the month.
const wideScreen = window.matchMedia('(min-width: 48rem)');
const placeCredits = () => map.attributionControl.setPosition(wideScreen.matches ? 'bottomright' : 'topleft');
placeCredits();
wideScreen.addEventListener('change', placeCredits);
const coarse = window.matchMedia('(pointer: coarse)').matches;
const renderer = L.canvas({ padding: 0.3, tolerance: coarse ? 8 : 3 });
const treeLayer = L.layerGroup().addTo(map);
const pickLayer = L.layerGroup().addTo(map);
const tourLayer = L.layerGroup().addTo(map);
const starLayer = L.layerGroup().addTo(map);
const youLayer = L.layerGroup().addTo(map);
map.createPane('stars').style.zIndex = '620';
map.createPane('tour').style.zIndex = '640';
const dots = new Map<L.CircleMarker, number>();

/** Bigger trunks, bigger dots; shrunk when zoomed out (tree-display.ts). */
function baseRadius(p: Plant): number {
  if (p.taxon.type !== 'deciduous-tree' && p.taxon.type !== 'evergreen-tree') return 5;
  const d = p.dbhIn ?? 0;
  return d >= 30 ? 10 : d >= 18 ? 8 : d >= 8 ? 6.5 : 5.5;
}

function drawTrees(): void {
  const { scale, weight } = dotScale('every', map.getZoom());
  const standing = plants.filter((p) => p.status === 'active').sort((a, b) => baseRadius(b) - baseRadius(a));
  for (const p of standing) {
    const color = season(p.taxon, MONTH).color;
    const dot = L.circleMarker([p.lat, p.lng], {
      renderer, radius: baseRadius(p) * scale, weight, color: isPale(color) ? '#6b716c' : '#ffffff',
      fillColor: color, fillOpacity: 0.92, bubblingMouseEvents: false,
    }).bindTooltip(esc(p.taxon.common), { direction: 'top', offset: [0, -6] })
      .on('click', () => openTree(p));
    dots.set(dot, baseRadius(p));
    dot.addTo(treeLayer);
  }
}
map.on('zoomend', () => {
  const { scale, weight } = dotScale('every', map.getZoom());
  for (const [dot, r] of dots) dot.setStyle({ radius: r * scale, weight });
});

/**
 * A star on every standing tree with a notable note (notable.ts): the
 * largest trunks measured on campus, the largest of a species, the only one
 * of its kind. Above the dots, so a tap finds the star; a pick "Around you"
 * gets its gold ring around the star.
 */
const STAR = '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="#fff" d="M12 2.6l2.8 6 6.5.7-4.9 4.4 1.4 6.4L12 16.8l-5.8 3.3 1.4-6.4-4.9-4.4 6.5-.7z"/></svg>';
function drawStars(): void {
  for (const p of plants) {
    if (p.status !== 'active' || !p.notable?.length) continue;
    L.marker([p.lat, p.lng], {
      pane: 'stars', keyboard: false, title: `${p.taxon.common}: ${p.notable[0]}`,
      icon: L.divIcon({ className: 'fg-star', html: STAR, iconSize: [22, 22], iconAnchor: [11, 11] }),
    }).on('click', () => openTree(p)).addTo(starLayer);
  }
}
// Smaller stars zoomed out, where they would otherwise cover their neighbors.
map.on('zoomend', () => $('fg-map').classList.toggle('fg-far', map.getZoom() < 17));

/** Faded under a tour, so its numbered stops stand out; full strength otherwise. */
function fadeTrees(faded: boolean): void {
  for (const dot of dots.keys()) dot.setStyle({ fillOpacity: faded ? 0.4 : 0.92, opacity: faded ? 0.4 : 1 });
  $('fg-map').classList.toggle('fg-touring', faded);
}

function drawOutline(): void {
  const outline = dataset.campusAreas.features.filter((f) => f.properties.kind === 'boundary');
  L.geoJSON({ type: 'FeatureCollection', features: outline } as GeoJSON.FeatureCollection, {
    interactive: false, style: { color: '#154734', weight: 2.5, opacity: 0.7, fill: false },
  }).addTo(map);
}

function renderSeasonChip(): void {
  const s = summarizeSeason(plants.filter((p) => p.status === 'active'), MONTH);
  const parts = (['flower', 'fruit', 'fall'] as const).filter((k) => s.counts[k] > 0)
    .map((k) => `${s.counts[k].toLocaleString()} ${SEASON_LABELS[k].toLowerCase()}`);
  const chip = $('fg-season');
  chip.textContent = [MONTH_NAMES[MONTH - 1], ...parts].join(' · ');
  chip.hidden = false;
}

/** The part of the map the sheet leaves in view: above it on a phone, beside it on a desktop. */
function sheetCover(): { bottom: number; left: number } {
  const m = $('fg-map').getBoundingClientRect();
  const s = $('fg-sheet').getBoundingClientRect();
  const wide = s.width >= m.width - 2;
  return wide ? { bottom: Math.max(0, m.bottom - s.top), left: 0 } : { bottom: 0, left: Math.max(0, s.right - m.left) };
}

/** Centre a point in the part of the map the sheet leaves in view. */
function showPoint(at: { lat: number; lng: number }, zoom: number): void {
  const c = sheetCover();
  const shift: [number, number] = [-c.left / 2, c.bottom / 2];
  map.setView(map.unproject(map.project([at.lat, at.lng], zoom).add(shift), zoom), zoom);
}

// ---------------------------------------------------------------- the URL

/** A tree by its accession, or by a number it had before being renumbered. */
function plantNamed(id: string | null): Plant | undefined {
  return id ? byId.get(dataset.renumbered?.[id] ?? id) : undefined;
}

/** The address for what is open now. */
function url(): string {
  const q = new URLSearchParams();
  if (walking) {
    q.set('tour', walking.tour.id);
    q.set('stop', String(walking.index + 1));
  }
  if (reading) q.set('plant', reading.id);
  const s = q.toString();
  return s ? `?${s}` : location.pathname;
}

/** Bring the page to what the address says: after Back, or on a shared link. */
function followUrl(): void {
  const q = new URLSearchParams(location.search);
  const tour = tours.find((t) => t.id === q.get('tour'));
  const stop = Math.max(0, (Number(q.get('stop')) || 1) - 1);
  if (tour && walking?.tour !== tour) startTour(tour, stop, 'none');
  else if (tour && walking && walking.index !== stop) goToStop(stop, 'none');
  else if (!tour && walking) endTour('none');
  const p = plantNamed(q.get('plant'));
  if (p) openTree(p, 'none');
  else if (reading) closeTree();
}
window.addEventListener('popstate', () => {
  // Back with the whole photo open closes the photo, and nothing else.
  if (!$('fg-lightbox').hidden) return closePhoto();
  followUrl();
});

// ---------------------------------------------------------------- the sheet

function setTab(tab: 'around' | 'tours'): void {
  for (const b of document.querySelectorAll<HTMLElement>('[data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  $('fg-around').hidden = tab !== 'around';
  $('fg-tours').hidden = tab !== 'tours';
  $('fg-count').hidden = tab !== 'around';
  // The gold rings belong to "Around you".
  if (tab === 'around') pickLayer.addTo(map);
  else pickLayer.remove();
}
$('fg-tabs').addEventListener('click', (e) => {
  const tab = (e.target as Element).closest<HTMLElement>('[data-tab]')?.dataset.tab;
  if (tab === 'around' || tab === 'tours') setTab(tab);
});

// ---------------------------------------------------------------- around you

const PIN = '<svg viewBox="0 0 24 32" width="26" height="34" aria-hidden="true"><path fill="#154734" stroke="#fff" stroke-width="2" d="M12 1C6 1 1.5 5.4 1.5 11.2 1.5 19 12 31 12 31s10.5-12 10.5-19.8C22.5 5.4 18 1 12 1z"/><circle cx="12" cy="11" r="4" fill="#ffd100"/></svg>';

/**
 * The trees worth a look around the visitor, or around the spot they tapped,
 * with a gold ring on each on the map. `note` says where that is; with a
 * spot picked it is ignored.
 */
function renderAround(note: string): void {
  const at = spot ?? here;
  const { picks, radius, within } = aroundYou(plants, at, MONTH);
  if (!spot) lastPicksAt = here;
  $('fg-where').textContent = spot ? 'The trees worth a look around the pin, and how far each is from it.' : note;
  $('fg-hint').hidden = Boolean(spot);
  $('fg-unpick').hidden = !spot;
  $('fg-unpick').textContent = located ? 'Back to where you are' : 'Back to the University Green';
  $('fg-tab-around').textContent = spot ? 'Around the pin' : 'Around you';
  $('fg-count').textContent = located || spot ? `${within} trees within 150 m` : '';
  $('fg-cards').innerHTML = picks.length
    ? picks.map((p) => card(p)).join('')
    : `<li class="fg-empty">Nothing notable or in season within ${radius} m.</li>`;
  pickLayer.clearLayers();
  for (const p of picks) {
    L.circleMarker([p.plant.lat, p.plant.lng], { radius: 16, color: '#ffd100', weight: 3, fill: false, interactive: false }).addTo(pickLayer);
  }
  if (spot) {
    L.marker([spot.lat, spot.lng], {
      interactive: false, keyboard: false,
      icon: L.divIcon({ className: 'fg-pin', html: PIN, iconSize: [26, 34], iconAnchor: [13, 33] }),
    }).addTo(pickLayer);
  }
}

/** The last note for the visitor's own position, to go back to when the pin is lifted. */
let ownNote = 'Finding your location…';
function renderOwn(note: string): void {
  ownNote = note;
  if (!spot) renderAround(note);
}

function pickSpot(at: { lat: number; lng: number }): void {
  spot = at;
  setTab('around');
  renderAround('');
}
function unpick(): void {
  spot = null;
  renderAround(ownNote);
  showPoint(here, Math.max(map.getZoom(), 17));
}
$('fg-unpick').addEventListener('click', unpick);

// A tap on open ground (a tap on a tree opens its page instead) picks that
// spot. Held back a moment, so the first tap of a double tap, which zooms,
// does not drop a pin.
let tapTimer = 0;
map.on('click', (e: L.LeafletMouseEvent) => {
  if (walking || reading) return;
  window.clearTimeout(tapTimer);
  tapTimer = window.setTimeout(() => pickSpot({ lat: e.latlng.lat, lng: e.latlng.lng }), 300);
});
map.on('dblclick', () => window.clearTimeout(tapTimer));

function thumb(p: Plant): string {
  const photo = p.photo ? photoUrl(p.photo, BASE, dataset.config.photoBaseUrl) : '';
  return photo
    ? `<img src="${esc(photo)}" alt="" loading="lazy">`
    : `<span class="fg-disc" style="background:${esc(season(p.taxon, MONTH).color)}"></span>`;
}

function card(p: Pick): string {
  return `<li><button type="button" class="fg-card fg-card--${p.kind}" data-plant="${esc(p.plant.id)}">
    <span class="fg-thumb">${thumb(p.plant)}</span>
    <span class="fg-card-text">
      <b>${esc(p.plant.taxon.common)}</b>
      <em>${esc(p.reason)}</em>
      <span>${Math.round(p.meters)} m ${esc(p.heading)}</span>
    </span></button></li>`;
}

$('fg-sheet').addEventListener('click', (e) => {
  const el = e.target as Element;
  const id = el.closest<HTMLElement>('[data-plant]')?.dataset.plant;
  const p = id ? byId.get(id) : undefined;
  if (p) return openTree(p);
  const tour = tours.find((t) => t.id === el.closest<HTMLElement>('[data-tour]')?.dataset.tour);
  if (tour) return startTour(tour, 0, 'push');
  const go = el.closest<HTMLElement>('[data-go]')?.dataset.go;
  if (go && walking) {
    if (go === 'end') return leaveTour();
    if (go === 'reverse') {
      walking.dir = -1;
      return goToStop(walking.stops.length - 1, 'replace');
    }
    const to = neighbours(walking.index, walking.stops.length, walking.dir)[go === 'next' ? 'next' : 'prev'];
    if (to !== null) goToStop(to, 'replace');
  }
});

function locate(): void {
  if (!('geolocation' in navigator)) return renderOwn('Your phone cannot share its location, so here are the trees around the University Green.');
  navigator.geolocation.watchPosition((pos) => {
    const at = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    const center = { lat: dataset.config.map.center[0], lng: dataset.config.map.center[1] };
    if (distanceMeters(at.lat, at.lng, center.lat, center.lng) > AWAY_M) {
      if (!located) renderOwn('You are away from campus, so here are the trees around the University Green.');
      return;
    }
    const first = !located;
    located = true;
    here = at;
    youLayer.clearLayers();
    L.circle([at.lat, at.lng], { radius: pos.coords.accuracy, color: '#1d6fe0', weight: 1, fillOpacity: 0.08, interactive: false }).addTo(youLayer);
    L.circleMarker([at.lat, at.lng], { radius: 7, color: '#fff', weight: 3, fillColor: '#1d6fe0', fillOpacity: 1, interactive: false }).addTo(youLayer);
    // A tour or a shared link has already put the map where it should be.
    if (first && !walking && !reading && !spot) showPoint(here, 18);
    // Not on every fix: the cards would shuffle as the visitor walks.
    if (first || !lastPicksAt || distanceMeters(at.lat, at.lng, lastPicksAt.lat, lastPicksAt.lng) > 25) {
      renderOwn('The trees worth a look near you, and why.');
      renderTourList();
      if (walking) renderWalk();
    }
  }, () => {
    if (!located) renderOwn('Without your location, here are the trees around the University Green. Allow location to see the trees around you.');
  }, { enableHighAccuracy: true, maximumAge: 10000 });
}

$('fg-locate').addEventListener('click', () => {
  if (spot) { spot = null; renderAround(ownNote); }
  showPoint(here, Math.max(map.getZoom(), 18));
  if (!located) locate();
});

// ---------------------------------------------------------------- tours

const miles = (m: number) => {
  const mi = m / 1609.34;
  return mi < 0.95 ? mi.toFixed(1) : String(Math.round(mi));
};

function renderTourList(): void {
  $('fg-tab-tours').hidden = tours.length === 0;
  $('fg-tour-list').innerHTML = tours.map((t) => {
    const first = byId.get(t.stops[0]!.plantId);
    const from = located && first ? ` · first stop ${stepText(step(here, first))}` : '';
    return `<li><button type="button" class="fg-tour" data-tour="${esc(t.id)}">
      <b>${esc(t.name)}</b>
      <span class="fg-tour-meta">${t.stops.length} stops · about ${miles(t.lengthM)} mi from stop to stop${esc(from)}</span>
      <span class="fg-tour-desc">${esc(t.description)}</span>
    </button></li>`;
  }).join('');
}

type Hist = 'push' | 'replace' | 'none';
function record(how: Hist, state: Record<string, unknown> | null = history.state): void {
  if (how === 'push') history.pushState(state, '', url());
  else if (how === 'replace') history.replaceState(state, '', url());
}

/**
 * Walk a tour: its stops numbered and joined in order over the faded trees,
 * and the sheet turned to the stop the visitor is on and the way to the next.
 */
/** The divider above the sheet (sheet-split.ts): while a tour is walked, re-centre the stop after a resize. */
const sheetSplit = initSheetSplit($('fg-sheet'), $('fg-sheet-split'), () => {
  if (walking) showPoint(walking.stops[walking.index]!, map.getZoom());
});
// On every tab, not only while a tour is walked (owner's request, 27 November 2026).
sheetSplit.enable(true);

function startTour(tour: Tour, index: number, how: Hist): void {
  const stops = tour.stops.map((s) => byId.get(s.plantId)).filter((p): p is Plant => p !== undefined);
  if (stops.length < 2) return;
  const at = Math.min(index, stops.length - 1);
  walking = { tour, stops, index: at, dir: 1 };
  tourLayer.clearLayers();
  L.polyline(stops.map((p) => [p.lat, p.lng] as [number, number]), {
    color: '#154734', weight: 3, opacity: 0.85, dashArray: '2 8', lineCap: 'round', interactive: false,
  }).addTo(tourLayer);
  stops.forEach((p, i) => {
    L.marker([p.lat, p.lng], {
      pane: 'tour', title: `Stop ${i + 1}: ${p.taxon.common}`,
      icon: L.divIcon({ className: 'fg-stop', html: `<span>${i + 1}</span>`, iconSize: [28, 28], iconAnchor: [14, 14] }),
    }).on('click', () => { goToStop(i, 'replace'); openTree(p); }).addTo(tourLayer);
  });
  fadeTrees(true);
  pickLayer.remove();
  $('fg-tabs').hidden = true;
  $('fg-around').hidden = true;
  $('fg-tours').hidden = true;
  $('fg-walk').hidden = false;
  sheetSplit.enable(true);
  renderWalk();
  const c = sheetCover();
  map.fitBounds(L.latLngBounds(stops.map((p) => [p.lat, p.lng] as [number, number])), {
    paddingTopLeft: [24 + c.left, 70], paddingBottomRight: [24, 24 + c.bottom], maxZoom: 19,
  });
  // Marked, so "End tour" can go back through history to where it started.
  record(how, how === 'push' ? { tourStart: true } : null);
}

function goToStop(index: number, how: Hist): void {
  if (!walking) return;
  walking.index = Math.max(0, Math.min(index, walking.stops.length - 1));
  renderWalk();
  showPoint(walking.stops[walking.index]!, Math.max(map.getZoom(), 19));
  record(how);
}

function renderWalk(): void {
  if (!walking) return;
  const { tour, stops, index } = walking;
  const p = stops[index]!;
  const around = neighbours(index, stops.length, walking.dir);
  const next = around.next === null ? undefined : stops[around.next];
  const note = tour.stops[index]?.note ?? '';
  const fromYou = located ? `<span>${esc(stepText(step(here, p)))} of you</span>` : '';
  // At the start of a tour, from nearer its far end: offer to walk it backwards.
  const last = stops.at(-1)!;
  const toLast = located && index === 0 && walking.dir === 1 ? step(here, last).meters : Infinity;
  const offer = toLast < step(here, p).meters && step(here, p).meters > NEAR_START_M
    ? `<p class="fg-walk-offer">You are nearer the last stop, ${Math.round(toLast)} m away. <button type="button" class="fg-linkbtn" data-go="reverse">Walk it in reverse from there</button></p>`
    : '';
  $('fg-walk').innerHTML = `
    <div class="fg-walk-head">
      <h2><span>${esc(tour.name)}</span> <small>Stop ${index + 1} of ${stops.length}${walking.dir === -1 ? ', in reverse' : ''}</small></h2>
      <button type="button" class="fg-linkbtn" data-go="end">End tour</button>
    </div>
    <button type="button" class="fg-card fg-card--stop" data-plant="${esc(p.id)}">
      <span class="fg-thumb">${thumb(p)}</span>
      <span class="fg-card-text"><b>${esc(p.taxon.common)}</b>${note ? `<span class="fg-note">${esc(note)}</span>` : ''}${fromYou}</span>
    </button>
    ${offer}
    <div class="fg-walk-nav">
      <button type="button" class="fg-step" data-go="prev" ${around.prev === null ? 'disabled' : ''} aria-label="Previous stop">&lsaquo;</button>
      ${next
        ? `<button type="button" class="fg-step fg-step--next" data-go="next">Next: ${esc(next.taxon.common)}, ${esc(stepText(step(p, next)))} &rsaquo;</button>`
        : '<button type="button" class="fg-step fg-step--next" data-go="end">End of the tour</button>'}
    </div>
    <a class="fg-walk-explorer" href="${esc(BASE)}?tour=${encodeURIComponent(tour.id)}">This tour in the explorer</a>`;
  sheetSplit.refit();
}

/** "End tour": back through history if the tour began here, so Back and this agree. */
function leaveTour(): void {
  if (history.state?.tourStart && !reading) history.back();
  else endTour('replace');
}

function endTour(how: Hist): void {
  walking = null;
  tourLayer.clearLayers();
  fadeTrees(false);
  $('fg-walk').hidden = true;
  sheetSplit.refit();
  $('fg-tabs').hidden = false;
  setTab('tours');
  record(how, null);
}

// ---------------------------------------------------------------- tree page

const ABSENT: Record<string, string> = {
  removed: 'This tree has been removed. Its record is kept.',
  'not-found': 'A survey looked for this tree and did not find it. Its record is kept.',
};

/**
 * A tree's own page, over the map: photo first, then why it matters, its
 * size and condition with their dates, its year, the others of its kind on
 * campus, and what to look for.
 */
function openTree(p: Plant, how: Hist = 'push'): void {
  const t = p.taxon;
  const unknown = t.id === 'unknown';
  const now = season(t, MONTH);
  const photo = p.photo ? photoUrl(p.photo, BASE, dataset.config.photoBaseUrl) : '';
  const taken = photoTaken(p.photoOn ?? p.surveyedOn);
  const others = othersOfItsKind(p, plants);
  const { tiles, conditionShown } = tilesFor(p, MONTH);
  // What the tiles leave out, in one line under them.
  const rest: Array<[string, string]> = [];
  if (!conditionShown && p.condition) rest.push(['Condition', cap(p.condition)]);
  if (p.plantedYear) rest.push(['Planted', String(p.plantedYear)]);
  rest.push(['Last surveyed', p.surveyedOn ? whenText(p.surveyedOn) : 'Not yet']);
  const origin = (ORIGIN_LABELS[t.origin] ?? '').replace(/^Introduced$/, 'introduced');
  const summary = unknown ? '' : yearSummary(t);
  if (kinMap) { kinMap.remove(); kinMap = null; }
  reading = p;

  $('fg-tree').innerHTML = `
    <div class="fg-tree-top"><button type="button" class="fg-back" data-back>&lsaquo; Map</button><span class="fg-tree-name" aria-hidden="true">${esc(t.common)}</span></div>
    <figure class="fg-photo${photo ? '' : ' fg-photo--none'}" style="--c:${esc(now.color)}">${photo
      ? `<button type="button" class="fg-photo-open" data-photo aria-label="See the whole photo">
           <img src="${esc(photo)}" alt="${esc(t.common)}, ${esc(p.id)}"><span class="fg-photo-full" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></span>
         </button>${taken ? `<figcaption>Photographed ${esc(taken)}</figcaption>` : ''}`
      : '<span class="fg-nophoto">No photo of this tree yet</span>'}</figure>
    <div class="fg-tree-body">
      ${tourBar(p)}
      ${ABSENT[p.status] ? `<p class="fg-absent">${ABSENT[p.status]}</p>` : ''}
      <p class="fg-eyebrow">${esc(p.id)}${p.collection ? ` · ${esc(p.collection.name)}` : ''} · ${p.tag ? `tag ${esc(p.tag)}` : 'no tag'}</p>
      <h1>${esc(t.common)}</h1>
      <p class="fg-sci">${unknown ? 'Species not identified yet' : `<i>${esc(t.sci)}</i>${t.family ? ` · ${esc(t.family)}` : ''}${origin ? ` · ${esc(origin)}` : ''}`}</p>
      ${p.notable?.length ? `<ul class="fg-notable">${p.notable.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
      ${p.story ? `<p class="fg-story">${esc(p.story)}</p>` : ''}
      ${tiles.length ? `<div class="fg-tiles${tiles.length === 1 ? ' fg-tiles--one' : ''}">${tiles.map((x) => `
        <div class="fg-tile"><small>${esc(x.label)}</small>
          <strong>${x.dot ? `<i style="background:${esc(x.dot)}"></i>` : ''}${esc(x.value)}</strong>${x.sub ? `<em>${esc(x.sub)}</em>` : ''}</div>`).join('')}
      </div>` : ''}
      <p class="fg-rest">${rest.map(([k, v]) => `<span>${esc(k)}: <b>${esc(v)}</b></span>`).join('')}</p>
      ${unknown ? '' : `
        <table class="fg-year">
          <caption class="fg-sr">What this species does each month</caption>
          <thead><tr><td></td>${MONTH_NAMES.map((n, i) => `<th scope="col" class="${i + 1 === MONTH ? 'fg-now' : ''}" abbr="${esc(n)}">${esc(n[0]!)}</th>`).join('')}</tr></thead>
          <tbody>${yearTable(t).map((row) => `<tr><th scope="row">${esc(row.label)}</th>${row.cells.map((c, i) =>
            `<td class="${i + 1 === MONTH ? 'fg-now' : ''}"${c ? ` style="--cell:${esc(c.color)}" title="${esc(MONTH_NAMES[i]!)}: ${esc(c.title)}"` : ''}><span>${c ? esc(c.title) : ''}</span></td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
        ${summary ? `<p class="fg-summary">${esc(summary)}</p>` : ''}
        <p class="fg-note">Table shows typical months for this species.</p>`}
      ${t.description ? `<h2>Look for</h2><p>${esc(t.description)}</p>` : ''}
      ${t.funFact ? `<details class="fg-fun"><summary>Did you know?</summary><p>${esc(t.funFact)}</p></details>` : ''}
      ${p.dedicationLabel ? `<h2>Dedication plaque</h2><p class="fg-plaque">${esc(p.dedicationLabel)}</p>` : ''}
      ${others.length ? `
        <h2>Others of its kind</h2>
        <p>${others.length === 1 ? 'One more on campus' : `${others.length} more on campus`}; the nearest is
          <button type="button" class="fg-linkbtn" data-plant="${esc(others[0]!.plant.id)}">${esc(stepText(others[0]!))}</button>
          from this one.</p>
        <div id="fg-kin-map" class="fg-kin-map" role="img" aria-label="Map of the ${others.length + 1} ${esc(t.common)} trees on campus, this one ringed"></div>` : ''}
      <p class="fg-actions">
        <a class="fg-btn" href="${esc(BASE)}?plant=${encodeURIComponent(p.id)}">Open in the explorer</a>
        ${unknown ? '' : `<a class="fg-btn" href="${esc(BASE)}species/${encodeURIComponent(t.id)}/">About the species</a>`}
        <a class="fg-btn" href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=walking" target="_blank" rel="noopener">Directions</a>
      </p>
    </div>`;
  $('fg-tree').hidden = false;
  $('fg-tree').scrollTop = 0;
  $('fg-tree').classList.remove('fg-scrolled');
  if (others.length) drawKin(p, others.map((o) => o.plant));
  record(how, how === 'push' ? { plant: p.id } : history.state);
}

// ---------------------------------------------------------------- the whole photo

/**
 * The page crops the photo to a fixed frame, aimed a little above the middle
 * where a crown usually is. A tap opens the whole of it, uncropped, on black.
 * It takes a history entry, so the phone's back button closes it rather than
 * the page.
 */
function openPhoto(): void {
  const img = $('fg-tree').querySelector<HTMLImageElement>('.fg-photo img');
  if (!img) return;
  const caption = $('fg-tree').querySelector('.fg-photo figcaption')?.textContent ?? '';
  $('fg-lightbox').innerHTML = `
    <button type="button" class="fg-lb-close" data-close aria-label="Close the photo">✕</button>
    <img src="${esc(img.src)}" alt="${esc(img.alt)}">
    <p>${esc(caption)}</p>`;
  $('fg-lightbox').hidden = false;
  history.pushState({ ...(history.state ?? {}), photo: true }, '', location.href);
}
function closePhoto(): void {
  $('fg-lightbox').hidden = true;
  $('fg-lightbox').innerHTML = '';
}
$('fg-lightbox').addEventListener('click', () => history.back());
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('fg-lightbox').hidden) history.back();
});

/** On a tour stop's page: which tour, which stop, why it is on it, and the way on. */
function tourBar(p: Plant): string {
  if (walking) {
    const i = walking.stops.indexOf(p);
    if (i < 0) return '';
    const note = walking.tour.stops[i]?.note ?? '';
    const n = neighbours(i, walking.stops.length, walking.dir).next;
    const next = n === null ? undefined : walking.stops[n];
    return `<div class="fg-tourbar">
      <p><b>${esc(walking.tour.name)}</b> · Stop ${i + 1} of ${walking.stops.length}</p>
      ${note ? `<p>${esc(note)}</p>` : ''}
      ${next ? `<button type="button" class="fg-step fg-step--next" data-next="${n}">Next: ${esc(next.taxon.common)}, ${esc(stepText(step(p, next)))} &rsaquo;</button>` : '<p><b>The last stop.</b></p>'}
    </div>`;
  }
  // Not walking it: say the tree is on one, and offer to walk it from here.
  const on = tours.find((t) => t.stops.some((s) => s.plantId === p.id));
  if (!on) return '';
  const i = on.stops.findIndex((s) => s.plantId === p.id);
  return `<div class="fg-tourbar">
    <p>Stop ${i + 1} of ${on.stops.length} on <b>${esc(on.name)}</b>. ${esc(on.stops[i]!.note)}</p>
    <button type="button" class="fg-step" data-walk="${esc(on.id)}" data-stop="${i}">Walk the tour from here &rsaquo;</button>
  </div>`;
}

/** A small map of the others of its kind, this one ringed. A tap opens one. */
function drawKin(p: Plant, others: Plant[]): void {
  const el = $('fg-kin-map');
  kinMap = L.map(el, {
    zoomControl: false, attributionControl: false, dragging: !coarse, touchZoom: !coarse,
    scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false,
  });
  basemaps(19).Streets!.addTo(kinMap);
  const kin = L.canvas({ padding: 0.3, tolerance: coarse ? 8 : 3 });
  for (const o of others) {
    L.circleMarker([o.lat, o.lng], { renderer: kin, radius: 5, weight: 1.5, color: '#fff', fillColor: '#1f6f4a', fillOpacity: 0.95 })
      .bindTooltip(esc(o.id)).on('click', () => openTree(o, 'replace')).addTo(kinMap);
  }
  L.circleMarker([p.lat, p.lng], { renderer: kin, radius: 7, weight: 3, color: '#ffd100', fillColor: '#154734', fillOpacity: 1, interactive: false }).addTo(kinMap);
  kinMap.fitBounds(L.latLngBounds([p, ...others].map((o) => [o.lat, o.lng] as [number, number])), { padding: [16, 16], maxZoom: 18 });
}

function closeTree(): void {
  reading = null;
  if (kinMap) { kinMap.remove(); kinMap = null; }
  $('fg-tree').hidden = true;
}

// Past the photo, the way back gets a solid strip of its own (styles.css).
$('fg-tree').addEventListener('scroll', () => {
  const photo = $('fg-tree').querySelector<HTMLElement>('.fg-photo');
  const past = $('fg-tree').scrollTop > (photo ? photo.offsetHeight : 0) - 52;
  $('fg-tree').classList.toggle('fg-scrolled', past);
}, { passive: true });

$('fg-tree').addEventListener('click', (e) => {
  const el = e.target as Element;
  if (el.closest('[data-photo]')) return openPhoto();
  if (el.closest('[data-back]')) {
    // Back through history when the page was opened here, so the phone's own
    // back button and this one agree; straight to the map from a shared link.
    if (history.state?.plant) history.back();
    else { closeTree(); record('replace', null); }
    return;
  }
  const next = el.closest<HTMLElement>('[data-next]')?.dataset.next;
  if (next !== undefined && walking) {
    goToStop(Number(next), 'none');
    return openTree(walking.stops[walking.index]!, 'replace');
  }
  const walk = el.closest<HTMLElement>('[data-walk]');
  const tour = tours.find((t) => t.id === walk?.dataset.walk);
  if (tour) {
    closeTree();
    return startTour(tour, Number(walk!.dataset.stop), 'replace');
  }
  const id = el.closest<HTMLElement>('[data-plant]')?.dataset.plant;
  const p = id ? byId.get(id) : undefined;
  if (p) openTree(p, 'replace');
});

// ---------------------------------------------------------------- start

loadData(BASE).then((d) => {
  dataset = d.dataset;
  plants = d.plants;
  byId = new Map(plants.map((p) => [p.id, p]));
  tours = (dataset.tours ?? []).filter((t) => t.stops.filter((s) => byId.has(s.plantId)).length >= 2);
  for (const [id, facts] of notableFacts(plants)) byId.get(id)!.notable = facts;
  drawOutline();
  drawTrees();
  drawStars();
  $('fg-map').classList.toggle('fg-far', map.getZoom() < 17);
  renderSeasonChip();
  renderOwn('Finding your location…');
  renderTourList();
  showPoint(here, 18);
  locate();
  const q = new URLSearchParams(location.search);
  const p = plantNamed(q.get('plant'));
  followUrl();
  // An old number, since changed to match the tree's tag: show the current one.
  if (reading && q.get('plant') !== reading.id) record('replace');
  if (p && !walking) map.setView([p.lat, p.lng], 19);
}).catch((err: Error) => {
  $('fg-where').textContent = `The trees did not load: ${err.message}`;
});

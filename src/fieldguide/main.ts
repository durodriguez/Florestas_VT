/**
 * The field guide (/fieldguide/): the campus's trees for someone standing
 * among them. The explorer at / is the whole collection, searched and
 * filtered; this opens on the trees around the visitor, in this month's
 * colors, and on a page for each tree. Same data, same rules (season.ts,
 * notable.ts, measured.ts); only the way in differs. See docs/FIELDGUIDE.md.
 */

import 'leaflet/dist/leaflet.css';
import './styles.css';

import L from 'leaflet';
import { loadData } from '../data';
import { basemaps } from '../basemaps';
import { notableFacts } from '../notable';
import { isPale, MONTH_NAMES, SEASON_LABELS, season, summarizeSeason } from '../season';
import { dotScale } from '../tree-display';
import { photoUrl } from '../photos';
import { measuredOn, whenText } from '../measured';
import { distanceMeters } from '../geo';
import { aroundYou, type Pick } from './picks';
import type { Dataset, Plant } from '../types';

const BASE = import.meta.env.BASE_URL;
const MONTH = new Date().getMonth() + 1;
/** Where the guide looks when it cannot see the visitor: the University Green. */
const GREEN = { lat: 44.4782, lng: -73.1993 };
/** Farther than this from the campus, the visitor is not among these trees. */
const AWAY_M = 3000;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

let dataset: Dataset;
let plants: Plant[] = [];
let byId = new Map<string, Plant>();
let here = GREEN;
let located = false;
let lastPicksAt: { lat: number; lng: number } | null = null;

const map = L.map($('fg-map'), { zoomControl: false, center: [GREEN.lat, GREEN.lng], zoom: 18, maxZoom: 21 });
const layers = basemaps(21);
layers.Streets!.addTo(map);
L.control.layers({ Streets: layers.Streets!, Satellite: layers.Satellite! }, {}, { position: 'topright' }).addTo(map);
const coarse = window.matchMedia('(pointer: coarse)').matches;
const renderer = L.canvas({ padding: 0.3, tolerance: coarse ? 8 : 3 });
const treeLayer = L.layerGroup().addTo(map);
const pickLayer = L.layerGroup().addTo(map);
const youLayer = L.layerGroup().addTo(map);
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

// ---------------------------------------------------------------- around you

function renderAround(note: string): void {
  const { picks, radius, within } = aroundYou(plants, here, MONTH);
  lastPicksAt = here;
  $('fg-where').textContent = note;
  $('fg-count').textContent = located ? `${within} trees within 150 m` : '';
  $('fg-cards').innerHTML = picks.length
    ? picks.map((p, i) => card(p, i)).join('')
    : `<li class="fg-empty">Nothing notable or in season within ${radius} m.</li>`;
  pickLayer.clearLayers();
  for (const p of picks) {
    L.circleMarker([p.plant.lat, p.plant.lng], { radius: 14, color: '#ffd100', weight: 3, fill: false, interactive: false }).addTo(pickLayer);
  }
}

function card(p: Pick, i: number): string {
  const photo = p.plant.photo ? photoUrl(p.plant.photo, BASE, dataset.config.photoBaseUrl) : '';
  const color = season(p.plant.taxon, MONTH).color;
  const thumb = photo
    ? `<img src="${esc(photo)}" alt="" loading="lazy">`
    : `<span class="fg-disc" style="background:${esc(color)}"></span>`;
  return `<li><button type="button" class="fg-card fg-card--${p.kind}" data-plant="${esc(p.plant.id)}" data-i="${i}">
    <span class="fg-thumb">${thumb}</span>
    <span class="fg-card-text">
      <b>${esc(p.plant.taxon.common)}</b>
      <em>${esc(p.reason)}</em>
      <span>${Math.round(p.meters)} m ${esc(p.heading)}</span>
    </span></button></li>`;
}

$('fg-cards').addEventListener('click', (e) => {
  const id = (e.target as Element).closest<HTMLElement>('[data-plant]')?.dataset.plant;
  const p = id ? byId.get(id) : undefined;
  if (p) openTree(p);
});

function locate(): void {
  if (!('geolocation' in navigator)) return renderAround('Your phone cannot share its location, so here are the trees around the University Green.');
  navigator.geolocation.watchPosition((pos) => {
    const at = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    const center = { lat: dataset.config.map.center[0], lng: dataset.config.map.center[1] };
    if (distanceMeters(at.lat, at.lng, center.lat, center.lng) > AWAY_M) {
      if (!located) renderAround('You are away from campus, so here are the trees around the University Green.');
      return;
    }
    const first = !located;
    located = true;
    here = at;
    youLayer.clearLayers();
    L.circle([at.lat, at.lng], { radius: pos.coords.accuracy, color: '#1d6fe0', weight: 1, fillOpacity: 0.08, interactive: false }).addTo(youLayer);
    L.circleMarker([at.lat, at.lng], { radius: 7, color: '#fff', weight: 3, fillColor: '#1d6fe0', fillOpacity: 1, interactive: false }).addTo(youLayer);
    if (first) showHere(18);
    // Not on every fix: the cards would shuffle as the visitor walks.
    if (first || !lastPicksAt || distanceMeters(at.lat, at.lng, lastPicksAt.lat, lastPicksAt.lng) > 25) {
      renderAround('The trees worth a look near you, and why.');
    }
  }, () => {
    if (!located) renderAround('Without your location, here are the trees around the University Green. Allow location to see the trees around you.');
  }, { enableHighAccuracy: true, maximumAge: 10000 });
}

/**
 * Centre the map on the visitor in the part of it the sheet leaves in view:
 * above it on a phone, beside it on a desktop.
 */
function showHere(zoom: number): void {
  const m = $('fg-map').getBoundingClientRect();
  const s = $('fg-sheet').getBoundingClientRect();
  const wide = s.width >= m.width - 2;
  const shift: [number, number] = wide ? [0, Math.max(0, m.bottom - s.top) / 2] : [-Math.max(0, s.right - m.left) / 2, 0];
  const center = map.unproject(map.project([here.lat, here.lng], zoom).add(shift), zoom);
  map.setView(center, zoom);
}

$('fg-locate').addEventListener('click', () => {
  showHere(Math.max(map.getZoom(), 18));
  if (!located) locate();
});

// ---------------------------------------------------------------- tree page

/**
 * A tree's own page, over the map: photo first, then why it matters, its
 * size and condition with their dates, what it is doing this month, and
 * what to look for. Its address names the tree, so the phone's back button
 * returns to the map and the page can be shared.
 */
function openTree(p: Plant, push = true): void {
  const t = p.taxon;
  const unknown = t.id === 'unknown';
  const on = measuredOn(p);
  const now = season(t, MONTH);
  const when = (d: string | null) => (d ? ` <span class="fg-when">(${esc(whenText(d))})</span>` : '');
  const fact = (label: string, value: string | null) => (value ? `<div><dt>${esc(label)}</dt><dd>${value}</dd></div>` : '');
  const photo = p.photo ? photoUrl(p.photo, BASE, dataset.config.photoBaseUrl) : '';
  $('fg-tree').innerHTML = `
    <button type="button" class="fg-back" data-back>&lsaquo; Map</button>
    <figure class="fg-photo">${photo
      ? `<img src="${esc(photo)}" alt="${esc(t.common)}, ${esc(p.id)}">`
      : `<div class="fg-nophoto" style="--c:${esc(now.color)}"><span>No photo of this tree yet</span></div>`}</figure>
    <div class="fg-tree-body">
      <p class="fg-eyebrow">${esc(p.id)}${p.tag ? ` · tag ${esc(p.tag)}` : ''}${p.collection ? ` · ${esc(p.collection.name)}` : ''}</p>
      <h1>${esc(t.common)}</h1>
      <p class="fg-sci">${unknown ? 'Species not identified yet' : `<i>${esc(t.sci)}</i>`}</p>
      ${p.notable?.length ? `<ul class="fg-notable">${p.notable.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
      <dl class="fg-facts">
        ${fact('Right now', `<span class="fg-dot" style="background:${esc(now.color)}"></span>${esc(SEASON_LABELS[now.state])} <span class="fg-when">(${esc(MONTH_NAMES[MONTH - 1]!)}, usually)</span>`)}
        ${fact('Trunk diameter', p.dbhIn === null ? null : `${p.dbhIn} in${when(on.dbh)}`)}
        ${fact('Height', p.heightFt === null ? null : `${p.heightFt} ft${when(on.height)}`)}
        ${fact('Crown spread', p.spreadFt === null ? null : `${p.spreadFt} ft${when(on.spread)}`)}
        ${fact('Condition', p.condition ? esc(cap(p.condition)) : null)}
      </dl>
      ${t.description ? `<h2>Look for</h2><p>${esc(t.description)}</p>` : ''}
      ${t.funFact ? `<details class="fg-fun"><summary>Did you know?</summary><p>${esc(t.funFact)}</p></details>` : ''}
      <p class="fg-actions"><a class="fg-btn" href="${esc(BASE)}?plant=${encodeURIComponent(p.id)}">Open in the explorer</a></p>
    </div>`;
  $('fg-tree').hidden = false;
  $('fg-tree').scrollTop = 0;
  document.body.classList.add('fg-reading');
  if (push) history.pushState({ plant: p.id }, '', `?plant=${encodeURIComponent(p.id)}`);
}

function closeTree(): void {
  $('fg-tree').hidden = true;
  document.body.classList.remove('fg-reading');
}

$('fg-tree').addEventListener('click', (e) => {
  if (!(e.target as Element).closest('[data-back]')) return;
  // Back through history when the page was opened here, so the phone's own
  // back button and this one agree; straight to the map from a shared link.
  if (history.state?.plant) history.back();
  else { closeTree(); history.replaceState(null, '', location.pathname); }
});
window.addEventListener('popstate', () => {
  const id = new URLSearchParams(location.search).get('plant');
  const p = id ? byId.get(id) : undefined;
  if (p) openTree(p, false);
  else closeTree();
});

// ---------------------------------------------------------------- start

loadData(BASE).then((d) => {
  dataset = d.dataset;
  plants = d.plants;
  byId = new Map(plants.map((p) => [p.id, p]));
  for (const [id, facts] of notableFacts(plants)) byId.get(id)!.notable = facts;
  drawOutline();
  drawTrees();
  renderSeasonChip();
  renderAround('Finding your location…');
  showHere(18);
  locate();
  const id = new URLSearchParams(location.search).get('plant');
  const p = id ? byId.get(id) : undefined;
  if (p) {
    map.setView([p.lat, p.lng], 19);
    openTree(p, false);
  }
}).catch((err: Error) => {
  $('fg-where').textContent = `The trees did not load: ${err.message}`;
});

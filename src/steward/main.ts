/**
 * The steward console (/steward/): the inventory for Grounds and planners.
 * How complete it is and where the gaps are (Overview), lists of the trees
 * that still need a visit (Worklists), the collection as a whole (Collection
 * health) and the data as files (Exports). The collection-health numbers come
 * from the build (scripts/lib/health.mjs, written to public/data/health.json);
 * everything else is worked out here from the same data as the map. See
 * docs/STEWARD.md.
 */

import 'leaflet/dist/leaflet.css';
import './styles.css';

import L from 'leaflet';
import { loadData } from '../data';
import { basemaps } from '../basemaps';
import { colorFor, legendFor } from '../palette';
import { measuredOn } from '../measured';
import { toCsv } from '../filters';
import { NEEDS, surveyDays, worklist, type Need } from './worklist';
import type { Dataset, Plant } from '../types';

const BASE = import.meta.env.BASE_URL;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const fmt = (n: number) => n.toLocaleString('en-US');
const pct = (n: number, of: number, digits = 0) => (of ? `${((n / of) * 100).toFixed(digits)}%` : '—');

interface Health {
  trees: number; taxa: number; genusOnly: number; unknown: number; measured: number; photo: number; knownTrees: number;
  top: Record<'species' | 'genus' | 'family', Array<[string, number]>>;
  origins: Array<[string, number]>; invasive: Array<[string, number]>;
  conditions: Array<[string, number]>; unrated: number;
  age: { recent: number; older: number; old: number; none: number };
  diversity: Record<'species' | 'genus' | 'family', { name: string; count: number; share: number; limit: number; within: boolean }>;
  threats: Array<{ name: string; label: string; trees: number }>;
  areas: Array<{ area: string; trees: number; measured: number; photo: number; species: number; recent: number }>;
}

let dataset: Dataset;
let plants: Plant[] = [];
let health: Health;

// ---------------------------------------------------------------- sections

const SECTIONS = ['overview', 'health', 'worklists', 'exports'];
function show(): void {
  const want = location.hash.slice(1);
  const id = SECTIONS.includes(want) ? want : 'overview';
  for (const s of SECTIONS) $(s).hidden = s !== id;
  for (const a of document.querySelectorAll<HTMLElement>('[data-section]')) {
    if (a.dataset.section === id) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  // Leaflet measures its box when shown; a map drawn while hidden is blank.
  if (id === 'overview') setTimeout(() => map?.invalidateSize(), 0);
}
window.addEventListener('hashchange', show);

// ---------------------------------------------------------------- overview

function kpi(label: string, value: string, share: number, note: string): string {
  return `<div class="st-kpi"><small>${esc(label)}</small><b>${esc(value)}</b>
    <span class="st-meter" aria-hidden="true"><i style="width:${Math.min(100, share * 100).toFixed(1)}%"></i></span>
    <em>${esc(note)}</em></div>`;
}

function renderKpis(): void {
  const h = health;
  const toSpecies = h.trees - h.genusOnly - h.unknown;
  const visited = h.areas.reduce((s, a) => s + a.recent, 0);
  const year = new Date().getFullYear();
  $('st-kpis').innerHTML = [
    kpi('Trees mapped', fmt(h.trees), 1, `${fmt(health.areas.length)} campuses`),
    kpi('Trunk measured', pct(h.measured, h.trees), h.measured / h.trees, `${fmt(h.age.recent)} within 5 years`),
    kpi('Photographed', pct(h.photo, h.trees, 1), h.photo / h.trees, `${fmt(h.photo)} trees`),
    kpi('Named to species', pct(toSpecies, h.trees), toSpecies / h.trees, `${fmt(h.genusOnly)} to genus only, ${fmt(h.unknown)} unknown`),
    kpi(`Visited ${year - 1}–${year}`, pct(visited, h.trees), visited / h.trees, `${fmt(visited)} trees`),
  ].join('');
}

const LEVELS = { species: 'Species', genus: 'Genus', family: 'Family' } as const;
type Level = keyof typeof LEVELS;

function render1020(): void {
  $('st-1020').innerHTML = limits();
  $('st-he-1020').innerHTML = limits();
}

/** The three levels against their limits; the red line is the limit. */
function limits(): string {
  const scale = 0.35;
  const names = LEVELS;
  return (Object.keys(names) as Level[]).map((level) => {
    const d = health.diversity[level];
    return `<div class="st-limit">
      <span class="st-limit-name">${names[level]}<small>${esc(d.name)}</small></span>
      <span class="st-limit-bar" role="img" aria-label="${esc(`${names[level]}: ${d.name}, ${(d.share * 100).toFixed(1)}% of trees, limit ${d.limit * 100}%`)}">
        <i class="${d.within ? '' : 'over'}" style="width:${Math.min(100, (d.share / scale) * 100).toFixed(1)}%"></i>
        <u style="left:${((d.limit / scale) * 100).toFixed(1)}%"></u>
      </span>
      <span class="st-limit-v">${(d.share * 100).toFixed(1)}%</span>
    </div>`;
  }).join('');
}

/** A plain table: a first column of names, then numbers. */
function table(head: string[], rows: string[][]): string {
  return `<div class="st-table-wrap"><table class="st-table st-numtable">
    <thead><tr>${head.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c, i) => (i ? `<td>${c}</td>` : `<th scope="row">${c}</th>`)).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}

const ORIGIN_NAMES: Record<string, string> = {
  'vermont-native': 'Native to Vermont', introduced: 'Introduced', 'vermont-invasive': 'Marked invasive in Vermont', 'not assessed': 'Not assessed',
};
const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const PLURAL: Record<Level, string> = { species: 'species', genus: 'genera', family: 'families' };

/** Collection health: what was the /health/ page, in full. */
function renderHealth(): void {
  const h = health;
  $('st-he-lede').textContent = `What the inventory says about the campus collection as a whole: ${fmt(h.trees)} standing trees, shrubs and vines of ${fmt(h.taxa)} species and other kinds. Burlington's street trees are not counted.`;
  $('st-he-known').textContent = `Counted over the ${fmt(h.knownTrees)} identified plants; a genus named without a species (${fmt(h.genusOnly)} plants) counts as one species, so the species figure is, if anything, high.`;
  $('st-he-top').innerHTML = (Object.keys(LEVELS) as Level[]).map((level) => `<div><h3>Most common ${PLURAL[level]}</h3>
    ${table([LEVELS[level], 'Plants', 'Share'], h.top[level].map(([name, n]) => [esc(name), fmt(n), pct(n, h.knownTrees, 1)]))}</div>`).join('');
  $('st-he-threats').innerHTML = table(['Pest or disease', 'Host plants'], h.threats.slice().sort((a, b) => b.trees - a.trees)
    .map((t) => [`${esc(t.name)} <span class="st-dim">${esc(t.label)}</span>`, fmt(t.trees)]));
  $('st-he-origin').innerHTML = table(['Origin', 'Plants', 'Share'], h.origins.map(([o, n]) => [esc(ORIGIN_NAMES[o] ?? o), fmt(n), pct(n, h.trees, 1)]));
  $('st-he-invasive').textContent = h.invasive.length
    ? `Marked invasive in Vermont: ${h.invasive.map(([name, n]) => `${name} (${fmt(n)})`).join(', ')}.` : '';
  $('st-he-condition').innerHTML = table(['Latest rating', 'Plants'],
    [...h.conditions.map(([c, n]) => [esc(cap(c)), fmt(n)]), ...(h.unrated ? [['Not rated', fmt(h.unrated)]] : [])]);
  $('st-he-age').innerHTML = table(['Trunk measured', 'Plants', 'Share'], ([
    ['Within 5 years', h.age.recent], ['5 to 10 years ago', h.age.older], ['More than 10 years ago', h.age.old], ['Not measured yet', h.age.none],
  ] as Array<[string, number]>).map(([label, n]) => [label, fmt(n), pct(n, h.trees)]));
}

function renderThreats(): void {
  $('st-threats').innerHTML = health.threats.slice().sort((a, b) => b.trees - a.trees).map((t) =>
    `<li><span>${esc(t.name)}<small>${esc(t.label)}</small></span><b>${fmt(t.trees)}</b></li>`).join('');
}

function renderDays(): void {
  const days = surveyDays(plants, 6);
  $('st-days').innerHTML = days.length ? days.map((d) => {
    const date = new Date(`${d.date}T12:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    const extra = [d.measured ? `${fmt(d.measured)} trunk ${d.measured === 1 ? 'size' : 'sizes'}` : '', d.photos ? `${fmt(d.photos)} ${d.photos === 1 ? 'photo' : 'photos'}` : ''].filter(Boolean).join(', ');
    return `<li><span>${esc(date)}<small>${esc(extra || 'no measurements or photos')}</small></span><b>${fmt(d.visits)} ${d.visits === 1 ? 'tree' : 'trees'}</b></li>`;
  }).join('') : '<li>No survey visits yet.</li>';
}

function renderAreas(): void {
  const rows = health.areas.map((a) => `<tr><th scope="row">${esc(a.area)}</th><td>${fmt(a.trees)}</td>
    ${[a.measured, a.photo, a.species, a.recent].map((n) => `<td><span class="st-cell-bar"><i style="width:${((n / a.trees) * 100).toFixed(1)}%"></i></span>${pct(n, a.trees)}</td>`).join('')}</tr>`).join('');
  $('st-areas').innerHTML = `<div class="st-table-wrap"><table class="st-table st-areas">
    <thead><tr><th scope="col">Campus</th><th scope="col">Trees</th><th scope="col">Trunk measured</th><th scope="col">Photographed</th><th scope="col">Named to species</th><th scope="col">Visited this year or last</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

// ---------------------------------------------------------------- the map

let map: L.Map | null = null;
const dots: Array<[L.CircleMarker, Plant]> = [];
type MapMode = 'measured' | 'photo' | 'species';
const MODE_COLORS: Record<'photo' | 'species', Array<{ label: string; color: string; test: (p: Plant) => boolean }>> = {
  photo: [
    { label: 'Photographed', color: '#1f6f4a', test: (p) => Boolean(p.photo) },
    { label: 'No photo yet', color: '#e0a400', test: () => true },
  ],
  species: [
    { label: 'Named to species', color: '#1f6f4a', test: (p) => Boolean(p.taxon.species) },
    { label: 'Genus only', color: '#e0a400', test: (p) => p.taxon.id !== 'unknown' },
    { label: 'Not identified', color: '#c4512b', test: () => true },
  ],
};
const colorIn = (p: Plant, mode: MapMode) => mode === 'measured' ? colorFor(p, 'measured') : MODE_COLORS[mode].find((c) => c.test(p))!.color;

function drawMap(): void {
  map = L.map($('st-map'), { center: dataset.config.map.center, zoom: 15, maxZoom: 20 });
  const layers = basemaps(20);
  layers.Streets!.addTo(map);
  L.control.layers({ Streets: layers.Streets!, Satellite: layers.Satellite! }, {}, { position: 'topright' }).addTo(map);
  L.geoJSON({ type: 'FeatureCollection', features: dataset.campusAreas.features.filter((f) => f.properties.kind === 'campus') } as GeoJSON.FeatureCollection, {
    interactive: false, style: { color: '#154734', weight: 1.5, opacity: 0.6, dashArray: '4 4', fill: false },
  }).addTo(map);
  const renderer = L.canvas({ padding: 0.3 });
  for (const p of plants) {
    if (p.status !== 'active') continue;
    const dot = L.circleMarker([p.lat, p.lng], { renderer, radius: 3.5, weight: 0.8, color: '#fff', fillOpacity: 0.95 })
      .bindPopup(() => popup(p));
    dots.push([dot, p]);
    dot.addTo(map);
  }
  const standing = plants.filter((p) => p.status === 'active');
  map.fitBounds(L.latLngBounds(standing.map((p) => [p.lat, p.lng] as [number, number])), { padding: [10, 10] });
  map.on('zoomend', () => { const r = map!.getZoom() >= 18 ? 6 : map!.getZoom() >= 17 ? 4.5 : 3.5; for (const [d] of dots) d.setRadius(r); });
  recolor();
}

function popup(p: Plant): string {
  const on = measuredOn(p).dbh;
  return `<b>${esc(p.taxon.common)}</b><br><span class="st-mono">${esc(p.id)}${p.tag ? ` · tag ${esc(p.tag)}` : ''}</span><br>
    ${p.dbhIn === null ? 'No trunk size' : `${p.dbhIn} in${on ? ` (${esc(on.slice(0, 4))})` : ''}`} · ${p.photo ? 'photographed' : 'no photo'}<br>
    <a href="${esc(BASE)}?plant=${encodeURIComponent(p.id)}">Explorer</a> · <a href="${esc(BASE)}fieldguide/?plant=${encodeURIComponent(p.id)}">Field guide</a>`;
}

function recolor(): void {
  const mode = $<HTMLSelectElement>('st-mapmode').value as MapMode;
  for (const [dot, p] of dots) dot.setStyle({ fillColor: colorIn(p, mode) });
  const legend = mode === 'measured' ? legendFor('measured', dataset) : MODE_COLORS[mode];
  const count = (color: string) => dots.filter(([, p]) => colorIn(p, mode) === color).length;
  $('st-legend').innerHTML = legend.map((l) => `<li><i style="background:${esc(l.color)}"></i>${esc(l.label)} <b>${fmt(count(l.color))}</b></li>`).join('');
}
$('st-mapmode').addEventListener('change', recolor);

// ---------------------------------------------------------------- worklists

const LIMIT = 300;
let shown: Plant[] = [];

function setupWorklists(): void {
  $<HTMLSelectElement>('st-need').innerHTML = NEEDS.map((n) => `<option value="${n.id}">${esc(n.label.toLowerCase())}</option>`).join('');
  $<HTMLSelectElement>('st-area').innerHTML += health.areas.map((a) => `<option>${esc(a.area)}</option>`).join('');
  for (const id of ['st-need', 'st-area']) $(id).addEventListener('change', renderWorklist);
  renderWorklist();
}

function renderWorklist(): void {
  const need = $<HTMLSelectElement>('st-need').value as Need;
  const area = $<HTMLSelectElement>('st-area').value || null;
  shown = worklist(plants, need, area);
  const what = NEEDS.find((n) => n.id === need)!;
  $('st-wl-count').textContent = `${fmt(shown.length)} standing ${shown.length === 1 ? 'tree' : 'trees'} ${area ? `on ${area}` : 'on every campus'}: ${what.label.toLowerCase()}. ${what.hint}${/[.?!]$/.test(what.hint) ? '' : '.'}`;
  const rows = shown.slice(0, LIMIT).map((p) => {
    const on = measuredOn(p).dbh;
    return `<tr>
      <td class="st-mono"><a href="${esc(BASE)}?plant=${encodeURIComponent(p.id)}">${esc(p.id)}</a></td>
      <td class="st-mono">${esc(p.tag || '—')}</td>
      <td>${esc(p.taxon.common)}</td>
      <td>${esc(p.collection?.name ?? '—')}</td>
      <td>${p.dbhIn === null ? '—' : `${p.dbhIn} in${on ? ` <span class="st-dim">${esc(on.slice(0, 4))}</span>` : ''}`}</td>
      <td>${p.photo ? 'Yes' : '—'}</td>
      <td>${esc(p.surveyedOn ? p.surveyedOn.slice(0, 7) : 'Never')}</td>
      <td><a href="${esc(BASE)}fieldguide/?plant=${encodeURIComponent(p.id)}">Field guide</a></td>
    </tr>`;
  }).join('');
  $('st-wl-table').innerHTML = `<thead><tr><th scope="col">Accession</th><th scope="col">Tag</th><th scope="col">Species</th><th scope="col">Campus</th>
    <th scope="col">Trunk</th><th scope="col">Photo</th><th scope="col">Last surveyed</th><th scope="col"><span class="st-sr">Links</span></th></tr></thead><tbody>${rows}</tbody>`;
  $('st-wl-more').textContent = shown.length > LIMIT ? `Showing the first ${LIMIT}. The CSV has all ${fmt(shown.length)}.` : '';
}

function download(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const today = () => new Date().toISOString().slice(0, 10);

$('st-wl-csv').addEventListener('click', () => {
  const need = $<HTMLSelectElement>('st-need').value;
  const area = ($<HTMLSelectElement>('st-area').value || 'all').toLowerCase().replace(/\s+/g, '-');
  download(`uvm-trees-${need}-${area}-${today()}.csv`, toCsv(shown), 'text/csv');
});
$('st-wl-print').addEventListener('click', () => window.print());

// ---------------------------------------------------------------- exports

function geojson(): string {
  const features = plants.filter((p) => p.status === 'active').map((p) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    properties: {
      plant_id: p.id, tag: p.tag || null, common_name: p.taxon.common, scientific_name: p.taxon.sci,
      family: p.taxon.family, campus: p.collection?.name ?? null, dbh_in: p.dbhIn, dbh_measured_on: measuredOn(p).dbh,
      condition: p.condition, last_surveyed: p.surveyedOn, photo: Boolean(p.photo),
    },
  }));
  return JSON.stringify({ type: 'FeatureCollection', features });
}

document.querySelector('.st-exports')!.addEventListener('click', (e) => {
  const kind = (e.target as Element).closest<HTMLElement>('[data-export]')?.dataset.export;
  if (kind === 'csv') download(`uvm-trees-${today()}.csv`, toCsv(plants), 'text/csv');
  if (kind === 'geojson') download(`uvm-trees-${today()}.geojson`, geojson(), 'application/geo+json');
});

// ---------------------------------------------------------------- start

Promise.all([
  loadData(BASE),
  fetch(`${BASE}data/health.json?v=${__DATA_VERSION__}`).then((r) => {
    if (!r.ok) throw new Error(`Could not load health.json (HTTP ${r.status}). Run \`npm run data\` first.`);
    return r.json() as Promise<Health>;
  }),
]).then(([d, h]) => {
  dataset = d.dataset;
  plants = d.plants;
  health = h;
  $('st-status').hidden = true;
  renderKpis();
  render1020();
  renderHealth();
  renderThreats();
  renderDays();
  renderAreas();
  setupWorklists();
  show();
  drawMap();
}).catch((err: Error) => {
  $('st-status').textContent = `The inventory did not load: ${err.message}`;
});

import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import './styles.css';

import { loadData } from './data';
import { PlantMap, escapeHtml } from './map';
import { renderDetail, renderResultItem } from './detail';
import { legendFor } from './palette';
import {
  applyFilters, emptyFilters, facetCounts, isFilterActive, distanceMeters, toCsv,
} from './filters';
import type { ColorBy, Dataset, FilterState, Plant } from './types';

const BASE = import.meta.env.BASE_URL;
const MAX_RESULTS_RENDERED = 250;

const $ = <T extends HTMLElement>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`missing element: ${sel}`);
  return el;
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ');

class App {
  private filters: FilterState = emptyFilters();
  private results: Plant[] = [];
  private selected: Plant | null = null;
  private colorBy: ColorBy = 'habit';
  private userPos: { lat: number; lng: number } | null = null;
  private readonly byId: Map<string, Plant>;
  private readonly map: PlantMap;

  constructor(
    private readonly dataset: Dataset,
    private readonly plants: Plant[],
  ) {
    this.byId = new Map(plants.map((p) => [p.id, p]));
    this.map = new PlantMap($('#map'), dataset, plants, {
      onSelect: (plant) => this.select(plant),
      onBasemapTrouble: (name) =>
        this.toast(`The ${name} basemap is not loading. Pick another from the layers control, bottom right.`),
    });

    document.title = dataset.config.siteName;
    $('#site-name').textContent = dataset.config.shortName;
    $('#site-tagline').textContent = dataset.config.tagline;

    this.buildFilterUi();
    this.bindEvents();
    this.refresh();
    this.applyUrlState();
  }

  // ---- filter panel ------------------------------------------------------

  private buildFilterUi(): void {
    const { vocab, collections } = this.dataset;
    const families = [...new Set(this.plants.map((p) => p.taxon.family))].sort();

    $('#facet-habit').innerHTML = vocab.habits.map((h) => checkbox('habits', h, titleCase(h))).join('');
    $('#facet-native').innerHTML = vocab.nativeStatus.map((n) => checkbox('native', n, titleCase(n))).join('');
    $('#facet-condition').innerHTML = vocab.conditions.map((c) => checkbox('conditions', c, titleCase(c))).join('');
    $('#facet-collection').innerHTML = collections.map((c) => checkbox('collections', c.id, c.name)).join('');
    $('#facet-family').innerHTML = families.map((f) => checkbox('families', f, f)).join('');

    const bloom = $<HTMLSelectElement>('#filter-bloom');
    bloom.innerHTML =
      '<option value="">Any month</option>' +
      MONTHS.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');
  }

  private renderFacetCounts(): void {
    const update = (
      container: string,
      facet: keyof FilterState,
      valueOf: (p: Plant) => string | null,
    ) => {
      const counts = facetCounts(this.plants, this.filters, facet, valueOf);
      for (const label of $(container).querySelectorAll<HTMLLabelElement>('label')) {
        const input = label.querySelector<HTMLInputElement>('input')!;
        const n = counts.get(input.value) ?? 0;
        label.querySelector('.facet-count')!.textContent = String(n);
        // Never disable a checked box, or the user cannot undo their own choice.
        label.classList.toggle('is-empty', n === 0 && !input.checked);
      }
    };

    update('#facet-habit', 'habits', (p) => p.taxon.habit);
    update('#facet-native', 'native', (p) => p.taxon.native);
    update('#facet-condition', 'conditions', (p) => p.condition);
    update('#facet-collection', 'collections', (p) => p.collection?.id ?? null);
    update('#facet-family', 'families', (p) => p.taxon.family);
  }

  private renderLegend(): void {
    $('#legend-items').innerHTML = legendFor(this.colorBy, this.dataset)
      .map(
        (e) =>
          `<li><span class="swatch" style="background:${escapeHtml(e.color)}"></span>${escapeHtml(titleCase(e.label))}</li>`,
      )
      .join('');
  }

  // ---- core loop ---------------------------------------------------------

  private refresh(): void {
    this.results = applyFilters(this.plants, this.filters);
    if (this.userPos) {
      const { lat, lng } = this.userPos;
      this.results.sort(
        (a, b) =>
          distanceMeters(lat, lng, a.lat, a.lng) - distanceMeters(lat, lng, b.lat, b.lng),
      );
    }
    this.map.show(this.results);
    this.renderResults();
    this.renderFacetCounts();
    this.renderLegend();
    $('#clear-filters').hidden = !isFilterActive(this.filters);
  }

  private renderResults(): void {
    const n = this.results.length;
    const total = this.plants.filter((p) => p.status === 'active').length;
    $('#result-count').textContent =
      n === total ? `${total.toLocaleString()} plants` : `${n.toLocaleString()} of ${total.toLocaleString()} plants`;

    const shown = this.results.slice(0, MAX_RESULTS_RENDERED);
    const pos = this.userPos;
    $('#results').innerHTML = shown
      .map((p) =>
        renderResultItem(p, pos ? distanceMeters(pos.lat, pos.lng, p.lat, p.lng) : undefined),
      )
      .join('');

    $('#results-more').textContent =
      n > shown.length ? `Showing the first ${shown.length}. Narrow your search to see the rest.` : '';
    $('#results-empty').hidden = n > 0;
  }

  private select(plant: Plant | null): void {
    this.selected = plant;
    const panel = $('#detail');
    if (!plant) {
      panel.hidden = true;
      panel.innerHTML = '';
      this.map.clearFocus();
      this.setUrlParam('plant', null);
      document.body.classList.remove('has-detail');
      return;
    }
    panel.hidden = false;
    panel.innerHTML =
      `<button type="button" class="detail-close" data-action="close-detail" aria-label="Close">&times;</button>` +
      renderDetail(plant, this.dataset, BASE);
    panel.scrollTop = 0;
    this.map.focus(plant);
    this.setUrlParam('plant', plant.id);
    document.body.classList.add('has-detail');
  }

  // ---- URL state ---------------------------------------------------------

  private setUrlParam(key: string, value: string | null): void {
    const url = new URL(location.href);
    if (value === null) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
    history.replaceState(null, '', url);
  }

  /**
   * Deep links are how the physical labels work: a QR code on a tree encodes
   * ?plant=<accession>, and scanning it should land on that plant's record.
   */
  private applyUrlState(): void {
    const params = new URLSearchParams(location.search);

    const taxonId = params.get('taxon');
    if (taxonId) {
      const taxon = this.dataset.taxa.find((t) => t.id === taxonId);
      if (taxon) {
        this.setQuery(taxon.sci);
        this.map.fitTo(this.results);
      }
    }

    const plantId = params.get('plant');
    if (plantId) {
      const plant = this.byId.get(plantId);
      if (plant) {
        // A removed or filtered-out plant must still resolve from its QR code.
        if (plant.status !== 'active') {
          $<HTMLInputElement>('#filter-removed').checked = true;
          this.filters.includeRemoved = true;
          this.refresh();
        }
        this.select(plant);
      } else {
        this.toast(`No plant with accession “${plantId}” is in the map yet.`);
      }
    }
  }

  private setQuery(q: string): void {
    $<HTMLInputElement>('#search').value = q;
    this.filters.q = q;
    this.refresh();
  }

  // ---- events ------------------------------------------------------------

  private bindEvents(): void {
    let searchTimer: number | undefined;
    $<HTMLInputElement>('#search').addEventListener('input', (e) => {
      const value = (e.target as HTMLInputElement).value;
      clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => {
        this.filters.q = value;
        this.refresh();
      }, 150);
    });

    $('#filters').addEventListener('change', (e) => {
      const input = e.target as HTMLInputElement;
      const facet = input.dataset.facet as keyof FilterState | undefined;
      if (facet) {
        const set = this.filters[facet] as Set<string>;
        if (input.checked) set.add(input.value);
        else set.delete(input.value);
        this.refresh();
      }
    });

    $<HTMLSelectElement>('#filter-bloom').addEventListener('change', (e) => {
      const v = (e.target as HTMLSelectElement).value;
      this.filters.bloomMonth = v ? Number(v) : null;
      this.refresh();
    });

    $<HTMLInputElement>('#filter-dbh').addEventListener('input', (e) => {
      const v = Number((e.target as HTMLInputElement).value);
      this.filters.minDbh = v > 0 ? v : null;
      $('#filter-dbh-value').textContent = v > 0 ? `${v}″ and up` : 'Any size';
      this.refresh();
    });

    $<HTMLInputElement>('#filter-removed').addEventListener('change', (e) => {
      this.filters.includeRemoved = (e.target as HTMLInputElement).checked;
      this.refresh();
    });

    $<HTMLSelectElement>('#color-by').addEventListener('change', (e) => {
      this.colorBy = (e.target as HTMLSelectElement).value as ColorBy;
      this.map.setColorBy(this.colorBy, this.plants);
      this.renderLegend();
    });

    $('#clear-filters').addEventListener('click', () => {
      this.filters = emptyFilters();
      this.userPos = null;
      $<HTMLFormElement>('#filters').reset();
      $<HTMLInputElement>('#search').value = '';
      $('#filter-dbh-value').textContent = 'Any size';
      this.map.clearFocus();
      this.map.resetView();
      this.refresh();
    });

    $('#results').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-plant]');
      if (btn) this.select(this.byId.get(btn.dataset.plant!) ?? null);
    });

    $('#detail').addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (!el) return;
      if (el.dataset.action === 'close-detail') this.select(null);
      if (el.dataset.action === 'same-taxon' && this.selected) {
        this.setQuery(this.selected.taxon.sci);
        this.map.fitTo(this.results);
      }
      if (el.dataset.action === 'copy-link') {
        navigator.clipboard
          ?.writeText(el.dataset.url!)
          .then(() => this.toast('Link copied to clipboard.'))
          .catch(() => this.toast('Could not copy — select the address bar instead.'));
      }
    });

    $('#zoom-results').addEventListener('click', () => this.map.fitTo(this.results));

    $('#export-csv').addEventListener('click', () => {
      const blob = new Blob([toCsv(this.results)], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `uvm-arboretum-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    });

    $('#locate').addEventListener('click', () => this.locate());

    $('#toggle-panel').addEventListener('click', () => {
      document.body.classList.toggle('panel-open');
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.selected) this.select(null);
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        $<HTMLInputElement>('#search').focus();
      }
    });
  }

  private locate(): void {
    if (!navigator.geolocation) return this.toast('This browser cannot share your location.');
    this.toast('Finding you…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        this.userPos = { lat: latitude, lng: longitude };
        this.map.showUserLocation(latitude, longitude, accuracy);
        this.refresh();
        this.toast('Results are now sorted by distance from you.');
      },
      () => this.toast('Location unavailable. Check your browser permissions.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  private toast(message: string): void {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('is-visible');
    window.setTimeout(() => el.classList.remove('is-visible'), 4000);
  }
}

function checkbox(facet: string, value: string, label: string): string {
  return `<label>
    <input type="checkbox" data-facet="${escapeHtml(facet)}" value="${escapeHtml(value)}">
    <span class="facet-label">${escapeHtml(label)}</span>
    <span class="facet-count">0</span>
  </label>`;
}

loadData(BASE)
  .then(({ dataset, plants }) => {
    document.body.classList.remove('is-loading');
    new App(dataset, plants);
  })
  .catch((err: Error) => {
    document.body.classList.remove('is-loading');
    document.querySelector('#boot-error')?.removeAttribute('hidden');
    const detail = document.querySelector('#boot-error-detail');
    if (detail) detail.textContent = err.message;
    console.error(err);
  });

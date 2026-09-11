import type { Dataset, Observation, Plant } from './types';
import { escapeHtml } from './map';
import { ORIGIN_LABELS, TYPE_LABELS } from './palette';

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const monthRange = (months: number[]): string =>
  months.length === 0 ? '—' : months.map((m) => MONTHS[m] ?? '').filter(Boolean).join('–');

const titleCase = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ') : '');

/** Botanical convention: genus and species italic, cultivar upright in quotes. */
function formatScientific(plant: Plant): string {
  const t = plant.taxon;
  const parts: string[] = [];
  if (t.genus) parts.push(`<i>${escapeHtml(t.genus)}</i>`);
  if (t.species) parts.push(`<i>${escapeHtml(t.species)}</i>`);
  if (t.infra) parts.push(escapeHtml(t.infra));
  if (t.cultivar) parts.push(`&lsquo;${escapeHtml(t.cultivar)}&rsquo;`);
  return parts.join(' ') || escapeHtml(t.sci);
}

function row(label: string, value: string | null | undefined): string {
  if (value === null || value === undefined || value === '' || value === '—') return '';
  return `<div class="fact"><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`;
}

const numOr = (v: number | null, unit: string): string | null =>
  v === null ? null : `${v}${unit}`;

/** "2026-09-01" -> "Sep 2026". Days are noise across a multi-year series. */
function surveyDate(iso: string): string {
  const [year, month] = iso.split('-');
  return `${MONTHS[Number(month)] ?? ''} ${year}`.trim();
}

/**
 * Every visit, newest first, for a plant surveyed more than once. This is the
 * whole point of keeping observations rather than overwriting them: a single
 * row can say how big a tree is, but only a series can say it is growing, or
 * that it started declining two surveys ago.
 */
function renderHistory(plant: Plant): string {
  if (plant.history.length < 2) return '';

  const rows = [...plant.history].reverse().map((o: Observation) => {
    const measures = [
      o.dbhIn === null ? null : `${o.dbhIn}&Prime; DBH`,
      o.heightFt === null ? null : `${o.heightFt} ft tall`,
    ].filter(Boolean).join(' &middot; ');
    return `
      <li class="survey">
        <span class="survey-date">${escapeHtml(surveyDate(o.surveyedOn))}</span>
        <span class="survey-body">
          ${o.condition ? `<span class="pill pill--${o.condition}">${escapeHtml(titleCase(o.condition))}</span>` : ''}
          ${measures ? `<span class="survey-measures">${measures}</span>` : ''}
          ${o.status !== 'active' ? `<span class="survey-measures">${escapeHtml(titleCase(o.status))}</span>` : ''}
        </span>
      </li>`;
  });

  return `
    <h3 class="detail-section">Survey history</h3>
    ${growth(plant)}
    <ul class="surveys">${rows.join('')}</ul>`;
}

/**
 * Growth between the first and last survey that measured a trunk — skipped
 * unless both ends have a diameter, since a change from nothing is not growth.
 */
function growth(plant: Plant): string {
  const measured = plant.history.filter((o) => o.dbhIn !== null);
  if (measured.length < 2) return '';
  const first = measured[0]!;
  const last = measured.at(-1)!;
  const gained = (last.dbhIn as number) - (first.dbhIn as number);
  if (gained <= 0) return '';
  const years = Number(last.surveyedOn.slice(0, 4)) - Number(first.surveyedOn.slice(0, 4));
  const span = years > 0 ? ` over ${years} year${years === 1 ? '' : 's'}` : '';
  return `<p class="detail-growth">Grew ${gained.toFixed(1)}&Prime; in trunk diameter${span},
    from ${first.dbhIn}&Prime; to ${last.dbhIn}&Prime;.</p>`;
}

export function renderDetail(plant: Plant, dataset: Dataset, base: string): string {
  const t = plant.taxon;
  const shareUrl = `${location.origin}${location.pathname}?plant=${encodeURIComponent(plant.id)}`;
  const age = plant.plantedYear ? `${new Date().getFullYear() - plant.plantedYear} years` : null;

  const photo = plant.photo
    ? `<img class="detail-photo" src="${base}photos/${encodeURIComponent(plant.photo)}"
         alt="${escapeHtml(t.common)}, accession ${escapeHtml(plant.id)}" loading="lazy">`
    : '';

  const removed =
    plant.status !== 'active'
      ? `<p class="detail-banner">This plant has been removed from the landscape. Its record is kept for historical reference.</p>`
      : '';

  const memorial = plant.memorial
    ? `<p class="detail-memorial">Dedicated: ${escapeHtml(plant.memorial)}</p>`
    : '';

  return `
    <header class="detail-header">
      <p class="detail-eyebrow">${escapeHtml(plant.id)}</p>
      <h2 class="detail-title">${escapeHtml(t.common)}</h2>
      <p class="detail-sci">${formatScientific(plant)}</p>
      <p class="detail-family">${escapeHtml(t.family)} &middot; ${escapeHtml(TYPE_LABELS[t.type] ?? titleCase(t.type))}
        &middot; ${escapeHtml(ORIGIN_LABELS[t.origin] ?? titleCase(t.origin))}</p>
    </header>
    ${removed}
    ${photo}
    ${memorial}
    ${t.description ? `<p class="detail-desc">${escapeHtml(t.description)}</p>` : ''}

    <h3 class="detail-section">This specimen</h3>
    <dl class="facts">
      ${row('Location', plant.collection ? escapeHtml(plant.collection.name) : null)}
      ${row('Diameter at breast height', numOr(plant.dbhIn, ' in'))}
      ${row('Height', numOr(plant.heightFt, ' ft'))}
      ${row('Canopy spread', numOr(plant.spreadFt, ' ft'))}
      ${row('Condition', plant.condition ? `<span class="pill pill--${plant.condition}">${escapeHtml(titleCase(plant.condition))}</span>` : null)}
      ${row('Planted', plant.plantedYear ? `${plant.plantedYear}${age ? ` (about ${age})` : ''}` : null)}
      ${row('Last surveyed', plant.surveyedOn
        ? `${escapeHtml(surveyDate(plant.surveyedOn))}${plant.history.length > 1 ? ` (${plant.history.length} surveys)` : ''}`
        : 'Not yet surveyed')}
      ${row('Coordinates', `${plant.lat.toFixed(6)}, ${plant.lng.toFixed(6)}`)}
      ${row('Notes', plant.notes ? escapeHtml(plant.notes) : null)}
    </dl>

    ${renderHistory(plant)}

    <h3 class="detail-section">About ${escapeHtml(t.common)}</h3>
    <dl class="facts">
      ${row('Plant type', TYPE_LABELS[t.type] ?? titleCase(t.type))}
      ${row('Flowers', `${titleCase(t.flowerColor) || '—'}${t.flowerMonths.length ? ` &middot; ${monthRange(t.flowerMonths)}` : ''}`)}
      ${row('Fruit', `${titleCase(t.fruitColor) || '—'}${t.fruitMonths.length ? ` &middot; ${monthRange(t.fruitMonths)}` : ''}`)}
      ${row('Fall color', titleCase(t.fallColor))}
      ${row('Mature height', numOr(t.matureHeightFt, ' ft'))}
      ${row('Mature spread', numOr(t.matureSpreadFt, ' ft'))}
      ${row('Bark', t.bark ? escapeHtml(t.bark) : null)}
      ${row('Soil', t.soil ? escapeHtml(t.soil) : null)}
      ${row('Pests and disease', t.pests ? escapeHtml(t.pests) : null)}
      ${row('Hardiness zones', t.zones)}
      ${row('On campus', `${t.count} mapped ${t.count === 1 ? 'plant' : 'plants'}`)}
    </dl>

    <div class="detail-actions">
      <button type="button" class="btn" data-action="same-taxon">See all ${t.count} ${escapeHtml(t.common)}</button>
      <a class="btn" href="https://www.google.com/maps/dir/?api=1&destination=${plant.lat},${plant.lng}"
         target="_blank" rel="noopener">Directions</a>
      <button type="button" class="btn" data-action="copy-link" data-url="${escapeHtml(shareUrl)}">Copy link</button>
      ${t.wikipedia ? `<a class="btn" href="${escapeHtml(t.wikipedia)}" target="_blank" rel="noopener">Wikipedia</a>` : ''}
    </div>
    <p class="detail-foot">Something look wrong? Email
      <a href="mailto:${escapeHtml(dataset.config.contactEmail)}?subject=${encodeURIComponent(`Arboretum record ${plant.id}`)}">${escapeHtml(dataset.config.contactEmail)}</a>.</p>
  `;
}

export function renderResultItem(plant: Plant, distance?: number): string {
  const dist =
    distance === undefined
      ? ''
      : `<span class="result-dist">${distance < 1000 ? `${Math.round(distance)} m` : `${(distance / 1000).toFixed(1)} km`}</span>`;
  return `
    <li>
      <button type="button" class="result" data-plant="${escapeHtml(plant.id)}">
        <span class="result-main">
          <span class="result-common">${escapeHtml(plant.taxon.common)}</span>
          <span class="result-sci">${escapeHtml(plant.taxon.sci)}</span>
        </span>
        <span class="result-meta">${escapeHtml(plant.id)}${plant.dbhIn ? ` · ${plant.dbhIn}″ DBH` : ''}</span>
        ${dist}
      </button>
    </li>`;
}

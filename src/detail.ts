import type { Dataset, Plant } from './types';
import { escapeHtml } from './map';

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
      <p class="detail-family">${escapeHtml(t.family)} &middot; ${escapeHtml(titleCase(t.habit))}
        &middot; ${escapeHtml(titleCase(t.native))}</p>
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
      ${row('Last surveyed', plant.surveyedOn)}
      ${row('Coordinates', `${plant.lat.toFixed(6)}, ${plant.lng.toFixed(6)}`)}
      ${row('Notes', plant.notes ? escapeHtml(plant.notes) : null)}
    </dl>

    <h3 class="detail-section">About ${escapeHtml(t.common)}</h3>
    <dl class="facts">
      ${row('Foliage', titleCase(t.foliage))}
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

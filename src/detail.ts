import type { CityTree, CityTreeItree, Dataset, Observation, Plant, Taxon, Tour } from './types';
import { escapeHtml } from './map';
import { ORIGIN_LABELS, TYPE_LABELS } from './palette';
import { photoSeries, photoTaken, photoUrl } from './photos';
import { championPoints } from './notable';
import { measuredOn, whenText } from './measured';

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const monthRange = (months: number[]): string =>
  months.length === 0 ? '—' : months.map((m) => MONTHS[m] ?? '').filter(Boolean).join('–');

const titleCase = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ') : '');

/** The same convention, from a taxon rather than a plant. */
function formatScientificTaxon(t: Taxon): string {
  const parts: string[] = [];
  if (t.genus) parts.push(`<i>${escapeHtml(t.genus)}</i>`);
  if (t.species) parts.push(`<i>${escapeHtml(t.species)}</i>`);
  if (t.infra) parts.push(escapeHtml(t.infra));
  if (t.cultivar) parts.push(`&lsquo;${escapeHtml(t.cultivar)}&rsquo;`);
  return parts.join(' ') || escapeHtml(t.sci);
}

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

/** The survey app's "Don't know yet": a plant mapped before it was identified. */
export const UNKNOWN_TAXON = 'unknown';

/** Family, kind and origin, leaving out any nobody has recorded. */
function familyLine(t: Taxon): string {
  if (t.id === UNKNOWN_TAXON) return 'Species not identified yet';
  return [t.family, TYPE_LABELS[t.type] ?? titleCase(t.type), ORIGIN_LABELS[t.origin] ?? titleCase(t.origin)]
    .filter(Boolean).map(escapeHtml).join(' &middot; ');
}

function row(label: string, value: string | null | undefined, hint?: string): string {
  if (value === null || value === undefined || value === '' || value === '—') return '';
  const title = hint ? ` title="${escapeHtml(hint)}"` : '';
  return `<div class="fact"><dt${title}>${escapeHtml(label)}</dt><dd>${value}</dd></div>`;
}

/** Short enough for the panel; the hover says exactly what was measured. */
const DBH_LABEL = 'Trunk diameter';
const DBH_HINT = 'Diameter at breast height: measured 4.5 ft above the ground';

const CHAMPION_HINT = "American Forests' big-tree score: trunk circumference in inches + height in feet + a quarter of the crown spread in feet";

/** What makes a tree stand out (notable.ts), one note a line. */
const notableRow = (notes: string[] | undefined): string =>
  row('Notable', notes?.length
    ? `<ul class="detail-notable">${notes.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul>`
    : null);

/**
 * When a measurement was taken, after the number: every one, so a trunk
 * size from 2014 never reads as today's. Its age in years once it is two or
 * more years old.
 */
const when = (date: string | null): string =>
  date ? ` <span class="fact-when">(${escapeHtml(whenText(date))})</span>` : '';

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
          ${o.photo ? '<span class="survey-measures">Photo added</span>' : ''}
        </span>
      </li>`;
  });

  return `
    <h3 class="detail-section">Survey history</h3>
    <ul class="surveys">${rows.join('')}</ul>`;
}

/**
 * The species, as both panels describe it. A UVM plant and a city tree of the
 * same species share everything here but the campus count; what differs is
 * whose tree it is, and that is said above this, not in it.
 */
function aboutTaxon(t: Taxon, countOnCampus = true): string {
  // Left off a city tree's panel: the count is of UVM's plants, and beside a
  // city tree it would seem to include the one being looked at.
  const mapped = `${t.count} mapped ${t.count === 1 ? 'plant' : 'plants'}${
    // "Show all" includes varieties, so the row says so rather than
    // promising a number the map then overshoots.
    t.groupCount > t.count ? `, plus ${t.groupCount - t.count} of named varieties` : ''}`;
  return `
    <h3 class="detail-section">About ${escapeHtml(t.common)}</h3>
    <dl class="facts">
      ${row('Plant type', TYPE_LABELS[t.type] ?? titleCase(t.type))}
      ${row('Flowers', `${titleCase(t.flowerColor) || '—'}${t.flowerMonths.length ? ` &middot; ${monthRange(t.flowerMonths)}` : ''}`)}
      ${row('Fruit', `${titleCase(t.fruitColor) || '—'}${t.fruitMonths.length ? ` &middot; ${monthRange(t.fruitMonths)}` : ''}`)}
      ${row('Summer leaves', titleCase(t.leafColor))}
      ${row('Fall color', titleCase(t.fallColor))}
      ${row('Mature height', numOr(t.matureHeightFt, ' ft'))}
      ${row('Mature spread', numOr(t.matureSpreadFt, ' ft'))}
      ${row('Bark', t.bark ? escapeHtml(t.bark) : null)}
      ${row('Soil', t.soil ? escapeHtml(t.soil) : null)}
      ${row('Pests and disease', t.pests ? escapeHtml(t.pests) : null)}
      ${row('Hardiness zones', t.zones)}
      ${row('Lifespan', t.lifespan ? escapeHtml(t.lifespan) : null)}
      ${countOnCampus ? row('On campus', mapped) : ''}
    </dl>
  `;
}

/**
 * Every photo of the tree as a row of thumbnails, newest first, once there
 * is more than one. A tap shows that photo in the main frame with its date;
 * the row scrolls sideways when it outgrows the panel.
 */
function photoStrip(plant: Plant, base: string, photoBaseUrl?: string): string {
  const shots = photoSeries(plant);
  if (shots.length < 2) return '';
  return `<div class="photo-strip" role="group" aria-label="Photos of this tree">${shots.map((s) => {
    const when = photoTaken(s.on);
    const url = photoUrl(s.file, base, photoBaseUrl);
    return `<button type="button" class="photo-strip-shot" data-action="photo-pick"
        data-src="${escapeHtml(url)}" data-when="${escapeHtml(when)}" aria-pressed="${s.file === plant.photo}"
        aria-label="Show the photo${when ? ` from ${escapeHtml(when)}` : ''}">
        <img src="${escapeHtml(url)}" alt="" loading="lazy"><span>${escapeHtml(when)}</span>
      </button>`;
  }).join('')}</div>`;
}

/** Where a tree sits on the tour being walked, for the bar on its record. */
export interface TourStop {
  tour: Tour;
  /** 0-based. */
  index: number;
  prev: Plant | null;
  next: Plant | null;
  /** Straight-line meters to the next stop. */
  toNext: number | null;
}

/**
 * The tour bar at the top of a stop's record: which tour, which stop, why
 * the tree is on it, and the way on. First on the record, so on a phone it
 * is what shows above the fold.
 */
function tourBar(s: TourStop): string {
  const note = s.tour.stops[s.index]?.note ?? '';
  return `
    <div class="tour-bar">
      <p class="tour-bar-head"><strong>${escapeHtml(s.tour.name)}</strong> &middot; Stop ${s.index + 1} of ${s.tour.stops.length}</p>
      ${note ? `<p class="tour-bar-note">${escapeHtml(note)}</p>` : ''}
      <div class="tour-bar-nav">
        <button type="button" class="tour-btn" data-tour-go="prev" ${s.prev ? '' : 'disabled'}>&lsaquo; Previous</button>
        ${s.next
          ? `<button type="button" class="tour-btn tour-btn--next" data-tour-go="next">Next: ${escapeHtml(s.next.taxon.common)}${s.toNext === null ? '' : `, ${Math.round(s.toNext)} m`} &rsaquo;</button>`
          : '<button type="button" class="tour-btn tour-btn--next" data-tour-go="end">End of the tour</button>'}
      </div>
    </div>`;
}

export function renderDetail(plant: Plant, dataset: Dataset, base: string, stop?: TourStop): string {
  const t = plant.taxon;
  const age = plant.plantedYear ? `${new Date().getFullYear() - plant.plantedYear} years` : null;
  const on = measuredOn(plant);

  const taken = photoTaken(plant.photoOn ?? plant.surveyedOn);
  const photo = plant.photo
    ? `<figure class="detail-figure">
         <button type="button" class="detail-photo-open" data-action="photo" aria-label="Show the photo full size">
           <img class="detail-photo" src="${escapeHtml(photoUrl(plant.photo, base, dataset.config.photoBaseUrl))}"
             alt="${escapeHtml(t.common)}, accession ${escapeHtml(plant.id)}" loading="lazy">
         </button>
         ${taken ? `<figcaption class="detail-photo-date">Photographed ${escapeHtml(taken)}</figcaption>` : ''}
         ${photoStrip(plant, base, dataset.config.photoBaseUrl)}
       </figure>`
    : '';

  // Two ways for a plant to be absent, and they are not the same claim. One
  // stood here and came down; the other was recorded and never found. Saying
  // "removed" for the second would assert a tree that may never have existed.
  const ABSENT: Record<string, string> = {
    removed: 'This plant has been removed from the landscape. Its record is kept for historical reference.',
    'not-found': 'A survey went looking for this plant and found nothing. It may have gone long ago, or it may never have been here — the record is kept so the question stays visible.',
  };
  const removed = ABSENT[plant.status]
    ? `<p class="detail-banner">${ABSENT[plant.status]}</p>`
    : '';

  // The wording is the whole record: a tree is a gift, memorial or dedicated
  // one exactly when somebody has written down what its plaque says.
  // Laid out line for line as the plaque is: the text keeps the surveyor's
  // line breaks, and the stylesheet shows them rather than running it together.
  const dedication = plant.dedicationLabel
    ? `<h3 class="detail-section">Dedication plaque</h3>
      <p class="detail-dedication">${escapeHtml(plant.dedicationLabel)}</p>`
    : '';

  return `
    ${stop ? tourBar(stop) : ''}
    <header class="detail-header">
      <p class="detail-eyebrow">${escapeHtml(plant.id)}</p>
      <h2 class="detail-title">${escapeHtml(t.common)}</h2>
      ${t.id === UNKNOWN_TAXON ? '' : `<p class="detail-sci">${formatScientific(plant)}</p>`}
      <p class="detail-family">${familyLine(t)}</p>
    </header>
    ${removed}
    ${photo}
    ${plant.story ? `<p class="detail-story">${escapeHtml(plant.story)}</p>` : ''}
    ${t.description ? `<p class="detail-desc"><strong>Description:</strong> ${escapeHtml(t.description)}</p>` : ''}
    ${t.funFact ? `<details class="detail-fact">
      <summary>Fun fact</summary>
      <p>${escapeHtml(t.funFact)}</p>
    </details>` : ''}
    ${dedication}

    <h3 class="detail-section">This specimen</h3>
    <dl class="facts">
      ${row('Tag', plant.tag ? escapeHtml(plant.tag) : 'No tag')}
      ${row('Location', plant.collection ? escapeHtml(plant.collection.name) : null)}
      ${row('Condition', plant.condition
        ? `<span class="pill pill--${plant.condition}">${escapeHtml(titleCase(plant.condition))}</span>${
          // From an earlier visit than the latest: say how old it is.
          plant.conditionOn ? ` <span class="fact-when">(${escapeHtml(surveyDate(plant.conditionOn))})</span>` : ''}`
        : null)}
      ${row('Planted', plant.plantedYear ? `${plant.plantedYear}${age ? ` (about ${age})` : ''}` : null)}
      ${row(DBH_LABEL, plant.dbhIn === null ? null : `${numOr(plant.dbhIn, ' in')}${when(on.dbh)}`, DBH_HINT)}
      ${row('Height', plant.heightFt === null ? null : `${numOr(plant.heightFt, ' ft')}${when(on.height)}`)}
      ${row('Canopy spread', plant.spreadFt === null ? null : `${numOr(plant.spreadFt, ' ft')}${when(on.spread)}`)}
      ${row('Champion points', championPoints(plant)?.toString() ?? null, CHAMPION_HINT)}
      ${notableRow(plant.notable)}
      ${row('Last surveyed', plant.surveyedOn
        ? `${escapeHtml(surveyDate(plant.surveyedOn))}${plant.history.length > 1 ? ` (${plant.history.length} surveys)` : ''}`
        : 'Not yet surveyed')}
      ${row('Coordinates', `${plant.lat.toFixed(6)}, ${plant.lng.toFixed(6)}`)}
    </dl>

    ${renderHistory(plant)}

    ${aboutTaxon(t)}

    <div class="detail-actions">
      <button type="button" class="btn" data-action="same-taxon">Show all</button>
      ${plant.status === 'active' ? `<a class="btn" href="${base}fieldguide/?plant=${encodeURIComponent(plant.id)}">In the field guide</a>` : ''}
      ${t.id === UNKNOWN_TAXON ? '' : `<a class="btn" href="${base}species/${encodeURIComponent(t.id)}/">More about this species</a>`}
      <a class="btn" href="https://www.google.com/maps/dir/?api=1&destination=${plant.lat},${plant.lng}"
         target="_blank" rel="noopener">Directions</a>
      ${t.wikipedia ? `<a class="btn" href="${escapeHtml(t.wikipedia)}" target="_blank" rel="noopener">Wikipedia</a>` : ''}
    </div>
    <p class="detail-foot">Something look wrong? Email
      <a href="mailto:${escapeHtml(dataset.config.contactEmail)}?subject=${encodeURIComponent(`${dataset.config.siteName} record ${plant.id}`)}">${escapeHtml(dataset.config.contactEmail)}</a>.</p>
  `;
}

/** The year of a trunk size in the results list: "49″ DBH (2014)". */
function resultYear(plant: Plant): string {
  const date = measuredOn(plant).dbh;
  return date ? ` (${escapeHtml(date.slice(0, 4))})` : '';
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
        <span class="result-meta">${escapeHtml(plant.id)}${plant.dbhIn ? ` · ${plant.dbhIn}″ DBH${resultYear(plant)}` : ''}</span>
        ${dist}
      </button>
    </li>`;
}

/**
 * A model's estimate, said as one: two significant figures, because the inputs
 * (a diameter to the inch, a height in five-foot steps) carry no more.
 */
export function roughly(n: number, unit: string): string {
  if (n < 0.1) return `less than 0.1 ${unit}`;
  return `about ${Number(n.toPrecision(2)).toLocaleString('en-US')} ${unit}`;
}

function roughlyDollars(n: number): string {
  return n < 1 ? 'less than $1' : `about $${Math.round(n).toLocaleString('en-US')}`;
}

/**
 * What i-Tree Eco estimates this tree does, folded under "This tree": each
 * service by its amount, then the yearly dollar total, unemphasized because it
 * is the least meaningful of them. "Powered by i-Tree" closes it and opens
 * our i-Tree page, which says what the figures rest on and links i-Tree itself
 * (docs/ITREE.md).
 */
function ecosystemServices(e: CityTreeItree, base: string): string {
  return `
    <details class="detail-services">
      <summary>Ecosystem services</summary>
      <dl class="facts">
        ${row('Carbon stored', roughly(e.carbonStoredLb, 'lb'))}
        ${row('Carbon absorbed', `${roughly(e.carbonPerYearLb, 'lb')} a year`)}
        ${row('Stormwater runoff avoided', `${roughly(e.runoffGalYr, 'gallons')} a year`)}
        ${row('Air pollution removed', `${roughly(e.pollutionOzYr, 'oz')} a year`)}
        ${row('Oxygen produced', `${roughly(e.oxygenLbYr, 'lb')} a year`)}
        ${row('Total yearly benefits', `${roughlyDollars(e.benefitsUsdYr)} a year`)}
      </dl>
      <p class="detail-powered">
        Powered by <a href="${base}itree/">i-Tree</a>
      </p>
    </details>`;
}

/**
 * A Burlington street tree.
 *
 * Deliberately a leaner panel than a plant's, and the first thing it says is
 * whose tree this is. Everything shown comes from the city's open data; there
 * is no accession, no dedication, no story and no survey history, because the
 * university keeps none of those for a tree it does not own.
 */
export function renderCityDetail(tree: CityTree, base: string): string {
  const t = tree.taxon;
  const age = tree.plantedYear ? `${new Date().getFullYear() - tree.plantedYear} years old` : '';

  return `
    <header class="detail-head">
      <p class="detail-accession">${escapeHtml(tree.id)} &middot; City of Burlington</p>
      <h2 class="detail-title">${escapeHtml(t.common)}</h2>
      <p class="detail-sci">${formatScientificTaxon(t)}</p>
      <p class="detail-family">${escapeHtml(t.family)} &middot; ${escapeHtml(TYPE_LABELS[t.type] ?? titleCase(t.type))}</p>
    </header>

    <p class="detail-city-note">
      A <strong>Burlington street tree</strong>, standing inside the campus
      boundary. It is the city's tree, not part of the UVM collection.
    </p>

    ${t.description ? `<p class="detail-desc"><strong>Description:</strong> ${escapeHtml(t.description)}</p>` : ''}
    ${t.funFact ? `<details class="detail-fact">
      <summary>Fun fact</summary>
      <p>${escapeHtml(t.funFact)}</p>
    </details>` : ''}

    <h3 class="detail-section">This tree</h3>
    <dl class="facts">
      ${row('Address', tree.address ? escapeHtml(tree.address) : null)}
      ${row('On campus', tree.collection ? escapeHtml(tree.collection.name) : null)}
      ${row('Condition', tree.condition
        ? `<span class="pill pill--${tree.condition}">${escapeHtml(titleCase(tree.condition))}</span>`
        : null)}
      ${row(DBH_LABEL, tree.dbhIn === null ? null : `${tree.dbhIn} in`, DBH_HINT)}
      ${row('Height', tree.heightFt === null ? null : `${tree.heightFt} ft`)}
      ${row('Canopy spread', tree.spreadFt === null ? null : `${tree.spreadFt} ft`)}
      ${row('Champion points', championPoints(tree)?.toString() ?? null, CHAMPION_HINT)}
      ${notableRow(tree.notable)}
      ${row('Planted', tree.plantedYear ? `${tree.plantedYear}${age ? ` (about ${age})` : ''}` : null)}
      ${row('Coordinates', `${tree.lat.toFixed(6)}, ${tree.lng.toFixed(6)}`)}
    </dl>
    ${tree.itree ? ecosystemServices(tree.itree, base) : ''}

    ${aboutTaxon(t, false)}

    <div class="detail-actions">
      <a class="btn" href="${base}species/${encodeURIComponent(t.id)}/">More about this species</a>
    </div>

    <p class="detail-source">
      Record from the City of Burlington's public tree inventory.
    </p>
  `;
}

/**
 * The search box on the species pages.
 *
 * The pages are plain HTML in public/, outside the app's bundle, so their
 * script is written out by `npm run data` as species/search.js. It is built
 * from the functions below, not retyped: `normalizeName` is the one the
 * importer and the survey app use, and `rankSpecies` is tested here and
 * serialised into the page as it stands. The ranking is the survey app's
 * (src/field/species.ts): a key starting with the query, then every word
 * starting a word, then the query anywhere; ties to the species with more
 * trees on campus.
 *
 * It searches public/field/species.json, the list the survey app already
 * ships, with every alias in it, and fetches it only when the box is first
 * used.
 */

import { normalizeName } from './species.mjs';

export const MAX_RESULTS = 8;

/**
 * @param {string} query  as typed
 * @param {{id: string, sci: string, common: string, n: number, k: string[]}[]} entries
 */
export function rankSpecies(query, entries, normalize, limit) {
  const q = normalize(query);
  if (q.length < 2) return [];
  const tokens = q.split(' ').filter(Boolean);
  const hits = [];
  for (const e of entries) {
    let best = null;
    for (const key of e.k) {
      if (key.startsWith(q)) { best = 0; break; }
      const words = key.split(' ');
      if (tokens.every((t) => words.some((w) => w.startsWith(t)))) best = best === null ? 1 : Math.min(best, 1);
      else if (key.includes(q)) best = best === null ? 2 : best;
    }
    if (best !== null) hits.push({ e, s: best });
  }
  hits.sort((a, b) => a.s - b.s || b.e.n - a.e.n || a.e.sci.length - b.e.sci.length || a.e.common.localeCompare(b.e.common));
  return hits.slice(0, limit).map((h) => h.e);
}

/**
 * The search, in the green bar of every species page and the index. On a wide
 * screen the box sits in the bar after "All species"; on a narrow one the bar
 * shows a magnifier instead, which swaps the bar's contents for the box and a
 * close button. Both start hidden: without the script they would do nothing.
 */
export const SEARCH_FORM = `<button type="button" class="search-open" aria-label="Search species" aria-expanded="false" hidden>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>
  </button>
  <form class="search" role="search" hidden>
    <label class="visually-hidden" for="species-q">Search species</label>
    <input id="species-q" type="search" placeholder="Search species" autocomplete="off"
      spellcheck="false" role="combobox" aria-expanded="false" aria-controls="species-hits" aria-autocomplete="list">
    <button type="button" class="search-close" aria-label="Close search">&times;</button>
    <ul id="species-hits" class="hits" role="listbox" hidden></ul>
  </form>`;

/** species/search.js. */
export const SPECIES_SEARCH_JS = `// Written by npm run data from scripts/lib/species-search.mjs. Do not edit.
(() => {
  const normalizeName = ${normalizeName.toString()};
  const rankSpecies = ${rankSpecies.toString()};
  const here = document.currentScript.src;
  const form = document.querySelector('form.search');
  if (!form) return;
  const input = form.querySelector('input');
  const list = form.querySelector('.hits');
  let entries = null;
  let hits = [];
  let active = -1;
  const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const pageOf = (e) => new URL(encodeURIComponent(e.id) + '/', here).href;

  const load = () => entries ?? (entries = fetch(new URL('../field/species.json', here))
    .then((r) => r.json()).catch(() => []));

  const show = () => {
    list.innerHTML = hits.map((e, i) => '<li role="option" id="hit-' + i + '"' + (i === active ? ' aria-selected="true"' : '') + '>'
      + '<a href="' + pageOf(e) + '"><span class="hit-common">' + esc(e.common) + '</span> '
      + '<span class="hit-sci">' + esc(e.sci) + '</span></a></li>').join('')
      || (normalizeName(input.value).length >= 2 ? '<li class="hit-none">No species matches that.</li>' : '');
    list.hidden = !list.innerHTML;
    input.setAttribute('aria-expanded', String(!list.hidden));
    if (active >= 0) input.setAttribute('aria-activedescendant', 'hit-' + active);
    else input.removeAttribute('aria-activedescendant');
  };

  input.addEventListener('focus', load, { once: true });
  input.addEventListener('input', async () => {
    const all = await load();
    hits = rankSpecies(input.value, all, normalizeName, ${MAX_RESULTS});
    active = -1;
    show();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!hits.length) return;
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : hits.length - 1)) % hits.length;
      show();
    } else if (e.key === 'Escape') {
      hits = []; active = -1; show();
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const pick = hits[active >= 0 ? active : 0];
    if (pick) location.href = pageOf(pick);
  });
  document.addEventListener('click', (e) => { if (!form.contains(e.target)) { list.hidden = true; input.setAttribute('aria-expanded', 'false'); } });

  // The narrow-screen magnifier: the bar becomes the search, and the close
  // button gives it back. On a wide screen neither button shows (species.css).
  const bar = form.closest('.bar');
  const open = bar && bar.querySelector('.search-open');
  const setOpen = (on) => {
    bar.classList.toggle('searching', on);
    open.setAttribute('aria-expanded', String(on));
    if (on) { load(); input.focus(); } else { input.value = ''; hits = []; active = -1; show(); open.focus(); }
  };
  if (open) {
    open.addEventListener('click', () => setOpen(true));
    form.querySelector('.search-close').addEventListener('click', () => setOpen(false));
    input.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !input.value && bar.classList.contains('searching')) setOpen(false); });
    open.hidden = false;
  }
  form.hidden = false;
})();
`;

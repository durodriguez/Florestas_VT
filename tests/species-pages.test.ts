import { describe, it, expect } from 'vitest';
// @ts-expect-error -- plain .mjs module, intentionally untyped
import { renderSpeciesPage, renderSpeciesIndex } from '../scripts/lib/species-pages.mjs';

const config = { siteName: 'UVM Trees', institution: 'University of Vermont', contactEmail: 'campustrees@uvm.edu' };

const taxon = (over: Record<string, unknown> = {}) => ({
  id: 'tilia-cordata',
  sci: 'Tilia cordata',
  common: 'Littleleaf linden',
  family: 'Malvaceae',
  type: 'deciduous-tree',
  origin: 'introduced',
  flowerColor: 'yellow',
  flowerMonths: [6, 7],
  fruitColor: '',
  fruitMonths: [],
  fallColor: 'yellow',
  matureHeightFt: 60,
  matureSpreadFt: null,
  bark: '',
  pests: '',
  soil: '',
  zones: '3-7',
  wikipedia: 'https://en.wikipedia.org/wiki/Tilia_cordata',
  description: 'Small neat heart-shaped leaves.',
  funFact: 'Linden honey is prized across Europe.',
  count: 1,
  ...over,
});

const page = (t = taxon(), over: Record<string, unknown> = {}) =>
  renderSpeciesPage(t, { photos: [], areas: [], base: '/', config, ...over });

describe('renderSpeciesPage', () => {
  it('reaches the stylesheet from one directory down', () => {
    // The page is written to species/<id>/index.html and the stylesheet to
    // species/species.css, so exactly one ../ stands between them. Two 404s.
    expect(page()).toMatch(/href="\.\.\/species\.css\?v=[0-9a-f]{10}"/);
  });

  it('carries the species through to the title and the headings', () => {
    const html = page();
    expect(html).toContain('<title>Littleleaf linden (Tilia cordata) — UVM Trees</title>');
    expect(html).toContain('<h1>Littleleaf linden</h1>');
  });

  it('shows only the facts that are recorded', () => {
    const html = page();
    expect(html).toContain('Mature height');
    expect(html).toContain('60 ft');
    // Nothing has been said about spread or bark, and an empty row reads as
    // though someone measured and found nothing.
    expect(html).not.toContain('Mature spread');
    expect(html).not.toContain('>Bark<');
  });

  it('writes month ranges rather than numbers', () => {
    expect(page()).toContain('Jun–Jul');
  });

  it('puts the fun fact first in Worth knowing', () => {
    const html = page();
    const box = html.slice(html.indexOf('<aside class="worth">'), html.indexOf('</aside>'));
    expect(box).toContain('<h2>Worth knowing</h2>');
    expect(box).toMatch(/<ul><li>Linden honey is prized across Europe\.<\/li>/);
  });

  it('leaves out Worth knowing when there is nothing to put in it', () => {
    expect(page(taxon({ funFact: '' }))).not.toContain('Worth knowing');
  });

  it('links to the trees on the map when some are mapped', () => {
    const html = page(taxon({ count: 3 }), { areas: ['Central Campus', 'Redstone Campus'] });
    expect(html).toContain('3 mapped on campus');
    expect(html).toContain('Central Campus, Redstone Campus');
    expect(html).toContain('href="/?taxon=tilia-cordata"');
  });

  it('says the list runs ahead rather than showing an empty section', () => {
    const html = page(taxon({ count: 0 }));
    expect(html).not.toContain('?taxon=');
    expect(html).toContain('None mapped yet');
  });

  it('shows campus photos with the accession they came from', () => {
    const html = page(taxon(), {
      photos: [{ id: 'UVM-0493', url: 'https://uvm.edu/photos/493.webp' }],
    });
    expect(html).toContain('src="https://uvm.edu/photos/493.webp"');
    expect(html).toContain('accession UVM-0493');
    expect(html).toContain('href="/?plant=UVM-0493"');
  });

  it('has the species search in the bar, with a magnifier for narrow screens', () => {
    const html = page();
    expect(html).toMatch(/<script src="\.\.\/search\.js\?v=[0-9a-f]{10}" defer><\/script>/);
    const bar = html.slice(html.indexOf('<header class="bar">'), html.indexOf('</header>'));
    expect(bar).toContain('id="species-q"');
    expect(bar.indexOf('id="species-q"')).toBeGreaterThan(bar.indexOf('All species'));
    expect(bar).toContain('class="search-open" aria-label="Search species"');
    expect(bar).toContain('class="search-close" aria-label="Close search"');
    expect(renderSpeciesIndex([taxon()], { base: '/', config })).toMatch(/<script src="search\.js\?v=[0-9a-f]{10}" defer><\/script>/);
  });

  it('puts Wikipedia in one row beside Show them on the map', () => {
    const html = page();
    expect(html).toMatch(/<p class="actions"><a class="btn" href="\/\?taxon=tilia-cordata">Show them on the map<\/a>\s*<a class="btn" href="https:\/\/en\.wikipedia\.org\/wiki\/Tilia_cordata" rel="noopener">Wikipedia<\/a><\/p>/);
    // With nothing mapped there is no map button, and Wikipedia stands alone.
    expect(page(taxon({ count: 0 }))).toMatch(/<p class="actions"><a class="btn" href="https:\/\/en\.wikipedia[^"]*" rel="noopener">Wikipedia<\/a><\/p>/);
  });

  it('keeps campus photos out of the top of the page: all in On campus, newest first, above its button', () => {
    const html = page(taxon({ count: 2, matureSpreadFt: 40 }), {
      photos: [
        { id: 'UVM-0493', url: 'https://uvm.edu/photos/493.webp', taken: '2026-05-01' },
        { id: 'UVM-0494', url: 'https://uvm.edu/photos/494.webp', taken: '2026-09-01' },
      ],
    });
    const at = (s: string) => html.indexOf(s);
    // The drawing leads, with the description beside it.
    expect(at('<section class="hero">')).toBeGreaterThan(-1);
    expect(html.slice(at('<section class="hero">'), at('</section>'))).toContain('class="mature"');
    expect(html.slice(at('<section class="hero">'), at('</section>'))).not.toContain('.webp');
    expect(at('class="lead"')).toBe(-1);
    expect(at('2 mapped on campus')).toBeGreaterThan(at('<h2>On campus</h2>'));
    expect(at('class="shots"')).toBeGreaterThan(at('2 mapped on campus'));
    expect(at('494.webp')).toBeGreaterThan(at('class="shots"'));
    expect(at('493.webp')).toBeGreaterThan(at('494.webp'));
    expect(at('Show them on the map')).toBeGreaterThan(at('class="shots"'));
    expect(at('<h2>Characteristics</h2>')).toBeGreaterThan(at('<h2>On campus</h2>'));
  });

  it('keeps Worth knowing to the species: no campus facts', () => {
    const html = page(taxon({ count: 1 }), { trees: [{ id: 'UVM-0001', lat: 44.478, lng: -73.199, dbh: 30, campus: 'Central Campus' }] });
    const worth = html.slice(html.indexOf('class="worth"'), html.indexOf('</aside>'));
    expect(worth).toContain('Linden honey');
    expect(worth).not.toContain('mapped on campus');
    expect(worth).not.toContain('largest trunk');
  });

  it('keeps the base path so the pages work under a project URL', () => {
    const html = page(taxon(), { base: '/Florestas_VT/' });
    expect(html).toContain('href="/Florestas_VT/"');
    expect(html).toContain('href="/Florestas_VT/species/"');
    // Still relative: the stylesheet sits beside the page either way.
    expect(html).toMatch(/href="\.\.\/species\.css\?v=[0-9a-f]{10}"/);
  });

  it('escapes text that came from the CSV', () => {
    const html = page(taxon({ common: 'Pear <script>', description: 'a & b' }));
    expect(html).not.toContain('<script>');
    expect(html).toContain('Pear &lt;script&gt;');
    expect(html).toContain('a &amp; b');
  });

  it('leaves out Wikipedia when no article is recorded', () => {
    expect(page(taxon({ wikipedia: '' }))).not.toContain('Wikipedia');
  });
});

describe('renderSpeciesIndex', () => {
  it('reaches the stylesheet in its own directory', () => {
    // The index IS species/index.html, so no ../ at all.
    expect(renderSpeciesIndex([taxon()], { base: '/', config })).toMatch(/href="species\.css\?v=[0-9a-f]{10}"/);
  });

  it('sorts by common name and links to each page', () => {
    const html = renderSpeciesIndex(
      [taxon({ id: 'ulmus-americana', common: 'American elm', sci: 'Ulmus americana' }), taxon()],
      { base: '/', config },
    );
    expect(html.indexOf('American elm')).toBeLessThan(html.indexOf('Littleleaf linden'));
    expect(html).toContain('href="ulmus-americana/"');
    expect(html).toContain('href="tilia-cordata/"');
  });

  it('offers sorting by scientific name, hidden until its script runs', () => {
    const html = renderSpeciesIndex([taxon()], { base: '/', config });
    expect(html).toMatch(/<div class="sort"[^>]*hidden>/);
    expect(html).toContain('data-sort="scientific"');
    // Each row carries the name the script sorts it by.
    expect(html).toContain('data-sci="Tilia cordata"');
  });

  it('leaves out the "All species" link, which would lead back to itself', () => {
    expect(renderSpeciesIndex([taxon()], { base: '/', config })).not.toContain('All species');
    expect(page()).toContain('>All species</a>');
  });

  it('lists only species mapped on campus, and counts them', () => {
    const html = renderSpeciesIndex(
      [taxon(), taxon({ id: 'acer-nigrum', common: 'Black maple', sci: 'Acer nigrum', count: 0 })],
      { base: '/', config },
    );
    expect(html).toContain('1 species mapped on campus so far');
    expect(html).toContain('href="tilia-cordata/"');
    expect(html).not.toContain('Black maple');
  });
});

describe('Know it by, for a cultivar', () => {
  const shot = (name: string, inherited?: boolean) => ({
    title: `File:${name}.jpg`, page: `https://commons.wikimedia.org/wiki/File:${name}.jpg`,
    image: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/${name}.jpg/500px-${name}.jpg`,
    site: 'Wikimedia Commons', author: 'A. Photographer', license: 'CC BY 4.0', licenseUrl: '', ...(inherited ? { inherited } : {}),
  });
  const cultivar = taxon({ genus: 'Acer', species: 'platanoides', cultivar: 'Crimson King', family: 'Sapindaceae' });

  it('names the parts that are its species\' photos when it has some of its own', () => {
    const html = page(cultivar, { extras: { photos: { bark: shot('Bark', true), leaves: shot('Purple'), fruit: shot('Samaras', true) } } });
    expect(html).toContain('The bark and fruit shown are of <i>Acer platanoides</i>');
    expect(html).toContain('500px-Purple.jpg');
  });

  it('says all are its species\' when it has none of its own', () => {
    const html = page(cultivar, { extras: { photos: { inherited: true, bark: shot('Bark', true) } } });
    expect(html).toContain('Photos of <i>Acer platanoides</i>, the species this was selected from.');
  });
});

describe('Know it by: credits as notes, photos full size on a tap', () => {
  const shot = (name: string, author: string) => ({
    title: `File:${name}.jpg`, page: `https://commons.wikimedia.org/wiki/File:${name}.jpg`,
    image: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/${name}.jpg/500px-${name}.jpg`,
    site: 'Wikimedia Commons', author, license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  });
  const html = page(taxon(), { extras: { photos: { bark: shot('Bark', 'Ann Bark'), leaves: shot('Leaf', 'Lee Leaf') } } });
  const parts = html.slice(html.indexOf('<h2>Know it by</h2>'), html.indexOf('</section>', html.indexOf('<h2>Know it by</h2>')));

  it('keeps the credit out of the caption, as a numbered note', () => {
    const captions = [...parts.matchAll(/<figcaption>([\s\S]*?)<\/figcaption>/g)].map((m) => m[1]).join(' ');
    expect(captions).not.toContain('Ann Bark');
    expect(captions).not.toContain('CC BY');
    expect(parts).toContain('<b>Bark.</b><sup class="fn"><a href="#credit-1" id="credit-ref-1"');
    expect(parts).toContain('href="#credit-2"');
  });

  it('writes the credits out in full at the end, in order, linked back', () => {
    const credits = html.slice(html.indexOf('class="credits"'));
    expect(credits).toMatch(/<li id="credit-1">Bark: <a href="https:\/\/commons\.wikimedia\.org\/wiki\/File:Bark\.jpg" rel="noopener">Ann Bark<\/a>, <a href="https:\/\/creativecommons\.org\/licenses\/by\/4\.0\/" rel="noopener license">CC BY 4\.0<\/a>, Wikimedia Commons\./);
    expect(credits).toContain('<li id="credit-2">Leaves: ');
    expect(credits).toContain('href="#credit-ref-1"');
    expect(html.indexOf('class="credits"')).toBeGreaterThan(html.indexOf('class="sources"'));
  });

  it('opens each photo full size, the larger copy, with its credit', () => {
    expect(parts).toContain('class="shot-open"');
    expect(parts).toContain('data-full="https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Bark.jpg/960px-Bark.jpg"');
    expect(parts).toContain('data-credit="Bark. Photo: Ann Bark, CC BY 4.0, Wikimedia Commons"');
    expect(html).toContain('btn.dataset.full');
  });

  it('has no notes without photos', () => {
    expect(page()).not.toContain('class="credits"');
  });
});

describe('credits at the end of the page', () => {
  it('credits only what a license requires: no Sources line, no habitat or drawing credit', () => {
    const html = page(taxon({ matureSpreadFt: 40 }), {
      extras: { habitat: { text: 'Woods.', source: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Tilia_cordata' }, facts: [{ text: 'A fact.', source: 'Some Book', url: 'https://example.org/book' }] },
    });
    expect(html).not.toContain('<b>Sources.</b>');
    expect(html).not.toContain('Some Book');
    expect(html).not.toContain('from the mature height and spread on file');
    expect(html).not.toContain('Map credit');
  });
});

describe('Worth knowing on a cultivar\'s page', () => {
  it('adds the species\' facts marked for it, under a line naming the species', () => {
    const cultivar = taxon({ genus: 'Tilia', species: 'cordata', cultivar: 'Greenspire' });
    const html = page(cultivar, { extras: { facts: [], speciesFacts: [{ text: 'National tree of the Czech Republic.' }] } });
    const worth = html.slice(html.indexOf('class="worth"'), html.indexOf('</aside>'));
    expect(worth).toContain('Linden honey');
    expect(worth).toMatch(/Of the species, <i>Tilia cordata<\/i>:<\/p><ul><li>National tree of the Czech Republic\.<\/li>/);
  });
});

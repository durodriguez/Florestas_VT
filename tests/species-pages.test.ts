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
    expect(page()).toContain('href="../species.css"');
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

  it('keeps the base path so the pages work under a project URL', () => {
    const html = page(taxon(), { base: '/Florestas_VT/' });
    expect(html).toContain('href="/Florestas_VT/"');
    expect(html).toContain('href="/Florestas_VT/species/"');
    // Still relative: the stylesheet sits beside the page either way.
    expect(html).toContain('href="../species.css"');
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
    expect(renderSpeciesIndex([taxon()], { base: '/', config })).toContain('href="species.css"');
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

  it('counts the list and how much of it is mapped', () => {
    const html = renderSpeciesIndex([taxon(), taxon({ id: 'x', count: 0 })], { base: '/', config });
    expect(html).toContain('2 in the list');
    expect(html).toContain('1 mapped on campus so far');
  });
});

import { describe, it, expect } from 'vitest';
import { kindOf, checklist, completeness, summary, progressMarkdown } from '../scripts/lib/completeness.mjs';

const base = { id: 'x', sci: 'X y', common: 'X', family: 'Aceraceae', genus: 'X', species: 'y', infra: '', cultivar: '', type: 'deciduous-tree',
  description: 'd', funFact: 'f', flowerColor: 'red', flowerMonths: [4], fruitColor: 'red', fruitMonths: [6], fallColor: 'red',
  matureHeightFt: 40, matureSpreadFt: 30, zones: '3-9', bark: 'gray', lifespan: '100 years' };
const photo = { image: 'i' };
const fact = { text: 't' };
const know = (parts: string, extra = {}) => ({ label: parts, parts: parts.split('+'), text: 'note', ...extra });
const full = { habitat: { text: 'h' }, crownForm: 'oval', facts: [fact, fact], photos: { bark: photo, leaves: photo, buds: photo, fruit: photo },
  know: [know('bark'), know('leaves'), know('buds'), know('fruit')] };

describe('species page completeness', () => {
  it('scores a full tree page complete, and names what a bare one lacks', () => {
    expect(checklist(base, full).every((i) => i.state === 'done')).toBe(true);
    const bare = checklist({ ...base, fallColor: '' }, {});
    const missing = bare.filter((i) => i.state === 'missing').map((i) => i.item);
    expect(missing).toEqual(['worth knowing (3)', 'growing details', 'where it grows wild', 'crown shape', 'know it by photos (4)', 'know it by notes']);
    expect(bare.find((i) => i.item === 'growing details')?.detail).toBe('fall color');
    expect(bare.find((i) => i.item === 'know it by notes')?.detail).toBe('no tiles yet');
  });

  it('wants four Know it by tiles of any parts, each with a written note', () => {
    const item = (e: object, name: string) => checklist(base, { ...full, ...e }).find((i) => i.item === name);
    expect(item({ photos: { ...full.photos, fruit: undefined } }, 'know it by photos (4)')).toMatchObject({ state: 'missing', detail: '3 of 4' });
    // A tile without a note falls back to a caption: the notes item names it.
    expect(item({ know: full.know.slice(0, 3) }, 'know it by notes')).toMatchObject({ state: 'missing', detail: 'none on fruit' });
    expect(item({ photos: { ...full.photos, inherited: true, bark: { ...photo, inherited: true } }, know: [know('bark', { inherited: true }), ...full.know.slice(1)] }, 'know it by notes')?.state).toBe('borrowed');
  });

  it('leaves out what does not apply: a fern\'s bark, flowers and fruit; fruit on a fruitless clone; a genus page\'s photos', () => {
    const fronds = { fronds: photo, fiddleheads: photo, spores: photo, underside: photo };
    const fern = checklist({ ...base, family: 'Dryopteridaceae', type: 'perennial', flowerColor: '', flowerMonths: [], fruitColor: '', fruitMonths: [], fallColor: '', bark: '', lifespan: '' },
      { habitat: { text: 'h' }, facts: [fact, fact], photos: fronds, know: Object.keys(fronds).map((p) => know(p)) });
    expect(fern.every((i) => i.state === 'done')).toBe(true);
    expect(checklist({ ...base, lifespan: '' }, full).find((i) => i.item === 'growing details')?.detail).toBe('lifespan');
    expect(checklist({ ...base, species: '' }, { kin: [{}] }).map((i) => i.item)).toEqual(['description', 'fun fact', 'worth knowing (3)', '"Which one?" leaves']);
    expect(kindOf({ ...base, species: '', sci: 'Forsythia sp.' })).toBe('genus');
    expect(kindOf({ ...base, species: '', sci: 'Acer griseum x maximowiczianum' })).toBe('hybrid');
  });

  it('counts a borrowed photo as filled, and sorts campus pages first, least complete first', () => {
    const borrowed = checklist({ ...base, cultivar: 'C' }, { ...full, photos: { ...full.photos, inherited: true, bark: { ...photo, inherited: true } } });
    expect(borrowed.find((i) => i.item === 'know it by photos (4)')?.state).toBe('borrowed');
    const taxa = [{ ...base, id: 'a' }, { ...base, id: 'b' }, { ...base, id: 'c' }];
    const extras = new Map<string, object>([['a', full], ['b', {}], ['c', {}]]);
    const rows = completeness(taxa, extras, { a: 5, b: 1 });
    expect(rows.map((r) => r.id)).toEqual(['b', 'a', 'c']);
    expect(summary(rows).complete).toBe(1);
    expect(progressMarkdown(rows, '2026-01-01')).toContain('- [ ] **X** (`b`, 1 on campus)');
  });

  it('wants three things worth knowing, counting a cultivar\'s species\' facts as borrowed', () => {
    const worth = (t: object, e: object) => checklist({ ...base, ...t }, e).find((i) => i.item === 'worth knowing (3)');
    expect(worth({}, { facts: [fact] })).toMatchObject({ state: 'missing', detail: '2 of 3' });
    expect(worth({}, { facts: [fact, fact] })?.state).toBe('done');
    expect(worth({ cultivar: 'C' }, { speciesFacts: [fact, fact] })?.state).toBe('borrowed');
  });
});

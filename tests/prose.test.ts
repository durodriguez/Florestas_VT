import { describe, it, expect } from 'vitest';
// @ts-expect-error -- plain .mjs module, intentionally untyped
import { checkProse, firstSentence, longestSharedRun, vocabularyOverlap } from '../scripts/lib/prose.mjs';

describe('firstSentence', () => {
  it('takes the opening sentence, which is what a reader meets first', () => {
    expect(firstSentence('One. Two. Three.')).toBe('One.');
    expect(firstSentence('A sentence with no stop')).toBe('A sentence with no stop');
    expect(firstSentence('')).toBe('');
  });
});

describe('longestSharedRun', () => {
  it('finds the echoed phrase, wherever it sits in each text', () => {
    const r = longestSharedRun('the lower branches sweep downward', 'its lower branches sweep down to the ground');
    expect(r.words).toEqual(['lower', 'branches', 'sweep']);
    // Where it falls is the part that matters — see the two tests below.
    expect(r.aStart).toBe(1);
    expect(r.bStart).toBe(1);
  });

  it('gives back nothing when two texts share no run', () => {
    expect(longestSharedRun('bark like alligator hide', 'flowers open in July').words).toEqual([]);
  });
});

describe('vocabularyOverlap', () => {
  it('measures against the shorter text, so a contained restatement scores high', () => {
    // The fun fact says nothing the description did not, in fewer words.
    const d = 'Inner bark is bright orange-yellow and was once used as a dye by the shipload.';
    const f = 'The inner bark is bright orange-yellow.';
    expect(vocabularyOverlap(d, f)).toBeGreaterThan(0.9);
  });

  it('ignores short and common words, which two sentences share by accident', () => {
    expect(vocabularyOverlap('it has a red fruit', 'it has a red bark')).toBe(0);
  });
});

describe('checkProse', () => {
  const row = (over: Record<string, string> = {}) => ({
    taxon_id: 'quercus-test', common_name: 'Test oak',
    description: 'Bark is deeply furrowed and grey.',
    fun_fact: 'Squirrels strip the acorns before they fall.',
    ...over,
  });

  it('passes an entry whose fun fact says something new', () => {
    expect(checkProse([row()]).issues).toHaveLength(0);
  });

  it('catches the pin oak, which is the fault this exists for', () => {
    // Verbatim as it stood before 23 September 2026. Whole-text overlap put
    // it at 30% and cleared it, because the two diverge after a few words —
    // but a reader meets the openings, and both opened the same way.
    const r = checkProse([row({
      common_name: 'Pin oak',
      description: 'Lower branches sweep distinctly downward while the upper ones rise — a silhouette no other oak shares. Deeply cut leaves turn bronze-red.',
      fun_fact: 'The lower branches sweep down to the ground and stay there, which is unmistakable — and which is why it needs more room than people give it.',
    })]);
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0].reasons[0]).toMatch(/both open with "lower branches sweep"/);
  });

  it('catches a long shared run even when it opens neither sentence', () => {
    const r = checkProse([row({
      description: 'The corky bark is soft enough to dent with a thumbnail.',
      fun_fact: 'Thick and deeply corky, soft enough to dent with a thumbnail, which the name records.',
    })]);
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0].reasons[0]).toMatch(/words in a row/);
  });

  it('catches a restatement that shares no long phrase at all', () => {
    // Reworded rather than echoed, which the phrase test alone would miss.
    const r = checkProse([row({
      description: 'Carries the largest simple leaves of any tree in North America, three feet long.',
      fun_fact: 'No North American tree has larger simple leaves; they reach three feet.',
    })]);
    expect(r.issues).toHaveLength(1);
  });

  it('does not flag shared subject matter', () => {
    // A green ash naming the borer twice is staying on topic, not repeating
    // itself. Position is the giveaway: the run ends one sentence and opens
    // the other. A plain length test called this four words and flagged it,
    // because "the" padded a three-word name.
    const r = checkProse([row({
      common_name: 'Green ash',
      description: 'Being killed across its range by the emerald ash borer.',
      fun_fact: 'The emerald ash borer arrived in packing timber and spread along firewood routes.',
    })]);
    expect(r.issues).toHaveLength(0);
  });

  it('reports one fun fact used on two taxa', () => {
    const r = checkProse([row(), row({ taxon_id: 'quercus-other', common_name: 'Other oak' })]);
    expect(r.duplicates).toHaveLength(1);
    expect(r.duplicates[0]).toMatchObject({ name: 'Other oak', sameAs: 'Test oak' });
  });

  it('skips a taxon missing either piece of prose rather than flagging it', () => {
    const r = checkProse([row({ fun_fact: '' }), row({ description: '' })]);
    expect(r.summary.compared).toBe(0);
    expect(r.issues).toHaveLength(0);
  });

  it('puts the most obvious echo first', () => {
    const r = checkProse([
      row({ taxon_id: 'a', description: 'Alpha beta gamma delta epsilon zeta.', fun_fact: 'Alpha beta gamma delta and more besides.' }),
      row({ taxon_id: 'b', description: 'Alpha beta gamma delta epsilon zeta eta theta.', fun_fact: 'Alpha beta gamma delta epsilon zeta eta theta.' }),
    ]);
    expect(r.issues[0].taxon_id).toBe('b');
  });
});

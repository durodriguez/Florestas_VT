// Catching a description and a fun fact that say the same thing.
//
// Every taxon carries two pieces of prose. The description is what a tree is;
// the fun fact is the thing worth knowing that the description had no room
// for. When the second merely restates the first, opening the fold gives a
// reader nothing, and the entry quietly wastes the only place this project
// has to be interesting.
//
// It takes TWO measures, because one is not enough and that was learned the
// hard way. A first pass compared whole texts and cleared the pin oak at 30%,
// since its two texts diverge after a few words. But both OPENED with "lower
// branches sweep down", which is the part a reader meets first — and a reader
// noticed. Shared vocabulary and an echoed opening phrase are different
// faults, and an entry can have either without the other.
//
// What is deliberately NOT flagged is shared subject matter. An ash entry
// naming the emerald ash borer in both fields is not repeating itself, it is
// staying on topic. That is why a short shared run alone is not enough: it has
// to be long, or accompanied by heavy shared vocabulary.

/** Words too common to mean anything when two sentences share them. */
const STOP = new Set([
  'that', 'with', 'this', 'from', 'when', 'they', 'their', 'which', 'have',
  'been', 'into', 'than', 'most', 'more', 'over', 'only', 'also', 'other',
  'like', 'once', 'tree', 'trees', 'them', 'some', 'what', 'while', 'where',
  'very', 'such', 'both', 'each', 'then', 'here', 'because', 'about',
]);

/** A run this long is an echo wherever it falls in the two sentences. */
export const ECHO_WORDS = 5;
/** A shorter run counts when both sentences OPEN with it, or when the rest
 *  of their vocabulary is shared too. */
export const ECHO_WORDS_IN_PLACE = 3;
/** How far into a sentence a run can start and still count as its opening. */
export const OPENING_WORDS = 2;
export const OPENING_OVERLAP = 0.5;
/** Whole-text overlap above this is a restatement however it is phrased. */
export const TEXT_OVERLAP = 0.6;

/** The first sentence, which is the part a reader meets first. */
export function firstSentence(text) {
  const s = String(text ?? '').trim();
  const m = s.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : s).trim();
}

const words = (text) =>
  String(text ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);

/** Content words worth comparing: long enough to carry meaning, not a stopword. */
function contentWords(text) {
  const set = new Set(words(text).filter((w) => w.length > 3));
  for (const s of STOP) set.delete(s);
  return set;
}

/**
 * How much of the shorter text's vocabulary the longer one also uses.
 *
 * Against the smaller set rather than the union, because a one-line fun fact
 * wholly contained in a long description is a total restatement and should
 * score as one.
 */
export function vocabularyOverlap(a, b) {
  const x = contentWords(a);
  const y = contentWords(b);
  if (x.size < 3 || y.size < 3) return 0;
  const shared = [...x].filter((w) => y.has(w)).length;
  return shared / Math.min(x.size, y.size);
}

/**
 * The longest run of consecutive words appearing in both texts, and where it
 * starts in each.
 *
 * Position is the part that matters, and it is what separates an echo from a
 * subject. "Lower branches sweep" opens both of the pin oak's sentences, which
 * is repetition. "The emerald ash borer" ends one of the green ash's and opens
 * the other, which is a tree and a beetle being discussed twice, correctly.
 */
export function longestSharedRun(a, b) {
  const x = words(a);
  const y = words(b);
  let best = { words: [], aStart: -1, bStart: -1 };
  for (let i = 0; i < x.length; i += 1) {
    for (let j = 0; j < y.length; j += 1) {
      let k = 0;
      while (i + k < x.length && j + k < y.length && x[i + k] === y[j + k]) k += 1;
      if (k > best.words.length) best = { words: x.slice(i, i + k), aStart: i, bStart: j };
    }
  }
  return best;
}

/**
 * @param {object[]} taxaRows  data/taxa.csv rows
 * @returns {{ issues: object[], duplicates: object[], summary: object }}
 */
export function checkProse(taxaRows) {
  const issues = [];
  const duplicates = [];
  const seenFacts = new Map();
  let compared = 0;

  for (const row of taxaRows) {
    const name = String(row.common_name ?? row.taxon_id ?? '').trim();
    const description = String(row.description ?? '').trim();
    const fact = String(row.fun_fact ?? '').trim();
    if (!description || !fact) continue;
    compared += 1;

    // Two entries with the same fun fact is a copy-paste, not a near miss.
    const prior = seenFacts.get(fact);
    if (prior) duplicates.push({ taxon_id: row.taxon_id, name, sameAs: prior });
    else seenFacts.set(fact, name);

    const run = longestSharedRun(firstSentence(description), firstSentence(fact));
    const phrase = run.words.join(' ');
    const inPlace = run.aStart <= OPENING_WORDS && run.bStart <= OPENING_WORDS;
    const opening = vocabularyOverlap(firstSentence(description), firstSentence(fact));
    const whole = vocabularyOverlap(description, fact);

    const reasons = [];
    if (run.words.length >= ECHO_WORDS) {
      reasons.push(`openings share ${run.words.length} words in a row: "${phrase}"`);
    } else if (run.words.length >= ECHO_WORDS_IN_PLACE && inPlace) {
      reasons.push(`both open with "${phrase}"`);
    } else if (run.words.length >= ECHO_WORDS_IN_PLACE && opening >= OPENING_OVERLAP) {
      reasons.push(`openings share "${phrase}" and ${(opening * 100).toFixed(0)}% of their words`);
    }
    if (whole >= TEXT_OVERLAP) {
      reasons.push(`${(whole * 100).toFixed(0)}% of the whole text is shared`);
    }

    if (reasons.length) {
      issues.push({
        taxon_id: row.taxon_id,
        name,
        reasons,
        run: run.words.length,
        whole,
        description: firstSentence(description),
        fact: firstSentence(fact),
      });
    }
  }

  // Worst first: a long echo is more obvious to a reader than a diffuse one.
  issues.sort((a, b) => b.run - a.run || b.whole - a.whole);

  return {
    issues,
    duplicates,
    summary: { compared, issues: issues.length, duplicates: duplicates.length },
  };
}

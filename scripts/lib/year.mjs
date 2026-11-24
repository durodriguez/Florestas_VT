/**
 * A species' year, for its species page: the same table and words as a tree's
 * page in the field guide (src/fieldguide/year.ts, which documents the rules).
 *
 * Written twice on purpose, as photoTaken() is: src/ is TypeScript compiled
 * by Vite, scripts/ is plain .mjs run by Node. tests/year-mirror.test.ts runs
 * both over every species in taxa.csv and fails if they ever disagree.
 */

// From src/season.ts.
const EVERGREEN = '#12501a';
const LEAF = '#4ea72e';
const LEAF_MONTHS = new Set([5, 6, 7, 8, 9, 10]);
const FALL_MONTH = 10;
const LEAF_TINTS = {
  purple: '#6e3454', 'red-purple': '#7c2c4a', 'purple-red': '#873247', gold: '#d6b02a', yellow: '#dcc64a',
  'yellow-green': '#a7c04a', 'blue-gray': '#7d99ab',
};
const leafTint = (word) => LEAF_TINTS[(word ?? '').trim().toLowerCase()] ?? null;
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const COLORS = {
  white: '#f7f4ea', cream: '#efe2b0', yellow: '#f2c934', gold: '#e0a91c', orange: '#e57a1f',
  red: '#cf3b45', pink: '#f19cbb', purple: '#8e5bb8', blue: '#4166b0', black: '#2b2b2b',
  green: '#7cae45', brown: '#8a5a33', tan: '#c8a46e', gray: '#9a9f9b', bronze: '#a8742f',
};

export function colorOf(word) {
  const w = (word ?? '').trim().toLowerCase();
  if (!w || w === 'none') return null;
  if (COLORS[w]) return COLORS[w];
  const [a, b] = w.split('-');
  if (a && b && COLORS[a] && COLORS[b]) return `color-mix(in srgb, ${COLORS[a]} 50%, ${COLORS[b]})`;
  return COLORS.gray;
}

const CONE_FAMILIES = new Set(['Pinaceae', 'Cupressaceae']);
export const fruitWord = (t) => (CONE_FAMILIES.has(t.family) ? 'cones' : 'fruit');

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const months = (f) => Array.from({ length: 12 }, (_, i) => f(i + 1));

export function yearTable(t) {
  const evergreen = t.type === 'evergreen-tree';
  const fall = colorOf(t.fallColor);
  const flower = colorOf(t.flowerColor);
  const fruit = colorOf(t.fruitColor);
  const word = fruitWord(t);
  const tint = leafTint(t.leafColor);
  const leafWord = tint ? `${cap(t.leafColor)} ${evergreen ? 'foliage' : 'leaves'}` : '';
  return [
    {
      label: 'Leaves',
      cells: months((m) => evergreen ? { color: tint ?? EVERGREEN, title: tint ? `Evergreen, ${leafWord.toLowerCase()}` : 'Evergreen' }
        : m === FALL_MONTH && fall ? { color: fall, title: `${cap(t.fallColor)} fall color` }
          : LEAF_MONTHS.has(m) ? { color: tint ?? LEAF, title: tint ? leafWord : 'In leaf' } : null),
    },
    { label: 'Flowers', cells: months((m) => flower && t.flowerMonths.includes(m) ? { color: flower, title: `${cap(t.flowerColor)} flowers` } : null) },
    { label: cap(word), cells: months((m) => fruit && t.fruitMonths.includes(m) ? { color: fruit, title: `${cap(t.fruitColor)} ${word}` } : null) },
  ];
}

export function monthRuns(list) {
  const set = new Set(list.filter((m) => m >= 1 && m <= 12));
  if (set.size === 0) return '';
  if (set.size === 12) return 'all year';
  const runs = [];
  for (let m = 1; m <= 12; m++) {
    if (!set.has(m) || set.has(m === 1 ? 12 : m - 1)) continue;
    const run = [m];
    for (let n = m === 12 ? 1 : m + 1; set.has(n); n = n === 12 ? 1 : n + 1) run.push(n);
    runs.push(run);
  }
  const name = (m) => MONTH_NAMES[m - 1];
  const parts = runs.map((r) => (r.length === 1 ? name(r[0]) : `${name(r[0])} to ${name(r.at(-1))}`));
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

export function yearSummary(t) {
  const when = (list) => {
    const text = monthRuns(list);
    return text === 'all year' ? text : text.includes(' to ') ? `from ${text}` : `in ${text}`;
  };
  const parts = [];
  if (colorOf(t.flowerColor) && t.flowerMonths.length) {
    parts.push([Math.min(...t.flowerMonths), `${cap(t.flowerColor)} flowers ${when(t.flowerMonths)}.`]);
  }
  if (colorOf(t.fruitColor) && t.fruitMonths.length) {
    parts.push([Math.min(...t.fruitMonths) + 0.1, `${cap(t.fruitColor)} ${fruitWord(t)} ${when(t.fruitMonths)}.`]);
  }
  if (t.type !== 'evergreen-tree' && colorOf(t.fallColor)) {
    parts.push([FALL_MONTH + 0.2, `${cap(t.fallColor)} fall color in ${MONTH_NAMES[FALL_MONTH - 1]}.`]);
  }
  if (leafTint(t.leafColor)) {
    const evergreen = t.type === 'evergreen-tree';
    const inLeaf = [...LEAF_MONTHS].filter((m) => !(m === FALL_MONTH && colorOf(t.fallColor)));
    parts.push(evergreen ? [0, `${cap(t.leafColor)} foliage all year.`] : [Math.min(...inLeaf) - 0.1, `${cap(t.leafColor)} leaves ${when(inLeaf)}.`]);
  }
  return parts.sort((a, b) => a[0] - b[0]).map(([, text]) => text).join(' ');
}

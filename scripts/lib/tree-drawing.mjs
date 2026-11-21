/**
 * A drawing of a tree at maturity, for its species page: a crown of leafy
 * dabs on a trunk, drawn to scale from taxa.csv's mature height and spread,
 * with a person beside it for scale and a guide every 20 ft.
 *
 * A first version, to be replaced by better drawings. The crown's shape comes
 * from the family until taxa.csv says otherwise: conifers a cone, everything
 * else an oval. The dabs are placed at random, seeded by the taxon's id, so a
 * species' drawing is the same on every build. No DOM here.
 */

/**
 * Pixels per foot, the same for every species, so their drawings compare: a
 * small tree's frame is shorter, not its feet larger.
 */
const PX = 3.4;
const WIDTH = 300;

const CONIFERS = new Set(['Pinaceae', 'Cupressaceae', 'Taxaceae', 'Sciadopityaceae', 'Araucariaceae']);

/** Greens, light to dark: the side the light comes from first. */
const DECIDUOUS = ['#8dbb62', '#6fa14e', '#578a3e', '#447433', '#335f29'];
const EVERGREEN = ['#5f8f56', '#4a7a45', '#3a6838', '#2d562e', '#224525'];

/** A small, seedable random number generator (mulberry32). */
function random(seed) {
  let a = 0;
  for (const ch of seed) a = (Math.imul(a, 31) + ch.charCodeAt(0)) | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The crown's shape, from the family for now. */
export function crownForm(taxon) {
  return CONIFERS.has(taxon.family) ? 'conical' : 'oval';
}

/**
 * The drawing as SVG, or '' when there is nothing to draw it from: not a
 * tree, or no mature height or spread on file.
 */
export function treeDrawing(taxon) {
  const tree = taxon.type === 'deciduous-tree' || taxon.type === 'evergreen-tree';
  const h = taxon.matureHeightFt;
  const w = taxon.matureSpreadFt;
  if (!tree || !h || !w) return '';
  const rnd = random(taxon.id);
  const form = crownForm(taxon);
  const palette = taxon.type === 'evergreen-tree' ? EVERGREEN : DECIDUOUS;
  const frameFt = Math.max(40, Math.ceil((h + 8) / 20) * 20);
  const H = Math.round(frameFt * PX) + 24;
  const ground = H - 12;
  const half = Math.min((w * PX) / 2, WIDTH / 2 - 34);
  const cx = WIDTH / 2 - 6;
  const top = ground - h * PX;
  const out = [];

  for (let ft = 0; ft <= frameFt; ft += 20) {
    const y = ground - ft * PX;
    out.push(`<line class="td-guide" x1="30" x2="${WIDTH - 4}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}"/><text class="td-ft" x="26" y="${(y + 3).toFixed(1)}" text-anchor="end">${ft} ft</text>`);
  }
  out.push(`<ellipse class="td-shade" cx="${cx}" cy="${ground}" rx="${(half * 1.1).toFixed(0)}" ry="4"/>`);

  let inside;
  if (form === 'conical') {
    // Widest just above the ground, to a point at the top.
    const base = ground - Math.min(7, h * 0.12) * PX;
    inside = (x, y) => y >= top && y <= base && Math.abs(x - cx) < half * ((y - top) / (base - top)) ** 0.85;
    const t = h * PX * 0.85;
    out.push(`<path class="td-trunk" d="M${cx - 4} ${ground}q-7 1-10-1q5-2 7-10l2-${t.toFixed(0)}h2l2 ${t.toFixed(0)}q2 8 7 10q-3 2-10 1z"/>`);
  } else {
    // An oval from a clear trunk about a sixth of the height up.
    const clear = Math.max(6, h * 0.18) * PX;
    const cy = (top + ground - clear) / 2;
    const ry = (ground - clear - top) / 2;
    inside = (x, y) => ((x - cx) / half) ** 2 + ((y - cy) / ry) ** 2 < 1;
    const fork = ground - clear - ry * 0.35;
    const f = (v) => v.toFixed(1);
    // A trunk, and three limbs into the crown, mostly hidden by the leaves.
    out.push(`<path class="td-trunk" d="M${f(cx - 4.5)} ${ground}L${f(cx - 2.5)} ${f(fork)}L${f(cx + 2.5)} ${f(fork)}L${f(cx + 4.5)} ${ground}Z"/>`);
    out.push(`<path class="td-limb" d="M${f(cx - 1)} ${f(fork + 4)}L${f(cx - half * 0.45)} ${f(fork - ry * 0.55)}M${f(cx + 1)} ${f(fork + 4)}L${f(cx + half * 0.4)} ${f(fork - ry * 0.5)}M${f(cx)} ${f(fork)}L${f(cx)} ${f(fork - ry * 0.8)}"/>`);
  }

  // Dabs of leaves, enough to fill the crown whatever its size.
  const want = Math.round(Math.min(520, Math.max(90, (half * 2 * (ground - top)) / 26)));
  const dabs = [];
  for (let tries = 0; dabs.length < want && tries < want * 40; tries++) {
    const x = cx - half + rnd() * half * 2;
    const y = top + rnd() * (ground - top);
    if (inside(x, y)) dabs.push([x, y]);
  }
  dabs.sort((a, b) => a[1] - b[1]);
  for (const [x, y] of dabs) {
    // Lighter toward the top left, where the light comes from.
    const shade = Math.max(0, Math.min(palette.length - 1,
      Math.floor(((x - cx + half) / (2 * half)) * 1.2 + ((y - top) / (ground - top)) * 1.6 + (rnd() - 0.5) * 1.2)));
    out.push(`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(3 + rnd() * 3.4).toFixed(1)}" fill="${palette[shade]}"/>`);
  }

  // A person, 6 ft tall, beside the tree.
  const px = Math.min(WIDTH - 12, cx + half + 16);
  const ph = 6 * PX;
  out.push(`<g class="td-person"><circle cx="${px}" cy="${(ground - ph + 2.2).toFixed(1)}" r="2.2"/><path d="M${px - 2.4} ${(ground - ph + 5).toFixed(1)}h4.8l1.2 7.4h-1.6l-.9-5v${(ph - 9.5).toFixed(1)}h-1.7v-8.2h-.4v8.2h-1.7v-${(ph - 9.5).toFixed(1)}l-.9 5h-1.6z"/></g>`);
  out.push(`<line class="td-ground" x1="8" x2="${WIDTH - 4}" y1="${ground}" y2="${ground}"/>`);

  return `<svg class="tree-drawing" viewBox="0 0 ${WIDTH} ${H}" role="img" aria-label="Drawing of a ${taxon.common.toLowerCase()} at maturity, about ${h} ft tall and ${w} ft wide, beside a person">${out.join('')}</svg>`;
}

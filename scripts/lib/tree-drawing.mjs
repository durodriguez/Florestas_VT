/**
 * A drawing of a tree at maturity, for its species page: a trunk, its main
 * limbs and clusters of leaves, drawn to scale from taxa.csv's mature height
 * and spread, with a person beside it for scale and a guide every 20 ft.
 *
 * The crown's shape is the species' crown form (data/crown-forms.csv): one of
 * FORMS below. Without one, conifers are a cone and everything else an oval.
 * Everything random is seeded by the taxon's id, so a species' drawing is the
 * same on every build. Light comes from the upper left: each cluster is
 * lighter on that side and darker beneath, and the crown as a whole darker
 * toward the lower right. No DOM here.
 */

/**
 * Pixels per foot, the same for every species, so their drawings compare: a
 * small tree's frame is shorter, not its feet larger.
 */
const PX = 3.4;
const WIDTH = 300;

const CONIFERS = new Set(['Pinaceae', 'Cupressaceae', 'Taxaceae', 'Sciadopityaceae', 'Araucariaceae']);

/**
 * Each form: where the crown starts, as a share of the height up the trunk;
 * its half-width at each height through it (t from 0 at the crown's base to 1
 * at the top, as a share of half the spread); whether the trunk runs to the
 * top (a leader, as conifers have) or divides into main limbs, and where
 * those limbs reach (t again); and how dense the leaves are, 1 being full.
 * Weeping and tiered trees are built their own way.
 */
const FORMS = {
  rounded: { base: 0.3, leader: false, reach: [0.45, 0.9], density: 1, width: (t) => Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)) ** 0.75 },
  oval: { base: 0.22, leader: false, reach: [0.5, 0.92], density: 1, width: (t) => Math.sqrt(Math.max(0, 1 - ((t - 0.45) / (t < 0.45 ? 0.45 : 0.55)) ** 2)) },
  pyramidal: { base: 0.12, leader: true, density: 0.95, width: (t) => Math.min(1, 1.1 * (1 - t) ** 0.85) * (0.75 + 0.25 * Math.min(1, t * 5)) },
  conical: { base: 0.04, leader: true, density: 1.1, width: (t) => (1 - t) ** 0.95 },
  columnar: { base: 0.1, leader: true, density: 1.1, width: (t) => Math.sin(Math.PI * Math.min(1, t * 1.05)) ** 0.35 },
  spreading: { base: 0.4, leader: false, reach: [0.25, 0.75], density: 0.65, width: (t) => Math.sqrt(Math.max(0, 1 - t ** 1.6)) * (0.85 + 0.15 * Math.min(1, t * 4)) },
  vase: { base: 0.32, leader: false, reach: [0.6, 0.95], density: 0.9, width: (t) => (0.12 + 0.88 * Math.sin((Math.min(1, t * 1.35) * Math.PI) / 2)) * Math.sqrt(Math.max(0, 1 - Math.max(0, (t - 0.74) / 0.26) ** 2)) },
  weeping: { base: 0.6, leader: false },
  tiered: { base: 0.22, leader: true },
};
export const CROWN_FORMS = Object.keys(FORMS);

/** Greens, light to dark. */
const DECIDUOUS = ['#b2d488', '#93bf6a', '#77a852', '#5e9040', '#477733', '#355e28', '#264720'];
const EVERGREEN = ['#8fb27a', '#6f985e', '#557f4b', '#43693e', '#345633', '#284529', '#1c341e'];

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

/** The crown's form: the one on file, else a cone for conifers and an oval for the rest. */
export function crownForm(taxon) {
  if (taxon.crownForm && FORMS[taxon.crownForm]) return taxon.crownForm;
  return CONIFERS.has(taxon.family) ? 'conical' : 'oval';
}

const f1 = (v) => v.toFixed(1);
const curve = (a, b, bend) => `M${f1(a[0])} ${f1(a[1])}Q${f1((a[0] + b[0]) / 2 + bend[0])} ${f1((a[1] + b[1]) / 2 + bend[1])} ${f1(b[0])} ${f1(b[1])}`;

/**
 * The drawing as SVG, or '' when there is nothing to draw it from: not a
 * tree, or no mature height or spread on file.
 */
export function treeDrawing(taxon) {
  const isTree = taxon.type === 'deciduous-tree' || taxon.type === 'evergreen-tree';
  const h = taxon.matureHeightFt;
  const w = taxon.matureSpreadFt;
  if (!isTree || !h || !w) return '';
  const rnd = random(taxon.id);
  const name = crownForm(taxon);
  const form = FORMS[name];
  const conifer = CONIFERS.has(taxon.family);
  const palette = taxon.type === 'evergreen-tree' ? EVERGREEN : DECIDUOUS;
  const frameFt = Math.max(40, Math.ceil((h + 8) / 20) * 20);
  const H = Math.round(frameFt * PX) + 24;
  const ground = H - 12;
  const half = Math.min((w * PX) / 2, WIDTH / 2 - 30);
  const cx = WIDTH / 2 - 8;
  const top = ground - h * PX;
  const base = ground - h * PX * form.base;
  const trunkW = Math.max(2.5, Math.min(7, half / 9));
  const out = [];

  for (let ft = 0; ft <= frameFt; ft += 20) {
    const y = ground - ft * PX;
    out.push(`<line class="td-guide" x1="30" x2="${WIDTH - 4}" y1="${f1(y)}" y2="${f1(y)}"/><text class="td-ft" x="26" y="${f1(y + 3)}" text-anchor="end">${ft} ft</text>`);
  }
  out.push(`<ellipse class="td-shade" cx="${cx}" cy="${ground}" rx="${f1(half * 1.05)}" ry="4"/>`);

  // The size of a cluster of leaves, a little larger on a larger tree.
  const R = 11 * Math.max(0.7, Math.min(1.25, Math.sqrt(half * (ground - top)) / 110));
  /** Clusters of leaves: { x, y, r, sx, sy } (sx, sy stretch its dabs). */
  const clusters = [];
  /** Wood: paths with a width. */
  const wood = [];
  /** Points on the main limbs, for twigs to start from. */
  const holds = [];
  const limb = (a, b, width, bend = [0, 0], steps = 6) => {
    wood.push({ d: curve(a, b, bend), width });
    for (let i = 1; i <= steps; i++) {
      const s = i / steps;
      const mx = (a[0] + b[0]) / 2 + bend[0];
      const my = (a[1] + b[1]) / 2 + bend[1];
      holds.push([(1 - s) ** 2 * a[0] + 2 * (1 - s) * s * mx + s * s * b[0], (1 - s) ** 2 * a[1] + 2 * (1 - s) * s * my + s * s * b[1]]);
    }
  };

  if (name === 'weeping') {
    // A trunk to about three fifths of the height; limbs arch up and over
    // from it and hang in curtains, some nearly to the ground.
    const fork = base;
    limb([cx, ground], [cx, fork], trunkW, [0, 0], 4);
    const arches = 8;
    for (let i = 0; i < arches; i++) {
      const dir = i % 2 ? 1 : -1;
      const out1 = half * (0.25 + 0.75 * ((Math.floor(i / 2) + 1) / (arches / 2))) * (0.85 + rnd() * 0.2);
      const peak = [cx + dir * out1 * 0.45, top + rnd() * (fork - top) * 0.25];
      const end = [cx + dir * out1, ground - h * PX * (0.08 + rnd() * 0.3)];
      wood.push({ d: `M${f1(cx)} ${f1(fork)}Q${f1(peak[0])} ${f1(peak[1] - 10)} ${f1(end[0])} ${f1(end[1])}`, width: Math.max(0.8, trunkW * 0.35) });
      // Leaves along the arch's fall: from its top down its curtain.
      for (let s = 0.35; s <= 1; s += 0.09) {
        const x = (1 - s) ** 2 * cx + 2 * (1 - s) * s * peak[0] + s * s * end[0];
        const y = (1 - s) ** 2 * fork + 2 * (1 - s) * s * (peak[1] - 10) + s * s * end[1];
        clusters.push({ x: x + (rnd() - 0.5) * 4, y, r: R * 0.75, sx: 0.55, sy: 1.5 });
      }
    }
  } else if (name === 'tiered') {
    // An old white pine: a trunk to the top, level limbs at uneven heights,
    // each a long flat spray, longer on one side, and a small irregular top.
    limb([cx, ground], [cx, top + R * 0.5], trunkW, [0, 0], 2);
    const tiers = Math.max(4, Math.round((base - top) / (R * 2.1)));
    for (let i = 0; i < tiers; i++) {
      const y = base - ((i + 0.5) / tiers) * (base - top) + (rnd() - 0.5) * R * 0.8;
      const reach = half * (0.5 + 0.5 * (1 - i / tiers)) * (0.75 + rnd() * 0.45);
      const side = rnd() < 0.5 ? -1 : 1;
      for (const dir of [side, -side]) {
        const len = dir === side ? reach : reach * (0.35 + rnd() * 0.5);
        wood.push({ d: curve([cx, y + 2], [cx + dir * len, y - len * 0.08], [0, 3]), width: Math.max(0.9, trunkW * 0.45) });
        // A spray is thicker near the trunk, and tufted: clusters a little
        // above and below the limb, and now and then a gap.
        for (let d = R * 0.5; d < len; d += R * 0.7) {
          if (rnd() < 0.12) continue;
          const thick = 1 - (d / len) * 0.5;
          clusters.push({ x: cx + dir * d, y: y - d * 0.08 - R * (0.2 + rnd() * 0.5) * thick, r: R * (0.6 + rnd() * 0.4) * thick, sx: 1.45, sy: 0.75 });
          if (rnd() < 0.6 * thick) clusters.push({ x: cx + dir * (d + R * 0.3), y: y - d * 0.08 - R * (0.75 + rnd() * 0.4) * thick, r: R * 0.55 * thick, sx: 1.3, sy: 0.8 });
        }
      }
    }
    // The top: a few uneven tufts, often leaning, as a pine's does once its
    // leader stops outgrowing its side branches.
    const lean = (rnd() - 0.5) * R * 1.6;
    for (let i = 0; i < 6; i++) clusters.push({ x: cx + lean * (1 - i / 6) + (rnd() - 0.5) * R * 1.6, y: top + R * (0.5 + i * 0.55), r: R * (0.55 + rnd() * 0.25), sx: 1.4, sy: 0.75 });
  } else {
    // Clusters spread through the outline, kept apart so gaps show the wood.
    const inside = (x, y) => {
      if (y < top || y > base) return false;
      return Math.abs(x - cx) <= half * form.width((base - y) / (base - top));
    };
    const gap = R * (form.density >= 1 ? 1.2 : 1.45);
    const want = Math.round(Math.min(80, Math.max(8, (form.density * (half * 2) * (base - top)) / (R * R * 2.3))));
    for (let tries = 0; clusters.length < want && tries < want * 80; tries++) {
      const x = cx - half + rnd() * half * 2;
      const y = top + rnd() * (base - top);
      if (!inside(x, y) || clusters.some((c) => Math.hypot(c.x - x, c.y - y) < gap)) continue;
      const flat = conifer || name === 'spreading';
      clusters.push({ x, y, r: R * (0.8 + rnd() * 0.4), sx: flat ? 1.45 : 1, sy: flat ? 0.7 : 1 });
    }
    if (form.leader) {
      // A trunk to the top, and branches out from it, rising or, on
      // conifers, sloping down.
      limb([cx, ground], [cx, top + R * 0.4], trunkW, [0, 0], 2);
      for (const c of clusters) {
        if (rnd() > 0.6) continue;
        const from = [cx, Math.min(base, c.y + Math.abs(c.x - cx) * (conifer ? -0.12 : 0.3))];
        wood.push({ d: curve(from, [c.x, c.y], [0, conifer ? 2 : -3]), width: Math.max(0.7, trunkW * 0.3 * Math.min(1, Math.abs(c.x - cx) / half + 0.3)) });
      }
    } else {
      // A trunk to where it divides, then three to five main limbs, then
      // twigs from those to the clusters.
      const fork = base - (base - top) * 0.12;
      limb([cx, ground], [cx, fork], trunkW, [0, 0], 2);
      const n = 3 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        const side = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
        const t = form.reach[0] + rnd() * (form.reach[1] - form.reach[0]);
        const y = base - t * (base - top);
        const x = cx + side * half * form.width(t) * (0.55 + rnd() * 0.3);
        limb([cx + side * trunkW * 0.3, fork], [x, y], trunkW * (0.75 - 0.2 * Math.abs(side)), [side * half * 0.06, 0]);
      }
      for (const c of clusters) {
        if (rnd() > 0.55) continue;
        const from = holds.reduce((best, p) => (Math.hypot(p[0] - c.x, p[1] - c.y) < Math.hypot(best[0] - c.x, best[1] - c.y) ? p : best), holds[0]);
        wood.push({ d: curve(from, [c.x, c.y], [0, -2]), width: Math.max(0.6, trunkW * 0.22) });
      }
    }
  }
  // Wood first, widest last so the trunk is clean over its limbs' ends.
  wood.sort((a, b) => a.width - b.width);
  out.push(`<g class="td-limb">${wood.map((p) => `<path d="${p.d}" stroke-width="${f1(p.width)}"/>`).join('')}</g>`);
  out.push(`<path class="td-trunk" d="M${f1(cx - trunkW * 0.6)} ${ground}L${f1(cx - trunkW * 0.42)} ${f1(Math.min(ground - 4, base))}L${f1(cx + trunkW * 0.42)} ${f1(Math.min(ground - 4, base))}L${f1(cx + trunkW * 0.6)} ${ground}Z"/>`);

  // ---- leaves: a dark heart to each cluster, then dabs lit from the upper left
  const spanX = half * 2 || 1;
  const spanY = ground - top || 1;
  const dabs = [];
  for (const c of clusters) {
    const wholeAt = (x, y) => 0.45 * ((x - (cx - half)) / spanX) + 0.75 * ((y - top) / spanY);
    dabs.push({ x: c.x + c.r * 0.12, y: c.y + c.r * 0.15, r: c.r * 0.78, sx: c.sx, sy: c.sy, shade: Math.min(palette.length - 1, 4 + Math.round(wholeAt(c.x, c.y) * 2)), z: 0 });
    const n = Math.round(6 + rnd() * 5);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const d = Math.sqrt(rnd()) * c.r * 0.85;
      const x = c.x + Math.cos(a) * d * c.sx;
      const y = c.y + Math.sin(a) * d * c.sy;
      const local = ((Math.cos(a) + Math.sin(a)) / 1.41) * (d / c.r);
      const shade = Math.max(0, Math.min(palette.length - 1, Math.round(0.4 + wholeAt(x, y) * 3.4 + local * 2 + (rnd() - 0.5) * 1.1)));
      dabs.push({ x, y, r: c.r * (0.28 + rnd() * 0.24), sx: c.sx, sy: c.sy, shade, z: 1 + (palette.length - shade) });
    }
  }
  // Within the whole crown: the dark hearts first, then dark dabs, then light.
  dabs.sort((a, b) => a.z - b.z || a.y - b.y);
  for (const d of dabs) {
    out.push(`<ellipse cx="${f1(d.x)}" cy="${f1(d.y)}" rx="${f1(d.r * d.sx)}" ry="${f1(d.r * d.sy)}" fill="${palette[d.shade]}"/>`);
  }

  // A person, 6 ft tall, beside the tree.
  const px = Math.min(WIDTH - 12, cx + half + 16);
  const ph = 6 * PX;
  out.push(`<g class="td-person"><circle cx="${px}" cy="${f1(ground - ph + 2.2)}" r="2.2"/><path d="M${f1(px - 2.4)} ${f1(ground - ph + 5)}h4.8l1.2 7.4h-1.6l-.9-5v${f1(ph - 9.5)}h-1.7v-8.2h-.4v8.2h-1.7v-${f1(ph - 9.5)}l-.9 5h-1.6z"/></g>`);
  out.push(`<line class="td-ground" x1="8" x2="${WIDTH - 4}" y1="${ground}" y2="${ground}"/>`);

  return `<svg class="tree-drawing" viewBox="0 0 ${WIDTH} ${H}" role="img" aria-label="Drawing of a ${taxon.common.toLowerCase()} at maturity, about ${h} ft tall and ${w} ft wide, beside a person">${out.join('')}</svg>`;
}

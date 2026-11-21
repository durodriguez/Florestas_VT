/**
 * A small map of where a species stands on campus, for its species page.
 * Two layers stacked in the page, as the range map is:
 *
 * 1. campus-map.svg, shared: the campuses' outlines and names, and every
 *    standing tree as a small gray dot.
 * 2. inline, per species: its trees as red dots, each a link to the tree on
 *    the map.
 *
 * Not a zoomable map: "Show them on the map" is the way to that. A plain
 * projection (degrees of longitude shortened by the cosine of the latitude)
 * is exact enough across two kilometres. No DOM here.
 */

const WIDTH = 300;
const PAD = 10;

/** The box every standing tree fits in, and the scale that draws it WIDTH wide. */
export function campusFrame(points) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const south = Math.min(...lats);
  const north = Math.max(...lats);
  const west = Math.min(...lngs);
  const east = Math.max(...lngs);
  const k = Math.cos((((south + north) / 2) * Math.PI) / 180);
  const scale = (WIDTH - 2 * PAD) / ((east - west) * k);
  const height = Math.round((north - south) * scale + 2 * PAD);
  const xy = (lng, lat) => [PAD + (lng - west) * k * scale, PAD + (north - lat) * scale];
  return { width: WIDTH, height, xy };
}

const ringPath = (frame, ring) => `M${ring.map(([lng, lat]) => frame.xy(lng, lat).map((v) => v.toFixed(1)).join(',')).join('L')}Z`;
const polygonsOf = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []);

/** A label's spot: the average of the outline's points, which suits these compact shapes. */
function labelAt(frame, polys) {
  const pts = polys.flatMap((p) => p[0]);
  const lng = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const lat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return frame.xy(lng, lat);
}

/** The shared layer. Its own colors, light and dark, as an <img> cannot see the page's. */
export function campusBaseSvg(frame, areas, points) {
  const campuses = areas.features.filter((f) => f.properties.kind === 'campus');
  const shapes = campuses.map((f) => polygonsOf(f.geometry).map((poly) => poly.map((r) => ringPath(frame, r)).join('')).join('')).join('');
  const labels = campuses.map((f) => {
    const [x, y] = labelAt(frame, polygonsOf(f.geometry));
    if (x < 0 || y < 0 || x > frame.width || y > frame.height) return '';
    return `<text x="${x.toFixed(0)}" y="${y.toFixed(0)}">${String(f.properties.name).replace(/ Campus$/, '').replace(/&/g, '&amp;')}</text>`;
  }).join('');
  const dots = points.map((p) => {
    const [x, y] = frame.xy(p.lng, p.lat);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.5"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${frame.width} ${frame.height}">
<style>.bg{fill:#eef2ee}.c{fill:#f7f6ef;stroke:#154734;stroke-opacity:.45;stroke-width:1.2}.d{fill:#c3c8c2}text{font:600 11px system-ui,sans-serif;fill:#154734;fill-opacity:.55;text-anchor:middle}
@media (prefers-color-scheme:dark){.bg{fill:#17201b}.c{fill:#222925;stroke:#9fd3b4}.d{fill:#4a524c}text{fill:#9fd3b4}}</style>
<rect class="bg" width="${frame.width}" height="${frame.height}"/>
<path class="c" d="${shapes}"/>
<g class="d">${dots}</g>
${labels}
</svg>`;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** The species' own layer: its trees, each a link to it on the map. */
export function campusSvg(frame, trees, base) {
  const dots = trees.map((t) => {
    const [x, y] = frame.xy(t.lng, t.lat);
    return `<a href="${esc(base)}?plant=${encodeURIComponent(t.id)}"><title>${esc(t.id)}</title><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5"/></a>`;
  }).join('');
  return `<svg class="campus-trees" viewBox="0 0 ${frame.width} ${frame.height}" role="img" aria-label="Where they stand on campus">${dots}</svg>`;
}

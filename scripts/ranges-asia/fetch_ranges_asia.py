#!/usr/bin/env python3
"""
Draw the native range of each East Asian species in taxa.csv that grows wild
only outside China (Japan, Korea and their islands), into data/ranges/asia/.
Run by hand, rarely, after species are added to taxa.csv; the build reads only
what this writes. See docs/SPECIES-PAGES.md, "East Asian ranges".

    pip install -r scripts/ranges-asia/requirements.txt
    python3 scripts/ranges-asia/fetch_ranges_asia.py

No one has drawn chorological maps of East Asia as Little did for the United
States and Caudullo et al. for Europe, so these are drawn from records:

- Where it is native: Kew's World Checklist of Vascular Plants (WCVP, CC BY),
  by "botanical country" (Japan, Korea, the Kurils...), on the TDWG regions'
  outlines. A species native anywhere in China is left for a source covering
  China (the herbarium record there is too thin to draw from), and one native
  outside East Asia too is left out.
- Where in those regions: herbarium specimens with coordinates, from GBIF.org,
  under CC0 or CC BY (not CC BY-NC), leaving out any whose label says it was
  planted or grown in a garden, park, temple, school or plantation, any placed
  less precisely than 25 km, and any outside the native regions.

Each record is drawn as a circle, records close together are joined, as a
hand-drawn map joins them, and the result is cut to the coast. What is left
too small to see is drawn as a dot, as is a record with no neighbour near it,
when a second specimen was taken within 25 km of it; a single one is left out.
"""
import csv, io, json, math, os, re, sys, time, urllib.parse, urllib.request, zipfile
from shapely import STRtree, delaunay_triangles
from shapely.geometry import MultiPoint, MultiPolygon, Point, Polygon, shape
from shapely.ops import unary_union

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'data', 'ranges', 'asia')
CACHE = os.path.join(ROOT, '.cache', 'ranges-asia')
WCVP = 'https://sftp.kew.org/pub/data-repositories/WCVP/wcvp.zip'
TDWG = 'https://raw.githubusercontent.com/tdwg/wgsrpd/master/geojson/level3.geojson'
GBIF = 'https://api.gbif.org/v1'

# Botanical countries a species may be native to and be drawn here (Japan and
# its islands, Korea, Taiwan, the Kurils, Sakhalin and Primorye), and the
# outlines (Natural Earth's, in the European maps' basemap) they lie on.
EAST_ASIA = {'JAP', 'KOR', 'KUR', 'NNS', 'KRY', 'TAI', 'OGA', 'SAK', 'PRM'}
CHINA = {'CHC', 'CHH', 'CHI', 'CHM', 'CHN', 'CHQ', 'CHS', 'CHT', 'CHX'}
COUNTRIES = ('Japan', 'South Korea', 'North Korea', 'Russia', 'Taiwan', 'China')
PLANTED = re.compile(r'cultiv|planted|plantation|garden|botanic|park\b|campus|arboret|nursery|'
                     r'experiment station|植栽|栽培|植林|造林|人工林|試験場|公園|庭|園|行道|校|寺|神社|식재|재배|공원|수목원|조림|시험장', re.I)

# Kilometres: each record's circle; the gap closed between neighbours; the
# farthest apart three records may be and still be joined; and the smallest
# area kept as an area, in square kilometres, rather than drawn as a dot.
RADIUS, CLOSE, LINK, MIN_AREA = 20, 30, 120, 2500

# Where a flora gives a northern limit the specimens overrun (plantations and
# hedges gone wild, filed without saying so), the map is cut at it. `stands`
# are outliers north of it the same flora names, drawn as dots.
NORTH_LIMIT = {
    # Native from Fukushima south to Yakushima (Forestry Agency; Japanese Wikipedia, Hinoki).
    'Chamaecyparis obtusa': {'lat': 38.0},
    # Central Honshu, Fukushima to Fukui, with scattered stands north to Mount
    # Hayachine in Iwate (Ohashi et al. 2015, via Japanese Wikipedia, Sawara).
    'Chamaecyparis pisifera': {'lat': 38.0, 'stands': [(141.49, 39.56)]},
    # Southern Tohoku southward, a few in Akita; escaped in Hokkaido
    # (Japanese Wikipedia, Megi; Hokkaido University's flora pages).
    'Berberis thunbergii': {'lat': 40.0},
}

# Where a species is known wild but so rare that its specimens stand alone,
# a single specimen inside the box (west, south, east, north) is drawn as a
# dot rather than left out.
RARE_WILD = {
    # Kyushu, without Yakushima's Yakutanegoyo, a pine of its own: listed as
    # threatened in Kumamoto (VU, Red List Kumamoto 2024) and Saga (Category I).
    'Pinus parviflora': (128.5, 31.0, 132.2, 34.3),
}


def laea(lat0=36.0, lng0=136.0):
    """Lambert azimuthal equal-area, in km, centred on Japan: lengths and areas true enough here."""
    R, p0, l0 = 6371.0, math.radians(lat0), math.radians(lng0)
    def fwd(lng, lat):
        p, l = math.radians(lat), math.radians(lng) - l0
        k = math.sqrt(2 / (1 + math.sin(p0) * math.sin(p) + math.cos(p0) * math.cos(p) * math.cos(l)))
        return R * k * math.cos(p) * math.sin(l), R * k * (math.cos(p0) * math.sin(p) - math.sin(p0) * math.cos(p) * math.cos(l))
    def inv(x, y):
        r = math.hypot(x, y)
        if r < 1e-9: return lng0, lat0
        c = 2 * math.asin(min(1, r / (2 * R)))
        lat = math.asin(math.cos(c) * math.sin(p0) + y * math.sin(c) * math.cos(p0) / r)
        lng = l0 + math.atan2(x * math.sin(c), r * math.cos(p0) * math.cos(c) - y * math.sin(p0) * math.sin(c))
        return math.degrees(lng), math.degrees(lat)
    return fwd, inv


FWD, INV = laea()


def project(geom):
    from shapely import transform
    import numpy as np
    return transform(geom, lambda xy: np.array([FWD(x, y) for x, y in xy]))


def get(url, path=None, tries=4):
    for t in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                data = r.read()
            if path:
                with open(path, 'wb') as f: f.write(data)
            return data
        except Exception:
            if t == tries - 1: raise
            time.sleep(2 ** t)


def cached(name, url):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        print(f'fetching {url}', file=sys.stderr)
        get(url, path)
    return path


def native_regions(names):
    """WCVP: {species: set of botanical countries it is native to} for the names given."""
    z = zipfile.ZipFile(cached('wcvp.zip', WCVP))
    ids = {}
    with z.open('wcvp_names.csv') as f:
        for r in csv.DictReader(io.TextIOWrapper(f, encoding='utf-8'), delimiter='|'):
            if r['taxon_status'] == 'Accepted' and r['taxon_rank'] == 'Species' and r['taxon_name'] in names:
                ids[r['plant_name_id']] = r['taxon_name']
    out = {}
    with z.open('wcvp_distribution.csv') as f:
        for r in csv.DictReader(io.TextIOWrapper(f, encoding='utf-8'), delimiter='|'):
            if r['plant_name_id'] in ids and r['introduced'] == '0' and r['extinct'] == '0':
                out.setdefault(ids[r['plant_name_id']], set()).add(r['area_code_l3'])
    return out


def specimens(name):
    key = json.loads(get(f'{GBIF}/species/match?' + urllib.parse.urlencode({'name': name, 'strict': 'true'})))['usageKey']
    rows, off = [], 0
    while True:
        q = {'taxonKey': key, 'basisOfRecord': 'PRESERVED_SPECIMEN', 'hasCoordinate': 'true',
             'hasGeospatialIssue': 'false', 'continent': 'ASIA', 'limit': 300, 'offset': off}
        d = json.loads(get(f'{GBIF}/occurrence/search?' + urllib.parse.urlencode(q)))
        rows += d['results']
        off += 300
        if d['endOfRecords'] or off >= 20000: return rows


def draw(name, codes, regions, land):
    mask = unary_union([regions[c] for c in codes if c in regions]).buffer(15)
    here = land.intersection(mask.buffer(300))
    kept, dropped = [], {'licence': 0, 'planted': 0, 'imprecise': 0, 'not native there': 0, 'at sea': 0}
    for r in specimens(name):
        lic = r.get('license') or ''
        if not (('publicdomain/zero' in lic) or ('licenses/by/' in lic)): dropped['licence'] += 1; continue
        if PLANTED.search(' '.join(str(r.get(k) or '') for k in ('locality', 'habitat', 'occurrenceRemarks', 'establishmentMeans'))): dropped['planted'] += 1; continue
        if (r.get('coordinateUncertaintyInMeters') or 0) > 25000: dropped['imprecise'] += 1; continue
        p = Point(FWD(r['decimalLongitude'], r['decimalLatitude']))
        if not mask.contains(p): dropped['not native there'] += 1; continue
        if here.distance(p) > 5: dropped['at sea'] += 1; continue
        kept.append(p)
    # Duplicates of one gathering (eleven sheets from one spot in Jeju City)
    # count once, so they cannot vouch for each other as neighbours.
    seen, distinct = set(), []
    for p in kept:
        k = (round(p.x), round(p.y))   # to the kilometre
        if k not in seen: seen.add(k); distinct.append(p)
    kept = distinct
    limit = NORTH_LIMIT.get(name) or {}
    if limit:
        south = project(Polygon([(115, 20), (160, 20), (160, limit['lat']), (115, limit['lat'])]).segmentize(0.5))
        here = here.intersection(south)
        dropped["north of the flora's limit"] = sum(1 for p in kept if not south.contains(p))
        kept = [p for p in kept if south.contains(p)]
    tree = STRtree(kept)
    reach = max(2 * CLOSE, LINK)
    lonely = [len(tree.query(p.buffer(reach))) < 3 for p in kept]   # itself and fewer than two others
    core = [p for p, l in zip(kept, lonely) if not l]
    parts = [p.buffer(RADIUS, 8) for p in core]
    if len(core) > 3:
        for t in delaunay_triangles(MultiPoint(core)).geoms:
            c = list(t.exterior.coords)[:3]
            if max(math.dist(c[i], c[i - 1]) for i in range(3)) < LINK: parts.append(t)
    area = unary_union(parts).buffer(CLOSE, 8).buffer(-CLOSE, 8).intersection(here).buffer(0) if parts else Polygon()
    polys = list(area.geoms) if isinstance(area, MultiPolygon) else ([area] if not area.is_empty else [])
    # A record with no neighbour is drawn as a dot only if a second specimen
    # was taken within 25 km of it: one alone is as likely a planted tree
    # whose label does not say so.
    box = RARE_WILD.get(name)
    rare = project(Polygon([(box[0], box[1]), (box[2], box[1]), (box[2], box[3]), (box[0], box[3])])) if box else Polygon()
    single = [p for p, l in zip(kept, lonely) if l and len(tree.query(p.buffer(25))) < 2 and not rare.contains(p)]
    dropped['single record'] = len(single)
    areas, dots = [], [(p.x, p.y) for p, l in zip(kept, lonely) if l and p not in single]
    for g in polys:
        g = Polygon(g.exterior, [h for h in g.interiors if Polygon(h).area > 4 * MIN_AREA]).simplify(3)
        if g.area < MIN_AREA: dots.append((g.centroid.x, g.centroid.y))
        else: areas.append(g)
    dots = [d for d in dots if not any(g.buffer(10).contains(Point(d)) for g in areas)]
    dots += [FWD(*st) for st in limit.get('stands', [])]
    ll = lambda pts: [[round(x, 2), round(y, 2)] for x, y in (INV(*c) for c in pts)]
    return {
        'species': name, 'source': 'gbif',
        'regions': sorted(codes),
        'places': len(kept), 'left_out': dropped,
        'range': [[ll(g.exterior.coords)] + [ll(h.coords) for h in g.interiors] for g in areas],
        'absent': [],
        'points': ll(dots),
    }


def main():
    taxa = list(csv.DictReader(open(os.path.join(ROOT, 'data', 'taxa.csv'), newline='', encoding='utf-8')))
    mapped = {f[:-5] for d in ('', 'europe') for f in os.listdir(os.path.join(ROOT, 'data', 'ranges', d)) if f.endswith('.json')}
    names = {}
    for t in taxa:
        if t['genus'] and t['species'] and not t['species'].startswith('x') and t['species'] not in ('sp', 'sp.'):
            sid = f"{t['genus']}-{t['species']}".lower()
            if sid not in mapped: names[f"{t['genus']} {t['species']}"] = sid
    native = native_regions(set(names))
    todo = {n: c for n, c in native.items() if c <= EAST_ASIA and not c & CHINA}
    print('drawing', ', '.join(sorted(todo)), file=sys.stderr)
    tdwg = json.load(open(cached('level3.geojson', TDWG)))
    regions = {f['properties']['LEVEL3_COD']: project(shape(f['geometry'])).buffer(0)
               for f in tdwg['features'] if f['properties']['LEVEL3_COD'] in EAST_ASIA}
    basemap = json.load(open(os.path.join(ROOT, 'data', 'ranges', 'europe', 'basemap.json')))
    box = Polygon([(115, 20), (160, 20), (160, 55), (115, 55)])
    land = unary_union([project(Polygon(p[0], p[1:]).buffer(0).intersection(box)) for c in basemap['countries'] if c['name'] in COUNTRIES
                        for p in c['polygons']])
    os.makedirs(OUT, exist_ok=True)
    for name, codes in sorted(todo.items()):
        r = draw(name, codes, regions, land)
        with open(os.path.join(OUT, names[name] + '.json'), 'w') as f: json.dump(r, f, separators=(',', ':'))
        print(f"{name}: specimens from {r['places']} places, {len(r['range'])} areas, {len(r['points'])} dots; left out {r['left_out']}", file=sys.stderr)


if __name__ == '__main__':
    main()

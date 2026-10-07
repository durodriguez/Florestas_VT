import { describe, it, expect } from 'vitest';
import {
  applyH, calibrate, estimateBounds, fitBounds, fitH, fitPlacement, invertH, matrix3dFor, parseGeprint, pixelAt, rankImages,
  type Bounds, type Camera, type H, type Pair,
} from '../src/positions/imagery-math';

// The camera block of the Main Street print the surveyor sent, verbatim in shape.
const GEPRINT = `[General]
version=2
camera="@ByteArray(<?xml version=\\"1.0\\" encoding=\\"UTF-8\\"?>\\n<kml><Placemark>\\n\\t<LookAt>\\n\\t\\t<longitude>-73.19538325460317</longitude>\\n\\t\\t<latitude>44.47416666172968</latitude>\\n\\t\\t<altitude>0</altitude>\\n\\t\\t<heading>-0.006050592089289539</heading>\\n\\t\\t<tilt>2.663653295467451</tilt>\\n\\t\\t<range>880.3181322278199</range>\\n\\t</LookAt>\\n</Placemark>\\n</kml>\\n)"
`;

const truth: Bounds = [[44.4712, -73.2017], [44.4771, -73.1890]];
const W = 8000;
const H = 4768;
/** A pair as a perfect click would make it. */
const pairAt = (fx: number, fy: number) => {
  const [[s, w], [n, e]] = truth;
  return { px: fx * W, py: fy * H, lat: n - fy * (n - s), lng: w + fx * (e - w) };
};

describe('parseGeprint', () => {
  it('reads the camera out of the embedded KML', () => {
    expect(parseGeprint(GEPRINT)).toEqual({
      lat: 44.47416666172968, lng: -73.19538325460317, range: 880.3181322278199,
      tilt: 2.663653295467451, heading: -0.006050592089289539,
    });
  });
  it('is null for a file with no camera', () => expect(parseGeprint('[General]\nversion=2')).toBeNull());
});

describe('estimateBounds', () => {
  it('centres the footprint on the camera, about a kilometre across for this print', () => {
    const cam = parseGeprint(GEPRINT)!;
    const [[s, w], [n, e]] = estimateBounds(cam, W, H);
    expect((s + n) / 2).toBeCloseTo(cam.lat, 6);
    expect((w + e) / 2).toBeCloseTo(cam.lng, 6);
    const widthM = (e - w) * 111_320 * Math.cos((cam.lat * Math.PI) / 180);
    expect(widthM).toBeGreaterThan(950);
    expect(widthM).toBeLessThan(1100);
  });
});

describe('fitBounds', () => {
  it('recovers the true placement from two well-spread points', () => {
    const fit = fitBounds([pairAt(0.1, 0.2), pairAt(0.85, 0.9)], W, H)!;
    expect(fit.bounds[0][0]).toBeCloseTo(truth[0][0], 7);
    expect(fit.bounds[1][1]).toBeCloseTo(truth[1][1], 7);
    expect(fit.rms).toBeLessThan(0.01);
  });

  it('reports an imprecise click as residual, in metres', () => {
    const off = pairAt(0.5, 0.5);
    off.lat += 2 / 111_320; // a click two metres north of the feature
    const fit = fitBounds([pairAt(0.1, 0.1), pairAt(0.9, 0.9), off], W, H)!;
    expect(fit.rms).toBeGreaterThan(0.3);
    expect(Math.max(...fit.residuals)).toBeGreaterThan(1);
  });

  it('refuses points that do not spread across and down the image', () => {
    expect(fitBounds([pairAt(0.1, 0.5), pairAt(0.9, 0.52)], W, H)).toBeNull();
    expect(fitBounds([pairAt(0.5, 0.5)], W, H)).toBeNull();
  });
});

describe('pixelAt', () => {
  it('is the inverse of placement', () => {
    const p = pairAt(0.3, 0.7);
    const [x, y] = pixelAt(truth, W, H, p.lat, p.lng);
    expect(x).toBeCloseTo(p.px, 3);
    expect(y).toBeCloseTo(p.py, 3);
  });
});

describe('calibrate', () => {
  it('learns the scale and shift from an aligned print and applies them to the next', () => {
    const cam: Camera = { lat: 44.474, lng: -73.195, range: 880, tilt: 2, heading: 0 };
    const guess = estimateBounds(cam, W, H);
    // Suppose Earth's real view was 8% wider and 10 m east of the camera's word.
    const shiftLng = 10 / (111_320 * Math.cos((44.474 * Math.PI) / 180));
    const real = estimateBounds({ ...cam, lng: cam.lng + shiftLng }, W, H, { scale: 1.08 });
    const k = calibrate([{ cam, width: W, height: H, bounds: real }]);
    expect(k.scale).toBeCloseTo(1.08, 6);
    expect(k.dLng).toBeCloseTo(shiftLng, 9);
    const next = estimateBounds(cam, W, H, k);
    expect(next[0][1]).toBeCloseTo(real[0][1], 9);
    expect(guess[0][1]).not.toBeCloseTo(real[0][1], 6);
  });
});


// ---------------------------------------------------------------- tilt

/**
 * A print as a tilted camera makes it: the top edge 4% narrower than the
 * bottom, so no rectangle fits all of it. Corners in [lat, lng], clockwise
 * from top-left, the way the image's own corners map.
 */
const kLng = 111_320 * Math.cos((44.474 * Math.PI) / 180);
const tiltedCorners: Array<[number, number]> = [
  [44.4771, -73.2017 + 20 / kLng], [44.4771, -73.1890 - 20 / kLng],
  [44.4712, -73.1890], [44.4712, -73.2017],
];
// Truth as a transform from image pixels to [lng, lat], built from those corners.
const truthH: H = fitH(
  [[0, 0], [W, 0], [W, H], [0, H]],
  tiltedCorners.map(([lat, lng]) => [lng, lat]),
)!;
const tiltedPair = (fx: number, fy: number): Pair => {
  const [lng, lat] = applyH(truthH, fx * W, fy * H);
  return { px: fx * W, py: fy * H, lat, lng };
};
const spread: Array<[number, number]> = [[0.1, 0.1], [0.9, 0.12], [0.88, 0.9], [0.12, 0.88], [0.5, 0.5], [0.3, 0.7]];

describe('fitH', () => {
  it('maps four points exactly, and inverts', () => {
    const from: Array<[number, number]> = [[0, 0], [100, 0], [100, 50], [0, 50]];
    const to: Array<[number, number]> = [[10, 10], [200, 30], [190, 140], [5, 120]];
    const h = fitH(from, to)!;
    from.forEach((p, i) => {
      const [x, y] = applyH(h, ...p);
      expect(x).toBeCloseTo(to[i]![0], 6);
      expect(y).toBeCloseTo(to[i]![1], 6);
      const [bx, by] = applyH(invertH(h), x, y);
      expect(bx).toBeCloseTo(p[0], 6);
      expect(by).toBeCloseTo(p[1], 6);
    });
  });
});

describe('matrix3dFor', () => {
  it('puts the element\'s corners on the screen points given', () => {
    const corners: Array<[number, number]> = [[12, 20], [400, 35], [380, 260], [8, 240]];
    const m = matrix3dFor(800, 480, corners)!;
    // Apply the column-major 4x4 to (x, y, 0, 1).
    const at = (x: number, y: number) => {
      const X = m[0]! * x + m[4]! * y + m[12]!;
      const Y = m[1]! * x + m[5]! * y + m[13]!;
      const Wt = m[3]! * x + m[7]! * y + m[15]!;
      return [X / Wt, Y / Wt];
    };
    [[0, 0], [800, 0], [800, 480], [0, 480]].forEach(([x, y], i) => {
      const [sx, sy] = at(x!, y!);
      expect(sx).toBeCloseTo(corners[i]![0], 6);
      expect(sy).toBeCloseTo(corners[i]![1], 6);
    });
  });
});

describe('fitPlacement', () => {
  it('stays a stretch with fewer than four points', () => {
    expect(fitPlacement(spread.slice(0, 3).map(([x, y]) => tiltedPair(x, y)), W, H)!.kind).toBe('stretch');
  });

  it('fits a tilted print everywhere, where a stretch cannot', () => {
    const pairs = spread.map(([x, y]) => tiltedPair(x, y));
    const tilt = fitPlacement(pairs, W, H)!;
    const stretch = fitBounds(pairs, W, H)!;
    expect(tilt.kind).toBe('tilt');
    expect(tilt.rms).toBeLessThan(0.05);
    // The stretch is metres out on the same points — the mismatch the surveyor saw.
    expect(stretch.rms).toBeGreaterThan(3);
    // And it is right away from the points too: the corners land on the truth.
    tilt.corners.forEach(([lat, lng], i) => {
      const [tl, tg] = tiltedCorners[i]!;
      expect(Math.hypot((lat - tl) * 111_320, (lng - tg) * kLng)).toBeLessThan(0.1);
    });
  });

  it('maps a click on the image back to its pixel', () => {
    const tilt = fitPlacement(spread.map(([x, y]) => tiltedPair(x, y)), W, H)!;
    const [lat, lng] = tilt.toMap(1234, 2100);
    const [px, py] = tilt.toImage(lat, lng);
    expect(px).toBeCloseTo(1234, 3);
    expect(py).toBeCloseTo(2100, 3);
  });

  it('refuses a fit folded by two points matched the wrong way round, and keeps the stretch', () => {
    // Four corners, with the two right-hand features clicked on the map in each
    // other's place: the shape comes out as a bow-tie.
    const pairs = [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]].map(([x, y]) => tiltedPair(x!, y!));
    const [b, c] = [pairs[1]!, pairs[2]!];
    pairs[1] = { ...b, lat: c.lat, lng: c.lng };
    pairs[2] = { ...c, lat: b.lat, lng: b.lng };
    const fit = fitPlacement(pairs, W, H);
    expect(fit?.kind ?? 'stretch').toBe('stretch');
  });

  it('shows one wild click as a large residual on that point', () => {
    const pairs = spread.map(([x, y]) => tiltedPair(x, y));
    pairs[4] = { ...pairs[4]!, lat: pairs[4]!.lat + 40 / 111_320 };
    const fit = fitPlacement(pairs, W, H)!;
    expect(fit.residuals.indexOf(Math.max(...fit.residuals))).toBe(4);
    expect(fit.rms).toBeGreaterThan(5);
  });

  it('reports an imprecise click as residual', () => {
    const pairs = spread.map(([x, y]) => tiltedPair(x, y));
    pairs[5] = { ...pairs[5]!, lng: pairs[5]!.lng + 2 / kLng };
    const fit = fitPlacement(pairs, W, H)!;
    expect(fit.kind).toBe('tilt');
    expect(Math.max(...fit.residuals)).toBeGreaterThan(1);
  });
});

describe('rankImages', () => {
  const r = (id: string, aligned: boolean, points: number, rms: number | null) => ({ id, aligned, points, rms });

  it('puts the lowest measured error on top', () => {
    const order = rankImages([r('A', true, 8, 1.4), r('B', true, 9, 0.6), r('C', true, 12, 0.9)]).map((i) => i.id);
    expect(order).toEqual(['B', 'C', 'A']);
  });

  it('does not let an unmeasured four-point fit win on its zero', () => {
    const order = rankImages([r('Four', true, 4, 0), r('Eight', true, 8, 1.8)]).map((i) => i.id);
    expect(order).toEqual(['Eight', 'Four']);
  });

  it('ranks stretched below tilt-measured, and unaligned last, ties by name', () => {
    const order = rankImages([
      r('Z-unaligned', false, 0, null), r('Stretch', true, 3, 0.2), r('A-unaligned', false, 0, null), r('Good', true, 6, 2.5),
    ]).map((i) => i.id);
    expect(order).toEqual(['Good', 'Stretch', 'A-unaligned', 'Z-unaligned']);
  });
});

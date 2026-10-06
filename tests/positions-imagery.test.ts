import { describe, it, expect } from 'vitest';
import {
  calibrate, estimateBounds, fitBounds, parseGeprint, pixelAt,
  type Bounds, type Camera,
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


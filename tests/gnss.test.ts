import { describe, it, expect } from 'vitest';
import { checksumOk, LineSplitter, parseGga, parseGst, qualityLabel } from '../src/gnss/nmea';
import { describeFix, Receiver, type ReceiverState } from '../src/gnss/receiver';

/** A sentence with its checksum, as a receiver would send it. */
function nmea(body: string): string {
  let sum = 0;
  for (const ch of body) sum ^= ch.charCodeAt(0);
  return `$${body}*${sum.toString(16).toUpperCase().padStart(2, '0')}`;
}

// About where the R1 was in the screenshot: 44°28'35.18" N, 73°11'41.03" W.
const GGA = nmea('GNGGA,145530.00,4428.58633,N,07311.68379,W,2,19,0.7,121.2,M,-29.2,M,5.0,0133');
const GST = nmea('GNGST,145530.00,1.5,1.2,0.9,45.0,0.95,0.80,2.54');

describe('NMEA', () => {
  it('checks the checksum', () => {
    expect(checksumOk(GGA)).toBe(true);
    expect(checksumOk(GGA.replace('4428', '4429'))).toBe(false);
    expect(checksumOk('GNGGA,no dollar')).toBe(false);
  });

  it('reads a GGA position, fix quality and satellites', () => {
    const g = parseGga(GGA)!;
    expect(g.lat).toBeCloseTo(44 + 28.58633 / 60, 8);
    expect(g.lng).toBeCloseTo(-(73 + 11.68379 / 60), 8);
    expect(g.quality).toBe(2);
    expect(g.satellites).toBe(19);
    expect(g.hdop).toBe(0.7);
    expect(g.time).toBe('145530.00');
  });

  it('takes GGA from any talker, and ignores a sentence with no fix', () => {
    expect(parseGga(nmea('GPGGA,145530.00,4428.58633,N,07311.68379,W,1,8,1.1,121.2,M,-29.2,M,,'))?.quality).toBe(1);
    expect(parseGga(nmea('GNGGA,145530.00,,,,,0,0,,,M,,M,,'))).toBeNull();
    expect(parseGga(GST)).toBeNull();
  });

  it('reads GST as one horizontal error', () => {
    expect(parseGst(GST)!.horizontal).toBeCloseTo(Math.hypot(0.95, 0.8), 6);
    expect(parseGst(nmea('GNGST,145530.00,,,,,,,'))).toBeNull();
  });

  it('names fix types', () => {
    expect(qualityLabel(2)).toBe('SBAS');
    expect(qualityLabel(4)).toBe('RTK fixed');
    expect(qualityLabel(1)).toBe('Autonomous');
  });

  it('splits a stream into lines across chunk boundaries', () => {
    const s = new LineSplitter();
    expect(s.push('$GNGGA,1')).toEqual([]);
    expect(s.push('23\r\n$GNGST,4')).toEqual(['$GNGGA,123']);
    expect(s.push('56\r\n')).toEqual(['$GNGST,456']);
  });
});

describe('Receiver', () => {
  const states: ReceiverState[] = [];
  const r = new Receiver((s) => states.push(s));

  it("uses the receiver's own error when GST matches the fix", () => {
    states.length = 0;
    r.line(GST);
    r.line(GGA);
    const s = states.at(-1)!;
    if (s.status !== 'fix') throw new Error('no fix');
    expect(s.fix.accuracy).toBeCloseTo(Math.hypot(0.95, 0.8), 6);
    expect(s.fix.estimated).toBe(false);
    expect(s.fix.label).toBe('SBAS');
    expect(describeFix(s.fix)).toBe('SBAS · 19 satellites · ±1.2 m');
  });

  it('estimates from HDOP, and says so, without a GST for that moment', () => {
    states.length = 0;
    r.line(nmea('GNGGA,145531.00,4428.58633,N,07311.68379,W,2,19,0.7,121.2,M,-29.2,M,5.0,0133'));
    const s = states.at(-1)!;
    if (s.status !== 'fix') throw new Error('no fix');
    expect(s.fix.estimated).toBe(true);
    expect(s.fix.accuracy).toBeCloseTo(2.8, 6);
    expect(describeFix(s.fix)).toContain('(estimated)');
  });

  it('ignores garbled lines', () => {
    states.length = 0;
    r.line(GGA.replace('4428', '4429'));
    r.line('noise');
    expect(states).toEqual([]);
  });
});

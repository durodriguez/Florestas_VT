import { describe, it, expect } from 'vitest';
import { toCsv } from '../src/field/exporter';
import { extensionFor } from '../src/field/photo';
import type { SurveyRecord } from '../src/field/db';

/** UVM-0493's position on the map, for the claim cases below. */
const MAPPED = { lat: 44.476523, lng: -73.194675 };

const record = (over: Partial<SurveyRecord> = {}): SurveyRecord => ({
  id: 1,
  tag: '',
  status: 'active',
  species: 'Tilia cordata',
  taxonId: 'tilia-cordata',
  referenceSpecies: '',
  referenceTaxonId: '',
  claimedPlantId: '',
  claimedMeters: null,
  claimedLat: null,
  claimedLng: null,
  lat: 44.476500,
  lng: -73.194700,
  accuracy: 4,
  pinAdjusted: false,
  dbhIn: 19.5,
  heightFt: null,
  spreadFt: null,
  condition: 'fair',
  plantedYear: null,
  plantedUnknown: false,
  notes: '',
  dedication: '',
  surveyedOn: '2026-09-21',
  surveyor: 'DR',
  photoName: null,
  createdAt: 0,
  ...over,
});

const cell = (r: SurveyRecord, column: string): string => {
  const [head, row] = toCsv([r]).trim().split('\n');
  const i = head!.split(',').indexOf(column);
  // Good enough for these fixtures: no field here contains a quoted comma.
  return row!.split(',')[i]!;
};

const claimed = (over: Partial<SurveyRecord> = {}) =>
  record({
    claimedPlantId: 'UVM-0493', claimedMeters: 3,
    claimedLat: MAPPED.lat, claimedLng: MAPPED.lng, ...over,
  });

describe('toCsv — which record a visit belongs to', () => {
  it('sends a physical tag when there is one', () => {
    expect(cell(record({ tag: '772' }), 'tag')).toBe('772');
  });

  it('sends the claimed accession when there is no tag', () => {
    // Both answer the same question for the importer — which record is this a
    // visit to — so both travel in one column.
    expect(cell(claimed(), 'tag')).toBe('UVM-0493');
  });

  it('prefers a tag read off the trunk over a match by position', () => {
    expect(cell(claimed({ tag: '772' }), 'tag')).toBe('772');
  });

  it('sends nothing for a tree that is neither tagged nor claimed', () => {
    expect(cell(record(), 'tag')).toBe('');
  });
});

describe('toCsv — a claim must not drag the tree to where the surveyor stood', () => {
  it('keeps the mapped position when the pin was not moved', () => {
    const r = claimed();
    expect(cell(r, 'lat')).toBe(MAPPED.lat.toFixed(6));
    expect(cell(r, 'lng')).toBe(MAPPED.lng.toFixed(6));
  });

  it('leaves geolocation_notes blank so the existing one survives', () => {
    // The column says how the stored position was arrived at, and that has not
    // changed. The importer skips blanks, so the record keeps what it had.
    expect(cell(claimed(), 'geolocation_notes')).toBe('');
  });

  it('lets a deliberately moved pin win', () => {
    // Dragging the pin onto the crown is the act that says the map is wrong.
    const r = claimed({ pinAdjusted: true, lat: 44.476400, lng: -73.194800, accuracy: null });
    expect(cell(r, 'lat')).toBe('44.476400');
    expect(cell(r, 'geolocation_notes')).toBe('Position set by pin on imagery');
  });

  it('uses the surveyor position for a tree that is not a claim', () => {
    expect(cell(record(), 'lat')).toBe('44.476500');
    expect(cell(record(), 'geolocation_notes')).toBe('GPS ±4 m');
  });
});

describe('toCsv — a claim is a judgement, and says so', () => {
  it('records what was matched and from how far', () => {
    expect(toCsv([claimed()])).toContain('CLAIMED BY POSITION: matched to UVM-0493 from 3 m');
  });

  it('says nothing of the sort for a tag read off a trunk', () => {
    expect(toCsv([record({ tag: '772' })])).not.toContain('CLAIMED BY POSITION');
  });

  it('keeps the surveyor\'s own note alongside it', () => {
    const csv = toCsv([claimed({ notes: 'Storm damage on the south side' })]);
    expect(csv).toContain('Storm damage on the south side. CLAIMED BY POSITION');
  });
});

describe('extensionFor', () => {
  it('names the file after what the encoder actually produced', () => {
    expect(extensionFor(new Blob([], { type: 'image/webp' }))).toBe('webp');
    expect(extensionFor(new Blob([], { type: 'image/jpeg' }))).toBe('jpg');
  });

  it('recognises the PNG a browser returns when it cannot write the type asked for', () => {
    // Measured, not assumed: canvas.toBlob for an unsupported type hands back
    // PNG rather than failing, and a PNG photograph is far larger than the
    // JPEG it was meant to beat.
    expect(extensionFor(new Blob([], { type: 'image/png' }))).toBe('png');
  });

  it('falls back to jpg for a blob with no type', () => {
    expect(extensionFor(new Blob([]))).toBe('jpg');
  });
});

describe('numbers a surveyor never entered', () => {
  const cell = (csv: string, header: string): string => {
    const cols = csv.split('\n')[0]!.split(',');
    const i = cols.indexOf(header);
    // Row values here contain no commas, so a plain split is enough.
    return csv.split('\n')[1]!.split(',')[i] ?? '';
  };

  it('writes an empty cell for a null measurement', () => {
    const csv = toCsv([record({ dbhIn: null, heightFt: null, spreadFt: null, plantedYear: null })]);
    for (const h of ['dbh_in', 'height_ft', 'spread_ft', 'planted_year']) {
      expect(cell(csv, h)).toBe('');
    }
  });

  it('writes an empty cell for undefined, not the word "undefined"', () => {
    // Records saved by an earlier build hold undefined where an unfilled
    // number should be null. String(undefined) is "undefined", which reached
    // a real export on 2026-09-01 and which the importer rightly refuses as
    // not a number. Those records sit in a surveyor's phone and re-export
    // every time, so this has to be handled here — nothing can go back and
    // clean up what is already on the device.
    const stale = record({
      dbhIn: undefined as never,
      heightFt: undefined as never,
      spreadFt: undefined as never,
      plantedYear: undefined as never,
    });
    const csv = toCsv([stale]);
    expect(csv).not.toContain('undefined');
    for (const h of ['dbh_in', 'height_ft', 'spread_ft', 'planted_year']) {
      expect(cell(csv, h)).toBe('');
    }
  });

  it('still writes a zero, which is a measurement and not a blank', () => {
    expect(cell(toCsv([record({ dbhIn: 0 })]), 'dbh_in')).toBe('0');
  });
});

describe('status', () => {
  const cell = (csv: string, header: string): string => {
    const cols = csv.split('\n')[0]!.split(',');
    return csv.split('\n')[1]!.split(',')[cols.indexOf(header)] ?? '';
  };

  it('exports what the surveyor said about whether the tree is there', () => {
    expect(cell(toCsv([record({ status: 'active' })]), 'status')).toBe('active');
    expect(cell(toCsv([record({ status: 'removed' })]), 'status')).toBe('removed');
    expect(cell(toCsv([record({ status: 'not-found' })]), 'status')).toBe('not-found');
  });

  it('falls back to active for a record saved before the column existed', () => {
    // Records live in a surveyor's phone across app updates, so an older one
    // has no status at all. Blank would import as active anyway, but writing
    // it explicitly keeps the CSV readable by a person.
    expect(cell(toCsv([record({ status: undefined as never })]), 'status')).toBe('active');
  });
});

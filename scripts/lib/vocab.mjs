// Controlled vocabularies shared by the build script, the validator and the tests.
// Extend these lists rather than inventing new values in the CSVs — the map's
// filter panel and legend are generated from them.

export const CONDITIONS = ['excellent', 'good', 'fair', 'poor', 'dead'];
export const STATUSES = ['active', 'removed'];
export const HABITS = ['tree', 'conifer', 'shrub', 'vine'];
export const FOLIAGE = ['deciduous', 'evergreen', 'semi-evergreen'];
export const NATIVE_STATUS = ['native', 'introduced', 'invasive'];

export const TAXON_REQUIRED = ['taxon_id', 'scientific_name', 'common_name', 'family', 'genus', 'habit'];
export const PLANT_REQUIRED = ['plant_id', 'taxon_id', 'lat', 'lng'];

export const TAXON_NUMERIC = ['mature_height_ft', 'mature_spread_ft'];
export const PLANT_NUMERIC = ['dbh_in', 'height_ft', 'spread_ft', 'planted_year'];

/** Column order of the compact `plants.json` row arrays. */
export const PLANT_FIELDS = [
  'plant_id',
  'taxon',       // integer index into taxa[]
  'lat',
  'lng',
  'collection',  // integer index into collections[], or -1
  'dbh_in',
  'height_ft',
  'spread_ft',
  'condition',   // integer index into CONDITIONS, or -1
  'planted_year',
  'status',      // integer index into STATUSES
  'surveyed_on',
  'surveyor',
  'photo',
  'memorial',
  'notes',
];

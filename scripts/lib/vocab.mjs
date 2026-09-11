// Controlled vocabularies shared by the build script, the validator and the tests.
// Extend these lists rather than inventing new values in the CSVs — the map's
// filter panel and legend are generated from them.

export const CONDITIONS = ['excellent', 'good', 'fair', 'poor', 'dead'];
export const STATUSES = ['active', 'removed'];
/**
 * What kind of plant it is, structurally. Deliberately does NOT split trees by
 * foliage: "conifer" used to sit alongside "tree" here, which made a larch two
 * things at once and a holly neither. The map's seven-way Plant type comes from
 * this crossed with FOLIAGE — see plantTypeOf.
 */
export const HABITS = ['tree', 'shrub', 'perennial', 'annual', 'vine', 'grass'];
export const FOLIAGE = ['deciduous', 'evergreen', 'semi-evergreen'];

/**
 * Where the plant is from. One value per taxon, unlike the two status flags,
 * which are independent of origin and of each other — a Vermont native can be
 * regionally invasive, and a prohibited plant is prohibited whatever its origin.
 */
export const ORIGINS = ['vermont-native', 'introduced', 'unknown'];

/** Yes / no / blank, where blank means nobody has assessed it yet. */
export const FLAGS = ['yes', 'no'];

/** The seven categories the map offers, in the order they are listed. */
export const PLANT_TYPES = [
  'deciduous-tree',
  'evergreen-tree',
  'shrub',
  'perennial',
  'annual',
  'vine',
  'grass',
];

/**
 * A taxon's display category. Trees split by foliage; everything else is its
 * habit unchanged. Derived rather than stored so the two can never disagree —
 * with the list heading past 400 taxa, a column repeating what `foliage`
 * already says is a column that drifts.
 *
 * Semi-evergreen trees count as evergreen: the question the filter answers is
 * "will there be leaves on it in January", and the answer is mostly yes.
 */
export function plantTypeOf(habit, foliage) {
  if (habit !== 'tree') return habit;
  return foliage === 'evergreen' || foliage === 'semi-evergreen' ? 'evergreen-tree' : 'deciduous-tree';
}

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

// Controlled vocabularies shared by the build script, the validator and the tests.
// Extend these lists rather than inventing new values in the CSVs — the map's
// filter panel and legend are generated from them.

export const CONDITIONS = ['excellent', 'good', 'fair', 'poor', 'dead'];
export const STATUSES = ['active', 'removed'];
/**
 * What kind of plant it is. One column, seven values — trees carry their own
 * deciduous/evergreen split rather than needing a second column to say it.
 */
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
 * Where the plant is from, and whether it is a problem here. One value per
 * taxon; blank means nobody has assessed it.
 */
export const ORIGINS = ['vermont-native', 'vermont-invasive', 'introduced'];

/**
 * A gift, memorial or dedicated tree is one with `dedication_label` filled in —
 * there is no separate flag. A boolean derivable from a text column is a second
 * place for the same fact to live, and two columns that must agree are where a
 * hand-edited CSV drifts.
 *
 * The cost is that a source with a yes/no memorial column, mapped to this one,
 * would put the word "Yes" on a public record as if it were plaque wording.
 * Both the build and the importer refuse a label that is only a boolean.
 */
export const BOOLEANISH = /^(y|yes|n|no|true|false|0|1)$/i;

export const TAXON_REQUIRED = ['taxon_id', 'scientific_name', 'common_name', 'family', 'genus', 'plant_type'];
/**
 * plants.csv holds what a tree *is* — the things that do not change when
 * somebody walks past it with a tape measure. Everything measured on a given
 * day lives in observations.csv instead.
 */
export const PLANT_REQUIRED = ['plant_id', 'taxon_id', 'lat', 'lng'];
export const OBSERVATION_REQUIRED = ['plant_id', 'surveyed_on'];

export const TAXON_NUMERIC = ['mature_height_ft', 'mature_spread_ft'];
export const PLANT_NUMERIC = ['planted_year'];
export const OBSERVATION_NUMERIC = ['dbh_in', 'height_ft', 'spread_ft'];

/** Column order of data/taxa.csv. */
export const TAXON_COLUMNS = [
  'taxon_id', 'scientific_name', 'common_name', 'family', 'genus', 'species',
  'infraspecific', 'cultivar', 'plant_type', 'origin',
  'flower_color', 'flower_months', 'fruit_color', 'fruit_months', 'fall_color',
  'mature_height_ft', 'mature_spread_ft', 'bark_profile', 'pest_resistance',
  'soil_preference', 'hardiness_zones', 'wikipedia_url', 'description', 'fun_fact',
];

/**
 * A fun fact or a story is one line, not a second description. Nothing enforces
 * that a fact is *true* — no validator can — so the rule that matters lives in
 * docs/DATA-MODEL.md; this only keeps the column from silently becoming an
 * essay nobody will read on a phone.
 */
export const PROSE_MAX = 240;

/** Column order of data/plants.csv, and of the rows the importer writes. */
export const PLANT_COLUMNS = [
  'plant_id',
  'taxon_id',
  'lat',
  'lng',
  // Next to the coordinates it qualifies: how this position was arrived at,
  // not what the surveyor thought of the tree. That goes in the observation.
  'geolocation_notes',
  'collection_id',
  'planted_year',
  'dedication_label',
  'story',
];

/** Column order of data/observations.csv. */
export const OBSERVATION_COLUMNS = [
  'plant_id',
  'surveyed_on',
  'surveyor',
  'dbh_in',
  'height_ft',
  'spread_ft',
  'condition',
  'status',
  'photo',
  'notes',
];

/**
 * Column order of the compact `plants.json` row arrays: a plant's identity with
 * its most recent observation flattened onto it, which is what the map draws.
 * The full series, for plants surveyed more than once, rides alongside in
 * `plants.json`'s `history` map rather than in these rows.
 */
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
  'dedication_label',
  'story',
  'notes',
  'surveys',     // how many observations this plant has
];

/** Column order of each row in `plants.json`'s `history` map. */
export const OBSERVATION_FIELDS = [
  'surveyed_on',
  'surveyor',
  'dbh_in',
  'height_ft',
  'spread_ft',
  'condition',   // integer index into CONDITIONS, or -1
  'status',      // integer index into STATUSES
  'photo',
  'notes',
];

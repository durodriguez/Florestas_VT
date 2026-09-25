// Controlled vocabularies shared by the build script, the validator and the tests.
// Extend these lists rather than inventing new values in the CSVs — the map's
// filter panel and legend are generated from them.

export const CONDITIONS = ['excellent', 'good', 'fair', 'poor', 'dead'];
/**
 * Whether there is a tree here at all — a different question from `condition`,
 * which describes a tree that is. Even `dead` means a dead tree still standing,
 * with a trunk to measure and a hazard to deal with.
 *
 *   active     a tree is here
 *   removed    it stood here and was taken down; a stump or a mark says so
 *   not-found  nothing here, and no sign there ever was
 *
 * The last two are deliberately separate. A removal is an event in a tree's
 * life and belongs in its history. A not-found is a fault in the source data —
 * the 2023-24 layer recording something that is not there — and counting the
 * two together would hide how often that happens, which is evidence about
 * that survey's reliability rather than about any tree.
 *
 * A surveyor standing on the spot often cannot tell them apart, so the field
 * app asks what was seen rather than what it means: "gone, stump or mark"
 * against "nothing here". The inference stays a desk decision.
 *
 * Appended rather than inserted: the browser payload stores a status as its
 * index in this array, so reordering would silently rewrite every record.
 */
export const STATUSES = ['active', 'removed', 'not-found'];
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

/**
 * A note segment addressed to the desk rather than to a visitor. The survey app
 * writes these with a shouted prefix — `SPECIES CHANGED:`, `SPECIES NOT ON
 * LIST:` — and `npm run import` lists them so a correction is not buried in a
 * cell.
 *
 * Nothing strips them any more, because observation notes are no longer sent to
 * the browser at all: a surveyor's remarks are internal, and not sending them is
 * a stronger guarantee than filtering them on the way out. Same reasoning as
 * geolocation_notes, which has never been sent.
 */
export const QA_NOTE = /^[A-Z][A-Z0-9 ]{2,}:/;

/** Column order of data/plants.csv, and of the rows the importer writes. */
export const PLANT_COLUMNS = [
  'plant_id',
  // The number on the metal tag, as the tag reads it — "763", not "0763".
  // Blank for a tree that wears none.
  //
  // Separate from plant_id on purpose. An accession is permanent and is what
  // a QR label and a shared link encode; a tag is a piece of metal that falls
  // off, corrodes and gets replaced with a different number. The first 1,349
  // accessions were minted from tags and still look like them, which is why
  // this column has to exist: it is the only place the two can disagree, and
  // disagree they already do — tree UVM-0105 wears tag 3497.
  'tag',
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
  // Where an imported row came from, so a re-import matches the tree it
  // created last time instead of adding a second one. Blank for a plant we
  // recorded ourselves. Never sent to the browser — see PLANT_FIELDS.
  'source_id',
];

/**
 * Column order of the compact `cityTrees` row arrays. Burlington's street
 * trees inside the campus boundary — not part of the UVM collection, and
 * deliberately a shorter row than a plant: no accession, no dedication, no
 * story, no survey history. A snapshot of somebody else's records.
 */
export const CITY_TREE_FIELDS = [
  'city_id',
  'taxon',        // index into taxa
  'lat',
  'lng',
  'collection',   // index into collections, or -1
  'dbhIn',
  'heightFt',
  'spreadFt',
  'condition',    // integer index into CONDITIONS, or -1
  'plantedYear',
  'address',
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
  // Sent to the browser because search has to find a tree by the number on
  // its trunk. That used to work by accident — "763" is a substring of
  // "UVM-0763" — and stops working the moment the two are allowed to differ.
  'tag',
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
];

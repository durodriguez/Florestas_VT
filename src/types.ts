/** Shapes of the JSON emitted by `npm run data` (see scripts/lib/build.mjs). */

export interface SiteConfig {
  siteName: string;
  shortName: string;
  institution: string;
  tagline: string;
  contactEmail: string;
  publicUrl: string;
  accessionPrefix: string;
  map: {
    center: [number, number];
    zoom: number;
    minZoom: number;
    maxZoom: number;
    bounds: [[number, number], [number, number]];
  };
}

export interface Collection {
  id: string;
  name: string;
  color: string;
  description: string;
}

export interface Taxon {
  id: string;
  sci: string;
  common: string;
  family: string;
  genus: string;
  species: string;
  infra: string;
  cultivar: string;
  /** One of Vocab.plantTypes. */
  type: string;
  /** One of Vocab.origins, or '' where nobody has assessed it. */
  origin: string;
  flowerColor: string;
  flowerMonths: number[];
  fruitColor: string;
  fruitMonths: number[];
  fallColor: string;
  matureHeightFt: number | null;
  matureSpreadFt: number | null;
  /** What the bark looks like — the most useful field identification cue. */
  bark: string;
  /** Known pest and disease pressure, not a resistance score. */
  pests: string;
  soil: string;
  zones: string;
  wikipedia: string;
  description: string;
  count: number;
}

export interface Vocab {
  conditions: string[];
  statuses: string[];
  plantTypes: string[];
  origins: string[];
}

export interface Dataset {
  generatedAt: string;
  config: SiteConfig;
  vocab: Vocab;
  collections: Collection[];
  taxa: Taxon[];
  trails: GeoJSON.FeatureCollection<GeoJSON.LineString, TrailProps>;
  campusAreas: GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, CampusAreaProps>;
  counts: Record<string, number>;
}

export interface TrailProps {
  trail_id: string;
  name: string;
  color: string;
  length_mi: number;
  duration_min: number;
  description: string;
  stops: string[];
}

export interface CampusAreaProps {
  area_id: string;
  name: string;
  /** 'boundary' is the outer campus edge; 'campus' is a named sub-campus. */
  kind: 'boundary' | 'campus';
  color: string;
  description: string;
  /** True while the geometry is an estimate rather than a traced boundary. */
  provisional: boolean;
}

/** What one surveyor recorded about one plant on one day. */
export interface Observation {
  surveyedOn: string;
  surveyor: string | null;
  dbhIn: number | null;
  heightFt: number | null;
  spreadFt: number | null;
  condition: string | null;
  status: string;
  photo: string | null;
  notes: string | null;
}

/** A plant record after the columnar rows in plants.json are expanded. */
export interface Plant {
  id: string;
  taxon: Taxon;
  lat: number;
  lng: number;
  collection: Collection | null;
  dbhIn: number | null;
  heightFt: number | null;
  spreadFt: number | null;
  condition: string | null;
  plantedYear: number | null;
  status: string;
  surveyedOn: string | null;
  surveyor: string | null;
  photo: string | null;
  /** True for a gift, memorial or otherwise dedicated tree. */
  dedicated: boolean;
  /** What the plaque says, where anyone has transcribed it. */
  dedicationLabel: string | null;
  notes: string | null;
  /**
   * Every observation of this plant, oldest first — empty for a plant nobody
   * has surveyed, and length 1 for most of the rest. The fields above are the
   * last entry, flattened on so the map never has to look in here.
   */
  history: Observation[];
  /** Lowercased haystack for free-text search, built once at load. */
  search: string;
}

export type ColorBy = 'type' | 'origin' | 'condition' | 'collection';

export interface FilterState {
  q: string;
  types: Set<string>;
  origins: Set<string>;
  conditions: Set<string>;
  collections: Set<string>;
  families: Set<string>;
  bloomMonth: number | null;
  minDbh: number | null;
  includeRemoved: boolean;
}

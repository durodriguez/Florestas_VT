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
  habit: string;
  foliage: string;
  native: string;
  flowerColor: string;
  flowerMonths: number[];
  fruitColor: string;
  fruitMonths: number[];
  fallColor: string;
  matureHeightFt: number | null;
  zones: string;
  wikipedia: string;
  description: string;
  count: number;
}

export interface Vocab {
  conditions: string[];
  statuses: string[];
  habits: string[];
  foliage: string[];
  nativeStatus: string[];
}

export interface Dataset {
  generatedAt: string;
  config: SiteConfig;
  vocab: Vocab;
  collections: Collection[];
  taxa: Taxon[];
  trails: GeoJSON.FeatureCollection<GeoJSON.LineString, TrailProps>;
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
  memorial: string | null;
  notes: string | null;
  /** Lowercased haystack for free-text search, built once at load. */
  search: string;
}

export type ColorBy = 'habit' | 'native' | 'condition' | 'collection';

export interface FilterState {
  q: string;
  habits: Set<string>;
  native: Set<string>;
  conditions: Set<string>;
  collections: Set<string>;
  families: Set<string>;
  bloomMonth: number | null;
  minDbh: number | null;
  includeRemoved: boolean;
}

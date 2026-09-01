/**
 * The 2014 tree inventory, used to look up what a metal tag should be.
 *
 * The inventory is UVM's data and is not committed to this repository, so the
 * app gets it one of two ways:
 *
 *   1. `public/field/reference.csv`, if someone has put it there. Fetched
 *      automatically and cached, so surveyors never see this step.
 *   2. A file the surveyor picks once on their own device.
 *
 * Either way it is cached in IndexedDB, so it is available offline afterwards.
 * The app works without it — you just type the species yourself.
 */

import Papa from 'papaparse';
import { getMeta, setMeta } from './db';

export interface ReferenceTree {
  tag: string;
  botanical: string;
  common: string;
  dbh: string;
  condition: string;
  ageClass: string;
}

const META_KEY = 'reference-2014';

/** Column aliases, so a re-exported or lightly renamed file still loads. */
const COLUMNS: Record<keyof ReferenceTree, string[]> = {
  tag: ['tree', 'tag', 'tree_no', 'id', 'plant_id'],
  botanical: ['botanical', 'scientific_name', 'species_full', 'taxon'],
  common: ['common_name', 'common'],
  dbh: ['dbh', 'dbh_in', 'diameter'],
  condition: ['condition', 'cond'],
  ageClass: ['age_class', 'age'],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export function parseReference(csv: string): ReferenceTree[] {
  const { data, meta } = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  });

  const headers = meta.fields ?? [];
  const pick: Partial<Record<keyof ReferenceTree, string>> = {};
  for (const [field, aliases] of Object.entries(COLUMNS) as [keyof ReferenceTree, string[]][]) {
    // Both sides must be normalised: the header "Common_Name" and the alias
    // "common_name" only match once punctuation is stripped from each.
    const wanted = aliases.map(norm);
    pick[field] = headers.find((h) => wanted.includes(norm(h)));
  }
  if (!pick.tag || !pick.botanical) {
    throw new Error('That file has no tree-number and scientific-name columns. Is it the inventory export?');
  }

  const get = (row: Record<string, string>, f: keyof ReferenceTree) =>
    (pick[f] ? row[pick[f]!] ?? '' : '').trim();

  return data
    .map((row) => ({
      tag: get(row, 'tag'),
      botanical: get(row, 'botanical'),
      common: get(row, 'common'),
      dbh: get(row, 'dbh'),
      condition: get(row, 'condition'),
      ageClass: get(row, 'ageClass'),
    }))
    .filter((t) => t.tag && t.botanical);
}

export class Reference {
  private byTag = new Map<string, ReferenceTree>();

  get size(): number {
    return this.byTag.size;
  }

  load(trees: ReferenceTree[]): void {
    this.byTag = new Map(trees.map((t) => [t.tag.trim(), t]));
  }

  lookup(tag: string): ReferenceTree | undefined {
    return this.byTag.get(tag.trim());
  }

  /**
   * Tags near the one typed. An engulfed or corroded tag often loses a digit,
   * and the neighbours plus the species usually identify it.
   */
  neighbours(tag: string, span = 3): ReferenceTree[] {
    const n = Number(tag);
    if (!Number.isInteger(n)) return [];
    const out: ReferenceTree[] = [];
    for (let i = n - span; i <= n + span; i++) {
      if (i === n || i < 1) continue;
      const hit = this.byTag.get(String(i));
      if (hit) out.push(hit);
    }
    return out;
  }
}

export async function loadCachedReference(): Promise<ReferenceTree[] | undefined> {
  return getMeta<ReferenceTree[]>(META_KEY);
}

export async function cacheReference(trees: ReferenceTree[]): Promise<void> {
  await setMeta(META_KEY, trees);
}

/** Try the server copy, if the project has published one. */
export async function fetchServerReference(base: string): Promise<ReferenceTree[] | undefined> {
  try {
    const res = await fetch(`${base}field/reference.csv`, { cache: 'no-cache' });
    if (!res.ok) return undefined;
    return parseReference(await res.text());
  } catch {
    return undefined;
  }
}

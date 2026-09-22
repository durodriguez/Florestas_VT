// Types for species.mjs, so the field app and the tests can import it without
// a @ts-expect-error. The implementation stays plain .mjs because the build
// scripts run under Node with no compile step.

export declare function normalizeName(name: unknown): string;

export interface SpeciesLookup {
  /** A taxon_id, or null for a name deliberately recorded as unresolvable. */
  lookup: Map<string, string | null>;
  conflicts: Array<{ alias: string; reason: string }>;
  byId: Map<string, Record<string, string>>;
  /** Alias (normalized) -> why its mapping is a judgement call. */
  assumed: Map<string, string>;
}

/**
 * `exact` — the source named this taxon.
 * `genus` — the source went no deeper than the genus; faithful, but vague.
 * `assumed` — somebody chose between readings the source left open.
 */
export type ResolutionQuality =
  | { kind: 'exact' }
  | { kind: 'genus' }
  | { kind: 'assumed'; reason: string };

export declare function resolutionQuality(
  name: unknown,
  taxonId: string | null | undefined,
  context?: {
    taxaById?: Map<string, Record<string, string>>;
    assumed?: Map<string, string>;
  },
): ResolutionQuality;

export declare function buildSpeciesLookup(
  taxaRows: Array<Record<string, string>>,
  aliasRows?: Array<Record<string, string>>,
): SpeciesLookup;

export declare function resolveSpecies(
  name: unknown,
  lookup: Map<string, string | null>,
): string | null | undefined;

export declare function classifyNames(
  names: Iterable<string>,
  lookup: Map<string, string | null>,
): { resolved: Map<string, string>; unresolved: string[]; unknown: string[] };

/**
 * What a species page adds by hand, species by species, in three files
 * beside taxa.csv (docs/SPECIES-PAGES.md):
 *
 * - data/crown-forms.csv: taxon_id, crown_form. The shape the drawing of the
 *   tree at maturity takes (tree-drawing.mjs's CROWN_FORMS).
 * - data/habitat.csv: taxon_id, habitat, source, source_url. Where it grows
 *   wild, in a few sentences.
 * - data/facts.csv: taxon_id, fact, source, source_url. One row per fact,
 *   shown in Worth knowing after the fun fact, in file order.
 *
 * A cultivar or variety without its own crown form or habitat takes its
 * species' (the taxon of the same genus and species, with neither): a
 * thornless honeylocust is shaped and grows wild like any other. Not its
 * facts: one about the species may not hold for a selection of it.
 *
 * Every habitat and fact needs a source: they are checkable claims, held to
 * the fun fact's rule (docs/DATA-MODEL.md). No DOM here.
 */

import { CROWN_FORMS } from './tree-drawing.mjs';

const trim = (v) => (v ?? '').toString().trim();
/** As the fun fact is held to: what a phone can show in a few lines. */
export const MAX_FACT = 240;

/**
 * @param {object} args  crownRows, habitatRows, factRows (parsed CSV rows),
 *   taxa (the built dataset's taxa: id, genus, species, infra, cultivar).
 * @returns {{ extras: Map<string, { crownForm: string|null, habitat: object|null, facts: object[] }>, errors: string[], warnings: string[] }}
 */
export function speciesExtras({ crownRows = [], habitatRows = [], factRows = [], taxa }) {
  const errors = [];
  const warnings = [];
  const ids = new Set(taxa.map((t) => t.id));
  const known = (file, i, id) => {
    if (ids.has(id)) return true;
    errors.push(`${file} row ${i + 2}: no taxon "${id}" in taxa.csv`);
    return false;
  };
  const sourced = (file, i, r) => {
    if (trim(r.source) && /^https?:\/\//.test(trim(r.source_url))) return true;
    errors.push(`${file} row ${i + 2}: needs a source and a source_url (http…)`);
    return false;
  };

  const forms = new Map();
  crownRows.forEach((r, i) => {
    const id = trim(r.taxon_id);
    const form = trim(r.crown_form);
    if (!known('crown-forms.csv', i, id)) return;
    if (!CROWN_FORMS.includes(form)) return errors.push(`crown-forms.csv row ${i + 2}: crown_form must be one of ${CROWN_FORMS.join(', ')}, got "${form}"`);
    if (forms.has(id)) return errors.push(`crown-forms.csv row ${i + 2}: ${id} is listed twice`);
    forms.set(id, form);
  });

  const habitats = new Map();
  habitatRows.forEach((r, i) => {
    const id = trim(r.taxon_id);
    if (!known('habitat.csv', i, id) || !sourced('habitat.csv', i, r)) return;
    if (!trim(r.habitat)) return errors.push(`habitat.csv row ${i + 2}: habitat is empty`);
    if (habitats.has(id)) return errors.push(`habitat.csv row ${i + 2}: ${id} is listed twice`);
    habitats.set(id, { text: trim(r.habitat), source: trim(r.source), url: trim(r.source_url) });
  });

  const facts = new Map();
  factRows.forEach((r, i) => {
    const id = trim(r.taxon_id);
    if (!known('facts.csv', i, id) || !sourced('facts.csv', i, r)) return;
    const text = trim(r.fact);
    if (!text) return errors.push(`facts.csv row ${i + 2}: fact is empty`);
    if (text.length > MAX_FACT) warnings.push(`facts.csv row ${i + 2}: ${id}'s fact runs to ${text.length} characters (keep it under ${MAX_FACT})`);
    if (!facts.has(id)) facts.set(id, []);
    facts.get(id).push({ text, source: trim(r.source), url: trim(r.source_url) });
  });

  // A cultivar's or variety's species: same genus and species, neither of its own.
  const speciesKey = (t) => `${t.genus}|${t.species}`;
  const speciesOf = new Map(taxa.filter((t) => t.species && !t.cultivar && !t.infra).map((t) => [speciesKey(t), t.id]));

  const extras = new Map();
  for (const t of taxa) {
    const parent = t.cultivar || t.infra ? speciesOf.get(speciesKey(t)) : undefined;
    const habitat = habitats.get(t.id) ?? (parent && habitats.has(parent) ? { ...habitats.get(parent), inherited: true } : null);
    extras.set(t.id, {
      crownForm: forms.get(t.id) ?? (parent ? forms.get(parent) ?? null : null),
      habitat,
      facts: facts.get(t.id) ?? [],
    });
  }
  return { extras, errors, warnings };
}

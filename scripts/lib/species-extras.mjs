/**
 * What a species page adds by hand, species by species, in three files
 * beside taxa.csv (docs/SPECIES-PAGES.md):
 *
 * - data/crown-forms.csv: taxon_id, crown_form. The shape the drawing of the
 *   tree at maturity takes (tree-drawing.mjs's CROWN_FORMS).
 * - data/habitat.csv: taxon_id, habitat, distribution, source, source_url.
 *   Where it grows wild, as a field guide puts it: habitat, the ground, light
 *   and places it grows in; distribution, where in the world. Either may be
 *   blank, not both.
 * - data/facts.csv: taxon_id, fact, source, source_url, cultivars. One row per
 *   fact, shown in Worth knowing after the fun fact, in file order. cultivars
 *   "yes": the fact holds for the species' cultivars and varieties too, and
 *   their pages show it, after their own, as the species'.
 * - data/part-photos.csv: taxon_id, part, title, page_url, image_url, author,
 *   license, license_url, matches, of_species ("yes" when the photo is of the
 *   species a cultivar was selected from, not listed in taxa.csv). A photo of its bark, leaves, flowers or fruit
 *   (PARTS), from Wikimedia Commons under a free license, credited on the
 *   page. From Wikimedia Commons, image_url is the 500 px thumbnail on
 *   upload.wikimedia.org and page_url its Commons page; from iNaturalist, a
 *   research-grade observation's medium photo and the observation's page.
 *
 * A cultivar or variety without its own crown form, habitat or photos takes its
 * species' (the taxon of the same genus and species, with neither; photos
 * part by part, so it can replace just the part that differs): a
 * thornless honeylocust is shaped and grows wild like any other. Its facts
 * only where marked (cultivars "yes"): one about the species may not hold for
 * a selection of it (wild honeylocusts carry thorns; the planted ones do not).
 *
 * - data/know-it-by.csv: taxon_id, label, parts, text, source, source_url,
 *   cultivars ("no": the note does not hold for its cultivars, not lent).
 *   Up to four Know it by tiles, in file order, each naming the photo parts it
 *   shows (PHOTO_PARTS; two joined by + sit side by side) and a note in prose.
 *   A taxon without rows shows the four default tiles (bark, leaves, flowers,
 *   fruit) captioned from taxa.csv.
 *
 * Every habitat and fact needs a source: they are checkable claims, held to
 * the fun fact's rule (docs/DATA-MODEL.md). No DOM here.
 */

import { CROWN_FORMS } from './tree-drawing.mjs';

const trim = (v) => (v ?? '').toString().trim();
/** As the fun fact is held to: what a phone can show in a few lines. */
export const MAX_FACT = 240;
export const PARTS = ['bark', 'leaves', 'flowers', 'fruit'];
/**
 * Every part a photo can show: the four above, which a page shows by default,
 * and the others a Know it by tile in know-it-by.csv can ask for. For a
 * conifer, flowers are its pollen cones and fruit its seed cones.
 */
export const PHOTO_PARTS = [...PARTS, 'buds', 'twigs', 'thorns', 'catkins', 'seeds', 'fronds', 'fiddleheads', 'spores', 'underside', 'color', 'habit', 'roots'];
/** A Know it by note: about as long as the book's, a short paragraph on a phone. */
export const MAX_KNOW = 320;
/**
 * Licenses that allow this site's use with credit: public domain, CC0, CC BY,
 * CC BY-SA, and the non-commercial CC BY-NC and CC BY-NC-SA, which fit a free
 * educational site (docs/SPECIES-PAGES.md, "Licenses"). Not CC BY-ND or
 * BY-NC-ND (no derivatives), nor all rights reserved.
 */
const FREE = /^(public domain|pd|cc0( 1\.0)?|cc by(-nc)?(-sa)? \d\.\d( [a-z]+)?)$/i;

/**
 * @param {object} args  crownRows, habitatRows, factRows (parsed CSV rows),
 *   taxa (the built dataset's taxa: id, genus, species, infra, cultivar, and
 *   flowerColor and fruitColor where known).
 * @returns {{ extras: Map<string, { crownForm: string|null, habitat: object|null, facts: object[] }>, errors: string[], warnings: string[] }}
 */
export function speciesExtras({ crownRows = [], habitatRows = [], factRows = [], photoRows = [], knowRows = [], taxa }) {
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
    if (!trim(r.habitat) && !trim(r.distribution)) return errors.push(`habitat.csv row ${i + 2}: habitat and distribution are both empty`);
    if (habitats.has(id)) return errors.push(`habitat.csv row ${i + 2}: ${id} is listed twice`);
    habitats.set(id, { text: trim(r.habitat), distribution: trim(r.distribution), source: trim(r.source), url: trim(r.source_url) });
  });

  const facts = new Map();
  factRows.forEach((r, i) => {
    const id = trim(r.taxon_id);
    if (!known('facts.csv', i, id) || !sourced('facts.csv', i, r)) return;
    const text = trim(r.fact);
    if (!text) return errors.push(`facts.csv row ${i + 2}: fact is empty`);
    if (text.length > MAX_FACT) warnings.push(`facts.csv row ${i + 2}: ${id}'s fact runs to ${text.length} characters (keep it under ${MAX_FACT})`);
    if (!facts.has(id)) facts.set(id, []);
    const forCultivars = trim(r.cultivars);
    if (forCultivars && !/^(yes|no)$/i.test(forCultivars)) return errors.push(`facts.csv row ${i + 2}: cultivars must be yes, no or blank, got "${forCultivars}"`);
    facts.get(id).push({ text, source: trim(r.source), url: trim(r.source_url), ...(/^yes$/i.test(forCultivars) && { forCultivars: true }) });
  });

  const byIdAll = new Map(taxa.map((t) => [t.id, t]));
  const photos = new Map();
  photoRows.forEach((r, i) => {
    const where = `part-photos.csv row ${i + 2}`;
    const id = trim(r.taxon_id);
    const part = trim(r.part);
    if (!known('part-photos.csv', i, id)) return;
    if (!PHOTO_PARTS.includes(part)) return errors.push(`${where}: part must be one of ${PHOTO_PARTS.join(', ')}, got "${part}"`);
    const commons = /^https:\/\/upload\.wikimedia\.org\/.+\/500px-[^/]+$/.test(trim(r.image_url)) && /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(trim(r.page_url));
    const inat = /^https:\/\/inaturalist-open-data\.s3\.amazonaws\.com\/photos\/\d+\/medium\.(jpe?g|png)$/i.test(trim(r.image_url)) && /^https:\/\/www\.inaturalist\.org\/observations\/\d+$/.test(trim(r.page_url));
    if (!commons && !inat) return errors.push(`${where}: needs a Commons 500px thumbnail and its File: page, or an iNaturalist medium photo and its observation page`);
    if (!FREE.test(trim(r.license))) return errors.push(`${where}: license "${trim(r.license)}" is not one that allows reuse with credit`);
    if (!trim(r.author)) return errors.push(`${where}: author is empty; credit is a condition of the license`);
    // What the photo shows that agrees with taxa.csv's record of that part:
    // written when the photo is chosen, so no photo goes in on its label
    // alone (docs/SPECIES-PAGES.md, "Choosing a photo").
    if (!trim(r.matches)) return errors.push(`${where}: matches is empty; say what the photo shows that agrees with taxa.csv for this part`);
    if (!photos.has(id)) photos.set(id, {});
    if (photos.get(id)[part]) return errors.push(`${where}: ${id} already has a ${part} photo`);
    // of_species: the photo is of the species a cultivar was selected from,
    // which taxa.csv does not list, so it cannot be borrowed from the
    // species' own page. Shown with the same "of the species" note.
    const ofSpecies = /^(yes|y|true)$/i.test(trim(r.of_species));
    if (ofSpecies) {
      const t = byIdAll.get(id);
      if (!t?.species || !(t.cultivar || t.infra)) return errors.push(`${where}: of_species is only for a cultivar or variety of a named species`);
    }
    photos.get(id)[part] = {
      title: trim(r.title), page: trim(r.page_url), image: trim(r.image_url), site: inat ? 'iNaturalist' : 'Wikimedia Commons',
      author: trim(r.author), license: trim(r.license), licenseUrl: trim(r.license_url),
      ...(ofSpecies && { inherited: true }),
    };
  });

  // Know it by, written: up to four tiles, each a label, the parts its photos
  // show (one, or two side by side: "flowers+fruit"), and a note in prose on
  // what tells the species apart by them. In file order.
  const knows = new Map();
  knowRows.forEach((r, i) => {
    const where = `know-it-by.csv row ${i + 2}`;
    const id = trim(r.taxon_id);
    if (!known('know-it-by.csv', i, id) || !sourced('know-it-by.csv', i, r)) return;
    const label = trim(r.label);
    const parts = trim(r.parts).split('+').map(trim).filter(Boolean);
    const text = trim(r.text);
    if (!label || !text) return errors.push(`${where}: label and text are both needed`);
    if (!parts.length || parts.length > 2) return errors.push(`${where}: parts must name one part or two joined by +, got "${trim(r.parts)}"`);
    const bad = parts.find((p) => !PHOTO_PARTS.includes(p));
    if (bad) return errors.push(`${where}: part must be one of ${PHOTO_PARTS.join(', ')}, got "${bad}"`);
    if (text.length > MAX_KNOW) warnings.push(`${where}: ${id}'s ${label.toLowerCase()} note runs to ${text.length} characters (keep it under ${MAX_KNOW})`);
    if (!knows.has(id)) knows.set(id, []);
    if (knows.get(id).length >= 4) return errors.push(`${where}: ${id} already has four Know it by tiles`);
    const forCultivars = trim(r.cultivars);
    if (forCultivars && !/^(yes|no)$/i.test(forCultivars)) return errors.push(`${where}: cultivars must be yes, no or blank, got "${forCultivars}"`);
    knows.get(id).push({ label, parts, text, source: trim(r.source), url: trim(r.source_url), ...(/^no$/i.test(forCultivars) && { notForCultivars: true }) });
  });
  for (const [id, tiles] of knows) {
    for (const k of tiles) {
      const missing = k.parts.filter((p) => !photos.get(id)?.[p]);
      if (missing.length) warnings.push(`know-it-by.csv: ${id}'s ${k.label.toLowerCase()} tile has no ${missing.join(' or ')} photo of its own in part-photos.csv`);
    }
  }

  // A cultivar's or variety's species: same genus and species, neither of its own.
  const speciesKey = (t) => `${t.genus}|${t.species}`;
  const speciesOf = new Map(taxa.filter((t) => t.species && !t.cultivar && !t.infra).map((t) => [speciesKey(t), t.id]));

  const byId = new Map(taxa.map((t) => [t.id, t]));
  // A part whose recorded color the cultivar changes (Crimson Cloud's red
  // flowers, where the species' are white) is not the species' to lend.
  // Compared by broad group, so "tan" and "brown" fruit, or "pink" and
  // "purple" redbud flowers, are the same thing described twice.
  const unlike = (t, species) => !species ? [] : [['flowers', 'flowerColor'], ['fruit', 'fruitColor']]
    .filter(([, key]) => t[key] && species[key] && !sameColor(t[key], species[key])).map(([part]) => part);

  const extras = new Map();
  for (const t of taxa) {
    const parent = t.cultivar || t.infra ? speciesOf.get(speciesKey(t)) : undefined;
    const habitat = habitats.get(t.id) ?? (parent && habitats.has(parent) ? { ...habitats.get(parent), inherited: true } : null);
    extras.set(t.id, {
      crownForm: forms.get(t.id) ?? (parent ? forms.get(parent) ?? null : null),
      habitat,
      facts: facts.get(t.id) ?? [],
      // The species' facts that hold for its cultivars too, shown after the cultivar's own.
      speciesFacts: parent ? (facts.get(parent) ?? []).filter((f) => f.forCultivars) : [],
      photos: partPhotos(photos.get(t.id), parent ? photos.get(parent) : undefined, unlike(t, byId.get(parent))),
      // Its own Know it by, or its species', marked inherited: a tile of the
      // species' is shown on a cultivar's page only where the cultivar shows
      // the species' photos of those parts (the page checks).
      // Not a tile marked cultivars "no": thorns on honeylocust, which its
      // planted cultivars lack.
      know: knows.get(t.id) ?? (parent && knows.has(parent) ? knows.get(parent).filter((k) => !k.notForCultivars).map((k) => ({ ...k, inherited: true })) : null),
    });
  }
  // A taxon named only to genus ("Ulmus sp.") shows a leaf of each species or
  // hybrid of that genus in the collection, most planted first, so a reader can
  // work out which one is in front of them. Each says whose leaf it is. A genus
  // with neither (forsythia: only a cultivar) shows its cultivars instead.
  const leafOf = (k) => ({ k, photo: extras.get(k.id)?.photos?.leaves });
  for (const t of taxa) {
    if (t.species || !t.genus || t.cultivar || !/\bspp?\.?$/.test(t.sci ?? "")) continue;
    const named = taxa.filter((k) => k.genus === t.genus && k.id !== t.id);
    const pick = (ks, ownOnly) => ks
      .map((k) => leafOf(k))
      .filter(({ photo }) => photo && !(ownOnly && photo.inherited))
      .sort((a, b) => (b.k.count ?? 0) - (a.k.count ?? 0) || a.k.id.localeCompare(b.k.id))
      .slice(0, 8);
    const species = named.filter((k) => k.species && !k.cultivar && !k.infra);
    const chosen = species.length ? pick(species, true) : pick(named, false);
    const kin = chosen.map(({ k, photo }) => ({
      id: k.id, common: k.common, count: k.count ?? 0, photo,
      sci: k.sci || `${k.genus} ${k.species}`,
    }));
    if (kin.length) extras.get(t.id).kin = kin;
  }
  return { extras, errors, warnings };
}

const COLOR_GROUPS = [
  ['white', 'cream'],
  ['yellow', 'green', 'gold'],
  ['red', 'pink', 'purple', 'magenta', 'crimson'],
  ['brown', 'tan', 'bronze', 'black', 'blue', 'gray'],
  ['orange'],
  ['none'],
];
/** Whether two recorded colors ("yellow-green", "pink-purple") fall in a common group. */
function sameColor(a, b) {
  const groups = (c) => new Set(c.toLowerCase().split(/[-\s]+/).map((w) => COLOR_GROUPS.findIndex((g) => g.includes(w))).filter((i) => i >= 0));
  const ga = groups(a);
  return [...groups(b)].some((i) => ga.has(i)) || a === b;
}

/**
 * A taxon's photos, part by part: its own where it has one, else its
 * species' (marked inherited), so a cultivar that differs in one part, such as
 * Crimson King's purple leaves, needs only that part's photo. `inherited` on
 * the whole is true when every part shown is the species'. Not a part in
 * `unlike`: one whose recorded color the cultivar changes.
 */
function partPhotos(own = {}, species = {}, unlike = []) {
  const out = {};
  for (const part of PHOTO_PARTS) {
    if (own[part]) out[part] = own[part];
    else if (species[part] && !unlike.includes(part)) out[part] = { ...species[part], inherited: true };
  }
  const shown = PHOTO_PARTS.filter((p) => out[p]);
  if (!shown.length) return null;
  if (shown.every((p) => out[p].inherited)) out.inherited = true;
  return out;
}

/**
 * docs/PHOTO-GAPS.md lists the part photos still wanted, one unticked line
 * each, naming the taxon and part as (`taxon-id`, part). Returns a warning
 * for every line still unticked whose photo is now in part-photos.csv.
 */
export function staleGaps(markdown, extras) {
  const warnings = [];
  for (const m of String(markdown ?? '').matchAll(/^- \[ \] .*?\(`([a-z0-9-]+)`, (bark|leaves|flowers|fruit)\)/gms)) {
    const photos = extras.get(m[1])?.photos;
    if (photos?.[m[2]] && !photos[m[2]].inherited) {
      warnings.push(`docs/PHOTO-GAPS.md: ${m[1]} now has a ${m[2]} photo; tick its line off`);
    }
  }
  return warnings;
}

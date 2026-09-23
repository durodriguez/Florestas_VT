import type { CityTree, Dataset, Observation, Plant, Taxon, Collection } from './types';

interface PlantsFile {
  fields: string[];
  rows: unknown[][];
  /**
   * Both optional so a plants.json still sitting in a returning visitor's cache
   * from before observations existed loads as it always did, one survey deep,
   * rather than throwing on the way in.
   */
  observationFields?: string[];
  /**
   * Keyed by plant_id, and present only for plants surveyed more than once —
   * a single observation is already flattened onto the row, so repeating it
   * here would double the file to say nothing new.
   */
  history?: Record<string, unknown[][]>;
}

/** Column-array rows -> Plant objects, resolving taxon/collection/enum indices. */
export function expandPlants(file: PlantsFile, dataset: Dataset): Plant[] {
  const col = Object.fromEntries(file.fields.map((f, i) => [f, i])) as Record<string, number>;
  const at = (row: unknown[], field: string) => row[col[field]!];
  const { conditions, statuses } = dataset.vocab;

  const obsCol = Object.fromEntries(
    (file.observationFields ?? []).map((f, i) => [f, i]),
  ) as Record<string, number>;
  const obsAt = (row: unknown[], field: string) => row[obsCol[field]!];

  const expandObservation = (row: unknown[]): Observation => {
    const condIdx = obsAt(row, 'condition') as number;
    return {
      surveyedOn: obsAt(row, 'surveyed_on') as string,
      surveyor: obsAt(row, 'surveyor') as string | null,
      dbhIn: obsAt(row, 'dbh_in') as number | null,
      heightFt: obsAt(row, 'height_ft') as number | null,
      spreadFt: obsAt(row, 'spread_ft') as number | null,
      condition: condIdx >= 0 ? conditions[condIdx] ?? null : null,
      status: statuses[obsAt(row, 'status') as number] ?? 'active',
      photo: obsAt(row, 'photo') as string | null,
    };
  };

  return file.rows.map((row) => {
    const taxon = dataset.taxa[at(row, 'taxon') as number] as Taxon;
    const cIdx = at(row, 'collection') as number;
    const collection: Collection | null = cIdx >= 0 ? dataset.collections[cIdx] ?? null : null;
    const condIdx = at(row, 'condition') as number;

    const plant: Plant = {
      id: at(row, 'plant_id') as string,
      tag: (at(row, 'tag') as string | null) ?? '',
      taxon,
      lat: at(row, 'lat') as number,
      lng: at(row, 'lng') as number,
      collection,
      dbhIn: at(row, 'dbh_in') as number | null,
      heightFt: at(row, 'height_ft') as number | null,
      spreadFt: at(row, 'spread_ft') as number | null,
      condition: condIdx >= 0 ? conditions[condIdx] ?? null : null,
      plantedYear: at(row, 'planted_year') as number | null,
      status: statuses[at(row, 'status') as number] ?? 'active',
      surveyedOn: at(row, 'surveyed_on') as string | null,
      surveyor: at(row, 'surveyor') as string | null,
      photo: at(row, 'photo') as string | null,
      dedicationLabel: at(row, 'dedication_label') as string | null,
      story: at(row, 'story') as string | null,
      history: [],
      search: '',
    };

    // Plants surveyed once carry no history entry of their own; rebuild the
    // single observation from the row so every consumer sees the same shape.
    const series = file.history?.[plant.id];
    if (series) {
      plant.history = series.map(expandObservation);
    } else if (plant.surveyedOn) {
      plant.history = [{
        surveyedOn: plant.surveyedOn,
        surveyor: plant.surveyor,
        dbhIn: plant.dbhIn,
        heightFt: plant.heightFt,
        spreadFt: plant.spreadFt,
        condition: plant.condition,
        status: plant.status,
        photo: plant.photo,
      }];
    }

    plant.search = [
      plant.id,
      taxon.common,
      taxon.sci,
      taxon.family,
      taxon.genus,
      taxon.cultivar,
      taxon.alt,
      collection?.name ?? '',
      plant.dedicationLabel ?? '',
      plant.story ?? '',
      // The number on the trunk. Needed explicitly now: it used to fall out of
      // the id for free, because "763" is a substring of "UVM-0763", and that
      // stopped being reliable when the two were allowed to differ.
      plant.tag,
    ]
      .join(' ')
      .toLowerCase();

    return plant;
  });
}

export async function loadData(base: string): Promise<{ dataset: Dataset; plants: Plant[] }> {
  // __DATA_VERSION__ is a hash of the data itself, compiled in at build time.
  // Without it these two URLs never change and browsers keep serving whatever
  // they cached, so a visitor would not see a new survey until their cache
  // expired on its own.
  const v = `?v=${__DATA_VERSION__}`;
  const [dataset, plantsFile] = await Promise.all([
    fetch(`${base}data/dataset.json${v}`).then(assertOk('dataset.json')) as Promise<Dataset>,
    fetch(`${base}data/plants.json${v}`).then(assertOk('plants.json')) as Promise<PlantsFile>,
  ]);
  return { dataset, plants: expandPlants(plantsFile, dataset) };
}

function assertOk(name: string) {
  return (res: Response) => {
    if (!res.ok) {
      throw new Error(`Could not load ${name} (HTTP ${res.status}). Run \`npm run data\` first.`);
    }
    return res.json();
  };
}

/**
 * Burlington's street trees, from the compact rows into usable objects.
 *
 * Deliberately a separate function from expandPlants rather than a shared one
 * with optional fields: these two things are not the same kind of record, and
 * a single expander would be the first step towards treating them as if they
 * were.
 */
export function expandCityTrees(dataset: Dataset): CityTree[] {
  const { fields, rows } = dataset.cityTrees ?? { fields: [], rows: [] };
  const col = Object.fromEntries(fields.map((f, i) => [f, i])) as Record<string, number>;
  const at = (row: unknown[], field: string) => row[col[field]!];
  const { conditions } = dataset.vocab;

  return rows.map((row) => {
    const taxon = dataset.taxa[at(row, 'taxon') as number]!;
    const collectionIdx = at(row, 'collection') as number;
    const conditionIdx = at(row, 'condition') as number;
    const tree: CityTree = {
      id: at(row, 'city_id') as string,
      lat: at(row, 'lat') as number,
      lng: at(row, 'lng') as number,
      taxon,
      collection: collectionIdx >= 0 ? dataset.collections[collectionIdx]! : null,
      dbhIn: (at(row, 'dbhIn') as number | null) ?? null,
      condition: conditionIdx >= 0 ? conditions[conditionIdx]! : '',
      plantedYear: (at(row, 'plantedYear') as number | null) ?? null,
      address: (at(row, 'address') as string) ?? '',
      search: '',
    };
    tree.search = [
      tree.id,
      taxon.common,
      taxon.sci,
      taxon.family,
      taxon.genus,
      taxon.alt,
      tree.address,
      tree.collection?.name ?? '',
    ].join(' ').toLowerCase();
    return tree;
  });
}

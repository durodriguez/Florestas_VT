import type { Dataset, Plant, Taxon, Collection } from './types';

interface PlantsFile {
  fields: string[];
  rows: unknown[][];
}

/** Column-array rows -> Plant objects, resolving taxon/collection/enum indices. */
export function expandPlants(file: PlantsFile, dataset: Dataset): Plant[] {
  const col = Object.fromEntries(file.fields.map((f, i) => [f, i])) as Record<string, number>;
  const at = (row: unknown[], field: string) => row[col[field]!];
  const { conditions, statuses } = dataset.vocab;

  return file.rows.map((row) => {
    const taxon = dataset.taxa[at(row, 'taxon') as number] as Taxon;
    const cIdx = at(row, 'collection') as number;
    const collection: Collection | null = cIdx >= 0 ? dataset.collections[cIdx] ?? null : null;
    const condIdx = at(row, 'condition') as number;

    const plant: Plant = {
      id: at(row, 'plant_id') as string,
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
      memorial: at(row, 'memorial') as string | null,
      notes: at(row, 'notes') as string | null,
      search: '',
    };

    plant.search = [
      plant.id,
      taxon.common,
      taxon.sci,
      taxon.family,
      taxon.genus,
      taxon.cultivar,
      collection?.name ?? '',
      plant.memorial ?? '',
    ]
      .join(' ')
      .toLowerCase();

    return plant;
  });
}

export async function loadData(base: string): Promise<{ dataset: Dataset; plants: Plant[] }> {
  const [dataset, plantsFile] = await Promise.all([
    fetch(`${base}data/dataset.json`).then(assertOk('dataset.json')) as Promise<Dataset>,
    fetch(`${base}data/plants.json`).then(assertOk('plants.json')) as Promise<PlantsFile>,
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

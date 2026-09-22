# Where the data came from, and under what terms

Three outside datasets feed this project. Each is recorded here with its
source, its licence and what was done to it, because attribution that lives
only in somebody's memory is attribution that gets lost on the next refresh.

## 1. The 2014 UVM campus inventory

**`public/field/reference.csv`** — 2,502 tagged trees, numbered 1–2555.

| | |
| --- | --- |
| Dataset | Burlington, Vermont UVM Campus Tree Inventory Data |
| Published by | Forest Ecosystem Monitoring Cooperative (FEMC), University of Vermont |
| Collected | 1 January – 31 December 2014 |
| Purpose, as stated | *"To estimate the composition and potential risk of damage to property and infrastructure during extreme weather events."* |
| Licence | **CC BY-SA 4.0** |
| Source | https://www.uvm.edu/femc/data/archive/project/burlington_vermont_street_tree_inventory/dataset/burlington-vermont-uvm-campus-tree-inventory |

**Preferred citation**, as the archive gives it:

> The University of Vermont (2019). *Burlington, Vermont UVM Campus Tree
> Inventory Data.* Available online at:
> https://www.uvm.edu/femc/data/archive/project/burlington_vermont_street_tree_inventory/dataset/burlington-vermont-uvm-campus-tree-inventory

**What was changed.** The archive download carries eleven columns:

```
Tree, Common_Name, Genus, Species, Botanical, DBH, Age_Class,
Height, Condition, Tree_Care_Priority, Notes
```

Six are published here — tree number, common and scientific name, DBH, age
class and condition. `Genus` and `Species` are `Botanical` split in two.
`Height` is a class (Small / Medium / Large) rather than a measurement.
`Tree_Care_Priority` and `Notes` were left out because the field app only
needs enough to autofill a form, and an arborist's internal notes do not
belong on a public URL.

**The published copy was verified against the source on 22 September 2026**:
all 2,502 rows present, zero cell differences across the six shared columns.
The reduction is faithful.

**There are no coordinates in the source.** The archive page describes the
dataset as 12 fields against the download's 11; either way, nothing in it
locates a tree. This is recorded because it is a reasonable thing to go
looking for twice — the survey's purpose was storm risk to buildings, which
sounds like it would need positions, and it did not record them.

**The dataset's stated purpose is worth remembering when reading it.** It was
built to assess storm risk to buildings, not to name trees precisely. DBH,
condition and age class carry that purpose directly. That does not make its
species wrong — but it does mean species identification was a means rather
than the point, which is context for the 165 places where it disagrees with
the 2023–24 mapping. See [INVENTORY-CROSSCHECK.md](../docs/INVENTORY-CROSSCHECK.md).

## 2. UVM's ArcGIS tree layer, 2023–24

**Imported into `data/plants.csv`.** Not redistributed — the source export is
deliberately not committed, and the `Creator` / `Editor` columns holding a
named individual's email are dropped on import.

Surveyed by Erin Camire as a UVM undergraduate; permission to use the data was
given directly, 21 September 2026. See [ARCGIS-IMPORT.md](../docs/ARCGIS-IMPORT.md).

## 3. The City of Burlington street tree inventory

**`data/city-trees.csv`** — 337 trees, clipped from 14,429 to the campus
boundary. Open data from the City of Burlington. See
[CITY-TREES.md](../docs/CITY-TREES.md).

Note that the FEMC archive also carries Burlington-area inventories under
**CC BY-SA 4.0**, and the city's own portal may carry different terms. The
committed file came from the city's public export; if it is ever re-sourced
from FEMC, the licence line above applies to it too.

## On ShareAlike

CC BY-SA requires that derivative works carry the same licence. How far that
reaches into a combined dataset-plus-software project is genuinely unsettled,
and this note is not legal advice. The structure that seems least likely to
create a problem is the one already in place: each outside dataset in its own
file, attributed, with its terms recorded beside it, rather than melted into a
single table whose provenance can no longer be separated.

**Still to do:** ask whoever at UVM handles licensing whether this is
sufficient before the map is published under a university domain.

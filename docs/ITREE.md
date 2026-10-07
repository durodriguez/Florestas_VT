# Ecosystem services with i-Tree

What trees do — carbon stored and taken up each year, air pollution removed,
rainfall intercepted — modelled with **i-Tree Eco**, the USDA Forest Service's
tool, from species, trunk diameter and location. This is the round trip for
[to-do #7](TODO.md), run first on **Burlington's 364 street trees inside the
campus boundary**: they are the trees here that carry a diameter. UVM's own
2,065 do not yet, and the same steps will run on them when they do.

The model runs in i-Tree. This repository prepares its input and, afterwards,
stores and shows its output — nothing here imitates the model.

## The steps

| # | Who | Step |
|---|---|---|
| 1 | here | `npm run itree:export` writes the inventory file |
| 2 | you | Install i-Tree Eco and create a project for Burlington, VT |
| 3 | you | Import the file and match the species |
| 4 | you | Submit the project; i-Tree processes it on its servers |
| 5 | you | Export the per-tree results and send them back |
| 6 | here | Store the results with their provenance; show them on the map |

### 1. The inventory file

```bash
npm run itree:export          # → itree-export/city-trees-itree.csv
```

One row per tree: Burlington's id (`BTV-…`, so results join back), species,
DBH (in), total height (ft), crown width (ft, the city's single spread used for
both directions), condition, street tree, date measured, coordinates and
address. The file is not committed: it is rebuilt from `data/city-trees.csv`
whenever it is needed.

**Names are translated for i-Tree**, and every translation is printed:

- Cultivars are modelled as their species — 'Princeton' is an American elm to
  the model; growth does not change with a trade name.
- Genus-only records (*Malus*, *Ulmus*) stay at genus.
- Thornless honeylocust is written *var. inermis*, as most species lists have it.
- *Scandosorbus intermedia* is written *Sorbus intermedia*, its older name.
- *Quercus × warei* is modelled as *Quercus*.

**Know what the numbers will rest on:**

- Measured **2013–2023**, a third in 2014; 22 records carry no date. The model
  sizes each tree as measured, so trees that have grown since are understated.
- Height and crown width come **in five-foot steps**. DBH, the input the model
  is most sensitive to, is to the inch.
- They are **the city's trees**, not UVM's, and any figure from them is labelled
  that way.

### 2–5. In i-Tree Eco

Written from i-Tree Eco version 6. i-Tree's site cannot be reached from where
this was prepared, so check each step against the screen, and correct this
file where the software has moved on.

- **Install:** i-Tree Eco is a free download from itreetools.org (an account is
  needed). It is **Windows software**; on a Mac it needs Windows running in a
  virtual machine, or a Windows computer on campus.
- **Project:** a new project, *complete inventory*, English units. Location:
  United States → Vermont → Chittenden County → Burlington. Weather and
  pollution year: the latest offered. Choose the data fields to match the file:
  DBH, total height, crown width, condition (crown health/dieback), street tree.
- **Import:** the inventory import wizard; map each column to its i-Tree field.
  Where i-Tree does not recognise a species, pick the closest from its list and
  note it here.
- **Submit:** i-Tree checks the data, then sends it for processing; results come
  back to the program, usually within the hour.
- **Export:** the **individual tree** results — carbon storage, gross carbon
  sequestration, avoided runoff, pollution removal, and their dollar values —
  as an Excel or CSV file, keeping the `ID` column.

### 6. Back here

The results file will be stored as `data/` alongside the trees it describes,
with the i-Tree version, the location and the weather/pollution year recorded
with it, and shown on the map labelled **Powered by i-Tree** — with how many
trees it covers and when they were measured.

## Status

- **7 October 2026** — step 1 done: 364 trees exported.

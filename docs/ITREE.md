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
npm run itree:export          # → itree-export/city-trees-itree.xlsx
```

An **Excel file, not CSV**: i-Tree's importer takes `.xls` or `.xlsx` only, and
a number stored as text is the usual reason records fail, so every cell is
typed — numbers as numbers, dates as dates. Columns are named after i-Tree's
own fields:

| Column | From | Note |
|---|---|---|
| Tree ID | Burlington's site number | i-Tree needs a whole number above zero |
| User Tree ID | `BTV-…` | what the results are joined back on |
| Species, Common Name | taxa | translated, below |
| DBH (in), Total Height (ft) | the city | |
| Crown Width (ft) | the city's spread | one value; i-Tree's import takes one |
| Crown Health | the city's condition | approximate, below |
| Street Tree, Public Tree | `Y` | all are city street trees |
| Land Use | `Institutional` | see [land use](#land-use) |
| Survey Date | date measured | 22 trees have none |
| Latitude, Longitude, Tree Address | the city | |

The file is not committed: it is rebuilt from `data/city-trees.csv` whenever it
is needed.

**Names are translated for i-Tree**, and every translation is printed. All 40
names that come out are on i-Tree's species list
(`i-Tree_Eco_species_list_1.17.2023.csv`, from the Eco resources page):

- Cultivars are modelled as their species — 'Princeton' is an American elm to
  the model; growth does not change with a trade name.
- Genus-only records (*Malus*, *Ulmus*) stay at genus.
- Forms and varieties are written **v.**, as i-Tree's list writes them:
  thornless honeylocust is *Gleditsia triacanthos v. inermis*.
- *Scandosorbus intermedia* is written *Sorbus intermedia*, its older name.
- *Quercus × warei* is not on the list, and is modelled as *Quercus*.

**Know what the numbers will rest on:**

- Measured **2013–2023**, a third in 2014; 22 records carry no date. The model
  sizes each tree as measured, so trees that have grown since are understated.
- Height and crown width come **in five-foot steps**. DBH, the input the model
  is most sensitive to, is to the inch.
- They are **the city's trees**, not UVM's, and any figure from them is labelled
  that way.

### What the data supports, and what it does not

From the Forest Service's own summary of the methods — *Understanding i-Tree:
Summary of Programs and Methods*, GTR-NRS-200
(<https://research.fs.usda.gov/treesearch/61514>), written to i-Tree 6.1 —
Table 2 says which field measurements feed which result. Against this data:

| Result | Needs | Here |
|---|---|---|
| Carbon storage; gross and net carbon sequestration | species, DBH, total height, condition | **all present** |
| Air pollution removal, avoided runoff, transpiration, oxygen | **leaf area**, from crown width *and* height to crown base, percent crown missing, crown light exposure | crown width only |
| Energy effects on buildings | distance and direction to the nearest building | **absent** |

So **carbon is the solid result**, and is the one to lead with. Pollution and
runoff rest on leaf area, and leaf area here rests on crown values i-Tree has
to assume; they are shown as estimates and say so. Energy effects are not
computed. No value is invented for the missing crown fields in the export: a
made-up crown measurement looks like data.

**What i-Tree assumes for a field left out** — from its *Data Limitations*
guide (Eco resources page):

| Field left out | i-Tree uses | Affects |
|---|---|---|
| Land use | Residential | growth (carbon sequestration), structural value |
| Height to crown base, crown width | predicted from DBH by regression | leaf area → pollution, runoff |
| Percent crown missing | 13% | leaf area → pollution, runoff |
| Crown health | 13% dieback | sequestration, leaf area |
| Crown light exposure | class 2–3 | growth (carbon sequestration), forecasts |

Crown width is supplied; height to crown base, percent crown missing and crown
light exposure are not, so those three defaults are what the pollution and
runoff figures — and, through crown light exposure, sequestration — rest on.

### Land use

The export says **Institutional** for every tree, rather than leaving
i-Tree to assume Residential. The Eco field manual (v6) puts *colleges* under
Institutional, and classes a tree on an ordinary street by **the nearest land
use beside the road** — only limited-access highways, railways and airports
count as Transportation. Inside the campus boundary that neighbour is the
university. A tree whose nearer side faces private houses across the street
would strictly be Residential; at campus edges that may be a few trees, and is
not corrected tree by tree here.

### Crown light exposure

Left to i-Tree's default (2–3 of 5 sides lit). It is a field observation —
how many of the crown's four sides and top get direct light — and the city did
not record it. Many street trees are open-grown (4–5), so the default probably
**understates** their growth, and with it carbon sequestration; carbon
*storage* does not use it. Recording it is one tap per tree and a candidate for
the field app.

**Condition is an approximation.** i-Tree's condition classes are bands of
crown dieback; the city's *good / fair / poor* is an overall rating, and may
not have been judged the same way.

### 2–5. In i-Tree Eco

From i-Tree Eco v6's own guides on www.itreetools.org (resources → Eco): the
*Eco Guide to Importing an Existing Inventory*, the *Field Manual* and *Data
Limitations*. Check each step against the screen; correct this file where the
software has moved on.

- **Install:** i-Tree Eco is a free download from itreetools.org. It is
  **Windows software (Windows 10 or later)** and does not run on a Mac or Linux
  except inside Windows — Parallels, Boot Camp on older Macs, or a campus
  Windows machine.
- **Project:** new project, *complete inventory*, English units. Location:
  United States → Vermont → Chittenden County → Burlington. Weather and
  pollution year: the latest offered. Data fields to collect: DBH, total
  height, crown width, crown health, street tree, public tree, land use.
  Leave height to crown base, percent crown missing and crown light exposure
  unticked — their defaults are above.
- **Import:** the import wizard, pointed at the `.xlsx`. Match each column to
  the i-Tree field of the same name. Map *Tree ID* to Tree ID and *User Tree
  ID* to User Tree ID. Then match values: species names should all be found;
  *Fair / Good / Poor* to crown health classes; *Institutional* to land use;
  *Y* to yes.
- **Submit:** i-Tree checks the data, then sends it for processing; results come
  back to the program.
- **Export:** the **individual tree** results — carbon storage, gross carbon
  sequestration, avoided runoff, pollution removal, and their dollar values —
  as an Excel or CSV file, **keeping the User Tree ID column**.

**i-Tree's funding.** The Forest Service has stopped funding i-Tree; the tools
are kept running on one-off grants, with a promise of six months' notice before
a core tool goes offline. Export and keep the results file as soon as it
exists. i-Tree runs open office hours for questions (next: Thursday
8 October 2026, 2 pm ET).

### 6. Back here

The results file will be stored as `data/` alongside the trees it describes,
with the i-Tree version, the location and the weather/pollution year recorded
with it, and shown on the map labelled **Powered by i-Tree** — with how many
trees it covers and when they were measured.

## Status

- **7 October 2026** — step 1 done: 364 trees exported. Re-checked against the
  Forest Service's methods summary: Eco is the right tool, carbon is fully
  supported by this data, pollution and runoff only partly.
- **7 October 2026** — re-checked against i-Tree's own guides: the export is
  now Excel with i-Tree's field names; every species name is on its list; land
  use set to Institutional; crown light exposure left to the default. Next:
  steps 2–5, on a Windows computer.

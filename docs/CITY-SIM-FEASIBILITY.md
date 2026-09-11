# A Burlington city simulator: feasibility

*Assessment written September 2026. Scope: an educational, browser-based
scenario game built on real Burlington, Vermont data, in the spirit of
SimCity 4 / Cities: Skylines.*

---

## The short answer

**A city-building game that teaches Burlington is feasible. A Burlington
simulator is not.** The distinction is the whole document.

What a small team can build, well, in a few months: a map of the real city,
loaded with real parcels, real zoning, real transit, real tree canopy and real
impervious surfaces, where you make a change and a transparent, auditable
indicator model tells you what it costs, who it reaches, and what it trades
away — with every number traceable to a citation and every coefficient
editable.

What a small team cannot build: a system that predicts what Burlington would
actually do in response to a tram on Main Street. Nobody can build that. The
regional travel demand model at CCRPC, run by professionals with a calibration
budget, produces forecasts that are argued over for years. A hobby project that
outputs "ridership: 4,200/day" has invented a number, and in a classroom the
invented number is exactly what a student will remember and repeat.

So the design problem is not *can we simulate a city* — it is **how do we build
something that teaches without lying**. That constraint, taken seriously, turns
out to produce a better educational tool than a more convincing fake would.

---

## Three tiers of ambition

| Tier | What it is | Effort (1–2 people, part-time) | Verdict |
|---|---|---|---|
| **0 — Atlas** | Real Burlington on a map. Parcels, zoning, canopy, transit, impervious, grand list. Click anything, see its facts. Read-only. | 3–5 weeks | Do this first regardless. It's mostly a reskin of what this repo already is. |
| **1 — Scenario sandbox** | Tier 0 plus edits: rezone a block, add a route, plant trees, build a facility. Turn-based. 8–12 indicators, each with visible arithmetic. Scenarios shareable as a URL. | 4–6 months | **The recommended target.** Genuinely useful; genuinely honest. |
| **2 — Feedback simulation** | Growth allocation, agent-based traffic, endogenous land values, population response over 20 years. | 12–18 months, plus somebody who has done travel demand modeling before | Possible, but it's a different project with a different failure mode: it *looks* authoritative. |
| **3 — Cities: Skylines peer** | Real-time 3D, emergent agents, thousands of assets, art pipeline. | Tens of person-years | Not feasible, and not desirable. See below. |

On Tier 3, one thing worth internalizing: **Cities: Skylines and SimCity do not
simulate cities.** Their agents are a few thousand tokens standing in for
hundreds of thousands of people; traffic is a shortest-path heuristic tuned
until it feels right; land value is a radius check. They are extraordinary toys
engineered for the *feel* of plausibility. Competing on that axis means
competing with a decade of engine work in order to arrive at a model you would
then have to disavow in front of a class. Skip it.

---

## What the recommended build looks like

**The loop.** One turn is one year. You have a capital budget, an operating
budget that persists, and a 20-year horizon. You make changes; you press *Run
year*; the indicator panel updates and the ledger charges you. There is no win
condition — there is a **scenario brief** ("cut CSO events in half without
raising the tax rate," "add 1,500 homes without losing canopy") and a scorecard
showing what you achieved and what you gave up.

**The screens.**

- *Map* — MapLibre GL over Burlington. Parcels as fills, buildings extruded
  from the state footprint layer with LiDAR-derived heights. It will look like
  a 2.5D city, because it is one, without anybody modeling a building.
- *Palette* — the interventions: zoning changes, transit service, green
  infrastructure, facilities, street redesign.
- *Indicators* — housing capacity, canopy %, runoff, transit access to jobs,
  GHG, fiscal balance, walkshed coverage. Each one is a **click-through**: tap
  the number, see the formula, the inputs, the source, the uncertainty band.
- *Ledger* — capital spent, annual operating cost, revenue. The unglamorous
  screen that carries most of the learning.
- *Sources* — every dataset, its vintage, its license, its known problems.

**The architecture** — and this is the part where the existing repo is a real
head start, not a metaphorical one:

```
data/*.csv, *.geojson      source of truth, human-editable, in git
  ↓ npm run data           validates every row, fails loudly
public/data/*.json         precomputed, compact, versioned
  ↓ vite build
dist/                      static site. no server, no database, no keys
```

The arboretum explorer already runs this pipeline, already validates data in
CI, already ships a mobile-first Leaflet map, already has an offline field-data
app. The scenario game is the same machine with a bigger data directory and a
simulation worker. That is not a small advantage — most projects of this kind
die of backend maintenance.

Two architectural rules worth writing down now:

1. **The model is data, not code.** Every coefficient lives in a versioned
   `model/*.json` spec with a `source` field. Students can open it. A teacher
   can fork it. "Change the runoff coefficient and see what happens" becomes a
   lesson instead of a code change.
2. **Determinism and seeds.** Same scenario, same result, forever. Scenarios
   encode to a URL; a student pastes the URL into an assignment; the teacher
   opens it and sees exactly what the student saw. This is your entire
   submission and assessment mechanism, with no accounts, no database, and no
   student-data compliance surface. Protect it.

**Burlington is unusually well-suited to this.** About 45,000 people, roughly
ten thousand parcels, ten and a half square miles of land. That fits in a
browser tab with room left over. Most real cities do not. You can hold the
entire municipality in memory at full parcel resolution and still run the
indicator pass in a Web Worker in under a second.

---

## The data actually exists

This is the pleasant surprise. Vermont's open data situation is better than
most states', and Burlington publishes its own on top of it.

| Layer | Source | State |
|---|---|---|
| Parcels + grand list values | [Burlington BTVstat](https://data.burlingtonvt.gov/), [VCGI parcel program](https://geodata.vermont.gov/pages/parcels) | Ready. Strip owner names on ingest — see ethics below. |
| Zoning + overlay districts | [VT Data – Burlington Zoning](https://geodata.vermont.gov/datasets/CCRPC::vt-data-burlington-zoning-overlay-districts) (CCRPC, current to the 2023 ordinance) | Ready, but the envelope rules themselves must be hand-transcribed from the CDO. |
| Building footprints | [VT Building Footprints](https://geodata.vermont.gov/datasets/VCGI::vt-building-footprints/about) | Ready. |
| Elevation, canopy, impervious | [VCGI lidar program](https://vcgi.vermont.gov/data-and-programs/lidar-program) — statewide land cover, impervious surface, forest cover are lidar-derived | Ready, and this is the layer that makes the stormwater module credible. |
| Transit | GMT GTFS via [Transitland](https://www.transit.land/operators/o-dru-greenmountaintransitagency) / [vermont-gtfs.org](https://vermont-gtfs.org/) | Ready. ~16 routes, ~7,300 weekday boardings — small enough to reason about honestly. |
| Streets, sidewalks, paths | OpenStreetMap | Ready. Note ODbL share-alike on derived data. |
| Population, jobs, commutes | Census ACS, LEHD LODES | Ready. |
| Tree collection | **This repository** | Partial, and growing — see below. |
| Energy + emissions | [BED Net Zero Energy Roadmap](https://www.burlingtonelectric.com/nze) and its annual updates | Published; the 2025 update reports ground transport and thermal emissions down 17.8% against the 2018 baseline. |
| Sewer/stormwater network | DPW — not fully open | **The one real gap.** Request it, or model sub-catchments from lidar topography instead. |

The unglamorous truth: **assembling and reconciling these is 40–50% of the
total project effort.** Coordinate systems, vintage mismatches, parcels that
don't line up with footprints, a zoning polygon that disagrees with the
ordinance text. Budget for it explicitly. The good news is that this repo's
team has already done exactly this kind of work once, at smaller scale.

---

## What can be modeled honestly — and what can't

This table is the heart of the assessment. The right response to a low-fidelity
row is not to fake it better; it's to change what the game reports.

| Module | Feasible fidelity | Why | What to report instead |
|---|---|---|---|
| **Zoning capacity** | **High** | Setbacks, height, lot coverage, FAR are deterministic arithmetic on a parcel polygon. Verifiable by hand. | Report *capacity*, and say loudly that capacity is not production. |
| **Fiscal / property tax** | **High** | Grand list values are public; tax math is arithmetic. Value-per-acre by parcel is one join away and is a genuinely eye-opening visual. | Revenue, capital cost, and the operating cost that never goes away. |
| **Canopy + tree benefits** | **Medium-high** | [i-Tree](https://www.itreetools.org/) coefficients (USDA Forest Service) give per-species, per-DBH values for interception, sequestration, pollutant removal. | Interception in gallons; sequestration in tons. Cite i-Tree. |
| **Runoff / green infrastructure** | **Medium** | NRCS TR-55 curve-number on lidar-derived sub-catchments is defensible for *relative* comparison. Full EPA SWMM is out of scope in-browser. | "This scenario reduces modeled runoff volume by X% relative to baseline." Never an absolute CSO event count. |
| **Transit accessibility** | **Medium-high** | Jobs-reachable-in-45-minutes from GTFS + LODES is computable, precomputable, and is what transit planners actually use. | **Access, not ridership.** |
| **Transit ridership** | **Low** | Mode-choice elasticities are the single most abused number in city games. Getting this wrong by 3× is normal even for professionals. | Don't forecast it. Show cost per rider under *assumed* ridership the player sets, with a slider and a comparables table. |
| **Energy / GHG** | **Medium** | Per-building EUI × floor area with BED's own factors. Burlington's electricity supply makes the electrification arithmetic genuinely different here than anywhere else — a real teaching hook. | Directional change vs. the 2018 baseline. |
| **Traffic congestion** | **Low** | Requires a calibrated network assignment model. Induced demand alone will defeat any naive version. | Omit, or model only vehicle-miles-traveled by land use pattern, clearly labeled as elasticity-based. |
| **Jobs / economic development** | **Low** | Every small-team version of this is a multiplier pulled from nowhere. | Omit. |
| **Displacement / equity** | **Low to model, highest in importance** | Displacement depends on tenure, rent regulation, landlord behavior, and household networks. No tractable model exists at this scale. | **Handle qualitatively and prominently:** demographic overlays, a "who lives here now" panel, and a required written justification when a scenario removes existing housing. |
| **Amenities** (library, pool, cultural center, garden) | **Not a demand model at all** | There is no defensible model of "how much happiness a pool produces." | Capital cost, annual operating cost, cost recovery ratio, and the 15-minute walkshed served. This is the honest version and it is *more* educational. |

---

## Your wish list, scored

| Idea | Verdict | What it teaches, done right |
|---|---|---|
| **Light rail on major arteries** | Buildable as an intervention; *not* forecastable as ridership | The best lesson on the list. Let the player build it — then show capital cost per mile (US streetcar projects run in the tens of millions per mile), the permanent operating subsidy, and the farebox recovery, side by side with what the same money buys in bus frequency. A player discovering that 15-minute headways on five existing routes beat a tram has learned real transit planning. |
| **Rain gardens / stormwater** | **Strongest module on the list** | Real CSO history, real green-infrastructure investment, lidar-grade impervious data. Curve-number math is simple enough to show on screen. Pairs directly with the canopy layer. |
| **More downtown density** | **Second strongest** | The Neighborhood Code passed in 2024 — duplexes through fourplexes and cottage courts legalized in RL/RM districts. The game can *reproduce a real policy that actually happened* and check its capacity predictions against what has been permitted since. That's both a validation test and a civics lesson. |
| **State-of-the-art library** | Buildable, as a budget object | Fletcher Free's walkshed, a comparables table for construction and O&M, and the annual line item forever. |
| **Cultural center** | Same | Same treatment; the interesting constraint is siting. |
| **State botanical garden on the waterfront** | Buildable, and the *land constraint* is the lesson | The waterfront is not a blank slate: brownfields, rail, public trust doctrine on filled lands, existing park commitments. A game that makes you discover why that parcel isn't available teaches more than one that lets you paint on it. |
| **Olympic-sized pool** | Buildable, as a budget object | 50m pools are capital-expensive and essentially never operate at cost recovery. The pool is how you teach that the fun stuff has an operating budget that outlives the ribbon-cutting. |

Note what happened in that table: **none of these got cut, and none of them got
faked.** They all become buildable — the model just refuses to invent the
number it can't know, and reports the numbers it can.

---

## Limitations you should take seriously

**1. You cannot validate a counterfactual.** There is no ground truth for
"Burlington with a tram." The only honest validation available is
*back-casting*: run the model on 2010 conditions and check whether it
reproduces what actually happened by 2024 — CityPlace, Cambrian Rise, canopy
change, the Neighborhood Code's permitting response. Build that as a test suite
in CI, the way `npm run data` already validates CSVs. A model with a failing
back-cast test in public is more trustworthy than one with no tests at all.

**2. Games make arguments whether you intend them to or not.** This is the
best-documented critique of the genre. SimCity's rules encode contestable
political claims as if they were physics — low taxes cause growth, density
causes crime, the mayor is an unopposed technocrat. Ian Bogost called this
*procedural rhetoric*: the rules are the argument. The recent literature on
city-builders makes the same point sharply — these games present urban
development as a centralized, depoliticized process and quietly naturalize it.

You will encode arguments too. The mitigations are: make the model spec
readable, make coefficients editable, put an opposition/stakeholder view in the
game rather than pretending consensus, and never give the player unilateral
power without showing what it would actually require. **A public process
mechanic — where a scenario must survive a hearing — is the single feature most
likely to make this pedagogically better than its commercial ancestors.**

**3. Precision is a lie your UI tells.** "Runoff: 4,182,300 gal" reads as
measured. Show bands, round hard, and label every indicator with a
confidence tier (measured / modeled / assumed). If a number is assumed, the UI
should look different.

**4. Students will learn your model, not Burlington.** Unavoidable. Turn it
into the curriculum: the highest-value assignment in this whole project is
*"find something the model gets wrong and document it."* Grade the critique,
not the score.

**5. Dependency rot is a live risk, and you've already been bitten.** This
repo's own deploy notes record CARTO's basemaps being dropped in August 2026
after they started watermarking tiles. A simulator has far more external
surface: GTFS feeds change, ArcGIS endpoints move, the zoning ordinance amends.
Vendor everything into `data/` at a pinned vintage, display the vintage, and
treat refresh as a scheduled chore.

**6. Effort is dominated by unglamorous work.** Roughly: 40–50% data
wrangling, 20% model specification and sourcing, 20% UI, 10% game design, 5%
the part that feels like making a game. If the appeal of the project is the
last 5%, this will be a hard project to finish.

**7. Accessibility and the 45-minute class period.** A scenario that takes two
hours is unusable in a school. Design the core loop for 20 minutes. Keyboard
navigation and colorblind-safe indicators aren't polish here — they're the
difference between a tool a teacher can assign and one they can't.

---

## What else is important to know

**Pick one learner.** These are three different products:

- *Middle/high school civics or earth science* — pre-built scenarios, tight
  loop, heavy scaffolding, a worksheet.
- *Undergraduate planning or geography studio* — open sandbox, editable model,
  the critique assignment.
- *Public engagement at a real city meeting* — completely different stakes; if
  a councilor quotes your number, you own it.

Build for the first two; reach the third only with institutional cover.

**The curriculum artifacts matter more than the features.** A lesson plan, a
worksheet, and a way for a teacher to collect twenty scenario URLs will do more
for adoption than any three features on the roadmap. Vermont's
proficiency-based and flexible-pathways framing gives a locally-built civics
tool an unusually real home.

**There are partners within walking distance.** Champlain College runs a
Princeton Review top-10 game program with a multi-semester collaborative studio
sequence — that's the art and UX capacity a data-and-model team won't have. UVM
has the spatial and environmental side. CCRPC owns the regional travel model
and the future land use maps that Act 181 (2024) just gave regulatory weight
to. Burlington DPW holds the sewer data you can't get otherwise. Any one of
these turns a side project into something durable; all of them come with
timelines and expectations.

**Ethics, concretely.**

- Parcel data ships with owner names and mailing addresses. **Strip them at
  ingest.** A tool that says "upzone 42 Elm St, owned by [name]" is a different
  and worse thing than a planning game.
- Anything that *removes* existing housing should operate at block level, not
  parcel level. Real people live in those polygons.
- Don't use Cities: Skylines or SimCity assets, names, or iconography. Name it
  something of its own.
- OSM derivatives carry ODbL share-alike; VCGI layers carry their own terms.
  Track licenses per layer in `data/`.

**On LLMs.** Do not use one as the simulation engine — it will produce
confident numbers with no provenance, which is precisely the failure mode this
whole document is organized against. There *is* one strong use: generating the
stakeholder reactions and public-comment text for a hearing mechanic, which is
the dimension every commercial city-builder omits. Be aware this breaks the
"no server, no keys" property that makes the static architecture durable, so
it's a genuine fork in the road — consider pre-generating that content at build
time instead.

---

## A path that doesn't collapse

Each milestone is independently useful. That's deliberate: if the project stops
at any point, what exists still has value.

| # | Milestone | Weeks | Ships |
|---|---|---|---|
| 1 | Data spine — parcels, zoning, footprints, canopy, impervious, GTFS, all validated in CI with pinned vintages | 4 | A Burlington atlas |
| 2 | Zoning envelope model — click a parcel, see what the ordinance permits; toggle a district, see capacity change citywide | 3 | A capacity explorer that reproduces the Neighborhood Code |
| 3 | Ledger — capital and operating budget, grand list revenue, value-per-acre | 2 | The fiscal lesson, standalone |
| 4 | Green infrastructure — canopy and runoff, wired to this repo's tree data and i-Tree coefficients | 3 | The stormwater module |
| 5 | Transit access — precomputed isochrones, jobs-reachable, service edits | 4 | The access map |
| 6 | Turn loop, scenario briefs, shareable URLs, sources panel | 4 | **The game** |
| 7 | Back-cast test suite, model spec docs, one classroom lesson plan | 3 | The part that makes it trustworthy |

**Cut first, if time runs short:** 3D, traffic, anything with an animated agent,
sound, and every feature whose purpose is to make the model feel more
authoritative than it is.

---

## The one-paragraph version

Build a turn-based scenario sandbox on real Burlington data, with an
indicator model whose arithmetic is visible and whose coefficients are cited
and editable, reporting access rather than ridership, capacity rather than
growth, and cost rather than happiness. It will not predict Burlington. It will
teach tradeoffs, budgets, and how to read a model skeptically — which is more
than SimCity does and closer to what a citizen actually needs. The tram, the
rain gardens, the density, the library, the garden and the pool all fit inside
it; they just arrive with a price tag instead of a happiness meter. Roughly
four to six months of part-time work for a credible Tier 1, half of it spent on
data rather than on anything that feels like making a game.

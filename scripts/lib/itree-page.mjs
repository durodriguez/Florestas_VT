/**
 * The page a tree panel's "i-Tree estimates" link opens: what the ecosystem
 * services figures are, which trees have them, and what they rest on.
 *
 * The panel itself shows only the figures. Everything a reader needs in order
 * to trust them, or to know how far not to, lives here instead, written once.
 * Generated at build time beside the species pages, sharing their header and
 * stylesheet, from data/itree-run.json and data/itree-city-trees.csv.
 */

import { esc, row, shell } from './species-pages.mjs';

const fmt = (n) => Math.round(n).toLocaleString('en-US');

/**
 * @param {object} run       data/itree-run.json
 * @param {Record<string, string>[]} rows  data/itree-city-trees.csv
 */
export function renderItreePage(run, rows, { base, config }) {
  const sum = (key) => rows.reduce((a, r) => a + Number(r[key]), 0);
  const n = rows.length;

  const body = `<main class="page">
  <h1>i-Tree estimates</h1>
  <p class="label">The ecosystem services shown on tree records</p>

  <p class="desc">
    Some trees on the map show their <strong>ecosystem services</strong>:
    carbon stored, carbon absorbed each year, stormwater runoff avoided, air
    pollution removed and oxygen produced. These are estimates from
    <a href="https://www.itreetools.org/">i-Tree Eco</a>, a free tree-benefits
    model developed by the USDA Forest Service and its partners.
  </p>

  <h2>Which trees</h2>
  <p class="desc">
    For now, the ${fmt(n)} <strong>City of Burlington street trees</strong>
    inside the campus boundary. They are the city's trees, not part of the
    UVM collection. They have estimates because the city measured each one's
    trunk, and i-Tree needs a trunk diameter. UVM's own trees will get
    estimates once theirs are measured.
  </p>

  <h2>How these are estimated</h2>
  <p class="desc">
    By ${esc(run.model)}, based on species, trunk diameter, height and
    condition as last measured, with Burlington's ${esc(run.weatherYear)}
    weather and air quality.
  </p>
  <p class="desc">
    Carbon is the firmest figure. Runoff, pollution and oxygen depend on the
    tree's leaf area, which is estimated rather than measured.
  </p>
  <p class="desc">
    The yearly benefits total counts only the quantified services, leaving out
    energy savings and other ecosystem services such as wildlife habitat and
    aesthetic value. It underestimates total value.
  </p>
  <p class="desc">
    Figures on a tree's record are rounded and given as "about": the
    measurements behind them, a diameter to the inch and a height to five
    feet, support no more precision than that. Most were taken between 2013
    and 2023, so a tree that has grown since is understated.
  </p>

  <h2>All ${fmt(n)} trees together</h2>
  <dl class="facts">
    ${row('Carbon stored', `${fmt(sum('carbon_storage_lb'))} lb`)}
    ${row('Carbon absorbed', `${fmt(sum('carbon_sequestration_lb_yr'))} lb a year`)}
    ${row('Stormwater runoff avoided', `${fmt(sum('avoided_runoff_gal_yr'))} gallons a year`)}
    ${row('Air pollution removed', `${fmt(sum('pollution_removal_oz_yr'))} oz a year`)}
    ${row('Oxygen produced', `${fmt(sum('oxygen_lb_yr'))} lb a year`)}
    ${row('Total yearly benefits', `$${fmt(sum('total_benefits_usd_yr'))} a year`)}
  </dl>

  <h2>The model run</h2>
  <dl class="facts">
    ${row('Model', esc(run.model))}
    ${row('Results', esc(run.resultsDate))}
    ${row('Weather', `${esc(run.weatherYear)}; station ${esc(run.weatherStation)}`)}
    ${row('Air quality', `${esc(run.pollutionYear)}; ${esc(run.pollutionStations)}`)}
    ${row('Prices', esc(run.prices))}
    ${row('Not estimated', esc(run.notEstimated))}
  </dl>

  <p class="foot">Powered by <a href="https://www.itreetools.org/">i-Tree</a>.</p>
</main>`;

  return shell({
    title: `i-Tree estimates — ${config.siteName}`,
    description: `How ${config.siteName} estimates the ecosystem services of trees on campus with i-Tree Eco.`,
    base, body, root: '../',
  });
}

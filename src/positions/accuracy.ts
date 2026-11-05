// Kept out of locate.ts so it can be tested without Leaflet, which needs a browser.

/** "±4 m", or "±40 m — too rough to place trees by" past the point where it misleads. */
export function accuracyLabel(meters: number): string {
  const m = Math.max(1, Math.round(meters));
  return m > 15 ? `±${m} m — too rough to place trees by` : `±${m} m`;
}

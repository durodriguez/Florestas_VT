import L from 'leaflet';

/**
 * Raster basemaps that need no API key or account, so the map keeps working
 * without anyone having to manage a token. Swap in a UVM-hosted or Esri
 * organisational service here if the university prefers its own imagery.
 */

export function basemaps(maxZoom: number): Record<string, L.TileLayer> {
  const esri = 'Tiles &copy; Esri';
  const osm = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  // Every layer here is keyless — no account, no token, nothing to rotate.
  // CARTO's raster basemaps used to be the default but now watermark every
  // tile with "API KEY REQUIRED"; that service is being retired in favour of
  // vector tiles, so it is gone rather than key-gated.
  return {
    Streets: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom,
      maxNativeZoom: 19,
      attribution: osm,
    }),
    // Native to z20 over Burlington, which is twice the ground detail of the
    // z19 this used to stop at: 0.107 m per pixel against 0.213 m. Everything
    // above the native zoom is Leaflet stretching the same pixels, so the cap
    // was throwing away half the resolution the service actually serves.
    // Checked against the tile over the green; z21 is not published.
    Satellite: L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom, maxNativeZoom: 20, attribution: `${esri}, Maxar, Earthstar Geographics` },
    ),
    Topographic: L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      { maxZoom, maxNativeZoom: 19, attribution: esri },
    ),
  };
}

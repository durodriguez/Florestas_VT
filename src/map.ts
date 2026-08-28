import L from 'leaflet';
import 'leaflet.markercluster';
import type { ColorBy, Dataset, Plant, TrailProps } from './types';
import { colorFor } from './palette';

/**
 * Raster basemaps that need no API key or account, so the map keeps working
 * without anyone having to manage a token. Swap in a UVM-hosted or Esri
 * organisational service here if the university prefers its own imagery.
 */
function basemaps(maxZoom: number): Record<string, L.TileLayer> {
  const esriAttr = 'Imagery &copy; Esri, Maxar, Earthstar Geographics';
  return {
    Streets: L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom,
      maxNativeZoom: 20,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    }),
    Satellite: L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom, maxNativeZoom: 19, attribution: esriAttr },
    ),
    Topographic: L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      { maxZoom, maxNativeZoom: 19, attribution: 'Tiles &copy; Esri' },
    ),
    OpenStreetMap: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom,
      maxNativeZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }),
  };
}

export interface PlantMapOptions {
  onSelect: (plant: Plant) => void;
}

export class PlantMap {
  readonly map: L.Map;
  private readonly cluster: L.MarkerClusterGroup;
  private readonly trailLayer: L.GeoJSON;
  private readonly highlight: L.CircleMarker;
  private readonly markers = new Map<string, L.CircleMarker>();
  private locationMarker: L.CircleMarker | null = null;
  private colorBy: ColorBy = 'habit';

  constructor(
    container: HTMLElement,
    private readonly dataset: Dataset,
    plants: Plant[],
    private readonly options: PlantMapOptions,
  ) {
    const cfg = dataset.config.map;
    const layers = basemaps(cfg.maxZoom);

    this.map = L.map(container, {
      center: cfg.center,
      zoom: cfg.zoom,
      minZoom: cfg.minZoom,
      maxZoom: cfg.maxZoom,
      maxBounds: L.latLngBounds(cfg.bounds).pad(0.5),
      zoomControl: false,
      layers: [layers.Streets!],
    });

    L.control.zoom({ position: 'bottomright' }).addTo(this.map);
    L.control.scale({ imperial: true, metric: false, position: 'bottomleft' }).addTo(this.map);

    this.trailLayer = L.geoJSON(dataset.trails, {
      style: (feature) => ({
        color: (feature?.properties as TrailProps | undefined)?.color ?? '#154734',
        weight: 5,
        opacity: 0.85,
        dashArray: '1 10',
        lineCap: 'round',
      }),
      onEachFeature: (feature, layer) => {
        const p = feature.properties as TrailProps;
        layer.bindPopup(
          `<h3 class="popup-title">${escapeHtml(p.name)}</h3>` +
            `<p class="popup-meta">${p.length_mi} mi · about ${p.duration_min} min · ${p.stops.length} stops</p>` +
            `<p>${escapeHtml(p.description)}</p>`,
        );
      },
    });

    // Radius grows with zoom so dense beds stay readable when you zoom in.
    this.cluster = L.markerClusterGroup({
      chunkedLoading: true,
      disableClusteringAtZoom: 19,
      maxClusterRadius: (zoom) => (zoom >= 17 ? 35 : 60),
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction: clusterIcon,
    });

    this.highlight = L.circleMarker([0, 0], {
      radius: 16,
      color: '#ffd100',
      weight: 4,
      opacity: 0,
      fill: false,
      interactive: false,
    });

    L.control
      .layers(layers, { 'Walking trails': this.trailLayer }, { position: 'bottomright', collapsed: true })
      .addTo(this.map);

    this.buildMarkers(plants);
    this.cluster.addTo(this.map);
    this.trailLayer.addTo(this.map);
    this.highlight.addTo(this.map);
  }

  private buildMarkers(plants: Plant[]): void {
    for (const plant of plants) {
      const marker = L.circleMarker([plant.lat, plant.lng], this.markerStyle(plant));
      marker.on('click', () => this.options.onSelect(plant));
      marker.bindTooltip(`${plant.taxon.common} · ${plant.id}`, { direction: 'top', offset: [0, -6] });
      this.markers.set(plant.id, marker);
    }
  }

  private markerStyle(plant: Plant): L.CircleMarkerOptions {
    const color = colorFor(plant, this.colorBy);
    const removed = plant.status !== 'active';
    return {
      radius: radiusFor(plant),
      color: '#ffffff',
      weight: 1.5,
      opacity: removed ? 0.6 : 1,
      fillColor: color,
      fillOpacity: removed ? 0.35 : 0.9,
      pane: 'markerPane',
    };
  }

  /** Swap the visible set. Called on every filter change. */
  show(plants: Plant[]): void {
    this.cluster.clearLayers();
    const layers: L.CircleMarker[] = [];
    for (const plant of plants) {
      const marker = this.markers.get(plant.id);
      if (marker) layers.push(marker);
    }
    this.cluster.addLayers(layers);
  }

  setColorBy(mode: ColorBy, plants: Plant[]): void {
    this.colorBy = mode;
    for (const plant of plants) {
      this.markers.get(plant.id)?.setStyle(this.markerStyle(plant));
    }
  }

  /** Centre on a plant and ring it, opening its cluster if it is collapsed. */
  focus(plant: Plant, zoom = 20): void {
    const marker = this.markers.get(plant.id);
    const latlng = L.latLng(plant.lat, plant.lng);
    this.highlight.setLatLng(latlng).setStyle({ opacity: 1 });
    if (marker && this.cluster.hasLayer(marker)) {
      this.cluster.zoomToShowLayer(marker, () => {
        if (this.map.getZoom() < zoom) this.map.setView(latlng, zoom);
      });
    } else {
      this.map.setView(latlng, zoom);
    }
  }

  clearFocus(): void {
    this.highlight.setStyle({ opacity: 0 });
  }

  fitTo(plants: Plant[]): void {
    if (plants.length === 0) return;
    const bounds = L.latLngBounds(plants.map((p) => [p.lat, p.lng] as [number, number]));
    this.map.fitBounds(bounds, { padding: [48, 48], maxZoom: 19 });
  }

  resetView(): void {
    const cfg = this.dataset.config.map;
    this.map.setView(cfg.center, cfg.zoom);
  }

  showUserLocation(lat: number, lng: number, accuracy: number): void {
    this.locationMarker?.remove();
    this.locationMarker = L.circleMarker([lat, lng], {
      radius: 8,
      color: '#ffffff',
      weight: 3,
      fillColor: '#1d6fe0',
      fillOpacity: 1,
    })
      .bindTooltip(`You are here (±${Math.round(accuracy)} m)`, { direction: 'top' })
      .addTo(this.map);
    this.map.setView([lat, lng], Math.max(this.map.getZoom(), 18));
  }

  toggleTrails(visible: boolean): void {
    if (visible) this.trailLayer.addTo(this.map);
    else this.trailLayer.remove();
  }
}

/** Bigger trunks read as bigger dots, which makes specimen trees findable. */
function radiusFor(plant: Plant): number {
  const dbh = plant.dbhIn ?? 0;
  if (plant.taxon.habit === 'shrub' || plant.taxon.habit === 'vine') return 5;
  if (dbh >= 30) return 10;
  if (dbh >= 18) return 8;
  if (dbh >= 8) return 6.5;
  return 5.5;
}

function clusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const n = cluster.getChildCount();
  const size = n < 10 ? 34 : n < 100 ? 42 : n < 1000 ? 50 : 58;
  const label = n < 1000 ? String(n) : `${Math.round(n / 100) / 10}k`;
  return L.divIcon({
    html: `<span>${label}</span>`,
    className: `plant-cluster plant-cluster--${n < 10 ? 'sm' : n < 100 ? 'md' : 'lg'}`,
    iconSize: L.point(size, size),
  });
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

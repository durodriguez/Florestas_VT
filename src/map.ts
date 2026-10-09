import L from 'leaflet';
import 'leaflet.markercluster';
import type { CampusAreaProps, CityTree, ColorBy, Dataset, Plant, TrailProps } from './types';
import { colorFor } from './palette';

/**
 * Raster basemaps that need no API key or account, so the map keeps working
 * without anyone having to manage a token. Swap in a UVM-hosted or Esri
 * organisational service here if the university prefers its own imagery.
 */

function basemaps(maxZoom: number): Record<string, L.TileLayer> {
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

/** Below this, the five campus names overlap each other and the boundary. */
const CAMPUS_LABEL_MIN_ZOOM = 15;

/**
 * Burlington's flag: blue and white, against UVM's green and gold.
 *
 * The colours are the point, not decoration. These trees belong to the city,
 * and a visitor should be able to tell that at a glance without reading a
 * legend — which is why the Burlington layer mirrors the UVM one exactly in
 * shape and differs only in palette. Same circles, same clustering, same
 * sizing; blue where UVM is green, white where UVM is gold.
 *
 * https://flagcolorcodes.com/burlington
 */
export const BTV_BLUE = '#1d4395';
export const BTV_WHITE = '#ffffff';

export interface PlantMapOptions {
  onSelect: (plant: Plant) => void;
  /** A Burlington street tree was tapped. */
  onSelectCityTree?: (tree: CityTree) => void;
  /** Called when the active basemap stops serving tiles. */
  onBasemapTrouble?: (layerName: string) => void;
  /** The campus areas were switched on or off from the map's own layers control. */
  onCampusAreasChange?: (visible: boolean) => void;
}

export class PlantMap {
  readonly map: L.Map;
  private readonly cluster: L.MarkerClusterGroup;
  /**
   * Its own cluster group, not a second set of markers in the UVM one. Two
   * groups means a city tree and a university tree never merge into one
   * cluster bubble, which would put a number on the map that answers no
   * question anybody has.
   */
  private readonly cityCluster: L.MarkerClusterGroup;
  private cityShown = false;
  private readonly trailLayer: L.GeoJSON;
  private readonly campusLayer: L.GeoJSON;
  private readonly highlight: L.CircleMarker;
  /** The same yellow ring, for a result the mouse is over in the list. */
  private readonly hoverRing: L.CircleMarker;
  private readonly markers = new Map<string, L.CircleMarker>();
  private locationMarker: L.CircleMarker | null = null;
  private colorBy: ColorBy = 'type';
  private tileErrors = 0;
  private reportedTrouble = new Set<string>();

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

    // Only the basemap credit here. The 2014 inventory is credited in the
    // survey app, the one place it is used; nothing on this map comes from it.

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

    this.cityCluster = L.markerClusterGroup({
      chunkedLoading: true,
      disableClusteringAtZoom: 19,
      maxClusterRadius: (zoom) => (zoom >= 17 ? 35 : 60),
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction: cityClusterIcon,
    });

    this.highlight = L.circleMarker([0, 0], {
      radius: 16,
      color: '#ffd100',
      weight: 4,
      opacity: 0,
      fill: false,
      interactive: false,
    });

    // Its own ring rather than the selection's, so pointing at a result
    // never moves the ring off the tree that is actually selected. In a pane
    // above the markers: a tree inside a collapsed cluster is ringed around the
    // cluster's bubble, which would otherwise cover the ring.
    this.map.createPane('hover-ring').style.zIndex = '650';
    this.map.getPane('hover-ring')!.style.pointerEvents = 'none';
    this.hoverRing = L.circleMarker([0, 0], {
      pane: 'hover-ring',
      radius: 16,
      color: '#ffd100',
      weight: 4,
      opacity: 0,
      fill: false,
      interactive: false,
    });

    this.campusLayer = campusAreas(dataset.campusAreas);

    // Overlays are checkboxes in the same control as the basemap radio buttons,
    // so campus areas toggle on and off without disturbing the chosen basemap.
    const provisional = dataset.campusAreas.features.some((f) => f.properties.provisional);
    L.control
      .layers(
        layers,
        {
          [`Campus areas${provisional ? ' (approximate)' : ''}`]: this.campusLayer,
          'Walking trails': this.trailLayer,
        },
        { position: 'bottomright', collapsed: true },
      )
      .addTo(this.map);
    // The panel has its own switch for the campus areas; tell it when this
    // control is used instead, so the two never disagree.
    const campusChanged = (visible: boolean) => (e: L.LayersControlEvent) => {
      if (e.layer === this.campusLayer) this.options.onCampusAreasChange?.(visible);
    };
    this.map.on('overlayadd', campusChanged(true));
    this.map.on('overlayremove', campusChanged(false));

    this.watchTiles(layers);
    this.map.on('zoomend', () => this.updateCampusLabels());
    this.updateCampusLabels();

    this.buildMarkers(plants);
    // Added before the clusters so the polygons sit under the tree markers.
    this.campusLayer.addTo(this.map);
    this.cluster.addTo(this.map);
    this.trailLayer.addTo(this.map);
    this.highlight.addTo(this.map);
    this.hoverRing.addTo(this.map);
  }

  /**
   * Public tile services change their terms without warning — CARTO's raster
   * basemaps began watermarking every tile "API KEY REQUIRED" mid-2026. A dead
   * basemap otherwise just looks like a broken map, so say which layer failed.
   */
  private watchTiles(layers: Record<string, L.TileLayer>): void {
    for (const [name, layer] of Object.entries(layers)) {
      layer.on('tileerror', () => {
        if (!this.map.hasLayer(layer) || this.reportedTrouble.has(name)) return;
        // A stray 404 at the edge of coverage is normal; a broken service is not.
        if (++this.tileErrors < 6) return;
        this.reportedTrouble.add(name);
        this.options.onBasemapTrouble?.(name);
      });
      layer.on('tileload', () => { this.tileErrors = 0; });
    }
    this.map.on('baselayerchange', () => { this.tileErrors = 0; });
  }

  /**
   * Campus names are permanent labels, so zooming out piles them on top of one
   * another — five names inside a boundary a couple of centimetres across. Real
   * maps drop area labels below the zoom where the areas are distinguishable,
   * and so does this: the polygons stay, the names come back on the way in.
   */
  private updateCampusLabels(): void {
    this.map.getContainer().classList.toggle('hide-campus-labels', this.map.getZoom() < CAMPUS_LABEL_MIN_ZOOM);
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

  /**
   * Draw Burlington's street trees, or take them away.
   *
   * Off by default and off until asked for: they are not part of the
   * collection this map is about, and a visitor who has not asked for them
   * should not have to work out which pins are which.
   */
  showCityTrees(trees: CityTree[]): void {
    this.cityCluster.clearLayers();
    const layers = trees.map((tree) => {
      const marker = L.circleMarker([tree.lat, tree.lng], {
        radius: cityRadiusFor(tree),
        // Blue fill, thin white stroke — the same treatment a UVM marker gets,
        // which is a green fill and a thin white stroke.
        color: BTV_WHITE,
        weight: 1.5,
        opacity: 1,
        fillColor: BTV_BLUE,
        fillOpacity: 0.9,
        pane: 'markerPane',
      });
      marker.bindTooltip(`${tree.taxon.common} · ${tree.id} (Burlington)`, {
        direction: 'top',
        offset: [0, -6],
      });
      marker.on('click', () => this.options.onSelectCityTree?.(tree));
      return marker;
    });
    this.cityCluster.addLayers(layers);
    if (!this.cityShown) {
      this.cityCluster.addTo(this.map);
      this.cityShown = true;
    }
  }

  hideCityTrees(): void {
    if (!this.cityShown) return;
    this.map.removeLayer(this.cityCluster);
    this.cityCluster.clearLayers();
    this.cityShown = false;
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

  /**
   * Ring a plant without moving the map, for a result being pointed at in the
   * list; null takes the ring away. A plant inside a collapsed cluster has no
   * dot of its own on screen, so the ring goes round the cluster instead.
   */
  hover(plant: Plant | null): void {
    if (!plant) {
      this.hoverRing.setStyle({ opacity: 0 });
      return;
    }
    const marker = this.markers.get(plant.id);
    // The typings say Marker; circle markers work the same at run time.
    const shown: L.Layer | null = marker && this.cluster.hasLayer(marker)
      ? this.cluster.getVisibleParent(marker as unknown as L.Marker)
      : null;
    const inCluster = shown instanceof L.MarkerCluster;
    this.hoverRing
      .setLatLng(inCluster ? shown.getLatLng() : [plant.lat, plant.lng])
      .setRadius(inCluster ? 25 : 16)
      .setStyle({ opacity: 1 });
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

  toggleCampusAreas(visible: boolean): void {
    if (visible) this.campusLayer.addTo(this.map);
    else this.campusLayer.remove();
  }
}

/**
 * The campus outline and its named sub-campuses, as UVM's own map draws them.
 * Non-interactive throughout: these are background context, and a polygon that
 * swallowed clicks would make the tree underneath it unselectable.
 */
function campusAreas(
  collection: GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, CampusAreaProps>,
): L.GeoJSON {
  return L.geoJSON(collection, {
    interactive: false,
    style: (feature) => {
      const p = feature?.properties as CampusAreaProps | undefined;
      const outline = p?.kind === 'boundary';
      return {
        color: p?.color ?? '#154734',
        weight: outline ? 3 : 2,
        opacity: outline ? 0.9 : 0.7,
        // Provisional geometry is dashed so an estimate never reads as survey.
        dashArray: p?.provisional ? '6 6' : undefined,
        fill: !outline,
        fillColor: p?.color ?? '#154734',
        fillOpacity: 0.08,
      };
    },
    onEachFeature: (feature, layer) => {
      const p = feature.properties as CampusAreaProps;
      // The outer boundary has no sensible centre to label — the sub-campus
      // names sit inside it, and a seventh label there would collide.
      if (p.kind !== 'campus') return;
      layer.bindTooltip(escapeHtml(p.name), {
        permanent: true,
        direction: 'center',
        className: 'campus-label',
        interactive: false,
      });
    },
  });
}

/** Bigger trunks read as bigger dots, which makes specimen trees findable. */
function radiusFor(plant: Plant): number {
  const dbh = plant.dbhIn ?? 0;
  // Shrubs, vines and herbaceous plants have no trunk to scale by, so they get
  // the small dot rather than a diameter-derived one.
  if (plant.taxon.type !== 'deciduous-tree' && plant.taxon.type !== 'evergreen-tree') return 5;
  if (dbh >= 30) return 10;
  if (dbh >= 18) return 8;
  if (dbh >= 8) return 6.5;
  return 5.5;
}

/**
 * The same bubble as a UVM cluster, in Burlington's colours. Identical
 * geometry on purpose: the only thing that should read as different is whose
 * trees they are.
 */
function cityClusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const n = cluster.getChildCount();
  const size = n < 10 ? 34 : n < 100 ? 42 : n < 1000 ? 50 : 58;
  const label = n < 1000 ? String(n) : `${Math.round(n / 100) / 10}k`;
  return L.divIcon({
    html: `<span>${label}</span>`,
    className: `city-cluster city-cluster--${n < 10 ? 'sm' : n < 100 ? 'md' : 'lg'}`,
    iconSize: L.point(size, size),
  });
}

/**
 * Sized by trunk like a UVM tree. Burlington records a diameter for every one
 * of these, so unlike the university's records there is never a fallback.
 */
function cityRadiusFor(tree: CityTree): number {
  const dbh = tree.dbhIn ?? 0;
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

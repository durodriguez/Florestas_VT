import L from 'leaflet';
import 'leaflet.markercluster';
import type { CampusAreaProps, CityTree, ColorBy, Dataset, Plant } from './types';
import { colorFor } from './palette';
import { basemaps } from './basemaps';
import { isPale } from './season';
import { dotScale, type TreeDisplay } from './tree-display';

/** Below this, the five campus names overlap each other and the boundary. */
const CAMPUS_LABEL_MIN_ZOOM = 15;

/**
 * Where the map starts. Phones and desktops now share one zoom (15, a 1000 ft
 * scale bar); config `phoneZoom`, if set, still gives phones their own. The
 * width is the panel's own breakpoint.
 */
function startZoom(cfg: { zoom: number; phoneZoom?: number }): number {
  return window.matchMedia('(max-width: 48rem)').matches ? cfg.phoneZoom ?? cfg.zoom : cfg.zoom;
}

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

/** How much of the map, in pixels, a record covers along its right or bottom edge. */
export interface Covered {
  right: number;
  bottom: number;
}

export interface PlantMapOptions {
  onSelect: (plant: Plant) => void;
  /** A Burlington street tree was tapped. */
  onSelectCityTree?: (tree: CityTree) => void;
  /** Called when the active basemap stops serving tiles. */
  onBasemapTrouble?: (layerName: string) => void;
  /** The campus areas were switched on or off from the map's own layers control. */
  /** A tap on the map itself: not on a tree, a cluster or a control, and not a drag. */
  onMapClick?: () => void;
  /** The whole-campus outline was switched on or off from the map's own layers control. */
  onOutlineChange?: (visible: boolean) => void;
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
  /** Clusters, or every tree as its own dot (see tree-display.ts). */
  private display: TreeDisplay = 'clusters';
  /** Where the trees go when every one is drawn: a plain group, no clustering. */
  private readonly treeLayer = L.layerGroup();
  private readonly cityLayer = L.layerGroup();
  /** The UVM trees the filters currently let through, biggest first. */
  private shown: L.CircleMarker[] = [];
  private cityMarkers: L.CircleMarker[] = [];
  /** Each dot's full size; every-tree mode shrinks it when zoomed out. */
  private readonly baseRadius = new WeakMap<L.CircleMarker, number>();
  /** A walking tour's route and numbered stops, while one is on. */
  private readonly tourLayer = L.layerGroup();
  /** The whole-campus outline: the one boundary the layers control switches. */
  private readonly outlineLayer: L.GeoJSON;
  /**
   * The six campus areas. Never on the map as a group: each area is added or
   * removed on its own, from the panel, so the group is only their container.
   */
  private readonly campusLayer: L.GeoJSON;
  /** Campus names by area_id: shown with the outline, or with their own area. */
  private readonly campusLabels: Map<string, L.Tooltip>;
  /** True while campus areas are changed from code, not the layers control. */
  private quietCampus = false;
  private readonly highlight: L.CircleMarker;
  /** The same yellow ring, for a result the mouse is over in the list. */
  private readonly hoverRing: L.CircleMarker;
  private readonly markers = new Map<string, L.CircleMarker>();
  private locationMarker: L.CircleMarker | null = null;
  private colorBy: ColorBy = 'type';
  /** The month "Color by season" shows, 1–12. */
  private month = new Date().getMonth() + 1;
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
      zoom: startZoom(cfg),
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

    const outline = dataset.campusAreas.features.filter((f) => f.properties.kind === 'boundary');
    this.outlineLayer = campusAreas({ ...dataset.campusAreas, features: outline });
    this.campusLayer = campusAreas({
      ...dataset.campusAreas,
      features: dataset.campusAreas.features.filter((f) => f.properties.kind !== 'boundary'),
    });
    this.campusLabels = campusLabels(dataset.campusAreas);

    // Overlays are checkboxes in the same control as the basemap radio buttons,
    // so the outline toggles on and off without disturbing the chosen basemap.
    // Only the outline: the campus areas are chosen one by one in the panel.
    const provisional = outline.some((f) => f.properties.provisional);
    const overlays: Record<string, L.Layer> = {
      [`Campus outline${provisional ? ' (approximate)' : ''}`]: this.outlineLayer,
    };
    L.control
      .layers(
        layers,
        overlays,
        { position: 'bottomright', collapsed: true },
      )
      .addTo(this.map);
    // The panel has its own switch for the outline; tell it when this control
    // is used instead, so the two never disagree. Leaflet fires these for any
    // add or remove, not only a click in the control, so changes the panel
    // itself makes (and the first add, below) are kept quiet.
    const campusChanged = (visible: boolean) => (e: L.LayersControlEvent) => {
      if (e.layer === this.outlineLayer && !this.quietCampus) this.options.onOutlineChange?.(visible);
    };
    this.map.on('overlayadd', campusChanged(true));
    this.map.on('overlayremove', campusChanged(false));

    // Leaflet passes a tree's click on to the map as well, without saying it
    // started on a tree, so look at what was actually under the finger: a
    // dot, a cluster or a control is not the map.
    this.map.on('click', (e) => {
      const under = e.originalEvent.target as Element | null;
      if (under?.closest('.leaflet-interactive, .leaflet-marker-icon, .leaflet-control')) return;
      this.options.onMapClick?.();
    });

    this.watchTiles(layers);
    this.map.on('zoomend', () => this.updateCampusLabels());
    this.map.on('zoomend', () => { if (this.display === 'every') this.restyleAll(); });
    this.updateCampusLabels();

    this.buildMarkers(plants);
    // Added before the clusters so the polygons sit under the tree markers.
    // The outline alone, by default; the panel adds any campus areas.
    this.quietCampus = true;
    this.outlineLayer.addTo(this.map);
    this.quietCampus = false;
    this.cluster.addTo(this.map);
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
      this.baseRadius.set(marker, radiusFor(plant));
      marker.on('click', () => this.options.onSelect(plant));
      marker.bindTooltip(`${plant.taxon.common} · ${plant.id}`, { direction: 'top', offset: [0, -6] });
      this.markers.set(plant.id, marker);
    }
  }

  private markerStyle(plant: Plant): L.CircleMarkerOptions {
    const color = colorFor(plant, this.colorBy, this.month);
    const removed = plant.status !== 'active';
    const { scale, weight } = dotScale(this.display, this.map.getZoom());
    return {
      radius: radiusFor(plant) * scale,
      // White blossom with a white edge would vanish on the light basemap.
      color: isPale(color) ? '#6b716c' : '#ffffff',
      weight,
      opacity: removed ? 0.6 : 1,
      fillColor: color,
      fillOpacity: removed ? 0.35 : 0.9,
      pane: 'markerPane',
    };
  }

  /**
   * Swap the visible set. Called on every filter change. Biggest first, so
   * when every tree is drawn a small tree sits on top of a big neighbor,
   * never hidden under it.
   */
  show(plants: Plant[]): void {
    const layers: L.CircleMarker[] = [];
    for (const plant of plants) {
      const marker = this.markers.get(plant.id);
      if (marker) layers.push(marker);
    }
    layers.sort((a, b) => (this.baseRadius.get(b) ?? 0) - (this.baseRadius.get(a) ?? 0));
    this.shown = layers;
    fill(this.display === 'clusters' ? this.cluster : this.treeLayer, layers);
  }

  /**
   * Clusters or every tree. The same dots move from one container to the
   * other; nothing is rebuilt, and the selection and colors carry over.
   */
  setDisplay(display: TreeDisplay): void {
    if (display === this.display) return;
    const [from, to] = display === 'every'
      ? [this.cluster, this.treeLayer] : [this.treeLayer, this.cluster];
    const [cityFrom, cityTo] = display === 'every'
      ? [this.cityCluster, this.cityLayer] : [this.cityLayer, this.cityCluster];
    this.map.removeLayer(from);
    from.clearLayers();
    this.display = display;
    this.restyleAll();
    to.addTo(this.map);
    fill(to, this.shown);
    if (this.cityShown) {
      this.map.removeLayer(cityFrom);
      cityFrom.clearLayers();
      cityTo.addTo(this.map);
      fill(cityTo, this.cityMarkers);
    }
  }

  /** Every dot's size and edge, for the current zoom and display. */
  private restyleAll(): void {
    const { scale, weight } = dotScale(this.display, this.map.getZoom());
    for (const marker of [...this.markers.values(), ...this.cityMarkers]) {
      marker.setStyle({ radius: (this.baseRadius.get(marker) ?? 5.5) * scale, weight });
    }
  }

  /**
   * Draw Burlington's street trees, or take them away.
   *
   * Off by default and off until asked for: they are not part of the
   * collection this map is about, and a visitor who has not asked for them
   * should not have to work out which pins are which.
   */
  showCityTrees(trees: CityTree[]): void {
    const container = this.display === 'clusters' ? this.cityCluster : this.cityLayer;
    const { scale, weight } = dotScale(this.display, this.map.getZoom());
    const layers = trees.map((tree) => {
      const marker = L.circleMarker([tree.lat, tree.lng], {
        radius: cityRadiusFor(tree) * scale,
        // Blue fill, thin white stroke — the same treatment a UVM marker gets,
        // which is a green fill and a thin white stroke.
        color: BTV_WHITE,
        weight,
        opacity: 1,
        fillColor: BTV_BLUE,
        fillOpacity: 0.9,
        pane: 'markerPane',
      });
      marker.bindTooltip(`${tree.taxon.common} · ${tree.id} (Burlington)`, {
        direction: 'top',
        offset: [0, -6],
      });
      this.baseRadius.set(marker, cityRadiusFor(tree));
      marker.on('click', () => this.options.onSelectCityTree?.(tree));
      return marker;
    });
    layers.sort((a, b) => (this.baseRadius.get(b) ?? 0) - (this.baseRadius.get(a) ?? 0));
    this.cityMarkers = layers;
    fill(container, layers);
    if (!this.cityShown) {
      container.addTo(this.map);
      this.cityShown = true;
    }
  }

  hideCityTrees(): void {
    if (!this.cityShown) return;
    const container = this.display === 'clusters' ? this.cityCluster : this.cityLayer;
    this.map.removeLayer(container);
    container.clearLayers();
    this.cityMarkers = [];
    this.cityShown = false;
  }

  setColorBy(mode: ColorBy, plants: Plant[], month = this.month): void {
    this.colorBy = mode;
    this.month = month;
    for (const plant of plants) {
      this.markers.get(plant.id)?.setStyle(this.markerStyle(plant));
    }
  }

  /**
   * Draw a tour: a dotted line from stop to stop, in order, and a gold disc
   * with its number on each stop, above the tree dots. A tap on a disc opens
   * that stop's tree. Null takes the tour away.
   */
  showTour(stops: Plant[] | null): void {
    this.tourLayer.clearLayers();
    if (!stops?.length) {
      this.tourLayer.remove();
      return;
    }
    if (!this.map.getPane('tour')) this.map.createPane('tour').style.zIndex = '640';
    L.polyline(stops.map((p) => [p.lat, p.lng] as [number, number]), {
      color: '#154734', weight: 3, opacity: 0.8, dashArray: '2 8', lineCap: 'round', interactive: false,
    }).addTo(this.tourLayer);
    stops.forEach((plant, i) => {
      L.marker([plant.lat, plant.lng], {
        pane: 'tour',
        icon: L.divIcon({ className: 'tour-stop', html: `<span>${i + 1}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] }),
        title: `Stop ${i + 1}: ${plant.taxon.common}`,
      }).on('click', () => this.options.onSelect(plant)).addTo(this.tourLayer);
    });
    this.tourLayer.addTo(this.map);
  }

  /** Centre on a plant and ring it, opening its cluster if it is collapsed. */
  focus(plant: Plant, zoom = 20, covered: Covered = { right: 0, bottom: 0 }): void {
    const marker = this.markers.get(plant.id);
    const latlng = L.latLng(plant.lat, plant.lng);
    this.highlight.setLatLng(latlng).setStyle({ opacity: 1 });
    if (marker && this.cluster.hasLayer(marker)) {
      this.cluster.zoomToShowLayer(marker, () => {
        const z = Math.max(this.map.getZoom(), zoom);
        this.map.setView(this.centerFor(latlng, z, covered), z);
      });
    } else {
      this.map.setView(this.centerFor(latlng, zoom, covered), zoom);
    }
  }

  /**
   * The map centre that puts a tree in the middle of the part of the map
   * still in view: above a phone's record sheet, or left of a desktop's
   * record column. Centred on the whole map, it sat under the sheet.
   */
  private centerFor(latlng: L.LatLng, zoom: number, covered: Covered): L.LatLng {
    if (!covered.right && !covered.bottom) return latlng;
    return this.map.unproject(this.map.project(latlng, zoom).add([covered.right / 2, covered.bottom / 2]), zoom);
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
    this.map.setView(cfg.center, startZoom(cfg));
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


  /**
   * Show exactly these campus areas, by area_id (the outline's included);
   * the rest are hidden.
   */
  showCampusAreas(ids: ReadonlySet<string>): void {
    this.quietCampus = true;
    try {
      this.applyCampusAreas(ids);
    } finally {
      this.quietCampus = false;
    }
  }

  private applyCampusAreas(ids: ReadonlySet<string>): void {
    const place = (layer: L.Layer, want: boolean) => {
      if (want && !this.map.hasLayer(layer)) {
        this.map.addLayer(layer);
        // Back under the tree dots, which share its drawing surface.
        if (layer instanceof L.Path || layer instanceof L.FeatureGroup) layer.bringToBack();
      } else if (!want && this.map.hasLayer(layer)) {
        this.map.removeLayer(layer);
      }
    };
    const idOf = (layer: L.Layer) =>
      ((layer as L.Path & { feature?: GeoJSON.Feature }).feature?.properties as CampusAreaProps).area_id;
    // The outline goes on and off as a group, since that is what the layers
    // control watches; the areas one by one.
    let outlineWanted = false;
    this.outlineLayer.eachLayer((layer) => { outlineWanted ||= ids.has(idOf(layer)); });
    place(this.outlineLayer, outlineWanted);
    this.campusLayer.eachLayer((layer) => place(layer, ids.has(idOf(layer))));
    // One name per campus, whichever of the two asked for it.
    for (const [id, label] of this.campusLabels) place(label, outlineWanted || ids.has(id));
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
  });
}

/**
 * Each campus area's name, at the point Leaflet itself would centre a label
 * on that polygon. Kept apart from the polygons so a name can show with the
 * whole-campus outline as well as with its own area, and only ever once. The
 * outline has no label of its own: the campus names sit inside it.
 */
function campusLabels(
  collection: GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, CampusAreaProps>,
): Map<string, L.Tooltip> {
  const labels = new Map<string, L.Tooltip>();
  for (const f of collection.features) {
    if (f.properties.kind !== 'campus') continue;
    const ring = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0]! : f.geometry.coordinates[0]![0]!;
    const centre = L.PolyUtil.polygonCenter(ring.map(([lng, lat]) => L.latLng(lat!, lng!)), L.CRS.EPSG3857);
    labels.set(
      f.properties.area_id,
      L.tooltip({ permanent: true, direction: 'center', className: 'campus-label', interactive: false })
        .setLatLng(centre)
        .setContent(escapeHtml(f.properties.name)),
    );
  }
  return labels;
}

/** Empty a container and fill it again: clusters take the dots in one batch. */
function fill(container: L.LayerGroup, markers: L.CircleMarker[]): void {
  container.clearLayers();
  if (container instanceof L.MarkerClusterGroup) container.addLayers(markers);
  else for (const marker of markers) container.addLayer(marker);
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

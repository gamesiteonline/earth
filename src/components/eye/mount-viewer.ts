import type { EyeMode, EyeQuality, GeoConfig, IntelFeature, OverlayKind } from "@/lib/eye/types";
import type { AircraftPoint, FirePoint, SatelliteTle } from "@/lib/feeds/types";
import { FEATURED_LOCATIONS } from "@/lib/locations";
import {
  degreesLat,
  degreesLong,
  eciToGeodetic,
  gstime,
  propagate,
  twoline2satrec,
  type SatRec,
} from "satellite.js";

export type EyeCameraState = {
  ready: boolean;
  error?: string;
  lat: number;
  lon: number;
  height: number;
  heading: number;
  pitch: number;
  metersPerPixel: number;
  imageryLevel: number;
  nativeLevel: number;
  beyondNative: boolean;
  mode: EyeMode;
  quality: EyeQuality;
  imagery: string;
  terrain: string;
  buildings: string;
  buildingsOn: boolean;
  google3d: boolean;
  mapillary: boolean;
  panoramaUrl?: string;
  notice?: string;
};

export type EyeHandle = {
  destroy: () => void;
  flyTo: (
    lon: number,
    lat: number,
    height?: number,
    heading?: number,
    pitch?: number,
    duration?: number,
  ) => Promise<void>;
  setMode: (mode: EyeMode) => Promise<void>;
  setQuality: (quality: EyeQuality) => void;
  setLayer: (kind: OverlayKind, on: boolean) => void;
  groundLook: () => Promise<void>;
  demonstrate: () => Promise<DemoReport>;
  getState: () => EyeCameraState;
};

export type DemoReport = {
  samples: Array<{ label: string; height: number; lat: number; lon: number; beyondNative: boolean }>;
  imagery: string;
  terrain: string;
  buildings: string;
};

type Hooks = {
  onState: (state: EyeCameraState) => void;
  onSelect: (feature: IntelFeature | null) => void;
};

const ESRI = {
  imagery: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
  streets: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer",
  topo: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer",
  roads: "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer",
  labels: "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer",
  terrain: "https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer",
  buildings: "https://basemaps3d.arcgis.com/arcgis/rest/services/OpenStreetMap3D_Buildings_v1/SceneServer",
};

const KIND_COLOR: Record<OverlayKind, string> = {
  camera: "#8eb4c9",
  device: "#c5cde0",
  vehicle: "#7eb8a4",
  drone: "#d5dce8",
  incident: "#d9895f",
  geofence: "#8eb4c9",
  history: "#8b91a3",
  fire: "#d9895f",
  aircraft: "#7eb8a4",
  satellite: "#f4f6fa",
  place: "#e8eaef",
};

const keys = new Set<string>();

export async function mountEye(container: HTMLElement, hooks: Hooks): Promise<EyeHandle> {
  (window as unknown as { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL = "/cesium/";
  const Cesium = await import("cesium");
  await import("cesium/Build/Cesium/Widgets/widgets.css");

  const mobile = window.matchMedia("(pointer: coarse), (max-width: 820px)").matches;
  const state: EyeCameraState = {
    ready: false,
    lat: 0,
    lon: 20,
    height: 18_000_000,
    heading: 0,
    pitch: -80,
    metersPerPixel: 0,
    imageryLevel: 0,
    nativeLevel: 19,
    beyondNative: false,
    mode: "satellite",
    quality: "auto",
    imagery: "loading",
    terrain: "ellipsoid (fallback)",
    buildings: "not loaded",
    buildingsOn: false,
    google3d: false,
    mapillary: false,
  };

  let viewer: InstanceType<typeof Cesium.Viewer>;
  try {
    viewer = new Cesium.Viewer(container, {
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: true,
      baseLayer: false,
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      requestRenderMode: true,
      maximumRenderTimeChange: Infinity,
      skyAtmosphere: new Cesium.SkyAtmosphere(),
      contextOptions: {
        webgl: { antialias: !mobile, powerPreference: mobile ? "low-power" : "high-performance" },
      },
    });
  } catch (err) {
    state.error = err instanceof Error ? err.message : "Cesium failed to start";
    hooks.onState({ ...state });
    throw err;
  }

  const scene = viewer.scene;
  scene.globe.enableLighting = true;
  scene.globe.showGroundAtmosphere = true;
  scene.fog.enabled = true;
  scene.fog.density = 0.00015;
  scene.globe.depthTestAgainstTerrain = true;
  scene.globe.baseColor = Cesium.Color.fromCssColorString("#071018");
  scene.screenSpaceCameraController.enableCollisionDetection = true;
  scene.screenSpaceCameraController.minimumZoomDistance = 2;
  scene.screenSpaceCameraController.maximumZoomDistance = 40_000_000;
  scene.screenSpaceCameraController.enableTilt = true;
  scene.screenSpaceCameraController.enableLook = true;

  const sources = new Map<OverlayKind, InstanceType<typeof Cesium.CustomDataSource>>();
  const ensureSource = (kind: OverlayKind) => {
    let src = sources.get(kind);
    if (!src) {
      src = new Cesium.CustomDataSource(kind);
      if (kind === "fire" || kind === "aircraft") {
        src.clustering.enabled = true;
        src.clustering.pixelRange = kind === "fire" ? 36 : 42;
        src.clustering.minimumClusterSize = 3;
      }
      viewer.dataSources.add(src);
      sources.set(kind, src);
    }
    return src;
  };

  const features = new Map<string, IntelFeature>();
  let baseLevel = 19;
  let googleTiles = false;
  let buildingPrimitive: { show: boolean } | null = null;
  let config: GeoConfig | null = null;
  let satRecs: Array<{ tle: SatelliteTle; rec: SatRec }> = [];
  let removed = false;

  const publish = () => hooks.onState({ ...state });

  const readCamera = () => {
    const carto = scene.camera.positionCartographic;
    const lat = Cesium.Math.toDegrees(carto.latitude);
    const lon = Cesium.Math.toDegrees(carto.longitude);
    const height = carto.height;
    const frustum = scene.camera.frustum as { fovy?: number };
    const fovy = frustum.fovy ?? Cesium.Math.toRadians(60);
    const mpp = (2 * Math.max(height, 1) * Math.tan(fovy / 2)) / Math.max(container.clientHeight, 1);
    const cos = Math.cos((lat * Math.PI) / 180);
    const level = Math.log2((156543.03392 * Math.max(cos, 0.02)) / Math.max(mpp, 0.01));
    const nativeGsd = (156543.03392 * Math.max(cos, 0.02)) / 2 ** baseLevel;
    state.lat = lat;
    state.lon = lon;
    state.height = height;
    state.heading = Cesium.Math.toDegrees(scene.camera.heading);
    state.pitch = Cesium.Math.toDegrees(scene.camera.pitch);
    state.metersPerPixel = mpp;
    state.imageryLevel = Math.max(0, Math.min(baseLevel, level));
    state.nativeLevel = baseLevel;
    state.beyondNative = !googleTiles && mpp < nativeGsd * 0.85 && height < 800;
    state.notice = state.beyondNative
      ? `Native imagery stops at level ${baseLevel}. Closer than this is the same tile, not new detail. Buildings and terrain stay metric.`
      : googleTiles
        ? "Google Photorealistic 3D Tiles are active where that mesh has coverage."
        : undefined;
  };

  const flyTo: EyeHandle["flyTo"] = (lon, lat, height = 1600, heading = 25, pitch = -35, duration = 2.2) =>
    new Promise((resolve) => {
      scene.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
        orientation: {
          heading: Cesium.Math.toRadians(heading),
          pitch: Cesium.Math.toRadians(pitch),
          roll: 0,
        },
        duration,
        complete: () => {
          readCamera();
          publish();
          resolve();
        },
        cancel: () => resolve(),
      });
    });

  const addFeature = (feature: IntelFeature) => {
    features.set(feature.id, feature);
    const src = ensureSource(feature.kind);
    const color = Cesium.Color.fromCssColorString(KIND_COLOR[feature.kind]);
    const clamp = feature.kind === "satellite" || feature.kind === "drone" ? undefined : Cesium.HeightReference.CLAMP_TO_GROUND;
    const relative = feature.kind === "drone" ? Cesium.HeightReference.RELATIVE_TO_GROUND : clamp;
    if (feature.kind === "geofence" && feature.ring) {
      src.entities.add({
        id: feature.id,
        name: feature.name,
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(feature.ring.flat())),
          material: color.withAlpha(0.16),
          outline: true,
          outlineColor: color,
          classificationType: Cesium.ClassificationType.TERRAIN,
        },
      });
      return;
    }
    src.entities.add({
      id: feature.id,
      name: feature.name,
      position: Cesium.Cartesian3.fromDegrees(feature.lon, feature.lat, feature.alt ?? 0),
      point: {
        pixelSize: feature.kind === "satellite" ? 7 : 9,
        color,
        outlineColor: Cesium.Color.fromCssColorString("#05060a"),
        outlineWidth: 1,
        heightReference: relative,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label:
        feature.kind === "fire" || feature.kind === "aircraft"
          ? undefined
          : {
              text: feature.name,
              font: "500 12px Outfit, sans-serif",
              fillColor: Cesium.Color.fromCssColorString("#e8eaef"),
              showBackground: true,
              backgroundColor: Cesium.Color.fromCssColorString("#101218").withAlpha(0.86),
              pixelOffset: new Cesium.Cartesian2(0, -16),
              heightReference: relative,
              distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, feature.kind === "place" ? 250000 : 12000),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
      polyline: feature.track
        ? {
            positions: Cesium.Cartesian3.fromDegreesArrayHeights(
              feature.track.flatMap((p) => [p.lon, p.lat, p.alt]),
            ),
            width: 2,
            material: color,
          }
        : feature.kind === "camera" && feature.heading !== undefined
          ? {
              positions: Cesium.Cartesian3.fromDegreesArray(wedge(feature.lon, feature.lat, feature.heading).flat()),
              width: 1,
              material: color.withAlpha(0.8),
              clampToGround: true,
            }
          : undefined,
    });
  };

  viewer.selectedEntityChanged.addEventListener((entity: { id?: string } | undefined) => {
    if (!entity?.id) {
      hooks.onSelect(null);
      return;
    }
    hooks.onSelect(features.get(String(entity.id)) ?? null);
  });

  const applyQuality = (quality: EyeQuality) => {
    state.quality = quality;
    const saver = quality === "saver" || (quality === "auto" && mobile);
    const high = quality === "high";
    viewer.resolutionScale = saver ? 0.85 : Math.min(window.devicePixelRatio || 1, high ? 1.6 : 1.25);
    scene.globe.maximumScreenSpaceError = saver ? 4 : high ? 1.4 : 2;
    scene.globe.tileCacheSize = saver ? 80 : 240;
    scene.postProcessStages.fxaa.enabled = !saver;
    scene.requestRender();
    publish();
  };

  const setMode: EyeHandle["setMode"] = async (mode) => {
    state.mode = mode;
    viewer.imageryLayers.removeAll();
    const add = async (url: string) => {
      const provider = await Cesium.ArcGisMapServerImageryProvider.fromUrl(url);
      viewer.imageryLayers.addImageryProvider(provider);
      return provider;
    };
    try {
      if (mode === "satellite" || mode === "hybrid") {
        const imagery = await add(ESRI.imagery);
        baseLevel = imagery.maximumLevel || 19;
        state.imagery = "Esri World Imagery";
        if (mode === "hybrid") {
          await add(ESRI.roads);
          await add(ESRI.labels);
          state.imagery = "Esri World Imagery + place and road labels";
        }
      } else if (mode === "terrain") {
        const topo = await add(ESRI.topo);
        baseLevel = topo.maximumLevel || 19;
        state.imagery = "Esri World Topographic";
      } else {
        const streets = await add(ESRI.streets);
        baseLevel = streets.maximumLevel || 19;
        state.imagery = "Esri World Street Map";
      }
    } catch (err) {
      state.imagery = "imagery failed";
      state.notice = err instanceof Error ? err.message : "Imagery provider failed";
    }
    scene.requestRender();
    publish();
  };

  scene.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(20, 2, 18_000_000),
    orientation: {
      heading: 0,
      pitch: Cesium.Math.toRadians(-82),
      roll: 0,
    },
  });

  applyQuality("auto");
  const boot = (async () => {
    config = await fetch("/api/geo-config")
      .then((r) => r.json() as Promise<GeoConfig>)
      .catch(() => null);
    state.mapillary = Boolean(config?.mapillary);
    if (config?.ion && config.ionToken) {
      Cesium.Ion.defaultAccessToken = config.ionToken;
    }
    try {
      const terrain = await Cesium.ArcGISTiledElevationTerrainProvider.fromUrl(ESRI.terrain);
      viewer.terrainProvider = terrain;
      state.terrain = "Esri World Elevation 3D";
    } catch {
      state.terrain = "Ellipsoid fallback — elevation service unavailable";
    }
    if (config?.ion && config.ionToken) {
      try {
        viewer.terrainProvider = await Cesium.createWorldTerrainAsync({ requestVertexNormals: true });
        state.terrain = "Cesium World Terrain";
      } catch {
        /* Esri elevation remains */
      }
    }
    await setMode("satellite");
    await loadBuildings();
    await loadOverlays();
    state.ready = true;
    readCamera();
    publish();
  })();

  async function loadBuildings() {
    if (config?.google3d && config.googleKey) {
      try {
        const tileset = await Cesium.Cesium3DTileset.fromUrl(
          `https://tile.googleapis.com/v1/3dtiles/root.json?key=${encodeURIComponent(config.googleKey)}`,
          { maximumScreenSpaceError: mobile ? 16 : 8 },
        );
        scene.primitives.add(tileset);
        googleTiles = true;
        state.google3d = true;
        state.buildings = "Google Photorealistic 3D Tiles";
        state.buildingsOn = true;
        buildingPrimitive = tileset;
        return;
      } catch {
        state.buildings = "Google 3D Tiles failed — using OSM buildings";
      }
    }
    if (config?.ion && config.ionToken) {
      try {
        const tileset = await Cesium.createOsmBuildingsAsync();
        scene.primitives.add(tileset);
        buildingPrimitive = tileset;
        state.buildings = "Cesium OSM Buildings";
        state.buildingsOn = true;
        return;
      } catch {
        /* fall through */
      }
    }
    try {
      const i3s = await Cesium.I3SDataProvider.fromUrl(ESRI.buildings, {
        name: "OSM 3D Buildings",
        cesium3dTilesetOptions: { maximumScreenSpaceError: mobile ? 18 : 10 },
      });
      scene.primitives.add(i3s);
      buildingPrimitive = i3s;
      state.buildings = "OSM 3D Buildings (I3S)";
      state.buildingsOn = true;
    } catch {
      state.buildings = "3D buildings unavailable";
      state.buildingsOn = false;
    }
  }

  async function loadOverlays() {
    for (const place of FEATURED_LOCATIONS) {
      addFeature({
        id: `place-${place.id}`,
        kind: "place",
        name: place.name,
        lat: place.lat,
        lon: place.lon,
        region: place.region,
        detail: place.blurb,
      });
    }
    try {
      const intel = (await fetch("/api/intelligence").then((r) => r.json())) as { features: IntelFeature[] };
      for (const feature of intel.features ?? []) addFeature(feature);
    } catch {
      /* registry optional */
    }
    try {
      const fires = (await fetch("/api/firms").then((r) => r.json())) as { points?: FirePoint[] };
      const points = stride(fires.points ?? [], mobile ? 500 : 900);
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        if (!p) continue;
        addFeature({
          id: `fire-${i}`,
          kind: "fire",
          name: "Thermal anomaly",
          lat: p.lat,
          lon: p.lon,
          region: "FIRMS",
          detail: `VIIRS hotspot · FRP ${p.frp.toFixed(1)} MW${p.date ? ` · ${p.date}` : ""}`,
        });
      }
    } catch {
      /* live feed optional */
    }
    try {
      const air = (await fetch("/api/aircraft").then((r) => r.json())) as { points?: AircraftPoint[] };
      const points = stride(air.points ?? [], mobile ? 400 : 800);
      for (const p of points) {
        addFeature({
          id: `ac-${p.icao}`,
          kind: "aircraft",
          name: p.callsign || p.icao,
          lat: p.lat,
          lon: p.lon,
          alt: (p.alt || 0) > 50 ? p.alt : undefined,
          heading: p.heading,
          region: p.country || "ADS-B",
          detail: [p.country, p.alt ? `${Math.round(p.alt)} m` : "", p.velocity ? `${Math.round(p.velocity)} m/s` : ""]
            .filter(Boolean)
            .join(" · "),
        });
      }
    } catch {
      /* optional */
    }
    try {
      const sats = (await fetch("/api/satellites").then((r) => r.json())) as { tles?: SatelliteTle[] };
      satRecs = [];
      for (const tle of sats.tles ?? []) {
        try {
          satRecs.push({ tle, rec: twoline2satrec(tle.line1, tle.line2) });
          addFeature({
            id: `sat-${tle.id}`,
            kind: "satellite",
            name: tle.name,
            lat: 0,
            lon: 0,
            alt: 400000,
            region: "Orbit",
            detail: `${tle.kind} · NORAD ${tle.id}`,
          });
        } catch {
          /* bad tle */
        }
      }
    } catch {
      /* optional */
    }
    scene.requestRender();
  }

  const onTick = () => {
    if (removed) return;
    const dt = Math.min(viewer.clock.deltaTime || 0.016, 0.1);
    moveCamera(dt);
    updateSatellites();
    const height = scene.camera.positionCartographic.height;
    if (buildingPrimitive) {
      const show = height < 80_000;
      buildingPrimitive.show = show;
      state.buildingsOn = show;
    }
    readCamera();
    if (viewer.clock.tickDate) {
      /* clock is advancing */
    }
    scene.requestRender();
  };
  let lastPublish = 0;
  const onTickPublish = () => {
    onTick();
    const now = performance.now();
    if (now - lastPublish > 160) {
      lastPublish = now;
      publish();
    }
  };
  viewer.clock.onTick.addEventListener(onTickPublish);

  function moveCamera(dt: number) {
    if (typing()) return;
    const cam = scene.camera;
    const height = Math.max(cam.positionCartographic.height, 2);
    const fast = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 3.2 : 1;
    const step = Math.max(4, height * 0.35) * dt * fast;
    const turn = 0.6 * dt * fast;
    if (keys.has("KeyW") || keys.has("ArrowUp")) cam.moveForward(step);
    if (keys.has("KeyS") || keys.has("ArrowDown")) cam.moveBackward(step);
    if (keys.has("KeyA")) cam.moveLeft(step);
    if (keys.has("KeyD")) cam.moveRight(step);
    if (keys.has("KeyQ")) cam.lookLeft(turn);
    if (keys.has("KeyE")) cam.lookRight(turn);
    if (keys.has("KeyR")) cam.lookUp(turn);
    if (keys.has("KeyF")) cam.lookDown(turn);
    if (keys.has("KeyZ")) cam.moveUp(step * 0.45);
    if (keys.has("KeyX")) cam.moveDown(step * 0.45);
  }

  function updateSatellites() {
    if (!satRecs.length) return;
    const src = sources.get("satellite");
    if (!src?.show) return;
    const now = new Date();
    const gmst = gstime(now);
    for (const sat of satRecs) {
      const pv = propagate(sat.rec, now);
      const position = pv?.position;
      if (!position || typeof position === "boolean") continue;
      const gd = eciToGeodetic(position, gmst);
      const lat = degreesLat(gd.latitude);
      const lon = degreesLong(gd.longitude);
      const entity = src.entities.getById(`sat-${sat.tle.id}`);
      if (!entity) continue;
      entity.position = new Cesium.ConstantPositionProperty(
        Cesium.Cartesian3.fromDegrees(lon, lat, gd.height * 1000),
      );
      const feature = features.get(`sat-${sat.tle.id}`);
      if (feature) {
        feature.lat = lat;
        feature.lon = lon;
        feature.alt = gd.height * 1000;
        feature.detail = `${sat.tle.kind} · NORAD ${sat.tle.id} · ${Math.round(gd.height)} km`;
      }
    }
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (typing()) return;
    keys.add(event.code);
    if (["Space", "ArrowUp", "ArrowDown"].includes(event.code)) event.preventDefault();
  };
  const onKeyUp = (event: KeyboardEvent) => keys.delete(event.code);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  const handle: EyeHandle = {
    destroy: () => {
      removed = true;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      viewer.clock.onTick.removeEventListener(onTickPublish);
      viewer.destroy();
    },
    flyTo,
    setMode,
    setQuality: applyQuality,
    setLayer: (kind, on) => {
      const src = sources.get(kind);
      if (src) src.show = on;
      if (kind === "place" || kind === "camera") {
        /* buildings are not a registry kind */
      }
      scene.requestRender();
    },
    groundLook: async () => {
      const carto = Cesium.Cartographic.clone(scene.camera.positionCartographic);
      try {
        const [sampled] = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, [carto]);
        carto.height = (sampled?.height ?? carto.height) + 1.7;
      } catch {
        carto.height = 2;
      }
      await flyTo(
        Cesium.Math.toDegrees(carto.longitude),
        Cesium.Math.toDegrees(carto.latitude),
        Math.max(carto.height, 2),
        Cesium.Math.toDegrees(scene.camera.heading),
        -12,
        1.3,
      );
      if (config?.mapillary && config.mapillaryToken) {
        const pad = 0.004;
        const bbox = `${state.lon - pad},${state.lat - pad},${state.lon + pad},${state.lat + pad}`;
        const url = `https://graph.mapillary.com/images?access_token=${encodeURIComponent(config.mapillaryToken)}&fields=id,thumb_1024_url,compass_angle&bbox=${bbox}&limit=1`;
        try {
          const json = (await fetch(url).then((r) => r.json())) as { data?: Array<{ thumb_1024_url?: string }> };
          state.panoramaUrl = json.data?.[0]?.thumb_1024_url;
          if (!state.panoramaUrl) state.notice = "No Mapillary panorama in this block.";
        } catch {
          state.notice = "Mapillary request failed.";
        }
        publish();
      } else {
        state.notice =
          "Ground camera is 1.7 m over the elevation model. Photographic panoramas need a Mapillary or Google Street View license.";
        publish();
      }
    },
    demonstrate: async () => {
      const samples: DemoReport["samples"] = [];
      const mark = async (label: string) => {
        readCamera();
        samples.push({
          label,
          height: state.height,
          lat: state.lat,
          lon: state.lon,
          beyondNative: state.beyondNative,
        });
      };
      await flyTo(20, 2, 18_000_000, 0, -82, 0.4);
      await mark("global");
      await flyTo(-73.9855, 40.758, 14_000, 20, -38, 2.4);
      await mark("city");
      await flyTo(-73.9855, 40.758, 650, 28, -42, 2.2);
      await mark("district");
      await flyTo(-73.9851, 40.7586, 90, 15, -28, 2);
      await mark("street");
      return {
        samples,
        imagery: state.imagery,
        terrain: state.terrain,
        buildings: state.buildings,
      };
    },
    getState: () => ({ ...state }),
  };

  void boot;
  (window as unknown as { __falizEye?: EyeHandle }).__falizEye = handle;
  return handle;
}

function typing() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement).isContentEditable;
}

function stride<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const out: T[] = [];
  const step = arr.length / max;
  for (let i = 0; i < max; i++) {
    const item = arr[Math.floor(i * step)];
    if (item) out.push(item);
  }
  return out;
}

function wedge(lon: number, lat: number, heading: number): Array<[number, number]> {
  const dest = (bearing: number, dist: number): [number, number] => {
    const R = 6378137;
    const br = (bearing * Math.PI) / 180;
    const lat1 = (lat * Math.PI) / 180;
    const lon1 = (lon * Math.PI) / 180;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(dist / R) + Math.cos(lat1) * Math.sin(dist / R) * Math.cos(br),
    );
    const lon2 =
      lon1 +
      Math.atan2(
        Math.sin(br) * Math.sin(dist / R) * Math.cos(lat1),
        Math.cos(dist / R) - Math.sin(lat1) * Math.sin(lat2),
      );
    return [(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI];
  };
  return [dest(heading - 28, 90), dest(heading, 140), dest(heading + 28, 90)];
}

import type { GeoCollection } from "./geoTypes";
import { MAP_FIT_PADDING_CLOSED, MAP_FIT_PADDING_OPEN } from "./mapLayout.js";
import { getProvinceCameraTarget, type ProvinceCameraBounds } from "./provinceCamera.ts";

const geoCache = new Map<string, Promise<GeoCollection>>();

/** Lazy-load a GeoJSON file from public/geo/ */
export function loadGeoJson(path: string): Promise<GeoCollection> {
  const fullPath = `/geo/${path}`;
  if (geoCache.has(fullPath)) return geoCache.get(fullPath)!;

  const promise = fetch(fullPath).then((r) => {
    if (!r.ok) throw new Error(`Failed to load ${fullPath}: ${r.status}`);
    return r.json();
  });
  geoCache.set(fullPath, promise);
  return promise;
}

/** Convert a GeoJSON Polygon coordinates to AMap path arrays */
export function polygonCoordsToPaths(
  coords: number[][][],
) {
  return coords.map((ring) =>
    ring.map(([lng, lat]) => [lng, lat] as [number, number]),
  );
}

/** Convert a GeoJSON MultiPolygon coordinates to AMap path arrays */
export function multiPolygonCoordsToPaths(
  coords: number[][][][],
) {
  return coords.map((polygon) =>
    polygon.map((ring) =>
      ring.map(([lng, lat]) => [lng, lat] as [number, number]),
    ),
  );
}

function geometryPoints(geometry: {
  type: string;
  coordinates: number[][][] | number[][][][];
}) {
  const rings =
    geometry.type === "Polygon"
      ? (geometry.coordinates as number[][][])
      : (geometry.coordinates as number[][][][]).flat();

  return rings.flat();
}

export function geometryBounds(geometry: {
  type: string;
  coordinates: number[][][] | number[][][][];
}) {
  const points = geometryPoints(geometry);
  const lngs = points.map(([lng]) => lng);
  const lats = points.map(([, lat]) => lat);

  return {
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
  };
}

/** Calculate a stable center from a feature geometry */
export function featureCenter(geometry: {
  type: string;
  coordinates: number[][][] | number[][][][];
}): [number, number] {
  const bounds = geometryBounds(geometry);
  return [
    (bounds.minLng + bounds.maxLng) / 2,
    (bounds.minLat + bounds.maxLat) / 2,
  ];
}

export function getDrawerFitPadding(input: { drawerOpen: boolean }) {
  return input.drawerOpen ? MAP_FIT_PADDING_OPEN : MAP_FIT_PADDING_CLOSED;
}

function flattenGeometry(geometry: {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
}): [number, number][][] {
  if (geometry.type === "Polygon") {
    return geometry.coordinates as [number, number][][];
  }

  return (geometry.coordinates as [number, number][][][]).flat();
}

export function focusFeatureOnMap(
  map: any,
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  },
  padding: [number, number, number, number] = MAP_FIT_PADDING_OPEN,
) {
  const AMap = window.AMap;
  const focusPolygon = new AMap.Polygon({
    path: flattenGeometry(geometry),
    strokeOpacity: 0,
    fillOpacity: 0,
  });
  map.setFitView([focusPolygon], false, padding);
  focusPolygon.setMap(null);
}

export interface FocusProvinceInput {
  provinceId: string;
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
  visualCenter: [number, number];
  bounds: ProvinceCameraBounds;
}

export function focusProvinceOnMap(
  map: any,
  input: FocusProvinceInput,
) {
  const size = map.getSize?.() ?? { width: 1280, height: 720 };
  const target = getProvinceCameraTarget({
    provinceId: input.provinceId,
    bounds: input.bounds,
    visualCenter: input.visualCenter,
    viewport: {
      width: typeof size.width === "number" ? size.width : 1280,
      height: typeof size.height === "number" ? size.height : 720,
    },
  });

  map.setZoomAndCenter(target.zoom, target.center, false);
}

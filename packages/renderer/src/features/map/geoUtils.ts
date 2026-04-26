import type { GeoCollection } from "./geoTypes";

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
): { lng: number; lat: number }[][] {
  return coords.map((ring) =>
    ring.map(([lng, lat]) => ({ lng, lat })),
  );
}

/** Convert a GeoJSON MultiPolygon coordinates to AMap path arrays */
export function multiPolygonCoordsToPaths(
  coords: number[][][][],
): { lng: number; lat: number }[][][] {
  return coords.map((polygon) =>
    polygon.map((ring) =>
      ring.map(([lng, lat]) => ({ lng, lat })),
    ),
  );
}

/** Calculate the centroid of a feature from its geometry */
export function featureCenter(geometry: {
  type: string;
  coordinates: number[][][] | number[][][][];
}): [number, number] {
  const coords =
    geometry.type === "Polygon"
      ? (geometry.coordinates as number[][][])[0]
      : (geometry.coordinates as number[][][][])[0][0];

  const sample = coords.slice(0, 20);
  const lng = sample.reduce((s, c) => s + c[0], 0) / sample.length;
  const lat = sample.reduce((s, c) => s + c[1], 0) / sample.length;
  return [lng, lat];
}

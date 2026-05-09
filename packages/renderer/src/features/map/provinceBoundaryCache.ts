import type { GeoFeature } from "./geoTypes";

export const BOUNDARY_CACHE_VERSION = 1;
const BOUNDARY_CACHE_KEY = "travel-map:province-boundaries:v1";

export interface BoundaryCachePayload {
  version: number;
  writtenAt: number;
  source: "cache" | "amap";
  features: GeoFeature[];
}

export function createBoundaryCachePayload(
  features: GeoFeature[],
  source: "cache" | "amap" = "amap",
): BoundaryCachePayload {
  return {
    version: BOUNDARY_CACHE_VERSION,
    writtenAt: Date.now(),
    source,
    features,
  };
}

export function isBoundaryCachePayload(
  value: unknown,
): value is BoundaryCachePayload {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as any).version === BOUNDARY_CACHE_VERSION &&
      Array.isArray((value as any).features),
  );
}

export async function readProvinceBoundaryCache() {
  if (window.travelMap.cache?.readProvinceBoundaries) {
    const result = await window.travelMap.cache.readProvinceBoundaries();
    return isBoundaryCachePayload(result) ? result : null;
  }

  const raw = window.localStorage.getItem(BOUNDARY_CACHE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return isBoundaryCachePayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function writeProvinceBoundaryCache(payload: BoundaryCachePayload) {
  if (window.travelMap.cache?.writeProvinceBoundaries) {
    return window.travelMap.cache.writeProvinceBoundaries(payload);
  }

  window.localStorage.setItem(BOUNDARY_CACHE_KEY, JSON.stringify(payload));
  return { ok: true as const };
}

import type { GeoFeature } from "./geoTypes.ts";
import { featureCenter, loadGeoJson } from "./geoUtils.ts";
import { loadAmapPlugin } from "./loadAmapSdk.ts";
import {
  createBoundaryCachePayload,
  readProvinceBoundaryCache,
  writeProvinceBoundaryCache,
  isBoundaryCachePayload,
} from "./provinceBoundaryCache.ts";

interface AMapPointLike {
  lng?: number;
  lat?: number;
  getLng?: () => number;
  getLat?: () => number;
}

interface AMapDistrictLike {
  adcode?: string;
  name?: string;
  center?: [number, number] | AMapPointLike;
  boundaries?: Array<AMapPointLike[] | string>;
}

let provinceBoundarySourcePromise: Promise<{
  status: "ready";
  source: "cache" | "amap";
  features: GeoFeature[];
}> | null = null;

export function normalizeProvinceAdcode(id: string) {
  return id.length === 2 ? `${id}0000` : id;
}

export function normalizeProvinceBoundaryEnvelope(features: GeoFeature[]) {
  return features.map((feature) => ({
    ...feature,
    properties: {
      ...feature.properties,
      id: normalizeProvinceAdcode(feature.properties.id),
      center: feature.properties.center ?? featureCenter(feature.geometry),
    },
  }));
}

export function shouldUseBoundaryCache(value: unknown) {
  return isBoundaryCachePayload(value);
}

function pointToTuple(point: AMapPointLike | [number, number]): [number, number] | null {
  if (Array.isArray(point) && point.length >= 2) {
    const lng = Number(point[0]);
    const lat = Number(point[1]);
    return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
  }

  const pointLike = point as AMapPointLike;
  const lng =
    typeof pointLike?.getLng === "function" ? pointLike.getLng() : Number(pointLike?.lng);
  const lat =
    typeof pointLike?.getLat === "function" ? pointLike.getLat() : Number(pointLike?.lat);

  return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
}

function boundaryToRing(boundary: AMapPointLike[] | string): [number, number][] {
  if (typeof boundary === "string") {
    return boundary
      .split(";")
      .map((pair) => pair.split(",").map(Number))
      .filter((pair) => pair.length >= 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
      .map(([lng, lat]) => [lng, lat] as [number, number]);
  }

  return boundary
    .map((point) => pointToTuple(point))
    .filter((point): point is [number, number] => point !== null);
}

function districtToFeature(
  metadata: GeoFeature,
  district: AMapDistrictLike | null,
): GeoFeature {
  const rings = (district?.boundaries ?? [])
    .map(boundaryToRing)
    .filter((ring) => ring.length >= 3);

  if (rings.length === 0) {
    return metadata;
  }

  const geometry =
    rings.length === 1
      ? ({
          type: "Polygon" as const,
          coordinates: [rings[0]],
        })
      : ({
          type: "MultiPolygon" as const,
          coordinates: rings.map((ring) => [ring]),
        });

  return {
    type: "Feature",
    properties: {
      id: metadata.properties.id,
      name: district?.name ?? metadata.properties.name,
      center: pointToTuple(district?.center as AMapPointLike) ?? featureCenter(geometry),
    },
    geometry,
  };
}

async function fetchProvinceBoundariesFromAmap(
  seedFeatures: GeoFeature[],
) {
  const AMap = await loadAmapPlugin("AMap.DistrictSearch");

  return Promise.all(
    seedFeatures.map(
      (seed) =>
        new Promise<GeoFeature>((resolve) => {
          const districtSearch = new AMap.DistrictSearch({
            level: "province",
            subdistrict: 0,
            extensions: "all",
          });

          const timeoutId = window.setTimeout(() => {
            resolve(seed);
          }, 4000);

          districtSearch.search(seed.properties.id, (status: string, result: any) => {
            window.clearTimeout(timeoutId);
            if (status !== "complete") {
              resolve(seed);
              return;
            }

            const districtList = result?.districtList;
            const matched =
              districtList?.find(
                (item: AMapDistrictLike) =>
                  item?.adcode === seed.properties.id,
              ) ??
              districtList?.[0] ??
              null;

            resolve(districtToFeature(seed, matched));
          });
        }),
    ),
  );
}

export async function loadCountryProvinceBoundaries() {
  if (provinceBoundarySourcePromise) return provinceBoundarySourcePromise;

  provinceBoundarySourcePromise = (async () => {
    try {
      const cached = await readProvinceBoundaryCache().catch(() => null);
      if (shouldUseBoundaryCache(cached)) {
        return {
          status: "ready" as const,
          source: "cache" as const,
          features: normalizeProvinceBoundaryEnvelope(cached.features),
        };
      }

      const localGeo = await loadGeoJson("china-provinces.json");
      const normalizedSeed = normalizeProvinceBoundaryEnvelope(localGeo.features);
      const features = await fetchProvinceBoundariesFromAmap(normalizedSeed);
      const normalizedFeatures = normalizeProvinceBoundaryEnvelope(features);

      void writeProvinceBoundaryCache(
        createBoundaryCachePayload(normalizedFeatures, "amap"),
      ).catch((error) => {
        console.warn("Province boundary cache write failed:", error);
      });

      return {
        status: "ready" as const,
        source: "amap" as const,
        features: normalizedFeatures,
      };
    } catch (error) {
      provinceBoundarySourcePromise = null;
      throw error;
    }
  })();

  return provinceBoundarySourcePromise;
}

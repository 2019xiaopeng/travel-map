import type { GeoFeature } from "./geoTypes";
import { featureCenter, loadGeoJson } from "./geoUtils";
import { loadAmapPlugin } from "./loadAmapSdk";

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

let provinceBoundariesPromise: Promise<GeoFeature[]> | null = null;

function normalizeAdcode(id: string) {
  return id.length === 2 ? `${id}0000` : id;
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

  const center = pointToTuple(district?.center as AMapPointLike) ?? featureCenter(geometry);

  return {
    type: "Feature",
    properties: {
      id: normalizeAdcode(metadata.properties.id),
      name: district?.name ?? metadata.properties.name,
      center,
    },
    geometry,
  };
}

async function searchProvinceBoundary(metadata: GeoFeature): Promise<GeoFeature> {
  const AMap = await loadAmapPlugin("AMap.DistrictSearch");

  return new Promise<GeoFeature>((resolve) => {
    const districtSearch = new AMap.DistrictSearch({
      level: "province",
      subdistrict: 0,
      extensions: "all",
    });

    districtSearch.search(metadata.properties.name, (status: string, result: any) => {
      if (status !== "complete") {
        resolve(metadata);
        return;
      }

      const districtList = result?.districtList;
      const provinceAdcode = normalizeAdcode(metadata.properties.id);
      const matched =
        districtList?.find((item: AMapDistrictLike) => item?.adcode === provinceAdcode) ??
        districtList?.[0] ??
        null;

      resolve(districtToFeature(metadata, matched));
    });
  });
}

export async function loadProvinceBoundaries(): Promise<GeoFeature[]> {
  if (provinceBoundariesPromise) return provinceBoundariesPromise;

  provinceBoundariesPromise = (async () => {
    const geo = await loadGeoJson("china-provinces.json");

    try {
      const features = await Promise.all(
        geo.features.map((feature) => searchProvinceBoundary(feature)),
      );
      return features;
    } catch {
      return geo.features.map((feature) => ({
        ...feature,
        properties: {
          ...feature.properties,
          id: normalizeAdcode(feature.properties.id),
        },
      }));
    }
  })();

  return provinceBoundariesPromise;
}

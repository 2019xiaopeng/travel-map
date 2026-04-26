import { useEffect, useRef } from "react";
import type { GeoFeature } from "../geoTypes";
import { loadGeoJson, polygonCoordsToPaths, multiPolygonCoordsToPaths, featureCenter } from "../geoUtils";
import { useMapStore } from "../mapStore";

interface RawMasterFeature {
  type: "Feature";
  properties?: {
    id?: string | number;
    adcode?: string | number;
    name?: string;
    center?: [number, number] | number[];
    level?: string;
    parent?: {
      adcode?: string | number;
    };
  };
  geometry?: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
}

function normalizeProvinceAdcode(provinceId: string): string {
  return provinceId.length === 2 ? `${provinceId}0000` : provinceId;
}

function toAdcode(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value).toString();
  }

  if (typeof value === "string") {
    const match = value.match(/\d+/);
    return match ? match[0] : null;
  }

  return null;
}

function toCenter(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) return null;

  const lng = Number(value[0]);
  const lat = Number(value[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;

  return [lng, lat];
}

function toGeoFeature(feature: RawMasterFeature): GeoFeature | null {
  const geometry = feature.geometry;
  if (!geometry) return null;

  const id = toAdcode(feature.properties?.id ?? feature.properties?.adcode);
  if (!id) return null;

  const name = (feature.properties?.name ?? id).toString();
  const center = toCenter(feature.properties?.center);

  return {
    type: "Feature",
    properties: {
      id,
      name,
      center: center ?? featureCenter(geometry),
    },
    geometry,
  };
}

function resolveMapCenter(map: any): [number, number] {
  const center = map?.getCenter?.();
  const lng = typeof center?.getLng === "function" ? center.getLng() : center?.lng;
  const lat = typeof center?.getLat === "function" ? center.getLat() : center?.lat;

  if (typeof lng === "number" && typeof lat === "number") {
    return [lng, lat];
  }

  return [104.5, 35.5];
}

function rectangleAround(center: [number, number], radiusLng: number, radiusLat: number) {
  const [lng, lat] = center;
  return [[
    [lng - radiusLng, lat - radiusLat],
    [lng + radiusLng, lat - radiusLat],
    [lng + radiusLng, lat + radiusLat],
    [lng - radiusLng, lat + radiusLat],
    [lng - radiusLng, lat - radiusLat],
  ]];
}

function buildFallbackCities(provinceAdcode: string, center: [number, number]): GeoFeature[] {
  const offsets: Array<[number, number]> = [
    [-0.75, 0.45],
    [0.8, 0.3],
    [0.05, -0.75],
  ];

  return offsets.map(([offsetLng, offsetLat], index) => {
    const cityCenter: [number, number] = [center[0] + offsetLng, center[1] + offsetLat];

    return {
      type: "Feature",
      properties: {
        id: `${provinceAdcode}-mock-${index + 1}`,
        name: `示例区域${index + 1}`,
        center: cityCenter,
      },
      geometry: {
        type: "Polygon",
        coordinates: rectangleAround(cityCenter, 0.42, 0.28),
      },
    };
  });
}

async function loadLocalCities(provinceId: string, map: any): Promise<GeoFeature[]> {
  const provinceAdcode = normalizeProvinceAdcode(provinceId);

  try {
    const dedicated = await loadGeoJson(`provinces/${provinceAdcode}.json`);
    if (dedicated.features.length > 0) return dedicated.features;
  } catch {
    // Fall through to the merged static dataset.
  }

  try {
    const response = await fetch("/geo/china-provinces-cities.geojson");
    if (response.ok) {
      const raw = (await response.json()) as { features?: RawMasterFeature[] };
      const allFeatures = raw.features ?? [];

      const cityMatches = allFeatures
        .filter((item) => item.properties?.level === "city")
        .filter((item) => toAdcode(item.properties?.parent?.adcode) === provinceAdcode)
        .map(toGeoFeature)
        .filter((item): item is GeoFeature => item !== null);

      if (cityMatches.length > 0) return cityMatches;

      const provincePrefix = provinceAdcode.slice(0, 2);
      const districtMatches = allFeatures
        .filter((item) => item.properties?.level === "district")
        .filter((item) => {
          const adcode = toAdcode(item.properties?.adcode);
          return adcode?.startsWith(provincePrefix) ?? false;
        })
        .map(toGeoFeature)
        .filter((item): item is GeoFeature => item !== null);

      if (districtMatches.length > 0) return districtMatches;
    }
  } catch {
    // Fall through to local rectangle examples.
  }

  return buildFallbackCities(provinceAdcode, resolveMapCenter(map));
}

const NORMAL_STYLE = {
  strokeColor: "#60a5fa",
  strokeWeight: 1,
  strokeOpacity: 0.5,
  fillColor: "#3b82f6",
  fillOpacity: 0.06,
  cursor: "pointer" as const,
};

const HOVER_STYLE = {
  strokeColor: "#93c5fd",
  strokeWeight: 1.5,
  strokeOpacity: 0.8,
  fillColor: "#3b82f6",
  fillOpacity: 0.15,
  cursor: "pointer" as const,
};

const SELECTED_STYLE = {
  strokeColor: "#fbbf24",
  strokeWeight: 2.5,
  strokeOpacity: 1,
  fillColor: "#fbbf24",
  fillOpacity: 0.12,
};

export function CityLayer({ map, provinceId }: { map: any; provinceId: string | null }) {
  const polygonsRef = useRef<any[]>([]);
  const selectedRef = useRef<any>(null);
  const enterCity = useMapStore((s) => s.enterCity);
  const cityId = useMapStore((s) => s.cityId);

  // Update selection highlight when cityId changes
  useEffect(() => {
    if (!polygonsRef.current.length) return;

    if (selectedRef.current) {
      selectedRef.current.setOptions(NORMAL_STYLE);
      selectedRef.current = null;
    }

    if (cityId) {
      const found = polygonsRef.current.find(
        (p: any) => (p.getExtData() as { id: string }).id === cityId,
      );
      if (found) {
        found.setOptions(SELECTED_STYLE);
        selectedRef.current = found;
      }
    }
  }, [cityId]);

  useEffect(() => {
    if (!map || !provinceId) return;

    let cancelled = false;

    loadLocalCities(provinceId, map).then((features) => {
      if (cancelled) return;

      const AMap = window.AMap;
      const polygons = features.map((feature) => {
        const paths =
          feature.geometry.type === "Polygon"
            ? polygonCoordsToPaths(feature.geometry.coordinates as number[][][])
            : multiPolygonCoordsToPaths(feature.geometry.coordinates as number[][][][]);

        const polygon = new AMap.Polygon({
          ...NORMAL_STYLE,
          path: paths,
          extData: feature.properties,
        });

        polygon.on("click", () => {
          const { id, name } = feature.properties;
          enterCity(id, name);
        });

        polygon.on("mouseover", () => {
          if (polygon !== selectedRef.current) {
            polygon.setOptions(HOVER_STYLE);
          }
        });

        polygon.on("mouseout", () => {
          if (polygon !== selectedRef.current) {
            polygon.setOptions(NORMAL_STYLE);
          }
        });

        return polygon;
      });

      polygonsRef.current = polygons;
      map.add(polygons);
    });

    return () => {
      cancelled = true;
      polygonsRef.current.forEach((p) => {
        p.off("click");
        p.off("mouseover");
        p.off("mouseout");
        p.setMap(null);
      });
      polygonsRef.current = [];
      selectedRef.current = null;
    };
  }, [map, provinceId, enterCity]);

  return null;
}

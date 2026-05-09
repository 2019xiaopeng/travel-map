import { useEffect, useRef } from "react";
import type { GeoFeature } from "../geoTypes";
import { loadGeoJson, polygonCoordsToPaths, multiPolygonCoordsToPaths, featureCenter } from "../geoUtils";
import { useMapStore } from "../mapStore";
import { CITY_LAYER_TOKENS } from "../mapLayout.js";
import { buildProvinceBoundaryUrl } from "../provinceBoundaryUrl.ts";

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

export function hasRealCityBoundaryData(features: GeoFeature[]) {
  return features.length > 0;
}

async function loadLocalCities(provinceId: string): Promise<GeoFeature[]> {
  const provinceAdcode = normalizeProvinceAdcode(provinceId);

  try {
    const dedicated = await loadGeoJson(`provinces/${provinceAdcode}.json`);
    if (hasRealCityBoundaryData(dedicated.features)) return dedicated.features;
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

      if (hasRealCityBoundaryData(cityMatches)) return cityMatches;
    }
  } catch {
    // Fall through to no-boundary mode.
  }

  return [];
}

async function loadProvinceCities(provinceId: string): Promise<GeoFeature[]> {
  const provinceAdcode = normalizeProvinceAdcode(provinceId);

  try {
    const response = await fetch(buildProvinceBoundaryUrl(provinceAdcode));
    if (response.ok) {
      const raw = (await response.json()) as { features?: RawMasterFeature[] };
      const features = (raw.features ?? [])
        .map(toGeoFeature)
        .filter((item): item is GeoFeature => item !== null);

      if (hasRealCityBoundaryData(features)) {
        return features;
      }
    }
  } catch (error) {
    console.warn("Province city boundary remote load failed:", error);
  }

  return loadLocalCities(provinceId);
}

const NORMAL_STYLE = {
  strokeColor: CITY_LAYER_TOKENS.stroke,
  strokeWeight: 1.8,
  strokeOpacity: 0.92,
  fillColor: CITY_LAYER_TOKENS.fill,
  fillOpacity: 0.06,
  cursor: "pointer" as const,
  zIndex: 70,
};

const HOVER_STYLE = {
  strokeColor: CITY_LAYER_TOKENS.hoverStroke,
  strokeWeight: 2.4,
  strokeOpacity: 1,
  fillColor: CITY_LAYER_TOKENS.hoverFill,
  fillOpacity: 0.12,
  cursor: "pointer" as const,
  zIndex: 80,
};

const SELECTED_STYLE = {
  strokeColor: CITY_LAYER_TOKENS.selectedStroke,
  strokeWeight: 2.8,
  strokeOpacity: 1,
  fillColor: CITY_LAYER_TOKENS.selectedFill,
  fillOpacity: 0.16,
  zIndex: 90,
};

export function CityLayer({
  map,
  provinceId,
  onBoundaryWarning,
}: {
  map: any;
  provinceId: string | null;
  onBoundaryWarning?: (message: string | null) => void;
}) {
  const polygonsRef = useRef<any[]>([]);
  const labelsRef = useRef<any[]>([]);
  const outlinesRef = useRef<any[]>([]);
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

    loadProvinceCities(provinceId).then((features) => {
      if (cancelled) return;

      if (!hasRealCityBoundaryData(features)) {
        onBoundaryWarning?.("当前省份暂无城市边界数据，仍可查看省级信息。");
        polygonsRef.current = [];
        labelsRef.current = [];
        outlinesRef.current = [];
        return;
      }

      onBoundaryWarning?.(null);

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

      const outlines = features.flatMap((feature) => {
        const paths =
          feature.geometry.type === "Polygon"
            ? polygonCoordsToPaths(feature.geometry.coordinates as number[][][])
            : multiPolygonCoordsToPaths(feature.geometry.coordinates as number[][][][]);
        const outlineSets = Array.isArray(paths[0][0][0]) ? (paths as [number, number][][][]) : [paths as [number, number][][]];

        return outlineSets.flatMap((polygonRings) =>
          polygonRings.map((ring) =>
            new AMap.Polyline({
              path: ring,
              strokeColor: CITY_LAYER_TOKENS.stroke,
              strokeOpacity: 0.8,
              strokeWeight: 1.45,
              strokeStyle: "solid",
              lineJoin: "round",
              lineCap: "round",
              zIndex: 100,
            }),
          ),
        );
      });

      const labels = features.map((feature) => {
        const label = new AMap.Text({
          text: feature.properties.name,
          position: feature.properties.center,
          anchor: "center",
          style: {
            "background-color": CITY_LAYER_TOKENS.labelBg,
            "border": `1px solid ${CITY_LAYER_TOKENS.labelBorder}`,
            "border-radius": "9999px",
            "padding": "3px 7px",
            "color": CITY_LAYER_TOKENS.labelText,
            "font-size": "10px",
            "font-weight": "600",
            "box-shadow": "0 4px 10px rgba(0, 0, 0, 0.24)",
            "cursor": "pointer",
          },
          zIndex: 110,
        });

        label.on("click", () => {
          const { id, name } = feature.properties;
          enterCity(id, name);
        });

        return label;
      });

      polygonsRef.current = polygons;
      labelsRef.current = labels;
      outlinesRef.current = outlines;
      map.add(polygons);
      map.add(outlines);
      map.add(labels);
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
      outlinesRef.current.forEach((outline) => {
        outline.setMap(null);
      });
      outlinesRef.current = [];
      labelsRef.current.forEach((label) => {
        label.off("click");
        label.setMap(null);
      });
      labelsRef.current = [];
      selectedRef.current = null;
      onBoundaryWarning?.(null);
    };
  }, [map, provinceId, enterCity, onBoundaryWarning]);

  return null;
}

import { useEffect, useRef, useCallback } from "react";
import type { GeoFeature } from "../geoTypes";
import { focusProvinceOnMap, polygonCoordsToPaths, multiPolygonCoordsToPaths } from "../geoUtils";
import { useMapStore } from "../mapStore";
import { MAP_FIT_PADDING_CLOSED, PROVINCE_LAYER_TOKENS } from "../mapLayout.js";
import type { ProvinceHoverState } from "../provinceHoverState";

const NORMAL_STYLE = {
  strokeColor: PROVINCE_LAYER_TOKENS.stroke,
  strokeWeight: 2.2,
  strokeOpacity: 0.92,
  fillColor: PROVINCE_LAYER_TOKENS.fill,
  fillOpacity: 0.035,
  cursor: "pointer" as const,
  zIndex: 60,
};

const ACTIVE_STYLE = {
  strokeColor: PROVINCE_LAYER_TOKENS.hoverStroke,
  strokeWeight: 3.2,
  strokeOpacity: 1,
  fillColor: PROVINCE_LAYER_TOKENS.hoverFill,
  fillOpacity: 0.08,
  cursor: "pointer" as const,
  zIndex: 70,
};

export function ProvinceLayer({
  map,
  features,
  hoveredProvinceId,
  onProvinceHoverChange,
}: {
  map: any;
  features: GeoFeature[];
  hoveredProvinceId: string | null;
  onProvinceHoverChange: (next: ProvinceHoverState | null) => void;
}) {
  const polygonsRef = useRef<any[]>([]);
  const outlinesRef = useRef<any[]>([]);
  const polygonMapRef = useRef(new Map<string, any>());
  const openProvinceExperience = useMapStore((s) => s.openProvinceExperience);

  const handleClick = useCallback(
    (feature: GeoFeature) => {
      onProvinceHoverChange(null);
      openProvinceExperience({
        id: feature.properties.id,
        name: feature.properties.name,
      });
      focusProvinceOnMap(map, {
        provinceId: feature.properties.id,
        geometry: feature.geometry,
        visualCenter:
          feature.properties.visualCenter ?? feature.properties.center,
        bounds:
          feature.properties.bounds ?? {
            minLng: feature.properties.center[0] - 1,
            maxLng: feature.properties.center[0] + 1,
            minLat: feature.properties.center[1] - 1,
            maxLat: feature.properties.center[1] + 1,
          },
      });
    },
    [map, openProvinceExperience, onProvinceHoverChange],
  );

  const clearLayers = useCallback(() => {
    polygonsRef.current.forEach((p) => {
      p.off("click");
      p.off("mouseover");
      p.off("mousemove");
      p.off("mouseout");
      p.setMap(null);
    });
    polygonsRef.current = [];
    polygonMapRef.current.clear();

    outlinesRef.current.forEach((outline) => {
      outline.setMap(null);
    });
    outlinesRef.current = [];
  }, []);

  const renderFeatures = useCallback(
    (
      features: GeoFeature[],
      options: {
        fitView: boolean;
      },
    ) => {
      const AMap = window.AMap;
      clearLayers();

      const polygons: any[] = [];
      const outlines: any[] = [];

      features.forEach((feature) => {
        const paths =
          feature.geometry.type === "Polygon"
            ? polygonCoordsToPaths(feature.geometry.coordinates as number[][][])
            : multiPolygonCoordsToPaths(feature.geometry.coordinates as number[][][][]);

        const polygon = new AMap.Polygon({
          ...NORMAL_STYLE,
          path: paths,
          extData: feature.properties,
        });

        polygon.on("click", () => handleClick(feature));
        polygon.on("mouseover", (e: any) => {
          const pixel = map.lngLatToContainer(e.lnglat);
          onProvinceHoverChange({
            provinceId: feature.properties.id,
            provinceName: feature.properties.name,
            x: typeof pixel?.getX === "function" ? pixel.getX() : pixel?.x,
            y: typeof pixel?.getY === "function" ? pixel.getY() : pixel?.y,
          });
        });
        polygon.on("mousemove", (e: any) => {
          const pixel = map.lngLatToContainer(e.lnglat);
          onProvinceHoverChange({
            provinceId: feature.properties.id,
            provinceName: feature.properties.name,
            x: typeof pixel?.getX === "function" ? pixel.getX() : pixel?.x,
            y: typeof pixel?.getY === "function" ? pixel.getY() : pixel?.y,
          });
        });
        polygon.on("mouseout", () => {
          onProvinceHoverChange(null);
        });

        polygons.push(polygon);
        polygonMapRef.current.set(feature.properties.id, polygon);

        const outlineSets = Array.isArray(paths[0][0][0]) ? (paths as [number, number][][][]) : [paths as [number, number][][]];
        outlineSets.forEach((polygonRings) => {
          polygonRings.forEach((ring) => {
            const outline = new AMap.Polyline({
              path: ring,
              strokeColor: PROVINCE_LAYER_TOKENS.stroke,
              strokeOpacity: 0.86,
              strokeWeight: 1.8,
              strokeStyle: "solid",
              lineJoin: "round",
              lineCap: "round",
              zIndex: 95,
            });
            outlines.push(outline);
          });
        });
      });

      polygonsRef.current = polygons;
      outlinesRef.current = outlines;
      map.add(polygons);
      if (outlines.length > 0) {
        map.add(outlines);
      }
      if (options.fitView) {
        map.setFitView(polygons, false, MAP_FIT_PADDING_CLOSED);
      }
    },
    [clearLayers, handleClick, map, onProvinceHoverChange],
  );

  useEffect(() => {
    if (!map) return;

    renderFeatures(features, { fitView: true });

    return () => {
      clearLayers();
      onProvinceHoverChange(null);
    };
  }, [map, clearLayers, renderFeatures, features, onProvinceHoverChange]);

  useEffect(() => {
    polygonMapRef.current.forEach((polygon, id) => {
      polygon.setOptions(
        id === hoveredProvinceId ? ACTIVE_STYLE : NORMAL_STYLE,
      );
    });
  }, [hoveredProvinceId]);

  return null;
}

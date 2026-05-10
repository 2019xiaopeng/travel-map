import { useEffect, useRef, useCallback, useMemo } from "react";
import type { GeoFeature } from "../geoTypes";
import { focusProvinceOnMap, polygonCoordsToPaths, multiPolygonCoordsToPaths } from "../geoUtils";
import { useMapStore } from "../mapStore";
import { MAP_FIT_PADDING_CLOSED, PROVINCE_LAYER_TOKENS } from "../mapLayout.js";
import type { ProvinceHoverState } from "../provinceHoverState";
import {
  getProvinceLayerModeConfig,
  type ProvinceLayerMode,
} from "../provinceLayerMode.ts";

export function ProvinceLayer({
  map,
  features,
  hoveredProvinceId,
  onProvinceHoverChange,
  mode = "country",
}: {
  map: any;
  features: GeoFeature[];
  hoveredProvinceId: string | null;
  onProvinceHoverChange: (next: ProvinceHoverState | null) => void;
  mode?: ProvinceLayerMode;
}) {
  const polygonsRef = useRef<any[]>([]);
  const outlinesRef = useRef<any[]>([]);
  const polygonMapRef = useRef(new Map<string, any>());
  const hoverClearTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const hoveredProvinceIdRef = useRef<string | null>(null);
  const openProvinceExperience = useMapStore((s) => s.openProvinceExperience);
  // Keep layer config stable across hover updates; otherwise the render effect
  // rebuilds all province polygons on every hover frame and causes flicker.
  const modeConfig = useMemo(() => getProvinceLayerModeConfig(mode), [mode]);
  const normalStyle = useMemo(
    () => ({
      strokeColor: PROVINCE_LAYER_TOKENS.stroke,
      strokeWeight: modeConfig.strokeWeight,
      strokeOpacity: 0.92,
      fillColor: PROVINCE_LAYER_TOKENS.fill,
      fillOpacity: modeConfig.fillOpacity,
      cursor: "pointer" as const,
      zIndex: modeConfig.zIndex,
    }),
    [modeConfig],
  );
  const activeStyle = useMemo(
    () => ({
      strokeColor: PROVINCE_LAYER_TOKENS.hoverStroke,
      strokeWeight: modeConfig.activeStrokeWeight,
      strokeOpacity: 1,
      fillColor: PROVINCE_LAYER_TOKENS.hoverFill,
      fillOpacity: modeConfig.activeFillOpacity,
      cursor: "pointer" as const,
      zIndex: modeConfig.zIndex + 10,
    }),
    [modeConfig],
  );

  const handleClick = useCallback(
    (feature: GeoFeature) => {
      if (hoverClearTimerRef.current !== null) {
        window.clearTimeout(hoverClearTimerRef.current);
        hoverClearTimerRef.current = null;
      }
      hoveredProvinceIdRef.current = null;
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

  const cancelPendingHoverClear = useCallback(() => {
    if (hoverClearTimerRef.current !== null) {
      window.clearTimeout(hoverClearTimerRef.current);
      hoverClearTimerRef.current = null;
    }
  }, []);

  const applyHover = useCallback(
    (feature: GeoFeature, event: any) => {
      cancelPendingHoverClear();
      hoveredProvinceIdRef.current = feature.properties.id;
      const pixel = map.lngLatToContainer(event.lnglat);
      onProvinceHoverChange({
        provinceId: feature.properties.id,
        provinceName: feature.properties.name,
        x: typeof pixel?.getX === "function" ? pixel.getX() : pixel?.x,
        y: typeof pixel?.getY === "function" ? pixel.getY() : pixel?.y,
      });
    },
    [cancelPendingHoverClear, map, onProvinceHoverChange],
  );

  const scheduleHoverClear = useCallback(
    (provinceId: string) => {
      cancelPendingHoverClear();
      hoverClearTimerRef.current = window.setTimeout(() => {
        if (hoveredProvinceIdRef.current === provinceId) {
          hoveredProvinceIdRef.current = null;
          onProvinceHoverChange(null);
        }
        hoverClearTimerRef.current = null;
      }, modeConfig.hoverClearDelayMs);
    },
    [cancelPendingHoverClear, modeConfig.hoverClearDelayMs, onProvinceHoverChange],
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
          ...normalStyle,
          path: paths,
          extData: feature.properties,
        });

        polygon.on("click", () => handleClick(feature));
        polygon.on("mouseover", (event: any) => applyHover(feature, event));
        polygon.on("mousemove", (event: any) => applyHover(feature, event));
        polygon.on("mouseout", () => {
          scheduleHoverClear(feature.properties.id);
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
              strokeWeight: modeConfig.outlineStrokeWeight,
              strokeStyle: "solid",
              lineJoin: "round",
              lineCap: "round",
              zIndex: modeConfig.outlineZIndex,
              bubble: false,
            });
            outlines.push(outline);
          });
        });
      });

      polygonsRef.current = polygons;
      outlinesRef.current = outlines;
      if (outlines.length > 0) {
        map.add(outlines);
      }
      map.add(polygons);
      if (options.fitView) {
        map.setFitView(polygons, false, MAP_FIT_PADDING_CLOSED);
      }
    },
    [
      applyHover,
      clearLayers,
      handleClick,
      map,
      modeConfig,
      normalStyle,
      scheduleHoverClear,
    ],
  );

  useEffect(() => {
    hoveredProvinceIdRef.current = hoveredProvinceId;
  }, [hoveredProvinceId]);

  useEffect(() => {
    if (!map) return;

    renderFeatures(features, { fitView: modeConfig.fitView });

    return () => {
      cancelPendingHoverClear();
      hoveredProvinceIdRef.current = null;
      clearLayers();
      onProvinceHoverChange(null);
    };
  }, [
    map,
    cancelPendingHoverClear,
    clearLayers,
    renderFeatures,
    features,
    modeConfig.fitView,
    onProvinceHoverChange,
  ]);

  useEffect(() => {
    polygonMapRef.current.forEach((polygon, id) => {
      polygon.setOptions(
        id === hoveredProvinceId ? activeStyle : normalStyle,
      );
    });
  }, [activeStyle, hoveredProvinceId, normalStyle]);

  return null;
}

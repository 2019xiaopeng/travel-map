import { useEffect, useRef, useCallback } from "react";
import type { GeoFeature } from "../geoTypes";
import { focusFeatureOnMap, polygonCoordsToPaths, multiPolygonCoordsToPaths } from "../geoUtils";
import { useMapStore } from "../mapStore";
import { MAP_FIT_PADDING_CLOSED, PROVINCE_LAYER_TOKENS } from "../mapLayout.js";
import { loadLocalProvinceBoundaries, loadProvinceBoundaries } from "../provinceBoundaries";

const NORMAL_STYLE = {
  strokeColor: PROVINCE_LAYER_TOKENS.stroke,
  strokeWeight: 2.2,
  strokeOpacity: 0.92,
  fillColor: PROVINCE_LAYER_TOKENS.fill,
  fillOpacity: 0.035,
  cursor: "pointer" as const,
  zIndex: 60,
};

const HOVER_STYLE = {
  strokeColor: PROVINCE_LAYER_TOKENS.hoverStroke,
  strokeWeight: 3.2,
  strokeOpacity: 1,
  fillColor: PROVINCE_LAYER_TOKENS.hoverFill,
  fillOpacity: 0.08,
  cursor: "pointer" as const,
  zIndex: 70,
};

export function ProvinceLayer({ map }: { map: any }) {
  const polygonsRef = useRef<any[]>([]);
  const outlinesRef = useRef<any[]>([]);
  const tooltipRef = useRef<any>(null);
  const enterProvince = useMapStore((s) => s.enterProvince);

  const handleClick = useCallback(
    (feature: GeoFeature) => {
      if (tooltipRef.current) {
        tooltipRef.current.hide();
      }
      const { id, name } = feature.properties;
      enterProvince(id, name);
      focusFeatureOnMap(map, feature.geometry);
    },
    [map, enterProvince],
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

    outlinesRef.current.forEach((outline) => {
      outline.setMap(null);
    });
    outlinesRef.current = [];
  }, []);

  const renderFeatures = useCallback(
    (features: GeoFeature[], fitView: boolean) => {
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
          polygon.setOptions(HOVER_STYLE);
          if (tooltipRef.current) {
            tooltipRef.current.setText(feature.properties.name);
            tooltipRef.current.setPosition(e.lnglat);
            tooltipRef.current.show();
          }
        });
        polygon.on("mousemove", (e: any) => {
          if (tooltipRef.current) {
            tooltipRef.current.setPosition(e.lnglat);
          }
        });
        polygon.on("mouseout", () => {
          polygon.setOptions(NORMAL_STYLE);
          if (tooltipRef.current) {
            tooltipRef.current.hide();
          }
        });

        polygons.push(polygon);

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
      map.add(outlines);
      if (fitView) {
        map.setFitView(polygons, false, MAP_FIT_PADDING_CLOSED);
      }
    },
    [clearLayers, handleClick, map],
  );

  useEffect(() => {
    if (!map) return;

    let cancelled = false;
    const AMap = window.AMap;

    if (!tooltipRef.current) {
      tooltipRef.current = new AMap.Text({
        text: "",
        anchor: "bottom-center",
        offset: new AMap.Pixel(0, -10),
        style: {
          "background-color": "rgba(15, 23, 42, 0.92)",
          "color": "#fff",
          "border": `1px solid ${PROVINCE_LAYER_TOKENS.labelBorder}`,
          "border-radius": "9999px",
          "padding": "6px 10px",
          "font-size": "12px",
          "font-weight": "600",
          "box-shadow": "0 8px 18px rgba(0,0,0,0.35)",
          "pointer-events": "none",
        },
        visible: false,
        zIndex: 100,
      });
      tooltipRef.current.setMap(map);
    }

    loadLocalProvinceBoundaries().then((features) => {
      if (!cancelled) {
        renderFeatures(features, true);
      }
    });

    loadProvinceBoundaries().then((features) => {
      if (!cancelled) {
        renderFeatures(features, false);
      }
    });

    return () => {
      cancelled = true;
      clearLayers();
      if (tooltipRef.current) {
        tooltipRef.current.setMap(null);
        tooltipRef.current = null;
      }
    };
  }, [map, clearLayers, renderFeatures]);

  return null;
}

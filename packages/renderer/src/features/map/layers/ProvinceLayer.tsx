import { useEffect, useRef, useCallback } from "react";
import type { GeoFeature } from "../geoTypes";
import { focusFeatureOnMap, loadGeoJson, polygonCoordsToPaths, multiPolygonCoordsToPaths } from "../geoUtils";
import { useMapStore } from "../mapStore";

const NORMAL_STYLE = {
  strokeColor: "#f59e0b",
  strokeWeight: 3.4,
  strokeOpacity: 1,
  fillColor: "#f59e0b",
  fillOpacity: 0.01,
  cursor: "pointer" as const,
  zIndex: 60,
};

const HOVER_STYLE = {
  strokeColor: "#fbbf24",
  strokeWeight: 4.6,
  strokeOpacity: 1,
  fillColor: "#f59e0b",
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
          "border": "1px solid rgba(251, 191, 36, 0.45)",
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

    loadGeoJson("china-provinces.json").then((geo) => {
      if (cancelled) return;

      const polygons: any[] = [];
      const outlines: any[] = [];

      geo.features.forEach((feature) => {
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
              strokeColor: "#fbbf24",
              strokeOpacity: 1,
              strokeWeight: 3,
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
      map.setFitView(polygons, false, [60, 60, 60, 60]);
    });

    return () => {
      cancelled = true;
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
      if (tooltipRef.current) {
        tooltipRef.current.setMap(null);
        tooltipRef.current = null;
      }
    };
  }, [map, handleClick]);

  return null;
}

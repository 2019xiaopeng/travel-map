import { useEffect, useRef, useCallback } from "react";
import type { GeoFeature } from "../geoTypes";
import { loadGeoJson, polygonCoordsToPaths, multiPolygonCoordsToPaths, featureCenter } from "../geoUtils";
import { useMapStore } from "../mapStore";

const NORMAL_STYLE = {
  strokeColor: "#f59e0b",
  strokeWeight: 3,
  strokeOpacity: 0.95,
  fillColor: "#f59e0b",
  fillOpacity: 0.2,
  cursor: "pointer" as const,
};

const HOVER_STYLE = {
  strokeColor: "#fbbf24",
  strokeWeight: 4,
  strokeOpacity: 1,
  fillColor: "#f59e0b",
  fillOpacity: 0.32,
  cursor: "pointer" as const,
};

export function ProvinceLayer({ map }: { map: any }) {
  const polygonsRef = useRef<any[]>([]);
  const labelsRef = useRef<any[]>([]);
  const tooltipRef = useRef<any>(null);
  const enterProvince = useMapStore((s) => s.enterProvince);

  const handleClick = useCallback(
    (feature: GeoFeature, polygon: any) => {
      if (tooltipRef.current) {
        tooltipRef.current.hide();
      }
      const { id, name, center } = feature.properties;
      enterProvince(id, name);
      map.setFitView([polygon], false, [60, 60, 60, 60]);
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

      const polygons = geo.features.map((feature) => {
        const paths =
          feature.geometry.type === "Polygon"
            ? polygonCoordsToPaths(feature.geometry.coordinates as number[][][])
            : multiPolygonCoordsToPaths(feature.geometry.coordinates as number[][][][]);

        const polygon = new AMap.Polygon({
          ...NORMAL_STYLE,
          path: paths,
          extData: feature.properties,
        });

        polygon.on("click", () => handleClick(feature, polygon));
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

        return polygon;
      });

      const labels = geo.features.map((feature) => {
        const label = new AMap.Text({
          text: feature.properties.name,
          position: feature.properties.center,
          anchor: "center",
          style: {
            "background-color": "rgba(245, 158, 11, 0.16)",
            "border": "1px solid rgba(251, 191, 36, 0.28)",
            "border-radius": "9999px",
            "padding": "4px 8px",
            "color": "#fde68a",
            "font-size": "11px",
            "font-weight": "600",
            "box-shadow": "0 6px 14px rgba(0, 0, 0, 0.28)",
            "cursor": "pointer",
          },
          zIndex: 110,
        });

        label.on("click", () => handleClick(feature, polygons.find((polygon) => {
          const extData = polygon.getExtData() as { id?: string };
          return extData?.id === feature.properties.id;
        }) ?? polygons[0]));

        return label;
      });

      polygonsRef.current = polygons;
      labelsRef.current = labels;
      map.add(polygons);
      map.add(labels);
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
      labelsRef.current.forEach((label) => {
        label.off("click");
        label.setMap(null);
      });
      labelsRef.current = [];
      if (tooltipRef.current) {
        tooltipRef.current.setMap(null);
        tooltipRef.current = null;
      }
    };
  }, [map, handleClick]);

  return null;
}

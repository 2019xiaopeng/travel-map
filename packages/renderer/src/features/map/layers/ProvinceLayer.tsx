import { useEffect, useRef, useCallback } from "react";
import type { GeoFeature } from "../geoTypes";
import { loadGeoJson, polygonCoordsToPaths, multiPolygonCoordsToPaths, featureCenter } from "../geoUtils";
import { useMapStore } from "../mapStore";

const NORMAL_STYLE = {
  strokeColor: "#3b82f6",
  strokeWeight: 1.5,
  strokeOpacity: 0.6,
  fillColor: "#3b82f6",
  fillOpacity: 0.08,
  cursor: "pointer" as const,
};

const HOVER_STYLE = {
  strokeColor: "#60a5fa",
  strokeWeight: 2,
  strokeOpacity: 0.9,
  fillColor: "#3b82f6",
  fillOpacity: 0.18,
  cursor: "pointer" as const,
};

export function ProvinceLayer({ map }: { map: any }) {
  const polygonsRef = useRef<any[]>([]);
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
          "background-color": "rgba(0, 0, 0, 0.75)",
          "color": "#fff",
          "border": "none",
          "border-radius": "4px",
          "padding": "4px 8px",
          "font-size": "12px",
          "box-shadow": "0 2px 6px rgba(0,0,0,0.3)",
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

      polygonsRef.current = polygons;
      map.add(polygons);
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
      if (tooltipRef.current) {
        tooltipRef.current.setMap(null);
        tooltipRef.current = null;
      }
    };
  }, [map, handleClick]);

  return null;
}

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
  const enterProvince = useMapStore((s) => s.enterProvince);

  const handleClick = useCallback(
    (feature: GeoFeature) => {
      const { id, name, center } = feature.properties;
      enterProvince(id, name);

      const targetCenter = center ?? featureCenter(feature.geometry);
      map.setZoomAndCenter(7, targetCenter, false, 600);
    },
    [map, enterProvince],
  );

  useEffect(() => {
    if (!map) return;

    let cancelled = false;

    loadGeoJson("china-provinces.json").then((geo) => {
      if (cancelled) return;

      const AMap = window.AMap;
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

        polygon.on("click", () => handleClick(feature));
        polygon.on("mouseover", () => polygon.setOptions(HOVER_STYLE));
        polygon.on("mouseout", () => polygon.setOptions(NORMAL_STYLE));

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
        p.off("mouseout");
        p.setMap(null);
      });
      polygonsRef.current = [];
    };
  }, [map, handleClick]);

  return null;
}

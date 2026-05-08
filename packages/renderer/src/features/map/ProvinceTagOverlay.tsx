import { useEffect, useMemo, useState } from "react";
import type { GeoFeature } from "./geoTypes";
import { focusFeatureOnMap, loadGeoJson } from "./geoUtils";
import { useMapStore } from "./mapStore";

interface ProvinceTagOverlayProps {
  map: any;
}

interface ProvinceTag {
  feature: GeoFeature;
  left: number;
  top: number;
}

function projectProvinceTags(map: any, features: GeoFeature[]): ProvinceTag[] {
  if (!map) return [];

  const size = map.getSize?.();
  const width = typeof size?.width === "number" ? size.width : 0;
  const height = typeof size?.height === "number" ? size.height : 0;

  return features
    .map((feature) => {
      const pixel = map.lngLatToContainer?.(feature.properties.center);
      const x = typeof pixel?.getX === "function" ? pixel.getX() : pixel?.x;
      const y = typeof pixel?.getY === "function" ? pixel.getY() : pixel?.y;
      if (typeof x !== "number" || typeof y !== "number") return null;
      if (x < -80 || x > width + 80 || y < -40 || y > height + 40) return null;

      return {
        feature,
        left: x,
        top: y,
      };
    })
    .filter((item): item is ProvinceTag => item !== null);
}

export function ProvinceTagOverlay({ map }: ProvinceTagOverlayProps) {
  const enterProvince = useMapStore((s) => s.enterProvince);
  const [features, setFeatures] = useState<GeoFeature[]>([]);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadGeoJson("china-provinces.json").then((geo) => {
      if (!cancelled) setFeatures(geo.features);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!map) return;

    const sync = () => setVersion((value) => value + 1);

    map.on("mapmove", sync);
    map.on("zoomchange", sync);
    map.on("resize", sync);

    sync();

    return () => {
      map.off("mapmove", sync);
      map.off("zoomchange", sync);
      map.off("resize", sync);
    };
  }, [map]);

  const tags = useMemo(() => projectProvinceTags(map, features), [map, features, version]);

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {tags.map(({ feature, left, top }) => (
        <button
          key={feature.properties.id}
          onClick={() => {
            enterProvince(feature.properties.id, feature.properties.name);
            focusFeatureOnMap(map, feature.geometry);
          }}
          className="
            pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full
            border border-amber-300/30 bg-black/60 px-3 py-1.5 text-xs font-semibold text-amber-200
            shadow-lg shadow-black/30 backdrop-blur-md transition-all hover:scale-105 hover:bg-amber-400/20 hover:text-white
          "
          style={{ left, top }}
        >
          {feature.properties.name}
        </button>
      ))}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import type { GeoFeature } from "./geoTypes";
import { focusFeatureOnMap } from "./geoUtils";
import { useMapStore } from "./mapStore";
import { PROVINCE_LAYER_TOKENS } from "./mapLayout.js";
import { loadLocalProvinceBoundaries, loadProvinceBoundaries } from "./provinceBoundaries";

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

  const projected = features
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

  const filtered: ProvinceTag[] = [];
  const minDistance = 56;

  projected.forEach((tag) => {
    const crowded = filtered.some((existing) => {
      const dx = existing.left - tag.left;
      const dy = existing.top - tag.top;
      return Math.hypot(dx, dy) < minDistance;
    });

    if (!crowded) {
      filtered.push(tag);
    }
  });

  return filtered;
}

export function ProvinceTagOverlay({ map }: ProvinceTagOverlayProps) {
  const enterProvince = useMapStore((s) => s.enterProvince);
  const [features, setFeatures] = useState<GeoFeature[]>([]);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadLocalProvinceBoundaries().then((provinceFeatures) => {
      if (!cancelled) setFeatures(provinceFeatures);
    });
    loadProvinceBoundaries().then((provinceFeatures) => {
      if (!cancelled) setFeatures(provinceFeatures);
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

  const tags = useMemo(() => {
    const zoom = map?.getZoom?.() ?? 4.5;
    const visibleFeatures = features.filter(
      (feature) => zoom >= 4.6 || feature.properties.name.length <= 2,
    );
    return projectProvinceTags(map, visibleFeatures);
  }, [map, features, version]);

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
            px-3 py-1.5 text-xs font-semibold shadow-lg shadow-black/30 backdrop-blur-md transition-all
            hover:scale-105 hover:text-white
          "
          style={{
            left,
            top,
            border: `1px solid ${PROVINCE_LAYER_TOKENS.labelBorder}`,
            backgroundColor: PROVINCE_LAYER_TOKENS.labelBg,
            color: PROVINCE_LAYER_TOKENS.labelText,
          }}
        >
          {feature.properties.name}
        </button>
      ))}
    </div>
  );
}

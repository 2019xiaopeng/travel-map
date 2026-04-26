import { useEffect, useRef, useState } from "react";
import { loadAmapSdk } from "./loadAmapSdk";
import { useMapStore } from "./mapStore";
import { ProvinceLayer } from "./layers/ProvinceLayer";
import { CityLayer } from "./layers/CityLayer";
import { BreadCrumbOverlay } from "./BreadCrumbOverlay";

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [map, setMap] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const level = useMapStore((s) => s.level);
  const provinceId = useMapStore((s) => s.provinceId);

  useEffect(() => {
    if (!containerRef.current) return;

    let destroyed = false;

    loadAmapSdk()
      .then((AMap) => {
        if (destroyed) return;

        const mapOptions = {
          viewMode: "2D" as const,
          zoom: 4.5,
          center: [104.5, 35.5] as [number, number],
          mapStyle: "amap://styles/dark",
          features: ["bg", "road"],
          showLabel: true,
          animateEnable: true,
          dragEnable: true,
          zoomEnable: true,
          rotateEnable: false,
          pitchEnable: false,
          buildingAnimation: false,
        };

        const instance = new AMap.Map(containerRef.current!, mapOptions);

        instance.on("complete", () => {
          if (!destroyed) setLoadError(null);
        });

        instance.on("error", (e: any) => {
          console.error("AMap error event:", e);
          if (!destroyed) {
            setLoadError(e?.message ?? "地图渲染出错");
          }
        });

        mapRef.current = instance;
        setMap(instance);
      })
      .catch((err) => {
        if (destroyed) return;
        console.error("AMap SDK load error:", err);
        setLoadError(err instanceof Error ? err.message : "地图加载失败");
      });

    return () => {
      destroyed = true;
      mapRef.current?.destroy();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {loadError && (
        <div className="absolute left-4 top-14 z-30 rounded-md border border-amber-500/40 bg-black/70 px-3 py-2 text-xs text-amber-300 backdrop-blur">
          地图加载失败：{loadError}
        </div>
      )}

      {level === "country" && map && <ProvinceLayer map={map} />}

      {(level === "province" || level === "city") && map && provinceId && (
        <CityLayer map={map} provinceId={provinceId} />
      )}

      <BreadCrumbOverlay />
    </div>
  );
}

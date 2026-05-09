import { useEffect, useRef, useState } from "react";
import { loadAmapSdk } from "./loadAmapSdk";
import { useMapStore } from "./mapStore";
import { ProvinceLayer } from "./layers/ProvinceLayer";
import { CityLayer } from "./layers/CityLayer";
import { PoiLayer } from "./layers/PoiLayer";
import { BreadCrumbOverlay } from "./BreadCrumbOverlay";
import { PoiAddModal } from "./PoiAddModal";
import { ProvinceTagOverlay } from "./ProvinceTagOverlay";
import {
  ProvinceHoverOverlay,
} from "./ProvinceHoverOverlay";
import type { GeoFeature } from "./geoTypes";
import { loadCountryProvinceBoundaries } from "./provinceBoundarySource";
import {
  clearProvinceHover,
  nextProvinceHoverState,
  type ProvinceHoverState,
} from "./provinceHoverState";

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [map, setMap] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [boundaryWarning, setBoundaryWarning] = useState<string | null>(null);
  const [provinceBoundaryStatus, setProvinceBoundaryStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [provinceFeatures, setProvinceFeatures] = useState<GeoFeature[]>([]);
  const [provinceHover, setProvinceHover] = useState<ProvinceHoverState | null>(
    null,
  );
  const level = useMapStore((s) => s.level);
  const provinceId = useMapStore((s) => s.provinceId);
  const cityId = useMapStore((s) => s.cityId);
  const addingPoi = useMapStore((s) => s.addingPoi);
  const poiDraft = useMapStore((s) => s.poiDraft);

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
          showLabel: false,
          animateEnable: true,
          dragEnable: true,
          zoomEnable: true,
          doubleClickZoom: false,
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

  useEffect(() => {
    if (level === "country") {
      setBoundaryWarning(null);
      setProvinceHover(null);
    }
  }, [level]);

  useEffect(() => {
    if (!map || level !== "country") return;

    let cancelled = false;
    setProvinceBoundaryStatus("loading");

    loadCountryProvinceBoundaries()
      .then((result) => {
        if (cancelled) return;
        setProvinceFeatures(result.features);
        setProvinceBoundaryStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Province boundary load error:", err);
        setProvinceBoundaryStatus("error");
      });

    return () => {
      cancelled = true;
      setProvinceHover(null);
    };
  }, [map, level]);

  return (
    <div className="relative h-full w-full">
      <div
        ref={containerRef}
        className="h-full w-full"
        onMouseLeave={() => {
          setProvinceHover((previous) => clearProvinceHover(previous));
        }}
      />

      {loadError && (
        <div className="absolute left-4 top-14 z-30 rounded-md border border-amber-500/40 bg-black/70 px-3 py-2 text-xs text-amber-300 backdrop-blur">
          地图加载失败：{loadError}
        </div>
      )}

      {boundaryWarning && (
        <div className="absolute left-4 top-28 z-30 rounded-md border border-white/10 bg-black/70 px-3 py-2 text-xs text-neutral-200 backdrop-blur">
          {boundaryWarning}
        </div>
      )}

      {level === "country" && provinceBoundaryStatus === "loading" && (
        <div className="absolute left-4 top-28 z-30 rounded-md border border-white/10 bg-black/70 px-3 py-2 text-xs text-neutral-200 backdrop-blur">
          正在加载精细省界...
        </div>
      )}

      {level === "country" && provinceBoundaryStatus === "error" && (
        <div className="absolute left-4 top-28 z-30 rounded-md border border-amber-500/40 bg-black/70 px-3 py-2 text-xs text-amber-200 backdrop-blur">
          省界加载失败，请稍后重试。
        </div>
      )}

      {level === "country" && map && provinceBoundaryStatus === "ready" && (
        <ProvinceLayer
          map={map}
          features={provinceFeatures}
          hoveredProvinceId={provinceHover?.provinceId ?? null}
          onProvinceHoverChange={(next) =>
            setProvinceHover((previous) =>
              next ? nextProvinceHoverState(previous, next) : clearProvinceHover(previous),
            )
          }
        />
      )}

      {level === "country" && map && provinceBoundaryStatus === "ready" && (
        <ProvinceTagOverlay
          map={map}
          features={provinceFeatures}
          hoveredProvinceId={provinceHover?.provinceId ?? null}
        />
      )}

      {level === "country" && <ProvinceHoverOverlay hover={provinceHover} />}

      {(level === "province" || level === "city") && map && provinceId && (
        <CityLayer
          map={map}
          provinceId={provinceId}
          onBoundaryWarning={setBoundaryWarning}
        />
      )}

      {level === "city" && map && cityId && (
        <PoiLayer map={map} cityId={cityId} />
      )}

      <BreadCrumbOverlay />

      {level === "city" && addingPoi && !poiDraft && (
        <div className="absolute left-4 top-14 z-20 rounded-md border border-[var(--color-border)] bg-black/70 px-3 py-2 text-xs text-neutral-200 backdrop-blur">
          点击地图选择落点
        </div>
      )}

      <PoiAddModal />
    </div>
  );
}

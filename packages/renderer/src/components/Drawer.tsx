import { useState, useEffect } from "react";
import { useMapStore } from "../features/map/mapStore";
import { CityHome } from "./drawer/CityHome";
import { TripList } from "./drawer/TripList";
import { TripDetail } from "./drawer/TripDetail";
import { PoiDetail } from "./drawer/PoiDetail";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
}

type DrawerView = "city-home" | "trip-list" | "trip-detail" | "poi-detail";

export function Drawer({ open, onClose }: DrawerProps) {
  const level = useMapStore((s) => s.level);
  const provinceName = useMapStore((s) => s.provinceName);
  const cityName = useMapStore((s) => s.cityName);
  const cityId = useMapStore((s) => s.cityId);
  const provinceId = useMapStore((s) => s.provinceId);
  const selectedPoiId = useMapStore((s) => s.selectedPoiId);
  const selectPoi = useMapStore((s) => s.selectPoi);
  const selectedTripId = useMapStore((s) => s.selectedTripId);
  const selectTrip = useMapStore((s) => s.selectTrip);

  const visible = level !== "country" && open;
  
  const [view, setView] = useState<DrawerView>("city-home");
  const [previousView, setPreviousView] = useState<DrawerView>("city-home");

  useEffect(() => {
    if (!open) {
      setView("city-home");
      selectTrip(null);
      selectPoi(null);
    }
  }, [open, cityId, selectPoi, selectTrip]);

  // Handle POI selection from map
  useEffect(() => {
    if (selectedPoiId) {
      setPreviousView(view);
      setView("poi-detail");
    }
  }, [selectedPoiId]);

  return (
    <aside
      className={`
        absolute top-0 right-0 bottom-0 z-30 flex flex-col
        w-[var(--drawer-width)] max-w-full
        border-l border-[var(--color-border)]
        bg-[var(--color-surface)]/80 backdrop-blur-xl
        transition-transform duration-300 ease-out
        ${visible ? "translate-x-0" : "translate-x-full"}
      `}
    >
      {/* 抽屉头部 */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
          <span>{provinceName}</span>
          <span className="text-neutral-700">/</span>
          <span className="font-medium text-white">{cityName ?? "—"}</span>
        </div>
        <div className="flex items-center gap-2">
          {view !== "city-home" && (
            <button
              onClick={() => {
                if (view === "poi-detail") {
                  setView(previousView === "poi-detail" ? "city-home" : previousView);
                  selectPoi(null);
                } else if (view === "trip-detail") {
                  setView("trip-list");
                  selectTrip(null);
                } else {
                  setView("city-home");
                }
              }}
              className="text-xs text-neutral-400 hover:text-white"
            >
              返回
            </button>
          )}
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-[var(--color-surface-elevated)] hover:text-white"
          >
            ✕
          </button>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto">
        {level === "province" && provinceName && (
          <div className="p-5">
            <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 p-4 text-sm text-sky-100">
              <div className="text-base font-semibold">{provinceName}</div>
              <div className="mt-2 text-sm leading-6 text-sky-100/80">
                已进入省级视图。请直接单击地图中的城市边界，右侧会切换为该城市的旅行详情。
              </div>
              <div className="mt-3 rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-xs text-sky-50/80">
                提示：右侧按钮会明确显示“展开详情 / 收起详情”，不用再猜抽屉有没有打开。
              </div>
            </div>
          </div>
        )}
        {level === "city" && cityName && cityId && provinceId && provinceName && (
          <>
            {view === "city-home" && (
              <>
                <CityHome 
                  cityId={cityId}
                  cityName={cityName}
                  provinceId={provinceId}
                  provinceName={provinceName}
                />
                <div className="px-5 pb-5">
                  <button
                    onClick={() => setView("trip-list")}
                    className="w-full rounded-lg bg-[var(--color-accent)] py-2 text-sm font-medium text-white hover:bg-[var(--color-accent)]/90"
                  >
                    查看旅行记录
                  </button>
                </div>
              </>
            )}
            {view === "trip-list" && (
              <TripList 
                cityId={cityId} 
                onSelectTrip={(id) => {
                  selectTrip(id);
                  setView("trip-detail");
                }} 
              />
            )}
            {view === "trip-detail" && selectedTripId && (
              <TripDetail 
                tripId={selectedTripId} 
                onBack={() => {
                  setView("trip-list");
                  selectTrip(null);
                }} 
              />
            )}
            {view === "poi-detail" && selectedPoiId && (
              <PoiDetail
                poiId={selectedPoiId}
                onBack={() => {
                  setView(previousView === "poi-detail" ? "city-home" : previousView);
                  selectPoi(null);
                }}
              />
            )}
          </>
        )}
        {level !== "city" && (
          <div className="flex h-full items-center justify-center text-sm text-neutral-600">
            点击城市查看详情
          </div>
        )}
      </div>
    </aside>
  );
}

import { useState, useEffect, type MouseEvent } from "react";
import { useMapStore } from "../features/map/mapStore";
import { CityHome } from "./drawer/CityHome";
import { TripList } from "./drawer/TripList";
import { TripDetail } from "./drawer/TripDetail";
import { PoiDetail } from "./drawer/PoiDetail";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  onToggle: () => void;
}

type DrawerView = "city-home" | "trip-list" | "trip-detail" | "poi-detail";

export function Drawer({ open, onClose, onToggle }: DrawerProps) {
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
  const showShell = level !== "country";
  
  const [view, setView] = useState<DrawerView>("city-home");
  const [previousView, setPreviousView] = useState<DrawerView>("city-home");

  const handleToggleMouseDown = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onToggle();
  };

  const handleCloseMouseDown = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };

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

  if (!showShell) return null;

  return (
    <div className="absolute top-0 right-0 bottom-0 z-40">
      <button
        onMouseDown={handleToggleMouseDown}
        className="
          absolute top-1/2 z-50 flex -translate-y-1/2 items-center gap-2 rounded-full border border-white/10
          bg-[var(--color-surface)]/90 px-4 py-2 text-xs font-medium text-white shadow-xl backdrop-blur-md
          transition-colors hover:bg-[var(--color-surface-elevated)]
        "
        style={{ right: open ? "calc(var(--drawer-width) + 12px)" : "16px" }}
      >
        <span>{open ? "收起详情" : "展开详情"}</span>
        <span className="text-neutral-400">{open ? ">" : "<"}</span>
      </button>

      <aside
        className={`
          absolute top-0 right-0 bottom-0 flex flex-col
          w-[var(--drawer-width)] max-w-full
          border-l border-white/10
          bg-[var(--color-surface)]/92 shadow-2xl backdrop-blur-xl
          transition-transform duration-300 ease-out
          ${visible ? "translate-x-0" : "translate-x-full"}
        `}
      >
      {/* 抽屉头部 */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/8 px-5 py-4">
        <div className="flex items-center gap-1.5 text-xs text-neutral-400">
          <span>{provinceName}</span>
          <span className="text-neutral-600">/</span>
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
              className="rounded-md px-2 py-1 text-xs text-neutral-300 transition-colors hover:bg-white/6 hover:text-white"
            >
              返回
            </button>
          )}
          <button
            onMouseDown={handleCloseMouseDown}
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-300 transition-colors hover:bg-white/8 hover:text-white"
          >
            ✕
          </button>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto">
        {level === "province" && provinceName && (
          <div className="p-5">
            <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-50">
              <div className="text-base font-semibold">{provinceName}</div>
              <div className="mt-2 text-sm leading-6 text-amber-50/80">
                已进入省级视图。请单击地图中的城市边界或城市标签，右侧会切换为该城市的旅行详情。
              </div>
              <div className="mt-3 rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-xs text-amber-50/80">
                提示：关闭后左侧仍会保留“展开详情”把手，可以随时重新打开。
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
    </div>
  );
}

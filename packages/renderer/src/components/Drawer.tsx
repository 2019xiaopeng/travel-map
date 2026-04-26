import { useState, useEffect } from "react";
import { useMapStore } from "../features/map/mapStore";
import { CityHome } from "./drawer/CityHome";
import { TripList } from "./drawer/TripList";
import { TripDetail } from "./drawer/TripDetail";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
}

type DrawerView = "city-home" | "trip-list" | "trip-detail";

export function Drawer({ open, onClose }: DrawerProps) {
  const level = useMapStore((s) => s.level);
  const provinceName = useMapStore((s) => s.provinceName);
  const cityName = useMapStore((s) => s.cityName);
  const cityId = useMapStore((s) => s.cityId);
  const provinceId = useMapStore((s) => s.provinceId);

  const visible = level !== "country" && open;
  
  const [view, setView] = useState<DrawerView>("city-home");
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setView("city-home");
      setSelectedTripId(null);
    }
  }, [open, cityId]);

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
                if (view === "trip-detail") setView("trip-list");
                else setView("city-home");
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
                  setSelectedTripId(id);
                  setView("trip-detail");
                }} 
              />
            )}
            {view === "trip-detail" && selectedTripId && (
              <TripDetail 
                tripId={selectedTripId} 
                onBack={() => setView("trip-list")} 
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

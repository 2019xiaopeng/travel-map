import { useState, useEffect, useRef, type MouseEvent } from "react";
import { useMapStore } from "../features/map/mapStore";
import { getProvinceCityNames } from "../features/map/provinceCityList.ts";
import { CityHome } from "./drawer/CityHome";
import { ProvinceOverview } from "./drawer/ProvinceOverview";
import { TripList } from "./drawer/TripList";
import { TripDetail } from "./drawer/TripDetail";
import { PoiDetail } from "./drawer/PoiDetail";
import { DRAWER_WIDTH } from "../features/map/mapLayout.js";

interface DrawerProps {
  open: boolean;
  onToggle: () => void;
}

type DrawerView = "city-home" | "city-assets" | "trip-list" | "trip-detail" | "poi-detail";

export function Drawer({ open, onToggle }: DrawerProps) {
  const level = useMapStore((s) => s.level);
  const provinceId = useMapStore((s) => s.provinceId);
  const provinceName = useMapStore((s) => s.provinceName);
  const cityId = useMapStore((s) => s.cityId);
  const cityName = useMapStore((s) => s.cityName);
  const provinceCityFeatures = useMapStore((s) => s.provinceCityFeatures);
  const selectedPoiId = useMapStore((s) => s.selectedPoiId);
  const selectPoi = useMapStore((s) => s.selectPoi);
  const selectedTripId = useMapStore((s) => s.selectedTripId);
  const selectTrip = useMapStore((s) => s.selectTrip);

  const visible = level !== "country" && open;
  const showShell = level !== "country";
  const isProvinceOverview = level === "province" && Boolean(provinceId) && Boolean(provinceName);
  const isCityDetail =
    level === "city" && cityName && cityId && provinceId && provinceName;
  const provinceCityNames = getProvinceCityNames(provinceCityFeatures);

  const [view, setView] = useState<DrawerView>("city-home");
  const [previousView, setPreviousView] = useState<DrawerView>("city-home");
  const suppressToggleClickRef = useRef(false);

  const runButtonAction = (
    event: MouseEvent<HTMLButtonElement>,
    action: () => void,
    source: "mouseDown" | "click",
    suppressRef: { current: boolean },
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (source === "click" && suppressRef.current) {
      suppressRef.current = false;
      return;
    }

    suppressRef.current = source === "mouseDown";
    action();
  };

  const handleToggleMouseDown = (event: MouseEvent<HTMLButtonElement>) =>
    runButtonAction(event, onToggle, "mouseDown", suppressToggleClickRef);

  const handleToggleClick = (event: MouseEvent<HTMLButtonElement>) =>
    runButtonAction(event, onToggle, "click", suppressToggleClickRef);

  useEffect(() => {
    setView("city-home");
    setPreviousView("city-home");
    selectTrip(null);
    selectPoi(null);
  }, [cityId, selectPoi, selectTrip]);

  useEffect(() => {
    if (selectedPoiId) {
      setPreviousView(view);
      setView("poi-detail");
    }
  }, [selectedPoiId, view]);

  if (!showShell) return null;

  return (
    <div className="absolute top-0 right-0 bottom-0 z-40" data-drawer-shell="true">
      <button
        onMouseDown={handleToggleMouseDown}
        onClick={handleToggleClick}
        type="button"
        className="absolute top-1/2 z-50 flex -translate-y-1/2 items-center gap-2 rounded-full border border-white/10 bg-[var(--color-surface)]/90 px-4 py-2 text-xs font-medium text-white shadow-xl backdrop-blur-md transition-colors hover:bg-[var(--color-surface-elevated)]"
        style={{ right: open ? `${DRAWER_WIDTH + 12}px` : "16px" }}
      >
        <span>{open ? "收起侧栏" : "展开侧栏"}</span>
        <span className="text-neutral-400">{open ? ">" : "<"}</span>
      </button>

      <aside
        data-drawer-panel="true"
        className={`absolute top-0 right-0 bottom-0 flex flex-col border-l border-white/10 bg-[var(--color-surface)] shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-out ${visible ? "translate-x-0" : "translate-x-full"}`}
        style={{ width: `${DRAWER_WIDTH}px`, maxWidth: "100vw" }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/8 px-5 py-4">
          <div className="min-w-0">
            {isProvinceOverview ? (
              <>
                <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                  Province
                </div>
                <div className="mt-1 truncate text-base font-semibold text-white">
                  {provinceName}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                <span>{provinceName}</span>
                <span className="text-neutral-600">/</span>
                <span className="truncate font-medium text-white">{cityName ?? "未选择城市"}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isCityDetail && view !== "city-home" && (
              <button
                onClick={() => {
                  if (view === "poi-detail") {
                    setView(previousView === "poi-detail" ? "city-home" : previousView);
                    selectPoi(null);
                  } else if (view === "trip-detail") {
                    setView("trip-list");
                    selectTrip(null);
                  } else if (view === "city-assets") {
                    setView("city-home");
                  } else {
                    setView("city-home");
                  }
                }}
                className="rounded-md px-2 py-1 text-xs text-neutral-300 transition-colors hover:bg-white/6 hover:text-white"
              >
                返回
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isProvinceOverview && provinceName && provinceId && (
            <ProvinceOverview
              provinceId={provinceId}
              provinceName={provinceName}
              cityNames={provinceCityNames}
            />
          )}

          {isCityDetail && (
            <>
              {view === "city-home" && (
                <CityHome
                  cityId={cityId}
                  cityName={cityName}
                  provinceId={provinceId}
                  provinceName={provinceName}
                  onOpenTrips={() => setView("trip-list")}
                  onOpenAssets={() => setView("city-assets")}
                />
              )}
              {view === "city-assets" && (
                <div className="p-5 text-sm text-neutral-400 animate-fade-in-up">
                  本地资料页下一步接入。
                </div>
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

          {!isProvinceOverview && !isCityDetail && (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-neutral-500">
              暂无可展示内容，请先从地图中选择省份或城市。
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

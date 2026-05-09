import { useState } from "react";

import { CitySearchBox } from "./CitySearchBox";
import { openCityExperience } from "./cityExperience.ts";
import { useMapStore } from "./mapStore";

export function BreadCrumbOverlay({
  map,
}: {
  map: any | null;
}) {
  const level = useMapStore((s) => s.level);
  const provinceName = useMapStore((s) => s.provinceName);
  const cityName = useMapStore((s) => s.cityName);
  const backToCountry = useMapStore((s) => s.backToCountry);
  const backToProvince = useMapStore((s) => s.backToProvince);
  const addingPoi = useMapStore((s) => s.addingPoi);
  const poiDraft = useMapStore((s) => s.poiDraft);
  const startAddPoi = useMapStore((s) => s.startAddPoi);
  const cancelAddPoi = useMapStore((s) => s.cancelAddPoi);
  const [searchOpen, setSearchOpen] = useState(false);
  const instruction =
    level === "country"
      ? "单击省份进入省级"
      : level === "province"
        ? "单击城市打开详情"
        : addingPoi
          ? "单击地图选择地标位置"
          : "单击右侧把手展开或收起侧栏";

  return (
    <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 text-xs">
      <div className="flex items-center gap-2">
        <div
          className="
            flex items-center gap-1.5 rounded-lg border border-[var(--color-border)]
            bg-[var(--color-surface)]/76 px-3 py-2 backdrop-blur-md
          "
        >
          <div className="flex items-center gap-1.5">
            {level === "country" ? (
              <span className="text-white font-medium">中国</span>
            ) : (
              <button
                onClick={backToCountry}
                className="text-neutral-400 transition-colors hover:text-white"
              >
                中国
              </button>
            )}

            {level === "province" && (
              <>
                <span className="text-neutral-600">/</span>
                <span className="font-medium text-amber-300">{provinceName}</span>
              </>
            )}

            {level === "city" && (
              <>
                <span className="text-neutral-600">/</span>
                <button
                  onClick={backToProvince}
                  className="text-amber-300 transition-colors hover:text-amber-200"
                >
                  {provinceName}
                </button>
                <span className="text-neutral-600">/</span>
                <span className="font-medium text-sky-300">{cityName}</span>
              </>
            )}
          </div>

          {level === "city" && !poiDraft && (
            <button
              onClick={addingPoi ? cancelAddPoi : startAddPoi}
              className={`ml-2 rounded border border-[var(--color-border)] px-2 py-1 text-[10px] transition-colors ${
                addingPoi
                  ? "bg-red-500/15 text-red-300 hover:bg-red-500/20"
                  : "bg-[var(--color-accent)]/15 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20"
              }`}
            >
              {addingPoi ? "取消添加" : "添加地标"}
            </button>
          )}
        </div>

        <button
          type="button"
          onMouseDown={(event) => {
            event.preventDefault();
            setSearchOpen((current) => !current);
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/45 text-neutral-200 backdrop-blur-md transition-colors hover:bg-black/60 hover:text-white"
          aria-label="搜索城市"
        >
          <svg
            viewBox="0 0 20 20"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="8.5" cy="8.5" r="4.75" />
            <path d="M12.2 12.2L16 16" />
          </svg>
        </button>

        <CitySearchBox
          open={searchOpen}
          onSelect={(entry) => {
            if (!map) return;
            openCityExperience(map, entry);
            setSearchOpen(false);
          }}
        />
      </div>

      <div className="rounded-lg border border-white/8 bg-black/45 px-3 py-2 text-[11px] text-neutral-200 backdrop-blur-md">
        {instruction}
      </div>
    </div>
  );
}

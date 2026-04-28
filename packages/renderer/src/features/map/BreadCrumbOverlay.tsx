import { useMapStore } from "./mapStore";

export function BreadCrumbOverlay() {
  const level = useMapStore((s) => s.level);
  const provinceName = useMapStore((s) => s.provinceName);
  const cityName = useMapStore((s) => s.cityName);
  const backToCountry = useMapStore((s) => s.backToCountry);
  const backToProvince = useMapStore((s) => s.backToProvince);
  const addingPoi = useMapStore((s) => s.addingPoi);
  const poiDraft = useMapStore((s) => s.poiDraft);
  const startAddPoi = useMapStore((s) => s.startAddPoi);
  const cancelAddPoi = useMapStore((s) => s.cancelAddPoi);

  return (
    <div
      className="
        absolute top-4 left-4 z-10
        flex items-center gap-1.5 rounded-lg
        border border-[var(--color-border)] bg-[var(--color-surface)]/70
        px-3 py-2 backdrop-blur-md text-xs
      "
    >
      <div className="flex items-center gap-1.5">
        {level === "country" ? (
          <span className="text-white font-medium">中国</span>
        ) : (
          <button
            onClick={backToCountry}
            className="text-neutral-500 transition-colors hover:text-white"
          >
            中国
          </button>
        )}

        {level === "province" && (
          <>
            <span className="text-neutral-700">/</span>
            <span className="text-white font-medium">{provinceName}</span>
          </>
        )}

        {level === "city" && (
          <>
            <span className="text-neutral-700">/</span>
            <button
              onClick={backToProvince}
              className="text-neutral-500 transition-colors hover:text-white"
            >
              {provinceName}
            </button>
            <span className="text-neutral-700">/</span>
            <span className="text-white font-medium">{cityName}</span>
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
  );
}

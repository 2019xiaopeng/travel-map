import { useMapStore } from "./mapStore";

export function BreadCrumbOverlay() {
  const level = useMapStore((s) => s.level);
  const provinceName = useMapStore((s) => s.provinceName);
  const cityName = useMapStore((s) => s.cityName);
  const backToCountry = useMapStore((s) => s.backToCountry);
  const backToProvince = useMapStore((s) => s.backToProvince);

  if (level === "country") return null;

  return (
    <div
      className="
        absolute top-4 left-4 z-10
        flex items-center gap-1.5 rounded-lg
        border border-[var(--color-border)] bg-[var(--color-surface)]/70
        px-3 py-2 backdrop-blur-md text-xs
      "
    >
      <button
        onClick={backToCountry}
        className="text-neutral-500 transition-colors hover:text-white"
      >
        全国
      </button>

      {level === "province" && (
        <span className="text-white font-medium">{provinceName}</span>
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
  );
}

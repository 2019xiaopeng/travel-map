import type { ProvinceHoverState } from "./provinceHoverState";

export function ProvinceHoverOverlay({
  hover,
}: {
  hover: ProvinceHoverState | null;
}) {
  if (!hover) return null;

  return (
    <div
      className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-full rounded-full border border-white/10 bg-[rgba(8,16,24,0.92)] px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-black/30"
      style={{ left: hover.x, top: hover.y - 10 }}
    >
      {hover.provinceName}
    </div>
  );
}

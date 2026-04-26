import { useMapStore } from "../features/map/mapStore";
import { CityHome } from "./drawer/CityHome";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
}

export function Drawer({ open, onClose }: DrawerProps) {
  const level = useMapStore((s) => s.level);
  const provinceName = useMapStore((s) => s.provinceName);
  const cityName = useMapStore((s) => s.cityName);

  const visible = level !== "country" && open;

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
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-[var(--color-surface-elevated)] hover:text-white"
        >
          ✕
        </button>
      </div>

      {/* 内容区：当前只显示城市主页 */}
      <div className="flex-1 overflow-y-auto">
        {level === "city" && cityName && (
          <CityHome cityName={cityName} />
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

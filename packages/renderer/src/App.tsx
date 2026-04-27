import { Drawer } from "./components/Drawer";
import { MapView } from "./features/map/MapView";
import { useMapStore } from "./features/map/mapStore";

export default function App() {
  const drawerOpen = useMapStore((s) => s.drawerOpen);
  const setDrawerOpen = useMapStore((s) => s.setDrawerOpen);
  const level = useMapStore((s) => s.level);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[var(--color-bg)]">
      {/* 地图底层 */}
      <MapView />

      {/* 顶栏浮层 */}
      <header className="absolute top-0 right-0 left-0 z-20 flex items-center justify-between px-4 py-2 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <span className="text-sm font-medium text-neutral-400">旅行地图</span>
        </div>
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => {
              if (level !== "country") setDrawerOpen(!drawerOpen);
            }}
            disabled={level === "country"}
            className="
              flex h-8 items-center gap-1.5 rounded-md border border-[var(--color-border)]
              bg-[var(--color-surface)]/80 px-3 text-xs text-neutral-300 backdrop-blur-md
              transition-colors hover:bg-[var(--color-surface-elevated)] hover:text-white
              disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[var(--color-surface)]/80
            "
          >
            {drawerOpen ? "收起" : "展开"}
          </button>
        </div>
      </header>

      {/* 右侧抽屉 */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}

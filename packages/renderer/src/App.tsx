import { Drawer } from "./components/Drawer";
import { MapView } from "./features/map/MapView";
import { useMapStore } from "./features/map/mapStore";
import { DialogHost } from "./ui/DialogHost";
import { ToastViewport } from "./ui/ToastViewport";

export default function App() {
  const drawerOpen = useMapStore((s) => s.drawerOpen);
  const setDrawerOpen = useMapStore((s) => s.setDrawerOpen);
  const level = useMapStore((s) => s.level);
  const drawerToggleLabel = drawerOpen ? "收起详情" : "展开详情";

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[var(--color-bg)]">
      {/* 地图底层 */}
      <MapView />

      {/* 顶栏浮层 */}
      <header className="absolute top-0 right-0 left-0 z-20 flex items-center justify-between px-4 py-2 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <span className="text-sm font-medium text-neutral-300">旅行地图</span>
        </div>
      </header>

      {level !== "country" && (
        <div className="pointer-events-none absolute top-1/2 right-4 z-40 -translate-y-1/2">
          <button
            onClick={() => setDrawerOpen(!drawerOpen)}
            className="
              pointer-events-auto flex items-center gap-2 rounded-full border border-[var(--color-border)]
              bg-[var(--color-surface)]/88 px-4 py-2 text-xs font-medium text-white shadow-lg backdrop-blur-md
              transition-colors hover:bg-[var(--color-surface-elevated)]
            "
          >
            <span>{drawerToggleLabel}</span>
            <span className="text-neutral-400">{drawerOpen ? ">" : "<"}</span>
          </button>
        </div>
      )}

      {/* 右侧抽屉 */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <DialogHost />
      <ToastViewport />
    </div>
  );
}

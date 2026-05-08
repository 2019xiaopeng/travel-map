import { useEffect } from "react";
import { Drawer } from "./components/Drawer";
import { MapView } from "./features/map/MapView";
import { useMapStore } from "./features/map/mapStore";
import { DialogHost } from "./ui/DialogHost";
import { ToastViewport } from "./ui/ToastViewport";

export default function App() {
  const drawerOpen = useMapStore((s) => s.drawerOpen);
  const setDrawerOpen = useMapStore((s) => s.setDrawerOpen);
  const level = useMapStore((s) => s.level);
  const toggleDrawer = () => setDrawerOpen(!drawerOpen);
  const closeDrawer = () => setDrawerOpen(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawerOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setDrawerOpen]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[var(--color-bg)]">
      {/* 地图底层 */}
      <MapView />

      {/* 顶栏浮层 */}
      {level !== "country" && (
        <header className="absolute top-4 right-4 z-50 flex items-center gap-2">
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleDrawer();
            }}
            className="
              rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-xs text-neutral-200
              backdrop-blur-md transition-colors hover:bg-black/60 hover:text-white
            "
          >
            {drawerOpen ? "收起详情" : "展开详情"}
          </button>
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              closeDrawer();
            }}
            className="
              rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-xs text-neutral-200
              backdrop-blur-md transition-colors hover:bg-black/60 hover:text-white
            "
          >
            关闭抽屉
          </button>
        </header>
      )}

      {/* 右侧抽屉 */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onToggle={() => setDrawerOpen(!drawerOpen)}
      />

      <DialogHost />
      <ToastViewport />
    </div>
  );
}

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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawerOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setDrawerOpen]);

  useEffect(() => {
    if (level !== "province" || !drawerOpen) return;

    const frameId = window.requestAnimationFrame(() => {
      const shell = document.querySelector("[data-drawer-shell='true']");
      if (!shell) {
        console.warn("Drawer shell missing after province entry; forcing open state");
        setDrawerOpen(true);
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [drawerOpen, level, setDrawerOpen]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[var(--color-bg)]">
      <MapView />
      <Drawer
        open={drawerOpen}
        onToggle={() => setDrawerOpen(!drawerOpen)}
      />

      <DialogHost />
      <ToastViewport />
    </div>
  );
}

import { useState } from "react";
import { Drawer } from "./components/Drawer";

export default function App() {
  const [drawerOpen, setDrawerOpen] = useState(true);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[var(--color-bg)]">
      {/* 地图占位区 */}
      <div className="absolute inset-0 flex items-center justify-center text-neutral-600 select-none">
        <span className="text-sm tracking-wider">MAP PLACEHOLDER</span>
      </div>

 {/* 顶栏 */}
      <header className="absolute top-0 right-0 left-0 z-20 flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-400">旅行地图</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDrawerOpen((v) => !v)}
            className="
              flex h-8 items-center gap-1.5 rounded-md border border-[var(--color-border)]
              bg-[var(--color-surface)] px-3 text-xs text-neutral-300
              transition-colors hover:bg-[var(--color-surface-elevated)] hover:text-white
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

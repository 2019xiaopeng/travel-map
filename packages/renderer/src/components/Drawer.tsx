import { useState } from "react";
import { CityHome } from "./drawer/CityHome";
import { TripList } from "./drawer/TripList";
import { TripDetail } from "./drawer/TripDetail";

type DrawerView = "city" | "tripList" | "tripDetail";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
}

export function Drawer({ open, onClose }: DrawerProps) {
  const [view, setView] = useState<DrawerView>("city");

  return (
    <aside
      className={`
        absolute top-0 right-0 bottom-0 z-30 flex flex-col
        w-[var(--drawer-width)] max-w-full
        border-l border-[var(--color-border)]
        bg-[var(--color-surface)]/80 backdrop-blur-xl
        transition-transform duration-300 ease-out
        ${open ? "translate-x-0" : "translate-x-full"}
      `}
    >
      {/* 抽屉头部 */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
        <Breadcrumbs view={view} onNavigate={setView} />
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-[var(--color-surface-elevated)] hover:text-white"
        >
          ✕
        </button>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto">
        {view === "city" && (
          <CityHome onShowTrips={() => setView("tripList")} />
        )}
        {view === "tripList" && (
          <TripList onBack={() => setView("city")} onSelectTrip={() => setView("tripDetail")} />
        )}
        {view === "tripDetail" && (
          <TripDetail onBack={() => setView("tripList")} />
        )}
      </div>
    </aside>
  );
}

function Breadcrumbs({
  view,
  onNavigate,
}: {
  view: DrawerView;
  onNavigate: (v: DrawerView) => void;
}) {
  const items: { key: DrawerView; label: string }[] = [
    { key: "city", label: "杭州市" },
    { key: "tripList", label: "旅行记录" },
    { key: "tripDetail", label: "清明3日" },
  ];

  const activeIdx = items.findIndex((i) => i.key === view);

  return (
    <nav className="flex items-center gap-1 text-xs text-neutral-500">
      {items.map((item, idx) => (
        <span key={item.key} className="flex items-center gap-1">
          {idx > 0 && <span className="text-neutral-700">/</span>}
          {idx <= activeIdx ? (
            <button
              onClick={() => onNavigate(item.key)}
              className={`transition-colors hover:text-white ${
                idx === activeIdx ? "text-white font-medium" : ""
              }`}
            >
              {item.label}
            </button>
          ) : (
            <span className="text-neutral-700">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

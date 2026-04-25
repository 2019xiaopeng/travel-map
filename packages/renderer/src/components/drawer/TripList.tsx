interface TripListProps {
  onBack: () => void;
  onSelectTrip: () => void;
}

const MOCK_TRIPS = [
  { id: "1", title: "清明3日", period: "2026-04-04 ~ 04-06", status: "completed" },
  { id: "2", title: "元旦跨年", period: "2025-12-30 ~ 2026-01-01", status: "completed" },
  { id: "3", title: "西湖骑行", period: "2026-03-15", status: "completed" },
];

export function TripList({ onSelectTrip }: TripListProps) {
  return (
    <div className="p-5 space-y-3">
      <h3 className="text-sm font-medium text-neutral-400">旅行记录</h3>

      <div className="space-y-2">
        {MOCK_TRIPS.map((trip) => (
          <button
            key={trip.id}
            onClick={onSelectTrip}
            className="
              w-full rounded-lg border border-[var(--color-border)]
              bg-[var(--color-surface-elevated)]/40 p-4 text-left
              transition-colors hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface-elevated)]
            "
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white">{trip.title}</span>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-400">
                {trip.status === "completed" ? "已完成" : "计划中"}
              </span>
            </div>
            <div className="mt-1 text-xs text-neutral-500">{trip.period}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

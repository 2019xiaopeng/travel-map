interface CityHomeProps {
  onShowTrips: () => void;
}

export function CityHome({ onShowTrips }: CityHomeProps) {
  return (
    <div className="p-5 space-y-5">
      {/* 封面占位 */}
      <div className="aspect-[16/9] w-full rounded-lg bg-[var(--color-surface-elevated)] flex items-center justify-center text-neutral-600 text-xs">
        封面图片
      </div>

      {/* 城市名称 & 简介 */}
      <div>
        <h2 className="text-lg font-semibold text-white">杭州市</h2>
        <p className="mt-1 text-sm text-neutral-400 leading-relaxed">
          浙江省省会，以西湖闻名的历史文化名城。
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="旅行次数" value="3" />
        <StatCard label="POI 收藏" value="12" />
        <StatCard label="总花费" value="¥4,280" />
      </div>

      {/* 进入旅行列表 */}
      <button
        onClick={onShowTrips}
        className="
          w-full rounded-lg border border-[var(--color-border)]
          bg-[var(--color-surface-elevated)] px-4 py-3
          text-sm font-medium text-white
          transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)]/10
        "
      >
        查看旅行记录 →
      </button>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/50 p-3 text-center">
      <div className="text-base font-semibold text-[var(--color-accent)]">{value}</div>
      <div className="mt-0.5 text-[11px] text-neutral-500">{label}</div>
    </div>
  );
}

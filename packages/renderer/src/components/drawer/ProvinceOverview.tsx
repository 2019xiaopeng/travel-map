interface ProvinceOverviewProps {
  provinceName: string;
}

export function ProvinceOverview({ provinceName }: ProvinceOverviewProps) {
  return (
    <section className="flex h-full flex-col gap-4 p-5">
      <div className="rounded-2xl border border-white/10 bg-white/4 p-5 shadow-[0_12px_36px_rgba(0,0,0,0.22)]">
        <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
          Province Overview
        </div>
        <div className="mt-3 text-2xl font-semibold text-white">{provinceName}</div>
        <div className="mt-3 text-sm leading-6 text-neutral-300">
          当前处于省级视图。单击地图中的城市边界或城市标签，右侧会切换到该城市的详细信息与旅行内容。
        </div>
      </div>

      <div className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-neutral-300">
        侧栏在省级视图中保持轻量，用来展示当前省份上下文和下一步操作提示；进入城市后会自动切换为完整详情侧栏。
      </div>

      <div className="rounded-2xl border border-white/8 bg-black/15 p-4 text-xs leading-6 text-neutral-400">
        如果当前省份缺少真实城市边界数据，地图会显示提示信息，而不会使用伪造的矩形区域替代。
      </div>
    </section>
  );
}

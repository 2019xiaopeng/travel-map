import { getProvinceDetailCard } from "../../features/map/provinceDetailData.ts";

interface ProvinceOverviewProps {
  provinceId: string;
  provinceName: string;
  cityNames: string[];
}

export function ProvinceOverview({
  provinceId,
  provinceName,
  cityNames,
}: ProvinceOverviewProps) {
  const detail = getProvinceDetailCard(provinceId);

  return (
    <section className="flex h-full flex-col gap-4 p-5">
      <div className="rounded-2xl border border-white/10 bg-white/4 p-5 shadow-[0_12px_36px_rgba(0,0,0,0.22)]">
        <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
          Province Overview
        </div>
        <div className="mt-3 text-2xl font-semibold text-white">{provinceName}</div>
        <div className="mt-3 text-sm leading-6 text-neutral-300">
          当前处于省级视图。单击地图中的城市边界即可进入城市层级，右侧会切换到对应城市的详细信息与旅行内容。
        </div>
      </div>

      <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
        <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
          Cities
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {cityNames.length > 0 ? (
            cityNames.map((name) => (
              <span
                key={name}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-200"
              >
                {name}
              </span>
            ))
          ) : (
            <span className="text-sm text-neutral-400">当前暂无城市列表数据</span>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/8 bg-black/15">
        {detail.imageSrc ? (
          <img
            src={detail.imageSrc}
            alt={detail.imageAlt}
            className="h-44 w-full object-cover"
          />
        ) : (
          <div className="flex h-44 items-center justify-center bg-white/5 text-sm text-neutral-400">
            暂无省会图片
          </div>
        )}
        <div className="p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
            Capital
          </div>
          <div className="mt-2 text-lg font-semibold text-white">
            {detail.capitalName}
          </div>
          <div className="mt-2 text-xs leading-6 text-neutral-400">
            若当前省份缺少完整城市边界，地图会显示提示信息，但省级概览与进入城市的主流程仍然可用。
          </div>
        </div>
      </div>
    </section>
  );
}

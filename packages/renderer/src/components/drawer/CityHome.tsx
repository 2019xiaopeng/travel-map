import { useEffect, useState } from "react";
import { db } from "../../services/db";

interface CityHomeProps {
  cityId: string;
  cityName: string;
  provinceId: string;
  provinceName: string;
}

export function CityHome({ cityId, cityName, provinceId, provinceName }: CityHomeProps) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let active = true;
    db.getCity(cityId, provinceId, cityName, provinceName).then((res) => {
      if (active) setData(res);
    });
    return () => {
      active = false;
    };
  }, [cityId, cityName, provinceId, provinceName]);

  return (
    <div className="p-5 space-y-5">
      {/* 封面占位 */}
      <div className="aspect-[16/9] w-full rounded-lg bg-[var(--color-surface-elevated)] flex items-center justify-center text-neutral-600 text-xs">
        封面图片
      </div>

      {/* 城市名称 & 简介 */}
      <div>
        <h2 className="text-lg font-semibold text-white">{cityName}</h2>
        <p className="mt-1 text-sm text-neutral-400 leading-relaxed">
          {data?.summary || "城市简介待编辑…"}
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="旅行次数" value={data?.tripCount?.toString() || "0"} />
        <StatCard label="POI 收藏" value={data?.poiCount?.toString() || "0"} />
        <StatCard label="总花费" value={data?.totalCost ? `¥${data.totalCost}` : "—"} />
      </div>
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

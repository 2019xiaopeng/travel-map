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
    <div className="p-5 space-y-5 animate-fade-in-up">
      {/* 封面占位 */}
      <div 
        className="aspect-[16/9] w-full rounded-lg bg-[var(--color-surface-elevated)] flex items-center justify-center text-neutral-600 text-xs overflow-hidden cursor-pointer group relative border border-[var(--color-border)]"
        onClick={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.onchange = async (e: any) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const path = (file as any).path;
            if (!path) return;

            const destDir = `cities/${cityId}-${cityName}/cover`;
            try {
              const res = await window.travelMap.file.saveAsset(path, destDir);
              if (res.assetId) {
                await window.travelMap.db.updateCityCover({ cityId, assetId: res.assetId });
                // Refresh data
                const updatedCity = await db.getCity(cityId, provinceId, cityName, provinceName);
                setData(updatedCity);
              }
            } catch (err) {
              console.error("上传城市封面失败", err);
            }
          };
          input.click();
        }}
      >
        {data?.cover_path || data?.cover_remote ? (
          <img 
            src={data.cover_remote || `local:///${data.cover_path}`} 
            alt="City Cover" 
            className="w-full h-full object-cover transition-transform group-hover:scale-105" 
          />
        ) : (
          <span>点击上传城市封面</span>
        )}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <span className="text-white text-sm font-medium">更换封面</span>
        </div>
      </div>

      {/* 城市名称 & 简介 */}
      <div>
        <h2 className="text-lg font-semibold text-white">{cityName}</h2>
        <textarea 
          className="mt-1 text-sm text-neutral-400 leading-relaxed w-full bg-transparent border-none outline-none resize-none focus:ring-1 focus:ring-[var(--color-border)] rounded px-1 -ml-1"
          placeholder="城市简介待编辑…"
          defaultValue={data?.summary || ""}
          onBlur={async (e) => {
            if (e.target.value !== data?.summary) {
              const updated = { ...data, summary: e.target.value };
              // Use specific IPC call instead of direct db.run to maintain security boundary
              await window.travelMap.db.updateCitySummary({ cityId, summary: e.target.value });
              setData(updated);
            }
          }}
          rows={3}
        />
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

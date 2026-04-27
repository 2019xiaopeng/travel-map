import { useEffect, useState } from "react";
import { db } from "../../services/db";

interface PoiDetailProps {
  poiId: string;
  onBack: () => void;
}

export function PoiDetail({ poiId, onBack }: PoiDetailProps) {
  const [poi, setPoi] = useState<any>(null);
  const [trips, setTrips] = useState<any[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [nextPoi, nextTrips, nextTags] = await Promise.all([
        db.getPoi(poiId),
        db.getTripsForPoi(poiId),
        db.getTags("poi", poiId),
      ]);
      if (cancelled) return;
      setPoi(nextPoi);
      setTrips(nextTrips);
      setTags(nextTags);
    })();
    return () => {
      cancelled = true;
    };
  }, [poiId]);

  if (!poi) return <div className="p-5 text-neutral-500">加载中...</div>;

  const handleChange = async (field: string, value: any) => {
    const updated = { ...poi, [field]: value };
    setPoi(updated);
    await db.updatePoi(updated);
    window.dispatchEvent(new Event('poi-added')); // Refresh map markers
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--color-surface)]">
      <div className="p-5 space-y-5 animate-fade-in-up">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-white">{poi.name}</h2>
          <button 
            onClick={async () => {
              if (confirm("确定删除此地点吗？")) {
                await db.deletePoi(poiId);
                window.dispatchEvent(new Event('poi-added'));
                onBack();
              }
            }}
            className="text-xs text-red-500 hover:text-red-400"
          >
            删除
          </button>
        </div>

        <div>
          <div className="mb-1 text-[11px] text-neutral-500">类别</div>
          <input
            type="text"
            value={poi.category || ""}
            onChange={(e) => handleChange("category", e.target.value)}
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[var(--color-accent)]"
            placeholder="例如: 餐饮, 景点..."
          />
        </div>

        <div>
          <div className="mb-1 text-[11px] text-neutral-500">简介</div>
          <textarea
            value={poi.summary || ""}
            onChange={(e) => handleChange("summary", e.target.value)}
            className="w-full h-24 resize-none rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[var(--color-accent)]"
            placeholder="写点关于这个地点的备注..."
          />
        </div>

        <div className="pt-2 border-t border-[var(--color-border)]">
          <div className="flex justify-between items-center mb-2">
            <div className="text-[11px] text-neutral-500">标签</div>
            <button 
              onClick={async () => {
                const tag = prompt("输入新标签:");
                if (tag) {
                  await db.addTag("poi", poiId, tag);
                  const nextTags = await db.getTags("poi", poiId);
                  setTags(nextTags);
                }
              }}
              className="text-[10px] text-[var(--color-accent)] hover:text-white"
            >
              + 添加
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t, idx) => (
              <span 
                key={idx} 
                className="group relative flex items-center rounded bg-[var(--color-surface-elevated)] px-1.5 py-0.5 text-[10px] text-neutral-300"
              >
                #{t}
                <button 
                  onClick={async () => {
                    await db.removeTag("poi", poiId, t);
                    const nextTags = await db.getTags("poi", poiId);
                    setTags(nextTags);
                  }}
                  className="ml-1 hidden text-red-400 hover:text-red-300 group-hover:inline-block"
                >
                  ×
                </button>
              </span>
            ))}
            {tags.length === 0 && <span className="text-[10px] text-neutral-600">暂无标签</span>}
          </div>
        </div>

        <div className="pt-2 border-t border-[var(--color-border)]">
          <div className="text-[11px] text-neutral-500 mb-2">相关的旅行记录 ({trips.length})</div>
          {trips.length > 0 ? (
            <ul className="space-y-2">
              {trips.map(t => (
                <li key={t.trip_id} className="text-xs text-neutral-300 bg-[var(--color-surface-elevated)]/50 p-2 rounded">
                  {t.title} <span className="text-[10px] text-neutral-500 ml-2">{t.date_start}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-xs text-neutral-600">无相关旅行</div>
          )}
        </div>
      </div>
    </div>
  );
}

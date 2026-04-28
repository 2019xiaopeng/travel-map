import { useMemo, useState } from "react";
import { db } from "../../services/db";
import { useMapStore } from "./mapStore";

export function PoiAddModal() {
  const cityId = useMapStore((s) => s.cityId);
  const selectedTripId = useMapStore((s) => s.selectedTripId);
  const draft = useMapStore((s) => s.poiDraft);
  const close = useMapStore((s) => s.closePoiDraft);
  const selectPoi = useMapStore((s) => s.selectPoi);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [summary, setSummary] = useState("");
  const [saving, setSaving] = useState(false);

  const title = useMemo(() => {
    if (!selectedTripId) return "添加地点";
    return "添加地点到当前行程";
  }, [selectedTripId]);

  if (!draft || !cityId) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[360px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-white">{title}</div>
          <button
            onClick={() => close()}
            className="rounded px-2 py-1 text-xs text-neutral-400 hover:text-white"
            disabled={saving}
          >
            ×
          </button>
        </div>

        <div className="mt-3 space-y-3">
          <div>
            <div className="mb-1 text-[11px] text-neutral-500">名称</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[var(--color-accent)]"
              placeholder="例如：西湖断桥"
              autoFocus
            />
          </div>

          <div>
            <div className="mb-1 text-[11px] text-neutral-500">分类（可选）</div>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[var(--color-accent)]"
              placeholder="例如：餐饮 / 景点 / 住宿"
            />
          </div>

          <div>
            <div className="mb-1 text-[11px] text-neutral-500">简介（可选）</div>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="h-20 w-full resize-none rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[var(--color-accent)]"
              placeholder="写点备注..."
            />
          </div>

          <div className="text-[11px] text-neutral-500">
            坐标：{draft.lng.toFixed(6)},{draft.lat.toFixed(6)}
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => close()}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-1.5 text-xs text-neutral-300 hover:text-white"
            disabled={saving}
          >
            取消
          </button>
          <button
            onClick={async () => {
              const trimmed = name.trim();
              if (!trimmed) return;
              setSaving(true);
              try {
                const poiId = await db.createPoi({
                  city_id: cityId,
                  trip_id: selectedTripId,
                  name: trimmed,
                  category: category.trim(),
                  summary: summary.trim(),
                  lng: draft.lng,
                  lat: draft.lat,
                  gcj02_lng: draft.gcj02_lng,
                  gcj02_lat: draft.gcj02_lat,
                });
                close();
                selectPoi(poiId);
                window.dispatchEvent(new Event("poi-added"));
              } catch (err) {
                console.error("Failed to create POI:", err);
                alert("添加失败");
              } finally {
                setSaving(false);
              }
            }}
            className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-accent)]/90 disabled:opacity-60"
            disabled={saving}
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}


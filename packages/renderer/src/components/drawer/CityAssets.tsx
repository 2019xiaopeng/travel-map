import { useEffect, useMemo, useState } from "react";

import { db } from "../../services/db";
import { ui } from "../../services/ui";
import type { CityAsset } from "../../types";
import { getCityAssetPreviewKind, localPathToLocalUrl } from "./cityAssetsPreview";

interface CityAssetsProps {
  cityId: string;
}

export function CityAssets({ cityId }: CityAssetsProps) {
  const [items, setItems] = useState<CityAsset[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [textPreview, setTextPreview] = useState<string>("");

  const loadItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = (await db.getCityAssets(cityId)) as CityAsset[];
      setItems(rows);
      setSelectedId((current) => current && rows.some((row) => row.asset_id === current) ? current : (rows[0]?.asset_id ?? null));
    } catch (err) {
      console.error("Failed to load city assets:", err);
      setError("本地资料加载失败，请重试。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadItems();
  }, [cityId]);

  const selected = useMemo(
    () => items.find((item) => item.asset_id === selectedId) ?? null,
    [items, selectedId],
  );

  const groupedItems = useMemo(() => {
    const groups = new Map<string, { tripTitle: string; items: CityAsset[] }>();
    for (const item of items) {
      const group = groups.get(item.trip_id);
      if (group) {
        group.items.push(item);
      } else {
        groups.set(item.trip_id, {
          tripTitle: item.trip_title,
          items: [item],
        });
      }
    }
    return Array.from(groups.entries()).map(([tripId, group]) => ({
      tripId,
      tripTitle: group.tripTitle,
      items: group.items,
    }));
  }, [items]);

  useEffect(() => {
    let cancelled = false;

    const loadTextPreview = async () => {
      if (!selected) {
        setTextPreview("");
        return;
      }

      const kind = getCityAssetPreviewKind(selected);
      if (kind !== "text") {
        setTextPreview("");
        return;
      }

      const res = await window.travelMap.file.readLocalText(selected.local_path);
      if (cancelled) return;
      setTextPreview(res.ok ? res.text : "无法预览此文本文件，可用系统打开。");
    };

    void loadTextPreview();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const openSelectedExternally = async (asset: CityAsset) => {
    const res = await window.travelMap.file.openLocal(asset.local_path);
    if (res?.error) {
      ui.toast.error(res.error);
    }
  };

  if (loading) {
    return <div className="p-5 text-sm text-neutral-400 animate-fade-in-up">正在加载本地资料...</div>;
  }

  if (error) {
    return (
      <div className="p-5 space-y-4 animate-fade-in-up">
        <p className="text-sm text-neutral-400">{error}</p>
        <button
          onClick={() => void loadItems()}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent)]/90"
        >
          重试
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="p-5 animate-fade-in-up">
        <div className="flex h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] text-center">
          <span className="mb-2 text-2xl">📁</span>
          <p className="text-sm text-neutral-400">这个城市还没有附件或正文图片。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 animate-fade-in-up">
      <div className="w-[240px] shrink-0 overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-surface-elevated)]/20">
        {groupedItems.map((group) => (
          <section key={group.tripId} className="border-b border-[var(--color-border)]/60">
            <div className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">
              {group.tripTitle}
            </div>
            {group.items.map((item) => {
              const active = item.asset_id === selectedId;
              const previewKind = getCityAssetPreviewKind(item);
              return (
                <button
                  key={item.asset_id}
                  onClick={() => setSelectedId(item.asset_id)}
                  className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors ${
                    active ? "bg-white/8" : "hover:bg-white/5"
                  }`}
                >
                  <span className="truncate text-sm text-white">{item.original_filename}</span>
                  <span className="text-[11px] text-neutral-500">
                    {item.source_kind === "attachment" ? "附件" : "正文图片"} · {previewKind}
                  </span>
                </button>
              );
            })}
          </section>
        ))}
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-4">
        {selected ? (
          <>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-white">{selected.original_filename}</h3>
                <p className="mt-1 text-xs text-neutral-500">
                  {selected.trip_title} · {selected.source_kind === "attachment" ? "附件" : "正文图片"}
                </p>
              </div>
              <button
                onClick={() => void openSelectedExternally(selected)}
                className="shrink-0 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-white hover:bg-white/5"
              >
                用系统打开
              </button>
            </div>

            {getCityAssetPreviewKind(selected) === "image" && (
              <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-[var(--color-border)] bg-black/20 p-3">
                <img
                  src={localPathToLocalUrl(selected.local_path)}
                  alt={selected.original_filename}
                  className="max-h-[65vh] max-w-full rounded-lg object-contain"
                />
              </div>
            )}

            {getCityAssetPreviewKind(selected) === "pdf" && (
              <iframe
                title={selected.original_filename}
                src={localPathToLocalUrl(selected.local_path)}
                className="min-h-[65vh] w-full rounded-2xl border border-[var(--color-border)] bg-white"
              />
            )}

            {getCityAssetPreviewKind(selected) === "text" && (
              <pre className="min-h-[320px] whitespace-pre-wrap rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/30 p-4 text-sm leading-6 text-neutral-200">
                {textPreview}
              </pre>
            )}

            {getCityAssetPreviewKind(selected) === "external" && (
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] text-center">
                <span className="mb-3 text-3xl">📄</span>
                <p className="text-sm text-neutral-400">此格式暂不支持站内预览。</p>
              </div>
            )}
          </>
        ) : (
          <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] text-sm text-neutral-500">
            请选择一个资料项进行预览。
          </div>
        )}
      </div>
    </div>
  );
}

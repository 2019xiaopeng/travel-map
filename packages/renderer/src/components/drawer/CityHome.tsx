import { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "../../services/db";
import { ui } from "../../services/ui";
import { City } from "../../types";
import { formatBackupWarnings, formatBackupWarningsGrouped } from "../../utils/backupWarnings";
import { deriveCityHomeState } from "./cityHomeState";
import { getCityWorkbenchCopy, type CityVisitState } from "./cityWorkbenchCopy";
import { localPathToLocalUrl } from "./cityAssetsPreview";

interface CityHomeProps {
  cityId: string;
  cityName: string;
  provinceId: string;
  provinceName: string;
  onOpenTrips: () => void;
  onOpenAssets: () => void;
  onStartAddPoi: () => void;
}

export function CityHome({
  cityId,
  cityName,
  provinceId,
  provinceName,
  onOpenTrips,
  onOpenAssets,
  onStartAddPoi,
}: CityHomeProps) {
  const [data, setData] = useState<City | null>(null);
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  const hasApi = typeof window !== "undefined" && Boolean((window as any)?.travelMap?.db);

  const loadCity = useCallback(async () => {
    if (!hasApi) {
      setRuntimeError("当前运行环境不支持本地数据操作，请使用 Electron 启动应用。");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await db.getCity(cityId, provinceId, cityName, provinceName);
      setData(res);
      setSummary(res?.summary || "");
    } catch (err) {
      console.error("Failed to load city:", err);
      const message = err instanceof Error ? err.message : "未知错误";
      setError(`城市资料加载失败：${message}`);
    } finally {
      setLoading(false);
    }
  }, [cityId, provinceId, cityName, provinceName, hasApi]);

  useEffect(() => {
    void loadCity();
  }, [loadCity]);

  const viewState = deriveCityHomeState({ loading, error, city: data });
  const workbenchCopy = useMemo(
    () => getCityWorkbenchCopy(data?.visit_state, Number(data?.tripCount ?? 0)),
    [data?.tripCount, data?.visit_state],
  );

  const updateVisitState = useCallback(
    async (nextState: CityVisitState) => {
      try {
        await db.updateCityVisitState(cityId, nextState, {
          provinceId,
          provinceName,
          cityName,
        });
        setData((current) => (current ? { ...current, visit_state: nextState } : current));
      } catch (err) {
        console.error("更新城市状态失败", err);
        const message = err instanceof Error ? err.message : "未知错误";
        ui.toast.error(`更新城市状态失败：${message}`);
      }
    },
    [cityId, provinceId, provinceName, cityName],
  );

  const handleQuickImport = useCallback(async () => {
    setImporting(true);
    try {
      const selection = await window.travelMap.file.selectMultiple({ mode: "all" });
      if (selection.canceled || selection.filePaths.length === 0) {
        return;
      }

      let importedCount = 0;
      let failedCount = 0;
      let failedMessage = "";

      for (const sourcePath of selection.filePaths) {
        const result = await window.travelMap.file.saveCityAsset({
          cityId,
          cityName,
          sourcePath,
          provinceId,
          provinceName,
        });
        if (result.assetId) {
          importedCount += 1;
        } else if (result.error) {
          failedCount += 1;
          failedMessage = result.error;
        }
      }

      if (importedCount === 0) {
        if (failedCount > 0) {
          ui.toast.error(`导入失败：${failedMessage}`);
        } else {
          ui.toast.error("未获取到可导入文件路径");
        }
        return;
      }

      if ((data?.visit_state ?? "unrecorded") === "unrecorded" && Number(data?.tripCount ?? 0) === 0) {
        await db.updateCityVisitState(cityId, "wishlist", {
          provinceId,
          provinceName,
          cityName,
        });
      }
      await loadCity();
      onOpenAssets();

      if (failedCount > 0) {
        ui.toast.success(`已导入 ${importedCount} 份资料，${failedCount} 个文件失败`, { durationMs: 4000 });
      } else {
        ui.toast.success(`已导入 ${importedCount} 份本地资料`);
      }
    } catch (err) {
      console.error("导入城市资料失败", err);
      ui.toast.error("导入资料失败");
    } finally {
      setImporting(false);
    }
  }, [cityId, cityName, provinceId, provinceName, data?.tripCount, data?.visit_state, loadCity, onOpenAssets]);

  const renderWorkbenchActions = () => (
    <section className="rounded-2xl border border-white/10 bg-white/4 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.22)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-[var(--color-border)] bg-white/6 px-2.5 py-1 text-[11px] font-medium text-white">
          {workbenchCopy.badge}
        </span>
        <span className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">
          {provinceName} / {cityName}
        </span>
      </div>
      <h2 className="mt-3 text-xl font-semibold text-white">{workbenchCopy.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-neutral-400">{workbenchCopy.description}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {([
          { value: "unrecorded", label: "未记录" },
          { value: "wishlist", label: "想去" },
          { value: "visited", label: "去过" },
        ] as Array<{ value: CityVisitState; label: string }>).map((option) => {
          const active = (data?.tripCount ?? 0) > 0
            ? option.value === "visited"
            : (data?.visit_state ?? "unrecorded") === option.value;
          return (
            <button
              key={option.value}
              onClick={() => void updateVisitState(option.value)}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                active
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)]/18 text-[var(--color-accent)]"
                  : "border-[var(--color-border)] bg-white/4 text-neutral-300 hover:bg-white/8 hover:text-white"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <ActionButton label="开始记录" description="进入旅行记录" onClick={onOpenTrips} primary />
        <ActionButton label="本地资料" description="查看已导入文件" onClick={onOpenAssets} />
        <ActionButton
          label={importing ? "导入中..." : "快速导入资料"}
          description="先收集，后整理"
          onClick={() => void handleQuickImport()}
          disabled={importing}
        />
        <ActionButton label="添加地标" description="在地图上选点" onClick={onStartAddPoi} />
      </div>
    </section>
  );

  if (runtimeError) {
    return (
      <div className="p-5 space-y-5 animate-fade-in-up">
        {renderWorkbenchActions()}
        <section className="rounded-2xl border border-amber-400/20 bg-amber-500/8 p-4">
          <p className="text-sm text-amber-200">{runtimeError}</p>
        </section>
      </div>
    );
  }

  if (viewState === "loading") {
    return <CityHomeSkeleton />;
  }

  if (viewState === "error") {
    return (
      <div className="p-5 space-y-5 animate-fade-in-up">
        {renderWorkbenchActions()}
        <section className="rounded-2xl border border-red-400/20 bg-red-500/8 p-4">
          <p className="text-sm text-red-200">{error}</p>
          <button
            onClick={() => void loadCity()}
            className="mt-3 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent)]/90"
          >
            重试
          </button>
        </section>
      </div>
    );
  }

  if (!data) return <CityHomeSkeleton />;

  return (
    <div className="p-5 space-y-5 animate-fade-in-up">
      {renderWorkbenchActions()}

      <section className="rounded-2xl border border-white/10 bg-white/4 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.22)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-white">城市概览</h3>
            <p className="mt-1 text-xs text-neutral-500">简介、封面和统计会在这里持续沉淀。</p>
          </div>
          {viewState === "empty" && (
            <span className="rounded-full border border-[var(--color-border)] bg-white/6 px-2.5 py-1 text-[11px] text-neutral-300">
              还没有内容
            </span>
          )}
        </div>

        <div
          className="mt-4 aspect-[16/9] w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] flex items-center justify-center text-neutral-600 text-xs overflow-hidden cursor-pointer group relative"
          onClick={async () => {
            const selected = await window.travelMap.file.select();
            if (!selected) return;
            const destDir = `cities/${cityId}-${cityName}/city-cover`;
            try {
              const res = await window.travelMap.file.saveAsset(selected, destDir);
              if (!res.assetId) {
                ui.toast.error(res.error || "上传封面失败");
                return;
              }
              await db.updateCityCover(cityId, res.assetId);
              await loadCity();
            } catch (err) {
              console.error("上传城市封面失败", err);
              ui.toast.error("上传失败");
            }
          }}
        >
          {data.cover_path || data.cover_remote ? (
            <img
              src={data.cover_remote || (data.cover_path ? localPathToLocalUrl(data.cover_path) : "")}
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

        <textarea
          className="mt-4 text-sm text-neutral-300 leading-relaxed w-full bg-transparent border border-[var(--color-border)]/60 outline-none resize-none focus:ring-1 focus:ring-[var(--color-border)] rounded-xl px-3 py-3"
          placeholder="给这座城市写一句简介，或者留一段准备中的想法…"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          onBlur={async (e) => {
            if (e.target.value !== (data?.summary || "")) {
              try {
                await db.updateCitySummary(cityId, e.target.value);
                setData({ ...data, summary: e.target.value });
              } catch (err) {
                console.error("更新城市简介失败", err);
              }
            }
          }}
          rows={4}
        />
      </section>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="旅行次数" value={data?.tripCount?.toString() || "0"} />
        <StatCard label="POI 收藏" value={data?.poiCount?.toString() || "0"} />
        <StatCard label="总花费" value={data?.totalCost ? `¥${data.totalCost}` : "—"} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={async () => {
            try {
              const res = await window.travelMap.file.exportBackupZip();
              if (res?.canceled) return;
              if (res?.ok && res.path) {
                const warningText = formatBackupWarningsGrouped(res.warnings ?? []) || formatBackupWarnings(res.warnings ?? []);
                if (warningText) {
                  await ui.alert({ title: "备份已导出", message: res.path, details: warningText });
                } else {
                  ui.toast.success(`备份已导出：${res.path}`);
                }
              } else {
                ui.toast.error(res?.error || "导出失败");
              }
            } catch (err: any) {
              console.error("导出备份失败", err);
              ui.toast.error("导出失败");
            }
          }}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/60 py-2 text-sm font-medium text-white hover:bg-[var(--color-surface-elevated)]"
        >
          导出备份
        </button>
        <button
          onClick={async () => {
            try {
              const res = await window.travelMap.file.importBackupZip();
              if (res?.canceled) return;
              if (!res?.ok) {
                ui.toast.error(res?.error || "导入失败");
                return;
              }
              const warningText = formatBackupWarningsGrouped(res.warnings ?? []) || formatBackupWarnings(res.warnings ?? []);
              const ok = await ui.confirm({
                title: "备份已导入",
                message: "重启后将替换当前数据。是否立即重启？",
                details: warningText || undefined,
                confirmText: "立即重启",
                cancelText: "稍后",
                danger: true,
              });
              if (ok) {
                await window.travelMap.app.relaunch();
              }
            } catch (err: any) {
              console.error("导入备份失败", err);
              ui.toast.error("导入失败");
            }
          }}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/60 py-2 text-sm font-medium text-white hover:bg-[var(--color-surface-elevated)]"
        >
          导入备份
        </button>
      </div>

      <div className="pt-2 flex justify-end">
        <button
          onClick={async () => {
            try {
              const res = await window.travelMap.diagnostics.exportRestoreDiagnostic({ reason: "manual" });
              if (res?.ok && res.relativePath) {
                await window.travelMap.diagnostics.reveal(res.relativePath);
                ui.toast.success(`诊断已导出：${res.relativePath}`);
              } else {
                ui.toast.error(res?.error || "导出诊断失败");
              }
            } catch (err: any) {
              console.error("导出诊断失败", err);
              ui.toast.error("导出诊断失败");
            }
          }}
          className="text-xs text-neutral-400 hover:text-white"
        >
          导出诊断
        </button>
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

function CityHomeSkeleton() {
  return (
    <div className="p-5 space-y-5 animate-fade-in-up">
      <div className="aspect-[16/9] w-full rounded-lg bg-[var(--color-surface-elevated)]/60 animate-pulse" />
      <div className="space-y-2">
        <div className="h-5 w-28 rounded bg-[var(--color-surface-elevated)]/60 animate-pulse" />
        <div className="h-12 w-full rounded bg-[var(--color-surface-elevated)]/40 animate-pulse" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="h-16 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/30 animate-pulse" />
        <div className="h-16 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/30 animate-pulse" />
        <div className="h-16 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/30 animate-pulse" />
      </div>
    </div>
  );
}

function ActionButton({
  label,
  description,
  onClick,
  primary = false,
  disabled = false,
}: {
  label: string;
  description: string;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl border p-3 text-left transition-colors ${
        primary
          ? "border-[var(--color-accent)] bg-[var(--color-accent)]/16 text-white hover:bg-[var(--color-accent)]/24"
          : "border-[var(--color-border)] bg-[var(--color-surface-elevated)]/45 text-white hover:bg-[var(--color-surface-elevated)]"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <div className="text-sm font-medium">{label}</div>
      <div className="mt-1 text-xs text-neutral-400">{description}</div>
    </button>
  );
}

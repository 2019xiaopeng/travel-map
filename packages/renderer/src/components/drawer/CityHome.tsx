import { useEffect, useState } from "react";
import { db } from "../../services/db";
import { ui } from "../../services/ui";
import { City } from "../../types";
import { formatBackupWarnings, formatBackupWarningsGrouped } from "../../utils/backupWarnings";

interface CityHomeProps {
  cityId: string;
  cityName: string;
  provinceId: string;
  provinceName: string;
  onOpenTrips: () => void;
}

export function CityHome({
  cityId,
  cityName,
  provinceId,
  provinceName,
  onOpenTrips,
}: CityHomeProps) {
  const [data, setData] = useState<City | null>(null);
  const [summary, setSummary] = useState<string>("");

  useEffect(() => {
    let active = true;
    db.getCity(cityId, provinceId, cityName, provinceName)
      .then((res) => {
        if (active) {
          setData(res);
          setSummary(res?.summary || "");
        }
      })
      .catch((err) => {
        console.error("Failed to load city:", err);
      });
    return () => {
      active = false;
    };
  }, [cityId, provinceId, cityName, provinceName]);

  if (!data) {
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

  return (
    <div className="p-5 space-y-5 animate-fade-in-up">
      <div
        className="aspect-[16/9] w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] flex items-center justify-center text-neutral-600 text-xs overflow-hidden cursor-pointer group relative"
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "image/*";
          input.onchange = async (e: any) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const sourcePath = (file as any).path;
            if (!sourcePath) return;
            const destDir = `cities/${cityId}-${cityName}/city-cover`;
            try {
              const res = await window.travelMap.file.saveAsset(sourcePath, destDir);
              if (!res.assetId) return;
              await db.updateCityCover(cityId, res.assetId);
              const updatedCity = await db.getCity(cityId, provinceId, cityName, provinceName);
              setData(updatedCity);
            } catch (err) {
              console.error("上传城市封面失败", err);
              ui.toast.error("上传失败");
            }
          };
          input.click();
        }}
      >
        {data.cover_path || data.cover_remote ? (
          <img
            src={data.cover_remote || (data.cover_path ? (data.cover_path.startsWith("assets/") ? `local://assets/${data.cover_path.slice("assets/".length)}` : `local:///${data.cover_path}`) : "")}
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

      <section className="rounded-2xl border border-white/10 bg-white/4 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.22)]">
        <h2 className="text-lg font-semibold text-white">{cityName}</h2>
        <textarea
          className="mt-1 text-sm text-neutral-400 leading-relaxed w-full bg-transparent border-none outline-none resize-none focus:ring-1 focus:ring-[var(--color-border)] rounded px-1 -ml-1"
          placeholder="城市简介待编辑…"
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
          rows={3}
        />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={onOpenTrips}
            className="rounded-lg bg-[var(--color-accent)] py-2 text-sm font-medium text-white hover:bg-[var(--color-accent)]/90"
          >
            查看旅行记录
          </button>
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
        </div>
      </section>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="旅行次数" value={data?.tripCount?.toString() || "0"} />
        <StatCard label="POI 收藏" value={data?.poiCount?.toString() || "0"} />
        <StatCard label="总花费" value={data?.totalCost ? `¥${data.totalCost}` : "—"} />
      </div>

      <div className="pt-2">
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
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/60 py-2 text-sm font-medium text-white hover:bg-[var(--color-surface-elevated)]"
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

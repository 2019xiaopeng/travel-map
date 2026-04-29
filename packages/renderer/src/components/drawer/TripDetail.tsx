import React, { useEffect, useState } from "react";
import { db } from "../../services/db";
import { ui } from "../../services/ui";
import MdEditor from 'react-markdown-editor-lite';
import MarkdownIt from 'markdown-it';
import 'react-markdown-editor-lite/lib/index.css';
import { useMapStore } from "../../features/map/mapStore";
import { Trip, TripCost, POI, Asset, Tag } from "../../types";
import { extractFilePaths } from "../../utils/fileDrop";
import { deriveUploadFilename } from "../../utils/imageUpload";
import { InlineTagAdder } from "../InlineTagAdder";

const mdParser = new MarkdownIt({ html: false });

function extractAssetIdsFromMarkdown(markdown: string) {
  const ids = new Set<string>();
  const re = /local:\/\/(?:assets\/|\/assets\/)[^)\s]*?\/([0-9a-fA-F-]{36})__[^)\s]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown))) {
    const assetId = String(m[1] ?? "").trim();
    if (assetId) ids.add(assetId);
  }
  return Array.from(ids);
}

function localPathToLocalUrl(localPath: string) {
  const normalized = String(localPath ?? "");
  if (normalized.startsWith("assets/")) return `local://assets/${normalized.slice("assets/".length)}`;
  return `local:///${normalized.replace(/^\/+/, "")}`;
}

function localUrlToLocalPath(localUrl: string) {
  const normalized = String(localUrl ?? "");
  if (normalized.startsWith("local://assets/")) return `assets/${normalized.slice("local://assets/".length)}`;
  if (normalized.startsWith("local:///")) return normalized.slice("local:///".length);
  if (normalized.startsWith("local://")) return normalized.slice("local://".length);
  return normalized;
}

interface TripDetailProps {
  tripId: string;
  onBack: () => void;
}

export function TripDetail({ tripId, onBack }: TripDetailProps) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [activeTab, setActiveTab] = useState<"content" | "attachment" | "pois" | "costs">("content");
  const [costs, setCosts] = useState<TripCost[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [pois, setPois] = useState<POI[]>([]);
  const [attachments, setAttachments] = useState<Asset[]>([]);
  const [attachmentDropping, setAttachmentDropping] = useState(false);
  const cityId = useMapStore((s) => s.cityId);
  const cityName = useMapStore((s) => s.cityName);

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      try {
        const t = await db.getTrip(tripId);
        if (cancelled) return;
        setTrip(t);
        const [nextCosts, nextTags, nextPois, nextAttachments] = await Promise.all([
          db.getTripCosts(tripId),
          db.getTags("trip", tripId),
          db.getPoisForTrip(tripId),
          db.getTripAttachments(tripId)
        ]);
        if (cancelled) return;
        setCosts(nextCosts);
        setTags(nextTags);
        setPois(nextPois);
        setAttachments(nextAttachments);
      } catch {
        if (!cancelled) setTrip(null);
      }
    };

    loadData();

    const onPoiUpdate = () => {
      db.getPoisForTrip(tripId).then(nextPois => {
        if (!cancelled) setPois(nextPois);
      });
    };
    window.addEventListener('poi-added', onPoiUpdate);

    return () => {
      cancelled = true;
      window.removeEventListener('poi-added', onPoiUpdate);
    };
  }, [tripId]);

  if (!trip) return <div className="p-5 text-neutral-500">加载中...</div>;

  const handleChange = (field: string, value: any) => {
    const updated = { ...trip, [field]: value };
    setTrip(updated);
    
    if ((window as any)._tripSaveTimer) clearTimeout((window as any)._tripSaveTimer);
    (window as any)._tripSaveTimer = setTimeout(() => {
      db.updateTrip(updated).catch((err) => console.error("Trip save failed:", err));
      if (field === "content") {
        const assetIds = extractAssetIdsFromMarkdown(String(value ?? ""));
        db.setTripInlineAssets(tripId, assetIds).catch((err) => console.error("Inline asset sync failed:", err));
      }
      window.dispatchEvent(new Event('poi-added'));
    }, 500);
  };

  const handleImageUpload = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const path = (file as any).path;
      if (!cityId || !cityName) {
        ui.toast.error("当前未选中城市，无法上传图片");
        resolve("");
        return;
      }

      const destDir = `cities/${cityId}-${cityName}/trips/${tripId}/photos`;

      if (path) {
        window.travelMap.file
          .saveAsset(path, destDir)
          .then((res) => {
            if (res.localUrl) resolve(res.localUrl);
            else {
              ui.toast.error("图片上传失败");
              resolve("");
            }
          })
          .catch((err) => {
            console.error("图片上传失败", err);
            ui.toast.error("图片上传失败");
            resolve("");
          });
        return;
      }

      file
        .arrayBuffer()
        .then((buf) => {
          const mime = file.type || "application/octet-stream";
          const originalFilename = deriveUploadFilename(file);
          return window.travelMap.file.saveAssetBytes(buf, originalFilename, mime, destDir);
        })
        .then((res) => {
          if (res?.localUrl) resolve(res.localUrl);
          else {
            ui.toast.error("图片上传失败");
            resolve("");
          }
        })
        .catch((err) => {
          console.error("图片上传失败", err);
          ui.toast.error("图片上传失败");
          resolve("");
        });
    });
  };

  const handleCoverClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const path = (file as any).path;
      if (!path) return;

      const destDir = `cities/${cityId}-${cityName}/trips/${tripId}/cover`;
      try {
        const res = await window.travelMap.file.saveAsset(path, destDir);
        if (res.assetId && res.localUrl) {
          const updated = { ...trip, cover_asset_id: res.assetId, cover_path: localUrlToLocalPath(res.localUrl) };
          setTrip(updated);
          await db.updateTrip(updated);
        }
      } catch (err) {
        console.error("封面上传失败", err);
      }
    };
    input.click();
  };

  const uploadAttachments = async (paths: string[]) => {
    if (!cityId || !cityName) return;
    for (const p of paths) {
      try {
        const destDir = `cities/${cityId}-${cityName}/trips/${tripId}/docs`;
        const res = await window.travelMap.file.saveAsset(p, destDir);
        if (res.assetId) {
          await db.addTag("trip_attachment", tripId, res.assetId);
        }
      } catch (err) {
        console.error("上传附件失败", err);
      }
    }
    const nextAttachments = await db.getTripAttachments(tripId);
    setAttachments(nextAttachments);
  };

  return (
    <div className="flex h-full flex-col animate-fade-in-up">
      {/* 封面区域 */}
      <div 
        className="relative h-32 w-full bg-[var(--color-surface-elevated)] flex items-center justify-center text-neutral-600 text-xs cursor-pointer overflow-hidden group shrink-0 border-b border-[var(--color-border)]"
        onClick={handleCoverClick}
      >
        {trip.cover_path || trip.cover_remote ? (
          <img 
            src={trip.cover_remote || (trip.cover_path ? localPathToLocalUrl(trip.cover_path) : "")} 
            alt="Trip Cover" 
            className="w-full h-full object-cover transition-transform group-hover:scale-105" 
          />
        ) : (
          <span>点击上传旅行封面</span>
        )}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <span className="text-white font-medium">更换封面</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 左侧：表单字段 */}
        <div className="w-[180px] shrink-0 border-r border-[var(--color-border)] p-4 space-y-4 overflow-y-auto">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium text-white">旅行详情</h3>
            <button
              onClick={async () => {
                const ok = await ui.confirm({
                  title: "删除旅行记录",
                  message: "确定删除此旅行记录吗？",
                  confirmText: "删除",
                  cancelText: "取消",
                  danger: true,
                });
                if (ok) {
                  try {
                    await db.deleteTrip(tripId);
                    onBack();
                  } catch (err) {
                    console.error("Failed to delete trip:", err);
                    ui.toast.error("删除失败");
                  }
                }
              }}
              className="text-xs text-red-500 hover:text-red-400"
            >
              删除
            </button>
          </div>
          <FormField
            label="标题"
            value={trip.title}
            onChange={(v) => handleChange("title", v)}
          />
          <FormField
            label="开始日期"
            value={trip.date_start || ""}
            onChange={(v) => handleChange("date_start", v)}
            type="date"
          />
          <FormField
            label="结束日期"
            value={trip.date_end || ""}
            onChange={(v) => handleChange("date_end", v)}
            type="date"
          />
          <FormField
            label="总花费"
            value={trip.cost_total?.toString() || "0"}
            onChange={() => {}}
            type="number"
            readOnly
          />
          <FormField
            label="同行人"
            value={trip.companions || ""}
            onChange={(v) => handleChange("companions", v)}
          />

          <div className="pt-2 border-t border-[var(--color-border)]">
            <div className="flex justify-between items-center mb-2">
              <div className="text-[11px] text-neutral-500">标签</div>
              <InlineTagAdder
                existingTags={tags}
                onAdd={async (tag) => {
                  try {
                    await db.addTag("trip", tripId, tag);
                    const nextTags = await db.getTags("trip", tripId);
                    setTags(nextTags);
                  } catch (err) {
                    console.error("Failed to add tag:", err);
                    ui.toast.error("添加标签失败");
                    throw err;
                  }
                }}
              />
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
                      const ok = await ui.confirm({
                        title: "删除标签",
                        message: `删除标签 #${t}?`,
                        confirmText: "删除",
                        cancelText: "取消",
                        danger: true,
                      });
                      if (ok) {
                        try {
                          await db.removeTag("trip", tripId, t);
                          const nextTags = await db.getTags("trip", tripId);
                          setTags(nextTags);
                        } catch (err) {
                          console.error("Failed to delete tag:", err);
                          ui.toast.error("删除标签失败");
                        }
                      }
                    }}
                    className="ml-1 hidden text-red-400 hover:text-red-300 group-hover:inline-block"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 右侧：正文 / 其他 Tab */}
        <div className="flex flex-1 flex-col bg-[var(--color-surface)] min-w-0">
          <div className="flex shrink-0 border-b border-[var(--color-border)] overflow-x-auto no-scrollbar">
            <TabButton active={activeTab === "content"} onClick={() => setActiveTab("content")}>正文</TabButton>
            <TabButton active={activeTab === "pois"} onClick={() => setActiveTab("pois")}>相关地点</TabButton>
            <TabButton active={activeTab === "costs"} onClick={() => setActiveTab("costs")}>记账明细</TabButton>
            <TabButton active={activeTab === "attachment"} onClick={() => setActiveTab("attachment")}>附件</TabButton>
          </div>

          <div className="flex-1 p-0 overflow-y-auto custom-md-editor">
            {activeTab === "content" && (
              <div className="animate-fade-in-up h-full w-full">
                <MdEditor
                  value={trip.content || ""}
                  style={{ height: '100%', border: 'none' }}
                  renderHTML={text => mdParser.render(text)}
                  onChange={({ text }) => handleChange("content", text)}
                  onImageUpload={handleImageUpload}
                  config={{
                    view: {
                      menu: true,
                      md: true,
                    html: false
                    }
                  }}
                />
              </div>
            )}
            
            {activeTab === "pois" && (
              <div className="p-4 h-full animate-fade-in-up">
                <div className="mb-4 flex items-center justify-between">
                  <h4 className="text-sm font-medium text-white">地点记录 ({pois.length})</h4>
                </div>
                {pois.length > 0 ? (
                  <ul className="space-y-2">
                    {pois.map((p, idx) => (
                      <li key={p.poi_id} className="flex items-center justify-between text-xs bg-[var(--color-surface-elevated)] p-2 rounded border border-[var(--color-border)] group">
                        <div className="flex items-center gap-2">
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-accent)] text-[10px] text-white">
                            {idx + 1}
                          </span>
                          <span className="text-white">{p.name}</span>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-neutral-500 text-[10px]">{p.category}</span>
                          <button 
                            onClick={async () => {
                              const ok = await ui.confirm({
                                title: "移除地点",
                                message: `从旅行中移除地点 ${p.name}？(不会删除地点本身)`,
                                confirmText: "移除",
                                cancelText: "取消",
                                danger: true,
                              });
                              if (ok) {
                                try {
                                  await db.removePoiFromTrip(tripId, p.poi_id);
                                  const nextPois = await db.getPoisForTrip(tripId);
                                  setPois(nextPois);
                                  window.dispatchEvent(new Event('poi-added'));
                                } catch (err) {
                                  console.error("Failed to remove POI from trip:", err);
                                  ui.toast.error("移除失败");
                                }
                              }
                            }}
                            className="text-red-500 hover:text-red-400 px-1"
                            title="从行程移除"
                          >
                            ×
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-neutral-500 flex flex-col items-center justify-center h-32 border border-dashed border-[var(--color-border)] rounded-lg">
                    <span className="mb-2 text-2xl">📍</span>
                    <span>暂无相关地点，请在地图右键添加或关联</span>
                  </div>
                )}
              </div>
            )}

            {activeTab === "costs" && (
              <div className="p-4 h-full animate-fade-in-up">
                <div className="mb-4 flex items-center justify-between">
                  <h4 className="text-sm font-medium text-white">记账明细</h4>
                  <button 
                    onClick={async () => {
                      const res = await ui.form({
                        title: "记一笔花费",
                        message: "填写类别与金额",
                        confirmText: "保存",
                        cancelText: "取消",
                        fields: [
                          { key: "category", label: "类别", type: "text", placeholder: "例如：交通/住宿/餐饮" },
                          { key: "amount", label: "金额", type: "number", placeholder: "例如：128.50" },
                        ],
                      });
                      const category = String(res?.category ?? "").trim();
                      const amount = Number(res?.amount);
                      if (res && category && Number.isFinite(amount) && amount > 0) {
                        try {
                          await db.updateTripCost(tripId, category, amount);
                          const t = await db.getTrip(tripId);
                          const nextCosts = await db.getTripCosts(tripId);
                          setTrip(t);
                          setCosts(nextCosts);
                        } catch (err) {
                          console.error("Failed to add trip cost:", err);
                          ui.toast.error("添加花费失败");
                        }
                      }
                    }}
                    className="text-xs text-[var(--color-accent)] hover:text-white"
                  >
                    + 记一笔
                  </button>
                </div>
                {costs.length > 0 ? (
                  <ul className="space-y-2">
                    {costs.map(c => (
                      <li key={c.category} className="flex items-center justify-between text-xs bg-[var(--color-surface-elevated)] p-2 rounded border border-[var(--color-border)]">
                        <span className="text-white">{c.category}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[var(--color-accent)] font-medium">¥{c.amount}</span>
                          <button 
                            onClick={async () => {
                            const ok = await ui.confirm({
                              title: "删除花费记录",
                              message: `删除 ${c.category} 的花费记录？`,
                              confirmText: "删除",
                              cancelText: "取消",
                              danger: true,
                            });
                            if (ok) {
                              try {
                                await db.deleteTripCost(tripId, c.category);
                                const t = await db.getTrip(tripId);
                                const nextCosts = await db.getTripCosts(tripId);
                                setTrip(t);
                                setCosts(nextCosts);
                              } catch (err) {
                                console.error("Failed to delete trip cost:", err);
                                ui.toast.error("删除花费失败");
                              }
                            }
                          }}
                            className="text-red-500 hover:text-red-400"
                          >
                            ×
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-neutral-500 flex flex-col items-center justify-center h-32 border border-dashed border-[var(--color-border)] rounded-lg">
                    <span className="mb-2 text-2xl">💰</span>
                    <span>暂无花费记录</span>
                  </div>
                )}
              </div>
            )}

            {activeTab === "attachment" && (
              <div
                className={`p-4 h-full animate-fade-in-up ${attachmentDropping ? "ring-2 ring-[var(--color-accent)]/60 rounded-lg" : ""}`}
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setAttachmentDropping(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setAttachmentDropping(false);
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setAttachmentDropping(false);
                  const paths = extractFilePaths(Array.from(e.dataTransfer?.files ?? []) as any);
                  if (paths.length > 0) {
                    await uploadAttachments(paths);
                    ui.toast.success("附件上传完成");
                  }
                }}
              >
                <div className="mb-4 flex items-center justify-between">
                  <h4 className="text-sm font-medium text-white">所有附件</h4>
                  <button 
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.multiple = true;
                      input.onchange = async (e: any) => {
                        const files = Array.from(e.target.files || []);
                        const paths = extractFilePaths(files as any);
                        await uploadAttachments(paths);
                        ui.toast.success("附件上传完成");
                      };
                      input.click();
                    }}
                    className="text-xs text-[var(--color-accent)] hover:text-white"
                  >
                    + 上传附件
                  </button>
                </div>
                {attachmentDropping && (
                  <div className="mb-4 rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface-elevated)]/40 p-4 text-center text-xs text-neutral-300">
                    松开鼠标上传附件
                  </div>
                )}
                {attachments.length > 0 ? (
                  <ul className="space-y-2">
                    {attachments.map((a: any) => (
                      <li key={a.asset_id} className="flex items-center justify-between text-xs bg-[var(--color-surface-elevated)] p-2 rounded border border-[var(--color-border)] group">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="text-lg shrink-0">📄</span>
                          <span className="text-white truncate" title={a.local_path}>{a.local_path.split('/').pop()}</span>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={async () => {
                              await window.travelMap.file.openLocal(a.local_path);
                            }}
                            className="text-[var(--color-accent)] hover:text-blue-400 px-2"
                          >
                            打开
                          </button>
                          <button 
                            onClick={async () => {
                              const ok = await ui.confirm({
                                title: "删除附件",
                                message: "删除此附件？(若没有其他引用，将删除本地文件)",
                                confirmText: "删除",
                                cancelText: "取消",
                                danger: true,
                              });
                              if (ok) {
                                try {
                                  await db.removeTripAttachment(tripId, a.asset_id);
                                  const nextAttachments = await db.getTripAttachments(tripId);
                                  setAttachments(nextAttachments);
                                } catch (err) {
                                  console.error("Failed to remove attachment:", err);
                                  ui.toast.error("删除失败");
                                }
                              }
                            }}
                            className="text-red-500 hover:text-red-400"
                          >
                            ×
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-neutral-500 flex flex-col items-center justify-center h-32 border border-dashed border-[var(--color-border)] rounded-lg">
                    <span className="mb-2 text-2xl">📁</span>
                    <span>暂无附件（可在本地文件夹中查看）</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, value, onChange, type = "text", readOnly = false }: { label: string; value: string | number; onChange: (val: any) => void; type?: string; readOnly?: boolean }) {
  return (
    <div>
      <div className="mb-1 text-[11px] text-neutral-500">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        className={`w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[var(--color-accent)] ${readOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
      />
    </div>
  );
}

function TabButton({ active, children, onClick }: { active?: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`
        border-b-2 px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap
        ${active
          ? "border-[var(--color-accent)] text-white"
          : "border-transparent text-neutral-500 hover:text-neutral-300"
        }
      `}
    >
      {children}
    </button>
  );
}

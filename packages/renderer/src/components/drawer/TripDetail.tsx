import { useEffect, useState } from "react";
import { db } from "../../services/db";
import MdEditor from 'react-markdown-editor-lite';
import MarkdownIt from 'markdown-it';
import 'react-markdown-editor-lite/lib/index.css';
import { useMapStore } from "../../features/map/mapStore";

const mdParser = new MarkdownIt();

interface TripDetailProps {
  tripId: string;
  onBack: () => void;
}

export function TripDetail({ tripId, onBack }: TripDetailProps) {
  const [trip, setTrip] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"content" | "attachment" | "pois" | "costs">("content");
  const [costs, setCosts] = useState<any[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [pois, setPois] = useState<any[]>([]);
  const cityId = useMapStore((s) => s.cityId);
  const cityName = useMapStore((s) => s.cityName);

  useEffect(() => {
    loadData();
  }, [tripId]);

  const loadData = async () => {
    const t = await db.getTrip(tripId);
    setTrip(t);
    loadCosts();
    loadTags();
    loadPois();
  };

  const loadCosts = async () => {
    const res = await db.getTripCosts(tripId);
    setCosts(res);
  };

  const loadTags = async () => {
    const res = await db.getTags("trip", tripId);
    setTags(res);
  };

  const loadPois = async () => {
    const res = await db.getPoisForTrip(tripId);
    setPois(res);
  };

  if (!trip) return <div className="p-5 text-neutral-500">加载中...</div>;

  const handleChange = (field: string, value: any) => {
    const updated = { ...trip, [field]: value };
    setTrip(updated);
    db.updateTrip(updated);
  };

  const handleImageUpload = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const path = (file as any).path;
      if (path && cityId && cityName) {
        const tripDir = `${trip.date_start}_${trip.date_end}-${trip.title}`.replace(/[\/\\]/g, '-');
        const destDir = `cities/${cityId}-${cityName}/trips/${tripDir}/photos`;

        window.travelMap.file.saveAsset(path, destDir).then(res => {
          if (res.localUrl) {
            resolve(`local:///${res.localUrl.replace('local:///', '')}`);
          } else {
            resolve(URL.createObjectURL(file)); // fallback
          }
        });
      } else {
        resolve(URL.createObjectURL(file));
      }
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

      const tripDir = `${trip.date_start}_${trip.date_end}-${trip.title}`.replace(/[\/\\]/g, '-');
      const destDir = `cities/${cityId}-${cityName}/trips/${tripDir}/cover`;
      try {
        const res = await window.travelMap.file.saveAsset(path, destDir);
        if (res.assetId && res.localUrl) {
          const updated = { ...trip, cover_asset_id: res.assetId, cover_path: res.localUrl.replace('local:///', '') };
          setTrip(updated);
          await db.updateTrip(updated);
        }
      } catch (err) {
        console.error("封面上传失败", err);
      }
    };
    input.click();
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
            src={trip.cover_remote || `local:///${trip.cover_path}`} 
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
                if (confirm("确定删除此旅行记录吗？")) {
                  await db.deleteTrip(tripId);
                  onBack();
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
              <button 
                onClick={async () => {
                  const tag = prompt("输入新标签:");
                  if (tag) {
                    await db.addTag("trip", tripId, tag);
                    loadTags();
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
                      await db.removeTag("trip", tripId, t);
                      loadTags();
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
                      html: true
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
                      <li key={p.poi_id} className="flex items-center justify-between text-xs bg-[var(--color-surface-elevated)] p-2 rounded border border-[var(--color-border)]">
                        <div className="flex items-center gap-2">
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-accent)] text-[10px] text-white">
                            {idx + 1}
                          </span>
                          <span className="text-white">{p.name}</span>
                        </div>
                        <span className="text-neutral-500 text-[10px]">{p.category}</span>
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
                      const category = prompt("输入花费类别(如: 交通, 住宿):");
                      const amount = prompt("输入花费金额:");
                      if (category && amount && !isNaN(Number(amount))) {
                        await db.updateTripCost(tripId, category, Number(amount));
                        loadData(); // refresh total
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
                              if (confirm(`删除 ${c.category} 的花费记录？`)) {
                                await db.deleteTripCost(tripId, c.category);
                                loadData();
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
              <div className="p-4 h-full animate-fade-in-up">
                <div className="mb-4 flex items-center justify-between">
                  <h4 className="text-sm font-medium text-white">所有附件</h4>
                  <button 
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.multiple = true;
                      input.onchange = async (e: any) => {
                        const files = Array.from(e.target.files || []);
                        for (const file of files) {
                          const path = (file as any).path;
                          if (path && cityId && cityName) {
                            const tripDir = `${trip.date_start}_${trip.date_end}-${trip.title}`.replace(/[\/\\]/g, '-');
                            const destDir = `cities/${cityId}-${cityName}/trips/${tripDir}/attachments`;
                            try {
                              const res = await window.travelMap.file.saveAsset(path, destDir);
                              if (res.assetId) {
                                await db.addTag("trip_attachment", tripId, res.assetId);
                              }
                            } catch(err) {
                              console.error("上传附件失败", err);
                            }
                          }
                        }
                        alert("附件上传完成");
                      };
                      input.click();
                    }}
                    className="text-xs text-[var(--color-accent)] hover:text-white"
                  >
                    + 上传附件
                  </button>
                </div>
                <div className="text-sm text-neutral-500 flex flex-col items-center justify-center h-32 border border-dashed border-[var(--color-border)] rounded-lg">
                  <span className="mb-2 text-2xl">📁</span>
                  <span>暂无附件（可在本地文件夹中查看）</span>
                </div>
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
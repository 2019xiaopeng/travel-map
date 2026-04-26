import { useEffect, useState, useRef } from "react";
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
  const [activeTab, setActiveTab] = useState<"content" | "attachment">("content");
  const cityId = useMapStore((s) => s.cityId);
  const cityName = useMapStore((s) => s.cityName);

  useEffect(() => {
    db.getTrip(tripId).then(setTrip);
  }, [tripId]);

  if (!trip) return <div className="p-5 text-neutral-500">加载中...</div>;

  const handleChange = (field: string, value: any) => {
    const updated = { ...trip, [field]: value };
    setTrip(updated);
    db.updateTrip(updated);
  };

  const handleImageUpload = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      // 真实场景：把 File 转换为本地路径然后上传
      // 因为这里我们是在 renderer 里面拿到的 file 对象，其实在 Electron 里有 file.path
      const path = (file as any).path;
      if (path && cityId && cityName) {
        // 使用 IPC 上传
        const tripDir = `${trip.date_start}_${trip.date_end}-${trip.title}`.replace(/[\/\\]/g, '-');
        const destDir = `cities/${cityId}-${cityName}/trips/${tripDir}/photos`;
        
        window.travelMap.file.saveAsset(path, destDir).then(res => {
          if (res.localUrl) {
            resolve(res.localUrl);
          } else {
            resolve(URL.createObjectURL(file)); // fallback
          }
        });
      } else {
        resolve(URL.createObjectURL(file));
      }
    });
  };

  return (
    <div className="flex h-full flex-col">
      {/* 表单 + 正文 左右分栏 */}
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
            onChange={(v) => handleChange("cost_total", parseFloat(v) || 0)} 
            type="number"
          />
          <FormField 
            label="同行人" 
            value={trip.companions || ""} 
            onChange={(v) => handleChange("companions", v)} 
          />
        </div>

        {/* 右侧：正文 / 附件 Tab */}
        <div className="flex flex-1 flex-col bg-[var(--color-surface)]">
          <div className="flex shrink-0 border-b border-[var(--color-border)]">
            <TabButton active={activeTab === "content"} onClick={() => setActiveTab("content")}>正文</TabButton>
            <TabButton active={activeTab === "attachment"} onClick={() => setActiveTab("attachment")}>附件</TabButton>
          </div>

          <div className="flex-1 p-0 overflow-y-auto custom-md-editor">
            {activeTab === "content" && (
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
            )}
            {activeTab === "attachment" && (
              <div className="p-4 h-full">
                <div className="text-sm text-neutral-500 flex items-center justify-center h-full border border-dashed border-[var(--color-border)] rounded-lg">
                  附件功能开发中...
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, value, onChange, type = "text" }: { label: string; value: string | number; onChange: (val: any) => void; type?: string }) {
  return (
    <div>
      <div className="mb-1 text-[11px] text-neutral-500">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[var(--color-accent)]"
      />
    </div>
  );
}

function TabButton({ active, children, onClick }: { active?: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`
        border-b-2 px-4 py-2 text-xs font-medium transition-colors
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

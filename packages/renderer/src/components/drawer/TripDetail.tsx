interface TripDetailProps {
  onBack: () => void;
}

export function TripDetail({}: TripDetailProps) {
  return (
    <div className="flex h-full flex-col">
      {/* 表单 + 正文 左右分栏（文档 07 已确认：左侧表单 / 右侧正文+附件） */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧：表单字段 */}
        <div className="w-[180px] shrink-0 border-r border-[var(--color-border)] p-4 space-y-4">
          <FormField label="标题" value="清明3日" />
          <FormField label="日期" value="04-04 ~ 04-06" />
          <FormField label="状态" value="已完成" />
          <FormField label="总花费" value="¥1,860" />
          <FormField label="交通" value="高铁" />
        </div>

        {/* 右侧：正文 / 附件 Tab（文档 07 已确认：两段式 Tab） */}
        <div className="flex flex-1 flex-col">
          <div className="flex shrink-0 border-b border-[var(--color-border)]">
            <TabButton active>正文</TabButton>
            <TabButton>附件</TabButton>
          </div>

          <div className="flex-1 p-4 overflow-y-auto">
            {/* 正文占位：Milkdown 编辑器区域 */}
            <div className="
              min-h-[200px] rounded-lg border border-dashed border-[var(--color-border)]
              bg-[var(--color-surface-elevated)]/30 p-4
              text-sm text-neutral-500
            ">
              在此编辑旅行正文…
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-[11px] text-neutral-500">{label}</div>
      <div className="rounded-md bg-[var(--color-surface-elevated)] px-2.5 py-1.5 text-xs text-white">
        {value}
      </div>
    </div>
  );
}

function TabButton({ active, children }: { active?: boolean; children: React.ReactNode }) {
  return (
    <button
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

import { useEffect, useRef, useState } from "react";
import { ui } from "../services/ui";
import { normalizeTagInput } from "../utils/tags";

export function InlineTagAdder(props: { existingTags: string[]; onAdd: (tag: string) => Promise<void>; placeholder?: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      queueMicrotask(() => inputRef.current?.focus());
    }
  }, [editing]);

  const normalizedExisting = new Set(props.existingTags.map((t) => normalizeTagInput(t).toLowerCase()).filter(Boolean));
  const current = normalizeTagInput(value);
  const canSubmit = current.length > 0;

  const submit = async () => {
    const next = normalizeTagInput(value);
    if (!next) return;
    if (normalizedExisting.has(next.toLowerCase())) {
      ui.toast.info("标签已存在");
      return;
    }
    await props.onAdd(next);
    setValue("");
    setEditing(false);
  };

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="text-[10px] text-[var(--color-accent)] hover:text-white">
        + 添加
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            setValue("");
            setEditing(false);
            return;
          }
          if (e.key === "Enter") {
            e.preventDefault();
            if (!canSubmit) return;
            submit().catch(() => ui.toast.error("添加标签失败"));
          }
        }}
        placeholder={props.placeholder ?? "例如：美食/亲子/徒步"}
        className="h-7 w-[180px] rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2 text-[11px] text-white outline-none focus:border-[var(--color-accent)]"
      />
      <button
        onClick={() => submit().catch(() => ui.toast.error("添加标签失败"))}
        disabled={!canSubmit}
        className={`rounded-md px-2 py-1 text-[11px] font-medium text-white bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 ${
          !canSubmit ? "opacity-60 cursor-not-allowed" : ""
        }`}
      >
        添加
      </button>
      <button
        onClick={() => {
          setValue("");
          setEditing(false);
        }}
        className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2 py-1 text-[11px] text-neutral-300 hover:text-white"
      >
        取消
      </button>
    </div>
  );
}


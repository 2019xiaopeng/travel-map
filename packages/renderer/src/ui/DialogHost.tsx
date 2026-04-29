import { ui, uiStores } from "../services/ui";
import { useEffect, useMemo, useState } from "react";

async function copyText(text: string) {
  const clip = (navigator as any)?.clipboard;
  if (clip?.writeText) {
    await clip.writeText(text);
    return;
  }
  throw new Error("clipboard not available");
}

export function DialogHost() {
  const dialog = uiStores.dialog((s) => s.dialog);

  if (!dialog) return null;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (dialog.cancelText) dialog.resolve(false);
      else dialog.resolve(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dialog]);

  const detailsText = [dialog.message, dialog.details ? `\n\n${dialog.details}` : ""].join("");
  const showCopy = Boolean(dialog.details) || dialog.mode === "prompt" || dialog.mode === "form";

  const initialValue = dialog.mode === "prompt" ? String(dialog.payload?.defaultValue ?? "") : "";
  const [promptValue, setPromptValue] = useState(initialValue);

  const formFields = dialog.mode === "form" ? (Array.isArray(dialog.payload?.fields) ? dialog.payload.fields : []) : [];
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (dialog.mode === "prompt") {
      setPromptValue(String(dialog.payload?.defaultValue ?? ""));
    }
    if (dialog.mode === "form") {
      const next: Record<string, string> = {};
      for (const f of formFields) {
        next[String(f?.key ?? "")] = String(f?.defaultValue ?? "");
      }
      setFormValues(next);
    }
  }, [dialog.id]);

  const canConfirm = useMemo(() => {
    if (dialog.mode === "prompt") return promptValue.trim().length > 0;
    if (dialog.mode === "form") {
      for (const f of formFields) {
        const k = String(f?.key ?? "");
        const v = String(formValues[k] ?? "").trim();
        if (!k) return false;
        if (!v) return false;
        if (f.type === "number" && (!Number.isFinite(Number(v)) || Number(v) <= 0)) return false;
      }
      return true;
    }
    return true;
  }, [dialog.mode, promptValue, formFields, formValues]);

  const body =
    dialog.mode === "prompt" ? (
      <div className="px-4 py-3">
        <input
          value={promptValue}
          onChange={(e) => setPromptValue(e.target.value)}
          placeholder={String(dialog.payload?.placeholder ?? "")}
          autoFocus
          className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2.5 py-2 text-xs text-white outline-none focus:border-[var(--color-accent)]"
        />
      </div>
    ) : dialog.mode === "form" ? (
      <div className="px-4 py-3 space-y-3">
        {formFields.map((f: any) => {
          const k = String(f?.key ?? "");
          const type = f?.type === "number" ? "number" : "text";
          return (
            <div key={k}>
              <div className="mb-1 text-[11px] text-neutral-500">{String(f?.label ?? k)}</div>
              <input
                value={String(formValues[k] ?? "")}
                onChange={(e) => setFormValues((prev) => ({ ...prev, [k]: e.target.value }))}
                placeholder={String(f?.placeholder ?? "")}
                type={type}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2.5 py-2 text-xs text-white outline-none focus:border-[var(--color-accent)]"
              />
            </div>
          );
        })}
      </div>
    ) : dialog.details ? (
      <div className="max-h-[50vh] overflow-auto px-4 py-3 text-[11px] leading-relaxed text-neutral-300 whitespace-pre-wrap">{dialog.details}</div>
    ) : null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (dialog.cancelText) dialog.resolve(false);
      }}
    >
      <div className="w-[520px] max-w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-white">{dialog.title}</div>
            <div className="mt-1 whitespace-pre-wrap break-words text-xs text-neutral-300">{dialog.message}</div>
          </div>
          {showCopy ? (
            <button
              onClick={async () => {
                try {
                  if (dialog.mode === "prompt") await copyText(promptValue);
                  else if (dialog.mode === "form") await copyText(JSON.stringify(formValues, null, 2));
                  else await copyText(detailsText);
                  ui.toast.info("已复制");
                } catch {
                  ui.toast.error("复制失败");
                }
              }}
              className="shrink-0 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2.5 py-1 text-[11px] text-neutral-200 hover:text-white"
            >
              复制详情
            </button>
          ) : null}
        </div>

        {body}

        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-4 py-3">
          {dialog.cancelText ? (
            <button
              onClick={() => dialog.resolve(false)}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-1.5 text-xs text-neutral-300 hover:text-white"
            >
              {dialog.cancelText}
            </button>
          ) : null}
          <button
            onClick={() => {
              if (dialog.mode === "prompt") dialog.resolve(true, promptValue);
              else if (dialog.mode === "form") dialog.resolve(true, formValues);
              else dialog.resolve(true);
            }}
            disabled={!canConfirm}
            className={`rounded-md px-3 py-1.5 text-xs font-medium text-white ${
              dialog.danger ? "bg-red-600 hover:bg-red-600/90" : "bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90"
            } ${!canConfirm ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            {dialog.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

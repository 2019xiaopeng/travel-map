import { useEffect, useRef } from "react";
import { uiStores } from "../services/ui";

const colors: Record<string, string> = {
  success: "border-emerald-500/30 text-emerald-200",
  error: "border-red-500/30 text-red-200",
  info: "border-[var(--color-border)] text-neutral-200",
};

export function ToastViewport() {
  const toasts = uiStores.toast((s) => s.toasts);
  const dismiss = uiStores.toast((s) => s.dismiss);
  const timers = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    for (const t of toasts) {
      if (timers.current.has(t.id)) continue;
      const timer = setTimeout(() => {
        timers.current.delete(t.id);
        dismiss(t.id);
      }, t.durationMs);
      timers.current.set(t.id, timer);
    }

    const existing = new Set(toasts.map((t) => t.id));
    for (const [k, v] of timers.current.entries()) {
      if (existing.has(k)) continue;
      clearTimeout(v);
      timers.current.delete(k);
    }
  }, [toasts, dismiss]);

  useEffect(() => {
    return () => {
      for (const v of timers.current.values()) clearTimeout(v);
      timers.current.clear();
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 bottom-4 z-[80] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-xl border bg-black/70 px-3 py-2 text-xs backdrop-blur ${colors[t.kind] ?? colors.info}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="break-words">{t.message}</div>
              {t.details ? <div className="mt-1 whitespace-pre-wrap break-words text-[11px] text-neutral-400">{t.details}</div> : null}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-neutral-400 hover:text-white"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

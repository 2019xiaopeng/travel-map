import { ui, uiStores } from "../services/ui";

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

  const detailsText = [dialog.message, dialog.details ? `\n\n${dialog.details}` : ""].join("");

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-[520px] max-w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-white">{dialog.title}</div>
            <div className="mt-1 whitespace-pre-wrap break-words text-xs text-neutral-300">{dialog.message}</div>
          </div>
          {dialog.details ? (
            <button
              onClick={async () => {
                try {
                  await copyText(detailsText);
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

        {dialog.details ? (
          <div className="max-h-[50vh] overflow-auto px-4 py-3 text-[11px] leading-relaxed text-neutral-300 whitespace-pre-wrap">
            {dialog.details}
          </div>
        ) : null}

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
            onClick={() => dialog.resolve(true)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium text-white ${
              dialog.danger ? "bg-red-600 hover:bg-red-600/90" : "bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90"
            }`}
          >
            {dialog.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}


import { create } from "zustand";

export type ToastKind = "success" | "error" | "info";

export type ToastItem = {
  id: string;
  kind: ToastKind;
  message: string;
  details?: string;
  durationMs: number;
};

export type DialogItem = {
  id: string;
  mode: "confirm" | "alert";
  title: string;
  message: string;
  details?: string;
  confirmText: string;
  cancelText?: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
};

function id() {
  const anyCrypto = globalThis.crypto as any;
  const uuid = anyCrypto?.randomUUID?.bind(anyCrypto);
  if (typeof uuid === "function") return uuid();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const uiStores = {
  toast: create<{
    toasts: ToastItem[];
    push: (toast: Omit<ToastItem, "id">) => string;
    dismiss: (toastId: string) => void;
    clear: () => void;
  }>((set, get) => ({
    toasts: [],
    push: (toast) => {
      const toastId = id();
      const next: ToastItem = { ...toast, id: toastId };
      const prev = get().toasts;
      const capped = [...prev, next].slice(-5);
      set({ toasts: capped });
      return toastId;
    },
    dismiss: (toastId) => set({ toasts: get().toasts.filter((t) => t.id !== toastId) }),
    clear: () => set({ toasts: [] }),
  })),
  dialog: create<{
    dialog: DialogItem | null;
    setDialog: (next: DialogItem | null) => void;
  }>((set) => ({
    dialog: null,
    setDialog: (next) => set({ dialog: next }),
  })),
};

export const ui = {
  toast: {
    success: (message: string, options?: { details?: string; durationMs?: number }) =>
      uiStores.toast.getState().push({ kind: "success", message, details: options?.details, durationMs: options?.durationMs ?? 2500 }),
    error: (message: string, options?: { details?: string; durationMs?: number }) =>
      uiStores.toast.getState().push({ kind: "error", message, details: options?.details, durationMs: options?.durationMs ?? 3500 }),
    info: (message: string, options?: { details?: string; durationMs?: number }) =>
      uiStores.toast.getState().push({ kind: "info", message, details: options?.details, durationMs: options?.durationMs ?? 2500 }),
  },
  confirm: (input: {
    title: string;
    message: string;
    details?: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
  }) => {
    const current = uiStores.dialog.getState().dialog;
    if (current) current.resolve(false);

    return new Promise<boolean>((resolve) => {
      const dialogId = id();
      const finalize = (ok: boolean) => {
        uiStores.dialog.getState().setDialog(null);
        resolve(ok);
      };
      uiStores.dialog.getState().setDialog({
        id: dialogId,
        mode: "confirm",
        title: input.title,
        message: input.message,
        details: input.details,
        confirmText: input.confirmText ?? "确定",
        cancelText: input.cancelText ?? "取消",
        danger: input.danger ?? false,
        resolve: finalize,
      });
    });
  },
  alert: (input: { title: string; message: string; details?: string; confirmText?: string }) => {
    const current = uiStores.dialog.getState().dialog;
    if (current) current.resolve(false);

    return new Promise<void>((resolve) => {
      const dialogId = id();
      const finalize = () => {
        uiStores.dialog.getState().setDialog(null);
        resolve();
      };
      uiStores.dialog.getState().setDialog({
        id: dialogId,
        mode: "alert",
        title: input.title,
        message: input.message,
        details: input.details,
        confirmText: input.confirmText ?? "确定",
        cancelText: undefined,
        danger: false,
        resolve: () => finalize(),
      });
    });
  },
};


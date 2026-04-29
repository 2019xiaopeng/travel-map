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
  mode: "confirm" | "alert" | "prompt" | "form";
  title: string;
  message: string;
  details?: string;
  confirmText: string;
  cancelText?: string;
  danger: boolean;
  payload?: any;
  resolve: (ok: boolean, data?: any) => void;
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
        resolve: (ok) => finalize(ok),
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
  prompt: (input: { title: string; message: string; placeholder?: string; defaultValue?: string; confirmText?: string; cancelText?: string }) => {
    const current = uiStores.dialog.getState().dialog;
    if (current) current.resolve(false);

    return new Promise<string | null>((resolve) => {
      const dialogId = id();
      uiStores.dialog.getState().setDialog({
        id: dialogId,
        mode: "prompt",
        title: input.title,
        message: input.message,
        confirmText: input.confirmText ?? "确定",
        cancelText: input.cancelText ?? "取消",
        danger: false,
        payload: { placeholder: input.placeholder ?? "", defaultValue: input.defaultValue ?? "" },
        resolve: (ok, data) => {
          uiStores.dialog.getState().setDialog(null);
          if (!ok) return resolve(null);
          resolve(String(data ?? "").trim());
        },
      });
    });
  },
  form: (input: {
    title: string;
    message: string;
    fields: Array<{ key: string; label: string; type: "text" | "number"; placeholder?: string; defaultValue?: string }>;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
  }) => {
    const current = uiStores.dialog.getState().dialog;
    if (current) current.resolve(false);

    return new Promise<Record<string, string> | null>((resolve) => {
      const dialogId = id();
      uiStores.dialog.getState().setDialog({
        id: dialogId,
        mode: "form",
        title: input.title,
        message: input.message,
        confirmText: input.confirmText ?? "确定",
        cancelText: input.cancelText ?? "取消",
        danger: input.danger ?? false,
        payload: { fields: input.fields },
        resolve: (ok, data) => {
          uiStores.dialog.getState().setDialog(null);
          if (!ok) return resolve(null);
          resolve((data ?? null) as any);
        },
      });
    });
  },
};

import { create } from "zustand";

type AlertDialog = {
  kind: "alert";
  title?: string;
  message: string;
  variant?: "default" | "error" | "success";
  resolve: () => void;
};

type ConfirmDialog = {
  kind: "confirm";
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  resolve: (ok: boolean) => void;
};

export type Dialog = AlertDialog | ConfirmDialog;

type State = {
  current: Dialog | null;
  open: (d: Dialog) => void;
  close: () => void;
};

export const useDialogs = create<State>((set) => ({
  current: null,
  open: (d) => set({ current: d }),
  close: () => set({ current: null }),
}));

// ─── Хелперы для использования в коде ────────────────
export function alertDialog(
  message: string,
  opts: { title?: string; variant?: "default" | "error" | "success" } = {}
): Promise<void> {
  return new Promise((resolve) => {
    useDialogs.getState().open({
      kind: "alert",
      message,
      title: opts.title,
      variant: opts.variant,
      resolve: () => {
        useDialogs.getState().close();
        resolve();
      },
    });
  });
}

export function confirmDialog(
  message: string,
  opts: {
    title?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "default" | "danger";
  } = {}
): Promise<boolean> {
  return new Promise((resolve) => {
    useDialogs.getState().open({
      kind: "confirm",
      message,
      title: opts.title,
      confirmLabel: opts.confirmLabel,
      cancelLabel: opts.cancelLabel,
      variant: opts.variant,
      resolve: (ok) => {
        useDialogs.getState().close();
        resolve(ok);
      },
    });
  });
}
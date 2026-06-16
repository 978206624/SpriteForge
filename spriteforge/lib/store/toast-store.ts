import { create } from "zustand";

export type ToastTone = "error" | "info";

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, tone?: ToastTone) => void;
  dismiss: (id: number) => void;
}

let seq = 0;
/** Cap the visible queue so a repeatedly-firing effect can't flood the screen. */
const MAX_TOASTS = 4;

/** Lightweight global toast queue for transient runtime errors (worker crashes,
 *  export/IO failures) that don't belong to a single step's inline state. */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (message, tone = "error") =>
    set((s) => {
      // de-dupe an identical message that's already showing (e.g. a restore
      // effect re-firing on range/fps change)
      if (s.toasts.some((t) => t.message === message)) return s;
      const next = [...s.toasts, { id: ++seq, message, tone }];
      return { toasts: next.slice(-MAX_TOASTS) };
    }),
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative helper for non-component code (catch blocks, orchestration). */
export function pushToast(message: string, tone: ToastTone = "error"): void {
  useToastStore.getState().push(message, tone);
}

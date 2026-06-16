"use client";

import { useEffect } from "react";
import { AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToastStore, type Toast } from "@/lib/store/toast-store";

/** Auto-dismiss delay for a toast. */
const TTL_MS = 6000;

function ToastItem({ id, message, tone }: Toast) {
  const dismiss = useToastStore((s) => s.dismiss);

  useEffect(() => {
    const t = setTimeout(() => dismiss(id), TTL_MS);
    return () => clearTimeout(t);
  }, [id, dismiss]);

  const Icon = tone === "error" ? AlertTriangle : Info;
  return (
    <div
      // errors interrupt (assertive); info is polite
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-md border px-3.5 py-2.5 text-[13px] shadow-lg",
        tone === "error"
          ? "border-error/40 bg-error/10 text-error"
          : "border-line bg-elevated text-fg",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={() => dismiss(id)}
        aria-label="关闭"
        className="rounded p-0.5 text-current/70 transition-colors hover:text-current"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

/** Fixed-position host that renders queued toasts. Mount once near the app root. */
export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem {...t} />
        </div>
      ))}
    </div>
  );
}

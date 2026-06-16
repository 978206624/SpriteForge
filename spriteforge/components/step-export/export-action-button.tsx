"use client";

import { Download, Loader2 } from "lucide-react";

interface ExportActionButtonProps {
  onClick: () => void;
  busy: boolean;
  disabled: boolean;
}

/** Presentational export button shared by the plain and auth-gated triggers. */
export function ExportActionButton({ onClick, busy, disabled }: ExportActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-2 rounded-md bg-brand-strong px-4 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-strong-hover disabled:opacity-50"
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Download className="size-4" />
      )}
      {busy ? "正在导出…" : "导出"}
    </button>
  );
}

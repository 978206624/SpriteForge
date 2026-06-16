"use client";

import { AlertTriangle, Film, Loader2, RotateCcw, X } from "lucide-react";
import { estimateFrameCount } from "@/lib/video/probe";
import { useWorkflowStore } from "@/lib/store/workflow-store";

interface ExtractButtonProps {
  onExtract: () => void;
  onCancel: () => void;
}

export function ExtractButton({ onExtract, onCancel }: ExtractButtonProps) {
  const status = useWorkflowStore((s) => s.extractStatus);
  const progress = useWorkflowStore((s) => s.extractProgress);
  const error = useWorkflowStore((s) => s.extractError);
  const frameCount = useWorkflowStore((s) => s.frames.length);
  const meta = useWorkflowStore((s) => s.videoMeta);
  const inTime = useWorkflowStore((s) => s.inTime);
  const outTime = useWorkflowStore((s) => s.outTime);
  const fps = useWorkflowStore((s) => s.fps);

  const estimated = estimateFrameCount(inTime, outTime, fps, meta);

  if (status === "extracting") {
    const pct =
      progress.total > 0
        ? Math.round((progress.done / progress.total) * 100)
        : 0;
    return (
      <div className="flex flex-col gap-2.5 rounded-lg border border-line bg-panel p-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-medium text-fg">
            <Loader2 className="size-4 animate-spin text-brand" />
            正在提取帧…
          </span>
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[13px] text-fg-muted transition-colors hover:bg-hover hover:text-fg"
          >
            <X className="size-3.5" />
            取消
          </button>
        </div>
        <div className="progress-sweep relative h-2 overflow-hidden rounded-full bg-elevated">
          <div
            className="relative h-full rounded-full bg-brand transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="font-mono text-[12px] text-fg-subtle">
          {progress.done} / {progress.total} 帧（{pct}%）
        </span>
      </div>
    );
  }

  if (status === "done" && frameCount > 0) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-panel px-4 py-3">
        <span className="text-sm text-fg">
          已提取 <span className="font-semibold text-brand">{frameCount}</span> 帧
        </span>
        <button
          type="button"
          onClick={onExtract}
          className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[13px] font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg"
        >
          <RotateCcw className="size-3.5" />
          重新提取
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onExtract}
        className="flex items-center justify-center gap-2 rounded-md bg-brand-strong px-4 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-strong-hover"
      >
        <Film className="size-4" />
        提取帧
      </button>
      <span className="text-center text-[12px] text-fg-subtle">
        预计提取约 {estimated} 帧（按当前区间与帧率）
      </span>
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-error/40 bg-error/10 px-3.5 py-2.5 text-[13px] text-error">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          提取失败：{error}
        </div>
      )}
    </div>
  );
}

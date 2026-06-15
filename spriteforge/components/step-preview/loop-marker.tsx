"use client";

import { Flag, X } from "lucide-react";
import { useWorkflowStore } from "@/lib/store/workflow-store";

/**
 * Mark a loop sub-segment from the current playhead. Start/end are frame-array
 * positions; the range is written to the workflow state for seamless preview
 * looping and the export config.
 */
export function LoopMarker() {
  const frames = useWorkflowStore((s) => s.frames);
  const previewIndex = useWorkflowStore((s) => s.previewIndex);
  const loopRange = useWorkflowStore((s) => s.loopRange);
  const setLoopRange = useWorkflowStore((s) => s.setLoopRange);

  if (frames.length === 0) return null;

  const setStart = () => {
    const end = loopRange?.end ?? frames.length - 1;
    setLoopRange({ start: previewIndex, end: Math.max(previewIndex, end) });
  };
  const setEnd = () => {
    const start = loopRange?.start ?? 0;
    setLoopRange({ start: Math.min(start, previewIndex), end: previewIndex });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[13px] text-fg-muted">循环区间</span>
      <button
        type="button"
        onClick={setStart}
        className="flex items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-[13px] text-fg-muted transition-colors hover:bg-hover hover:text-fg"
      >
        <Flag className="size-3.5" />
        设为起点
      </button>
      <button
        type="button"
        onClick={setEnd}
        className="flex items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-[13px] text-fg-muted transition-colors hover:bg-hover hover:text-fg"
      >
        <Flag className="size-3.5" />
        设为终点
      </button>
      {loopRange ? (
        <span className="flex items-center gap-2 font-mono text-[13px] text-brand">
          {loopRange.start + 1} – {loopRange.end + 1}
          <button
            type="button"
            onClick={() => setLoopRange(null)}
            aria-label="清除循环区间"
            className="rounded p-0.5 text-fg-muted transition-colors hover:bg-hover hover:text-fg"
          >
            <X className="size-3.5" />
          </button>
        </span>
      ) : (
        <span className="text-[13px] text-fg-subtle">全段循环</span>
      )}
    </div>
  );
}

"use client";

import { useCallback, useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteFrames } from "@/lib/frames/store";
import { useWorkflowStore } from "@/lib/store/workflow-store";
import type { FrameId } from "@/types";
import { AnimationPreview } from "./animation-preview";
import { DedupPanel } from "./dedup-panel";
import { FrameStrip } from "./frame-strip";
import { LoopMarker } from "./loop-marker";

export function PreviewStep() {
  const frames = useWorkflowStore((s) => s.frames);
  const selection = useWorkflowStore((s) => s.selection);
  const applyDeletion = useWorkflowStore((s) => s.applyDeletion);
  const clearSelection = useWorkflowStore((s) => s.clearSelection);
  const setPlaying = useWorkflowStore((s) => s.setPlaying);

  const [confirming, setConfirming] = useState(false);

  const handleDelete = useCallback(
    async (ids: FrameId[]) => {
      if (ids.length === 0) return;
      setPlaying(false);
      const next = await deleteFrames(ids);
      applyDeletion(next);
    },
    [applyDeletion, setPlaying],
  );

  const deleteSelected = async () => {
    await handleDelete(selection);
    setConfirming(false);
  };

  if (frames.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-fg-subtle">
          请先在第二步提取帧并完成抠图。
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <AnimationPreview />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <LoopMarker />

        {selection.length > 0 &&
          (confirming ? (
            <div className="flex items-center gap-2 text-[13px]">
              <span className="text-fg">删除选中的 {selection.length} 帧？</span>
              <button
                type="button"
                onClick={deleteSelected}
                className="rounded-md bg-error/90 px-3 py-1.5 font-semibold text-white transition-colors hover:bg-error"
              >
                确认删除
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-md border border-line px-3 py-1.5 text-fg-muted transition-colors hover:bg-hover hover:text-fg"
              >
                取消
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearSelection}
                className="rounded-md px-2 py-1.5 text-[13px] text-fg-muted transition-colors hover:bg-hover hover:text-fg"
              >
                清除选择（{selection.length}）
              </button>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="flex items-center gap-1.5 rounded-md border border-error/40 bg-error/10 px-3 py-1.5 text-[13px] font-medium text-error transition-colors hover:bg-error/20"
              >
                <Trash2 className="size-3.5" />
                删除选中 {selection.length} 帧
              </button>
            </div>
          ))}
      </div>

      <FrameStrip />
      <DedupPanel />
    </div>
  );
}

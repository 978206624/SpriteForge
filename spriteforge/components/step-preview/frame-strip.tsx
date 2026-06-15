"use client";

import { useMemo } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { inLoop } from "@/lib/frames/loop";
import { useThumbnailUrls } from "@/components/shared/use-thumbnail-urls";
import { useWorkflowStore } from "@/lib/store/workflow-store";

export function FrameStrip() {
  const frames = useWorkflowStore((s) => s.frames);
  const previewIndex = useWorkflowStore((s) => s.previewIndex);
  const selection = useWorkflowStore((s) => s.selection);
  const loopRange = useWorkflowStore((s) => s.loopRange);
  const setPreviewIndex = useWorkflowStore((s) => s.setPreviewIndex);
  const setPlaying = useWorkflowStore((s) => s.setPlaying);
  const toggleFrameSelection = useWorkflowStore((s) => s.toggleFrameSelection);

  const keys = useMemo(
    () => frames.map((f) => ({ id: f.id, rev: f.rev })),
    [frames],
  );
  const urls = useThumbnailUrls(keys);
  const selected = useMemo(() => new Set(selection), [selection]);

  if (frames.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {frames.map((frame, pos) => {
        const url = urls.get(frame.id) ?? null;
        const isCurrent = pos === previewIndex;
        const isSelected = selected.has(frame.id);
        const inRange = inLoop(loopRange, pos);
        return (
          <div
            key={frame.id}
            className={cn(
              "group relative h-16 w-16 shrink-0 overflow-hidden rounded-md ring-1 transition-colors",
              isCurrent ? "ring-2 ring-brand" : "ring-line hover:ring-line-strong",
              loopRange && !inRange && "opacity-40",
            )}
          >
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setPreviewIndex(pos);
              }}
              aria-label={`跳到第 ${pos + 1} 帧`}
              className="size-full bg-elevated"
            >
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element -- blob: object URL
                <img
                  src={url}
                  alt=""
                  className="size-full object-contain"
                  draggable={false}
                />
              ) : (
                <div className="size-full animate-pulse bg-hover" />
              )}
            </button>

            <button
              type="button"
              onClick={() => toggleFrameSelection(frame.id)}
              aria-label={isSelected ? `取消选择第 ${pos + 1} 帧` : `选择第 ${pos + 1} 帧`}
              aria-pressed={isSelected}
              className={cn(
                "absolute left-1 top-1 flex size-4 items-center justify-center rounded border transition-colors",
                isSelected
                  ? "border-brand bg-brand text-on-brand"
                  : "border-white/70 bg-black/40 text-transparent group-hover:border-white",
              )}
            >
              <Check className="size-3" />
            </button>

            <span className="pointer-events-none absolute bottom-0.5 right-1 font-mono text-[10px] text-white drop-shadow">
              {pos + 1}
            </span>
          </div>
        );
      })}
    </div>
  );
}

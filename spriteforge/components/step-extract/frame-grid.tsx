"use client";

import { useMemo } from "react";
import { useWorkflowStore } from "@/lib/store/workflow-store";
import { useThumbnailUrls } from "@/components/shared/use-thumbnail-urls";
import { FrameGridItem } from "./frame-grid-item";

export function FrameGrid() {
  const frames = useWorkflowStore((s) => s.frames);
  const selectedFrameId = useWorkflowStore((s) => s.selectedFrameId);
  const selectFrame = useWorkflowStore((s) => s.selectFrame);

  // stable id+rev list so the thumbnail effect only re-runs when frames or
  // their processed revisions actually change
  const keys = useMemo(
    () => frames.map((f) => ({ id: f.id, rev: f.rev })),
    [frames],
  );
  const urls = useThumbnailUrls(keys);

  if (frames.length === 0) return null;

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2.5">
      {frames.map((frame) => (
        <FrameGridItem
          key={frame.id}
          index={frame.index}
          url={urls.get(frame.id) ?? null}
          processed={frame.processed}
          needsAttention={frame.needsAttention}
          hasOverride={frame.overrideParams !== null}
          selected={frame.id === selectedFrameId}
          onSelect={() => selectFrame(frame.id)}
        />
      ))}
    </div>
  );
}

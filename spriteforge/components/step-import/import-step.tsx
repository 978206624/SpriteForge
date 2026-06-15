"use client";

import { useRef } from "react";
import { RotateCcw } from "lucide-react";
import { useWorkflowStore } from "@/lib/store/workflow-store";
import { VideoUploader } from "./video-uploader";
import { VideoPreview } from "./video-preview";
import { TimelineRange } from "./timeline-range";
import { FpsSelect } from "./fps-select";
import { VideoInfo } from "./video-info";

export function ImportStep() {
  const videoMeta = useWorkflowStore((s) => s.videoMeta);
  const clearVideo = useWorkflowStore((s) => s.clearVideo);
  const videoRef = useRef<HTMLVideoElement>(null);

  if (!videoMeta) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <VideoUploader />
      </div>
    );
  }

  return (
    <div className="flex h-full gap-4 p-4">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <VideoPreview videoRef={videoRef} />
        <TimelineRange videoRef={videoRef} />
      </div>

      <aside className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto">
        <FpsSelect />
        <VideoInfo />
        <button
          type="button"
          onClick={clearVideo}
          className="flex items-center justify-center gap-1.5 rounded-md border border-line px-3 py-2 text-[13px] font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg"
        >
          <RotateCcw className="size-3.5" />
          重新选择视频
        </button>
      </aside>
    </div>
  );
}

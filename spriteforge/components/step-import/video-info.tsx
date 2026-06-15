"use client";

import { AlertTriangle } from "lucide-react";
import {
  estimateBytes,
  estimateFrameCount,
  resolveFps,
} from "@/lib/video/probe";
import { useWorkflowStore } from "@/lib/store/workflow-store";

/** Above this estimated frame count we warn about memory/perf pressure. */
const FRAME_WARN_THRESHOLD = 300;

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-[13px] text-fg-subtle">{label}</span>
      <span className="font-mono text-[13px] text-fg">{value}</span>
    </div>
  );
}

export function VideoInfo() {
  const meta = useWorkflowStore((s) => s.videoMeta);
  const inTime = useWorkflowStore((s) => s.inTime);
  const outTime = useWorkflowStore((s) => s.outTime);
  const fps = useWorkflowStore((s) => s.fps);

  if (!meta) return null;

  const span = Math.max(0, outTime - inTime);
  const effFps = resolveFps(fps, meta);
  const frameCount = estimateFrameCount(inTime, outTime, fps, meta);
  const sizeBytes = estimateBytes(frameCount, meta);
  const overLimit = frameCount > FRAME_WARN_THRESHOLD;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-line bg-panel p-4">
        <h3 className="mb-1 text-sm font-semibold text-fg">视频信息</h3>
        <div className="divide-y divide-line/60">
          <Row label="文件名" value={meta.name} />
          <Row label="分辨率" value={`${meta.width} × ${meta.height}`} />
          <Row label="时长" value={formatDuration(meta.duration)} />
          <Row label="估算帧率" value={`${meta.estimatedFps} fps`} />
          <Row label="文件大小" value={formatBytes(meta.size)} />
        </div>
      </div>

      <div className="rounded-lg border border-brand/30 bg-brand-soft p-4">
        <h3 className="mb-1 text-sm font-semibold text-fg">导出预计</h3>
        <div className="divide-y divide-line/60">
          <Row label="选中区间" value={formatDuration(span)} />
          <Row label="导出帧率" value={`${effFps} fps`} />
          <Row label="预计帧数" value={`${frameCount} 帧`} />
          <Row label="预计大小（约）" value={formatBytes(sizeBytes)} />
        </div>
      </div>

      {overLimit && (
        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3.5 py-2.5 text-[13px] text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          帧数过多（{frameCount} 帧）可能卡顿或内存不足，建议缩小区间或降低 fps。
        </div>
      )}
    </div>
  );
}

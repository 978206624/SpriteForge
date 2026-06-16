"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ExportFps } from "@/types";
import { useWorkflowStore } from "@/lib/store/workflow-store";
import { estimateFrameCount, resolveFps } from "@/lib/video/probe";

const FPS_MIN = 1;
const FPS_MAX = 60;

export function FpsSelect() {
  const fps = useWorkflowStore((s) => s.fps);
  const setFps = useWorkflowStore((s) => s.setFps);
  const meta = useWorkflowStore((s) => s.videoMeta);
  const inTime = useWorkflowStore((s) => s.inTime);
  const outTime = useWorkflowStore((s) => s.outTime);

  // local draft of the numeric field so the user can clear it mid-edit (an empty
  // string would otherwise be coerced to 0 and rejected, snapping back the value)
  const [draft, setDraft] = useState<string | null>(null);

  const isOriginal = fps === "original";
  // numeric fps the extraction will actually use ("original" → source estimate);
  // drives the slider position, the placeholder, and the frame-count estimate
  const resolved = resolveFps(fps, meta);
  // slider position clamps to [MIN, MAX]; the underlying value may exceed it
  // (e.g. a 120fps source in "original" mode) without moving the thumb past max
  const sliderValue = Math.min(FPS_MAX, Math.max(FPS_MIN, Math.round(resolved)));
  const estimated = estimateFrameCount(inTime, outTime, fps, meta);

  // committing from slider / button clears any half-typed numeric draft
  function commit(next: ExportFps) {
    setDraft(null);
    setFps(next);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-medium text-fg-muted">帧率</span>
        <span className="text-[12px] text-fg-subtle">
          每秒从视频中提取多少张画面
        </span>
      </div>

      {/* slider 1–60 */}
      <div className="flex items-center gap-2.5">
        <span className="font-mono text-[12px] text-fg-subtle">{FPS_MIN}</span>
        <input
          type="range"
          min={FPS_MIN}
          max={FPS_MAX}
          step={1}
          value={sliderValue}
          onChange={(e) => commit(Number(e.target.value))}
          aria-label="提取帧率"
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-elevated accent-brand"
        />
        <span className="font-mono text-[12px] text-fg-subtle">{FPS_MAX}</span>
      </div>

      {/* numeric input + 原始帧率 shortcut */}
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={FPS_MIN}
          max={FPS_MAX}
          value={draft ?? (isOriginal ? "" : String(fps))}
          placeholder={isOriginal ? String(Math.round(resolved)) : undefined}
          onChange={(e) => {
            const raw = e.target.value;
            setDraft(raw);
            const n = Math.round(Number(raw));
            if (raw !== "" && Number.isFinite(n) && n > 0) {
              setFps(Math.min(FPS_MAX, Math.max(FPS_MIN, n)));
            }
          }}
          onBlur={() => setDraft(null)}
          className="w-16 rounded-md border border-line bg-elevated px-2 py-1 text-center font-mono text-[13px] text-fg outline-none focus:border-brand"
        />
        <span className="text-[13px] text-fg-subtle">帧/秒</span>
        <button
          type="button"
          onClick={() => commit("original")}
          className={cn(
            "ml-auto rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
            isOriginal
              ? "bg-brand-strong text-on-brand"
              : "bg-elevated text-fg-muted ring-1 ring-line hover:bg-hover hover:text-fg",
          )}
        >
          {/* show the source rate when active, so a >60 source explains why the
              slider rests at its max while the estimate counts the real rate */}
          {isOriginal && meta ? `原始 ${Math.round(resolved)}` : "原始帧率"}
        </button>
      </div>

      {/* live estimate */}
      <div className="flex items-center justify-between rounded-lg border border-line bg-elevated px-3.5 py-2.5">
        <span className="text-[12px] text-fg-muted">预估帧数</span>
        <span className="font-mono text-[15px] font-semibold text-brand">
          {estimated}{" "}
          <span className="text-[12px] font-normal text-fg-subtle">帧</span>
        </span>
      </div>
    </div>
  );
}

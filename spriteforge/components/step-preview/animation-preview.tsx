"use client";

import { useEffect, useMemo, useRef } from "react";
import { Pause, Play, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkerboard } from "@/components/shared/checkerboard";
import { useWorkflowStore } from "@/lib/store/workflow-store";
import { useFrameBitmaps } from "./use-frame-bitmaps";

export function AnimationPreview() {
  const frames = useWorkflowStore((s) => s.frames);
  const videoMeta = useWorkflowStore((s) => s.videoMeta);
  const isPlaying = useWorkflowStore((s) => s.isPlaying);
  const playbackFps = useWorkflowStore((s) => s.playbackFps);
  const looping = useWorkflowStore((s) => s.looping);
  const previewIndex = useWorkflowStore((s) => s.previewIndex);
  const setPlaying = useWorkflowStore((s) => s.setPlaying);
  const setPlaybackFps = useWorkflowStore((s) => s.setPlaybackFps);
  const setLooping = useWorkflowStore((s) => s.setLooping);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const keys = useMemo(
    () => frames.map((f) => ({ id: f.id, rev: f.rev })),
    [frames],
  );
  const bitmaps = useFrameBitmaps(
    keys,
    videoMeta?.width ?? 0,
    videoMeta?.height ?? 0,
  );

  // playback loop: advance the playhead based on the chosen fps, honoring the
  // loop range and the loop on/off toggle (reads live store state each tick)
  useEffect(() => {
    if (!isPlaying || frames.length === 0) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const tick = (now: number) => {
      const s = useWorkflowStore.getState();
      acc += now - last;
      last = now;
      const interval = 1000 / s.playbackFps;
      if (acc >= interval) {
        // advance by however many intervals elapsed so playback stays
        // time-accurate even when a frame (tab throttle, GC) ran long
        const steps = Math.floor(acc / interval);
        acc -= steps * interval;
        const lo = s.loopRange?.start ?? 0;
        const hi = s.loopRange?.end ?? s.frames.length - 1;
        let cur = s.previewIndex;
        let stopped = false;
        for (let n = 0; n < steps; n++) {
          if (cur < lo || cur > hi) {
            cur = lo;
          } else if (cur >= hi) {
            if (s.looping) cur = lo;
            else {
              stopped = true;
              break;
            }
          } else {
            cur += 1;
          }
        }
        s.setPreviewIndex(cur);
        if (stopped) s.setPlaying(false);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, frames.length]);

  // paint the current frame
  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = frames[previewIndex];
    const bitmap = frame ? bitmaps.get(frame.id) : undefined;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (!bitmap) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    if (canvas.width !== bitmap.width) canvas.width = bitmap.width;
    if (canvas.height !== bitmap.height) canvas.height = bitmap.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
  }, [previewIndex, bitmaps, frames]);

  const total = frames.length;

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <Checkerboard
        size={12}
        className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg border border-line"
      >
        <canvas
          ref={canvasRef}
          className="max-h-[48vh] max-w-full object-contain"
        />
      </Checkerboard>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => setPlaying(!isPlaying)}
          disabled={total === 0}
          className="flex items-center gap-2 rounded-md bg-brand-strong px-4 py-2 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-strong-hover disabled:opacity-50"
        >
          {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
          {isPlaying ? "暂停" : "播放"}
        </button>

        <button
          type="button"
          onClick={() => setLooping(!looping)}
          aria-pressed={looping}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-medium ring-1 transition-colors",
            looping
              ? "bg-brand-soft text-brand ring-brand/40"
              : "text-fg-muted ring-line hover:bg-hover hover:text-fg",
          )}
        >
          <Repeat className="size-3.5" />
          循环
        </button>

        <label className="flex items-center gap-2">
          <span className="text-[13px] text-fg-muted">速度</span>
          <input
            type="range"
            min={1}
            max={60}
            value={playbackFps}
            onChange={(e) => setPlaybackFps(Number(e.target.value))}
            className="h-1.5 w-28 cursor-pointer appearance-none rounded-full bg-elevated accent-brand"
          />
          <span className="w-14 font-mono text-[13px] text-fg">
            {playbackFps} fps
          </span>
        </label>

        <span className="ml-auto font-mono text-[13px] text-fg-subtle">
          {total > 0 ? previewIndex + 1 : 0} / {total}
        </span>
      </div>
    </div>
  );
}

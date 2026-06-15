"use client";

import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { LoaderCircle } from "lucide-react";
import { generateThumbnails } from "@/lib/video/thumbnails";
import { useWorkflowStore } from "@/lib/store/workflow-store";

const THUMB_COUNT = 16;
type Handle = "in" | "out";

export function TimelineRange({
  videoRef,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  const videoUrl = useWorkflowStore((s) => s.videoUrl);
  const duration = useWorkflowStore((s) => s.videoMeta?.duration ?? 0);
  const inTime = useWorkflowStore((s) => s.inTime);
  const outTime = useWorkflowStore((s) => s.outTime);
  const setInTime = useWorkflowStore((s) => s.setInTime);
  const setOutTime = useWorkflowStore((s) => s.setOutTime);

  const trackRef = useRef<HTMLDivElement>(null);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [loadingThumbs, setLoadingThumbs] = useState(false);
  const [dragging, setDragging] = useState<Handle | null>(null);
  const [playhead, setPlayhead] = useState(0);

  // generate the thumbnail strip whenever the source video changes
  useEffect(() => {
    if (!videoUrl) return;
    const controller = new AbortController();
    const load = async () => {
      setLoadingThumbs(true);
      setThumbs([]);
      try {
        const t = await generateThumbnails(videoUrl, THUMB_COUNT, controller.signal);
        if (!controller.signal.aborted) setThumbs(t);
      } catch {
        if (!controller.signal.aborted) setThumbs([]);
      } finally {
        if (!controller.signal.aborted) setLoadingThumbs(false);
      }
    };
    void load();
    return () => {
      controller.abort();
    };
  }, [videoUrl]);

  // keep the playhead synced to the preview video while it plays
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    let raf = 0;
    const tick = () => {
      setPlayhead(v.currentTime);
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      setPlayhead(v.currentTime);
    };
    v.addEventListener("play", start);
    v.addEventListener("pause", stop);
    v.addEventListener("seeked", stop);
    if (!v.paused) start(); // already playing when this mounts
    return () => {
      cancelAnimationFrame(raf);
      v.removeEventListener("play", start);
      v.removeEventListener("pause", stop);
      v.removeEventListener("seeked", stop);
    };
  }, [videoRef]);

  const pct = (t: number) => (duration > 0 ? (t / duration) * 100 : 0);

  function timeAt(clientX: number): number {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return frac * duration;
  }

  function onHandleDown(handle: Handle, e: ReactPointerEvent) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(handle);
  }

  function onHandleMove(handle: Handle, e: ReactPointerEvent) {
    if (dragging !== handle) return;
    const t = timeAt(e.clientX);
    if (handle === "in") setInTime(t);
    else setOutTime(t);
  }

  // pointerup, pointercancel and lostpointercapture all end the drag so the
  // `dragging` state never sticks (e.g. touch gesture interrupted by the OS)
  function endDrag(e: ReactPointerEvent) {
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDragging(null);
  }

  // keyboard nudging for the focused handle (a11y: role="slider")
  function onHandleKey(handle: Handle, e: ReactKeyboardEvent) {
    if (duration <= 0) return;
    const step = Math.max(0.1, duration / 100);
    const cur = handle === "in" ? inTime : outTime;
    let next: number | null = null;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = cur - step;
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") next = cur + step;
    else if (e.key === "Home") next = handle === "in" ? 0 : inTime;
    else if (e.key === "End") next = handle === "in" ? outTime : duration;
    if (next === null) return;
    e.preventDefault();
    if (handle === "in") setInTime(next);
    else setOutTime(next);
  }

  // click on the track (outside handles) seeks the preview
  function onTrackDown(e: ReactPointerEvent) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = timeAt(e.clientX);
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={trackRef}
        onPointerDown={onTrackDown}
        className="relative h-11 w-full cursor-pointer touch-none overflow-hidden rounded-md border border-line bg-elevated select-none"
      >
        {/* thumbnail strip */}
        <div className="absolute inset-0 flex">
          {loadingThumbs && (
            <div className="flex w-full items-center justify-center gap-2 text-xs text-fg-subtle">
              <LoaderCircle className="size-3.5 animate-spin" />
              生成时间轴缩略图…
            </div>
          )}
          {thumbs.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              alt=""
              draggable={false}
              className="h-full flex-1 object-cover"
            />
          ))}
        </div>

        {/* dim outside the selected range */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 bg-black/55"
          style={{ width: `${pct(inTime)}%` }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 bg-black/55"
          style={{ width: `${100 - pct(outTime)}%` }}
        />

        {/* selected-range border */}
        <div
          className="pointer-events-none absolute inset-y-0 border-y-2 border-brand"
          style={{
            left: `${pct(inTime)}%`,
            width: `${Math.max(0, pct(outTime) - pct(inTime))}%`,
          }}
        />

        {/* playhead */}
        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-white/90"
          style={{ left: `${pct(playhead)}%` }}
        />

        {/* in / out handles */}
        {(["in", "out"] as const).map((h) => {
          const value = h === "in" ? inTime : outTime;
          return (
            <div
              key={h}
              role="slider"
              tabIndex={0}
              aria-label={h === "in" ? "区间起点" : "区间终点"}
              aria-valuemin={h === "in" ? 0 : inTime}
              aria-valuemax={h === "in" ? outTime : duration}
              aria-valuenow={value}
              aria-valuetext={`${value.toFixed(1)} 秒`}
              onPointerDown={(e) => onHandleDown(h, e)}
              onPointerMove={(e) => onHandleMove(h, e)}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onLostPointerCapture={endDrag}
              onKeyDown={(e) => onHandleKey(h, e)}
              className="absolute inset-y-0 z-10 flex w-3 -translate-x-1/2 cursor-ew-resize touch-none items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-brand"
              style={{ left: `${pct(value)}%` }}
            >
              <span className="h-full w-1 rounded-full bg-brand shadow-[0_0_0_1px_rgba(0,0,0,0.35)]" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

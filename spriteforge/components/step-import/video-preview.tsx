"use client";

import { type RefObject, useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { useWorkflowStore } from "@/lib/store/workflow-store";

function fmt(t: number): string {
  if (!Number.isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VideoPreview({
  videoRef,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  const videoUrl = useWorkflowStore((s) => s.videoUrl);
  const duration = useWorkflowStore((s) => s.videoMeta?.duration ?? 0);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => setCurrent(v.currentTime);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("timeupdate", onTime);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("timeupdate", onTime);
    };
  }, [videoRef]);

  function toggle() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }

  return (
    <div className="group relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg border border-line bg-black">
      <video
        ref={videoRef}
        src={videoUrl ?? undefined}
        className="max-h-full max-w-full"
        playsInline
        muted
        onClick={toggle}
      />

      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "暂停" : "播放"}
        className="absolute inset-0 grid place-items-center"
      >
        <span
          className={`grid size-14 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition-opacity ${
            playing ? "opacity-0 group-hover:opacity-100" : "opacity-100"
          }`}
        >
          {playing ? (
            <Pause className="size-6" />
          ) : (
            <Play className="size-6 translate-x-0.5" />
          )}
        </span>
      </button>

      <span className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 font-mono text-xs text-white">
        {fmt(current)} / {fmt(duration)}
      </span>
    </div>
  );
}

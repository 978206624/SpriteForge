"use client";

import { type RefObject, useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { useWorkflowStore } from "@/lib/store/workflow-store";

/** Small slack (s) so the loop wraps slightly before the exact out point,
 *  avoiding a frame of overshoot from coarse timeupdate granularity. */
const LOOP_SLACK = 0.03;

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
  const inTime = useWorkflowStore((s) => s.inTime);
  const outTime = useWorkflowStore((s) => s.outTime);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);

  // keep the latest range in refs so the timeupdate loop reads fresh values
  // without re-binding listeners on every slider drag
  const inRef = useRef(inTime);
  const outRef = useRef(outTime);
  inRef.current = inTime;
  outRef.current = outTime;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => {
      // keep the playhead inside the selected [in, out] clip *while playing*:
      // wrap back to in both when it runs past out and when it sits before in
      // (e.g. a timeline click / in-handle drag moved it left of the clip).
      // Gated on !paused so paused scrubbing can still inspect frames outside
      // the clip without being yanked back.
      const inn = inRef.current;
      const out = outRef.current;
      if (
        !v.paused &&
        out > inn &&
        (v.currentTime >= out - LOOP_SLACK || v.currentTime < inn)
      ) {
        v.currentTime = inn;
      }
      setCurrent(v.currentTime);
    };
    // fallback: when out ≈ duration the coarse timeupdate cadence can overshoot
    // the wrap window and let the clip end — restart it to keep the loop going.
    // Only loop a real clip; a degenerate/empty selection (out <= in) just ends.
    const onEnded = () => {
      const inn = inRef.current;
      const out = outRef.current;
      if (out > inn) {
        v.currentTime = inn;
        void v.play();
      }
    };
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnded);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("ended", onEnded);
    };
  }, [videoRef]);

  function toggle() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      // start playback from the in point if the playhead sits outside the clip
      const inn = inRef.current;
      const out = outRef.current;
      if (out > inn && (v.currentTime < inn || v.currentTime >= out - LOOP_SLACK)) {
        v.currentTime = inn;
      }
      void v.play();
    } else v.pause();
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

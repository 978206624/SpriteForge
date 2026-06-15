"use client";

import { useCallback, useEffect, useRef } from "react";
import { isManifestRestorable, videoSignature } from "@/lib/frames/model";
import {
  clearFrames,
  countFrames,
  getAllFrameMeta,
  getManifest,
} from "@/lib/frames/store";
import { extractFrames } from "@/lib/video/extract";
import { estimateFrameCount } from "@/lib/video/probe";
import { useWorkflowStore } from "@/lib/store/workflow-store";
import { ExtractButton } from "./extract-button";
import { FrameGrid } from "./frame-grid";

export function ExtractStep() {
  const videoUrl = useWorkflowStore((s) => s.videoUrl);
  const videoMeta = useWorkflowStore((s) => s.videoMeta);
  const inTime = useWorkflowStore((s) => s.inTime);
  const outTime = useWorkflowStore((s) => s.outTime);
  const fps = useWorkflowStore((s) => s.fps);

  const setFrames = useWorkflowStore((s) => s.setFrames);
  const appendFrame = useWorkflowStore((s) => s.appendFrame);
  const setExtractStatus = useWorkflowStore((s) => s.setExtractStatus);
  const setExtractProgress = useWorkflowStore((s) => s.setExtractProgress);
  const setExtractError = useWorkflowStore((s) => s.setExtractError);
  const resetFrames = useWorkflowStore((s) => s.resetFrames);

  const abortRef = useRef<AbortController | null>(null);

  // Reconcile IndexedDB ↔ current selection: restore only a *complete* cache
  // (manifest done + matching video/range/fps + frame count), otherwise discard
  // any stale/partial/mismatched frames. Skips when the store already holds
  // frames (mid-session navigation back to this step).
  useEffect(() => {
    if (!videoMeta) return;
    if (useWorkflowStore.getState().frames.length > 0) return;
    let cancelled = false;
    // Only touch state while the workflow is genuinely idle with no frames. If
    // the user starts (or finishes) an extraction during our async DB reads,
    // status leaves "idle" — we then bail so this stale reconciliation can
    // neither restore over, nor destructively clear, the fresh run's data.
    const isIdleEmpty = () => {
      const s = useWorkflowStore.getState();
      return s.extractStatus === "idle" && s.frames.length === 0;
    };
    void (async () => {
      try {
        const sig = videoSignature(
          videoMeta.name,
          videoMeta.size,
          videoMeta.duration,
        );
        const [manifest, count] = await Promise.all([
          getManifest(),
          countFrames(),
        ]);
        if (cancelled || !isIdleEmpty()) return;
        if (isManifestRestorable(manifest, sig, inTime, outTime, fps, count)) {
          const restored = await getAllFrameMeta();
          if (cancelled || !isIdleEmpty()) return;
          if (restored.length > 0) {
            setFrames(restored);
            setExtractStatus("done");
          }
        } else if (manifest !== null || count > 0) {
          await clearFrames();
        }
      } catch {
        // IndexedDB unavailable — extraction will surface a clear error
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [videoMeta, inTime, outTime, fps, setFrames, setExtractStatus]);

  // abort any in-flight extraction when leaving the step. Null the ref *before*
  // aborting so the old run's `isCurrent()` becomes false — its async catch then
  // can't reset/clobber a fresh run started after a quick remount. Also clear
  // the hanging in-memory state (no DB write) so returning mid-extraction never
  // finds a stuck "extracting" status with a dead worker.
  useEffect(() => {
    return () => {
      const ctrl = abortRef.current;
      abortRef.current = null;
      ctrl?.abort();
      if (useWorkflowStore.getState().extractStatus === "extracting") {
        useWorkflowStore.getState().resetFrames();
      }
    };
  }, []);

  const handleExtract = useCallback(async () => {
    if (!videoUrl || !videoMeta) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    // true only while this run is still the active one (guards every async
    // state mutation against a superseding re-extract or a user cancel)
    const isCurrent = () => abortRef.current === ctrl;

    resetFrames();
    setExtractStatus("extracting");
    setExtractError(null);
    setExtractProgress({
      done: 0,
      total: estimateFrameCount(inTime, outTime, fps, videoMeta),
    });

    try {
      await extractFrames({
        url: videoUrl,
        inTime,
        outTime,
        fps,
        meta: videoMeta,
        signal: ctrl.signal,
        onProgress: (done, total) => {
          if (isCurrent()) setExtractProgress({ done, total });
        },
        onFrame: (frame) => {
          if (isCurrent()) appendFrame(frame);
        },
      });
      // Reaching here means extractFrames resolved normally — every frame and
      // the "done" manifest were written (it throws on abort *before* that), so
      // a cancel that landed during the final manifest write is treated as a
      // completed extraction rather than left hanging in "extracting".
      if (isCurrent()) setExtractStatus("done");
    } catch (err) {
      if (!isCurrent()) return; // superseded by a newer run — it owns the state
      // Discard the partial result either way. We only reset in-memory state:
      // the partial IndexedDB rows keep their "extracting" manifest (never
      // restorable) and are wiped by the next extraction's leading clearFrames,
      // so there's no async DB write here to race a fresh run.
      resetFrames();
      if (!ctrl.signal.aborted) {
        setExtractError(err instanceof Error ? err.message : "提取失败");
      }
    }
  }, [
    videoUrl,
    videoMeta,
    inTime,
    outTime,
    fps,
    resetFrames,
    setExtractStatus,
    setExtractError,
    setExtractProgress,
    appendFrame,
  ]);

  const handleCancel = useCallback(() => abortRef.current?.abort(), []);

  if (!videoMeta) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-fg-subtle">请先在第一步导入视频。</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="shrink-0">
        <ExtractButton onExtract={handleExtract} onCancel={handleCancel} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <FrameGrid />
      </div>
    </div>
  );
}

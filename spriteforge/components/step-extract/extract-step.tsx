"use client";

import { useCallback, useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { isManifestRestorable, videoSignature } from "@/lib/frames/model";
import {
  clearFrames,
  countFrames,
  getAllFrameMeta,
  getManifest,
  updateManifestGlobalParams,
} from "@/lib/frames/store";
import { applyToAllFrames, processFrame } from "@/lib/image/chroma";
import { extractFrames } from "@/lib/video/extract";
import { estimateFrameCount } from "@/lib/video/probe";
import { useWorkflowStore } from "@/lib/store/workflow-store";
import type { ChromaParams } from "@/types";
import { ExtractButton } from "./extract-button";
import { FrameEditModal } from "./frame-edit-modal";
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

  const extractStatus = useWorkflowStore((s) => s.extractStatus);
  const frameCount = useWorkflowStore((s) => s.frames.length);
  const selectedFrameId = useWorkflowStore((s) => s.selectedFrameId);
  const selectFrame = useWorkflowStore((s) => s.selectFrame);
  const chromaStatus = useWorkflowStore((s) => s.chromaStatus);
  const chromaProgress = useWorkflowStore((s) => s.chromaProgress);
  const chromaError = useWorkflowStore((s) => s.chromaError);
  const setGlobalChromaParams = useWorkflowStore((s) => s.setGlobalChromaParams);
  const setChromaStatus = useWorkflowStore((s) => s.setChromaStatus);
  const setChromaProgress = useWorkflowStore((s) => s.setChromaProgress);
  const setChromaError = useWorkflowStore((s) => s.setChromaError);
  const updateFrameMeta = useWorkflowStore((s) => s.updateFrameMeta);

  const abortRef = useRef<AbortController | null>(null);
  const chromaAbortRef = useRef<AbortController | null>(null);

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
            // restore the global chroma params so frames without a per-frame
            // override resolve to the right effective params after refresh
            if (manifest?.globalChromaParams) {
              setGlobalChromaParams(manifest.globalChromaParams);
            }
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
  }, [
    videoMeta,
    inTime,
    outTime,
    fps,
    setFrames,
    setExtractStatus,
    setGlobalChromaParams,
  ]);

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

  // abort an in-flight batch keying when leaving the step
  useEffect(() => {
    return () => chromaAbortRef.current?.abort();
  }, []);

  // Apply `params` to every frame: set it as the global params, drop the edited
  // frame's override so it follows global, then reprocess all frames using each
  // frame's effective params (its own override, or the new global).
  const handleApplyToAll = useCallback(
    (params: ChromaParams) => {
      setGlobalChromaParams(params);
      if (selectedFrameId) updateFrameMeta(selectedFrameId, { overrideParams: null });
      // persist the new global params so they survive refresh (effective params
      // of non-overridden frames depend on them)
      void updateManifestGlobalParams(params);

      chromaAbortRef.current?.abort();
      const ctrl = new AbortController();
      chromaAbortRef.current = ctrl;
      const isCurrent = () => chromaAbortRef.current === ctrl;

      const frames = useWorkflowStore.getState().frames;
      setChromaError(null);
      setChromaStatus("processing");
      setChromaProgress({ done: 0, total: frames.length });

      void (async () => {
        try {
          await applyToAllFrames(frames, params, {
            signal: ctrl.signal,
            onProgress: (done, total) => {
              if (isCurrent()) setChromaProgress({ done, total });
            },
            onFrame: (id, meta) => {
              if (isCurrent()) updateFrameMeta(id, meta);
            },
          });
        } catch (err) {
          // an aborted run is intentional; surface only real worker/DB failures
          if (isCurrent() && !ctrl.signal.aborted) {
            setChromaError(err instanceof Error ? err.message : "抠图失败");
          }
        } finally {
          if (isCurrent()) setChromaStatus("idle");
        }
      })();
    },
    [
      selectedFrameId,
      setGlobalChromaParams,
      updateFrameMeta,
      setChromaStatus,
      setChromaProgress,
      setChromaError,
    ],
  );

  // Apply `params` to one frame only, as a per-frame override. Shares the batch
  // abort controller so starting either supersedes the other; resetting chroma
  // status here also clears a batch's "processing" bar that this just aborted.
  const handleApplySingle = useCallback(
    async (params: ChromaParams) => {
      if (!selectedFrameId) return;
      chromaAbortRef.current?.abort();
      const ctrl = new AbortController();
      chromaAbortRef.current = ctrl;
      setChromaError(null);
      setChromaStatus("idle"); // collapse any batch progress this superseded
      try {
        const meta = await processFrame(
          selectedFrameId,
          params,
          params,
          ctrl.signal,
        );
        if (meta && chromaAbortRef.current === ctrl) {
          updateFrameMeta(selectedFrameId, meta);
        }
      } catch (err) {
        if (chromaAbortRef.current === ctrl && !ctrl.signal.aborted) {
          setChromaError(err instanceof Error ? err.message : "抠图失败");
        }
      }
    },
    [selectedFrameId, updateFrameMeta, setChromaStatus, setChromaError],
  );

  if (!videoMeta) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-fg-subtle">请先在第一步导入视频。</p>
      </div>
    );
  }

  const hasFrames = frameCount > 0;
  const chromaPct =
    chromaProgress.total > 0
      ? Math.round((chromaProgress.done / chromaProgress.total) * 100)
      : 0;

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="shrink-0">
        <ExtractButton onExtract={handleExtract} onCancel={handleCancel} />
      </div>

      {extractStatus === "done" && hasFrames && (
        <p className="shrink-0 text-[13px] text-fg-subtle">
          点击任意帧打开抠图编辑：取色去背景，「应用到全部帧」批量处理。
        </p>
      )}

      {chromaStatus === "processing" && (
        <div className="flex shrink-0 flex-col gap-1.5 rounded-md border border-line bg-panel px-4 py-2.5">
          <span className="text-[13px] text-fg">
            正在抠图 {chromaProgress.done} / {chromaProgress.total} 帧
          </span>
          <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-150"
              style={{ width: `${chromaPct}%` }}
            />
          </div>
        </div>
      )}

      {chromaError && chromaStatus !== "processing" && (
        <div className="flex shrink-0 items-center gap-2 rounded-md border border-error/40 bg-error/10 px-4 py-2.5 text-[13px] text-error">
          <AlertTriangle className="size-4 shrink-0" />
          抠图失败：{chromaError}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <FrameGrid />
      </div>

      {selectedFrameId && extractStatus === "done" && (
        <FrameEditModal
          frameId={selectedFrameId}
          onClose={() => selectFrame(null)}
          onApplyToAll={handleApplyToAll}
          onApplySingle={handleApplySingle}
        />
      )}
    </div>
  );
}

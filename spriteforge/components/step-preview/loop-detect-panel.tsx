"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, Loader2, Repeat, Trash2 } from "lucide-react";
import {
  findLoopCandidates,
  type LoopCandidate,
} from "@/lib/frames/loop-detect";
import { framesSignature } from "@/lib/frames/signature";
import { useWorkflowStore } from "@/lib/store/workflow-store";
import type { FrameId } from "@/types";

interface LoopDetectPanelProps {
  /** delete the given frames (DB + state); resolves when done */
  onDelete: (ids: FrameId[]) => Promise<void>;
}

type Status = "idle" | "scanning" | "done" | "error";

/** Map a 0-64 Hamming distance to a friendly similarity percentage. */
function similarityPct(distance: number): number {
  return Math.round((1 - distance / 64) * 100);
}

export function LoopDetectPanel({ onDelete }: LoopDetectPanelProps) {
  const frames = useWorkflowStore((s) => s.frames);
  const loopRange = useWorkflowStore((s) => s.loopRange);
  const setLoopRange = useWorkflowStore((s) => s.setLoopRange);
  const setPlaying = useWorkflowStore((s) => s.setPlaying);
  const sig = useMemo(() => framesSignature(frames), [frames]);

  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<{ sig: string; candidates: LoopCandidate[] }>(
    { sig: "", candidates: [] },
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // a scan result is only valid for the exact sequence it was computed on
  const fresh = result.sig === sig;
  const candidates = fresh ? result.candidates : [];
  const shownStatus: Status = !fresh && status === "done" ? "idle" : status;

  // the candidate currently written to the loop range, derived from live state
  const activeIndex = candidates.findIndex(
    (c) => loopRange && loopRange.start === c.start && loopRange.end === c.end,
  );

  // frames outside the active loop range — the quick-delete targets
  const outsideIds = useMemo(() => {
    if (!loopRange) return [];
    return frames
      .filter((_, pos) => pos < loopRange.start || pos > loopRange.end)
      .map((f) => f.id);
  }, [frames, loopRange]);

  const scan = async () => {
    const startSig = sig;
    setStatus("scanning");
    setError(null);
    setConfirmingDelete(false);
    try {
      const found = await findLoopCandidates(frames);
      setResult({ sig: startSig, candidates: found });
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "循环检测失败");
      setStatus("error");
    }
  };

  const applyCandidate = (c: LoopCandidate) => {
    setPlaying(false);
    setConfirmingDelete(false);
    setLoopRange({ start: c.start, end: c.end });
  };

  const deleteOutside = async () => {
    // capture the targets before awaiting so a re-render mid-delete can't shift them
    const targetIds = outsideIds;
    if (targetIds.length === 0) return;
    setDeleting(true);
    try {
      await onDelete(targetIds);
      // only the loop itself remains, so the whole (re-indexed) sequence is the
      // loop now — clear the range to "whole sequence". applyDeletion's clamp
      // can't do this: it preserves the old positions, which no longer line up
      // after frames are re-indexed contiguously.
      setLoopRange(null);
      setResult({ sig: "", candidates: [] });
      setStatus("idle");
      setConfirmingDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const leadCount = loopRange ? loopRange.start : 0;
  const tailCount = loopRange ? frames.length - 1 - loopRange.end : 0;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
          <Repeat aria-hidden="true" className="size-4 text-fg-muted" />
          检测循环点
        </h3>
        <button
          type="button"
          onClick={scan}
          disabled={status === "scanning" || frames.length < 5}
          className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[13px] font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg disabled:opacity-50"
        >
          {status === "scanning" && (
            <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
          )}
          扫描循环点
        </button>
      </div>

      {shownStatus === "error" && (
        <div className="flex items-center gap-2 text-[13px] text-error">
          <AlertTriangle aria-hidden="true" className="size-4" />
          {error}
        </div>
      )}

      {shownStatus === "done" && candidates.length === 0 && (
        <p className="text-[13px] text-fg-subtle">未发现循环点。</p>
      )}

      {candidates.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-fg-muted">
            发现 <span className="font-semibold text-fg">{candidates.length}</span>{" "}
            个循环候选，按相似度排序。点选写入循环区间，再决定是否删除区间外多余帧。
          </p>
          <div className="flex flex-col gap-1.5">
            {candidates.map((c, i) => {
              const active = i === activeIndex;
              return (
                <button
                  key={`${c.start}-${c.end}-${c.period}`}
                  type="button"
                  onClick={() => applyCandidate(c)}
                  aria-pressed={active}
                  aria-label={`循环候选：帧 ${c.start + 1} 至 ${c.end + 1}，周期 ${c.period} 帧，相似度 ${similarityPct(c.distance)}%${i === 0 ? "（推荐）" : ""}`}
                  className={
                    active
                      ? "flex items-center justify-between gap-3 rounded-md border border-brand/50 bg-brand/10 px-3 py-2 text-[13px] text-brand transition-colors"
                      : "flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2 text-[13px] text-fg-muted transition-colors hover:bg-hover hover:text-fg"
                  }
                >
                  <span className="flex items-center gap-2">
                    {active && (
                      <Check aria-hidden="true" className="size-3.5 shrink-0" />
                    )}
                    <span className="font-mono">
                      帧 {c.start + 1}–{c.end + 1}
                    </span>
                    <span className="text-fg-subtle">周期 {c.period} 帧</span>
                    {i === 0 && (
                      <span className="rounded bg-brand/15 px-1.5 py-0.5 text-[11px] font-medium text-brand">
                        推荐
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-fg-subtle">
                    相似 {similarityPct(c.distance)}%
                  </span>
                </button>
              );
            })}
          </div>

          {activeIndex >= 0 && outsideIds.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-line pt-3">
              {confirmingDelete ? (
                <div className="flex flex-wrap items-center gap-2 text-[13px]">
                  <span className="text-fg">
                    删除区间外 {outsideIds.length} 帧（前导 {leadCount} + 尾段{" "}
                    {tailCount}），只保留这一圈？
                  </span>
                  <button
                    type="button"
                    onClick={deleteOutside}
                    disabled={deleting}
                    className="flex items-center gap-1.5 rounded-md bg-error/90 px-3 py-1.5 font-semibold text-white transition-colors hover:bg-error disabled:opacity-50"
                  >
                    {deleting && (
                      <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                    )}
                    确认删除
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    disabled={deleting}
                    className="rounded-md border border-line px-3 py-1.5 text-fg-muted transition-colors hover:bg-hover hover:text-fg disabled:opacity-50"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="flex w-fit items-center gap-1.5 rounded-md border border-error/40 bg-error/10 px-3 py-1.5 text-[13px] font-medium text-error transition-colors hover:bg-error/20"
                >
                  <Trash2 aria-hidden="true" className="size-3.5" />
                  删除区间外多余帧（{outsideIds.length}）
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

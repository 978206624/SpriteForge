"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Copy, Loader2, Trash2 } from "lucide-react";
import { findDuplicates, type DedupGroup } from "@/lib/frames/dedup";
import { useWorkflowStore } from "@/lib/store/workflow-store";
import type { FrameId } from "@/types";

interface DedupPanelProps {
  /** delete the given frames (DB + state); resolves when done */
  onDelete: (ids: FrameId[]) => Promise<void>;
}

type Status = "idle" | "scanning" | "done" | "error";

/** Order- and content-sensitive signature of the current frame sequence.
 *  Includes `rev` so a re-keyed frame (new thumbnail, same id) also invalidates
 *  a prior scan, since dedup hashes the thumbnails. */
function framesSignature(frames: { id: FrameId; rev: number }[]): string {
  return frames.map((f) => `${f.id}:${f.rev}`).join("|");
}

export function DedupPanel({ onDelete }: DedupPanelProps) {
  const frames = useWorkflowStore((s) => s.frames);
  const sig = useMemo(() => framesSignature(frames), [frames]);

  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<{ sig: string; groups: DedupGroup[] }>({
    sig: "",
    groups: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // a scan result is only valid for the exact sequence it was computed on; any
  // add/delete/reorder/reprocess changes `sig` and silently invalidates it
  // (no reset effect needed — staleness is derived during render)
  const fresh = result.sig === sig;
  const groups = fresh ? result.groups : [];
  const shownStatus: Status = !fresh && status === "done" ? "idle" : status;
  const dropIds = groups.flatMap((g) => g.drop.map((d) => d.id));

  const scan = async () => {
    const startSig = sig;
    setStatus("scanning");
    setError(null);
    setConfirming(false);
    try {
      const found = await findDuplicates(frames);
      setResult({ sig: startSig, groups: found });
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "查重失败");
      setStatus("error");
    }
  };

  const deleteAll = async () => {
    if (dropIds.length === 0) return;
    setDeleting(true);
    try {
      await onDelete(dropIds);
      setResult({ sig: "", groups: [] });
      setStatus("idle");
      setConfirming(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
          <Copy className="size-4 text-fg-muted" />
          查找重复帧
        </h3>
        <button
          type="button"
          onClick={scan}
          disabled={status === "scanning" || frames.length < 2}
          className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[13px] font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg disabled:opacity-50"
        >
          {status === "scanning" && <Loader2 className="size-3.5 animate-spin" />}
          扫描相邻近似帧
        </button>
      </div>

      {shownStatus === "error" && (
        <div className="flex items-center gap-2 text-[13px] text-error">
          <AlertTriangle className="size-4" />
          {error}
        </div>
      )}

      {shownStatus === "done" && groups.length === 0 && (
        <p className="text-[13px] text-fg-subtle">未发现相邻近似帧。</p>
      )}

      {groups.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-fg-muted">
            发现 <span className="font-semibold text-fg">{groups.length}</span>{" "}
            组近似帧，建议删除{" "}
            <span className="font-semibold text-brand">{dropIds.length}</span> 帧
            （每组保留第一帧）。
          </p>
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <span
                key={g.keep.id}
                className="rounded-md bg-elevated px-2 py-1 font-mono text-[12px] text-fg-subtle"
                title="保留首帧，删除其余"
              >
                保留 {g.keep.index + 1}，删 {g.drop.map((d) => d.index + 1).join(",")}
              </span>
            ))}
          </div>

          {confirming ? (
            <div className="flex items-center gap-2 text-[13px]">
              <span className="text-fg">确认删除 {dropIds.length} 个重复帧？</span>
              <button
                type="button"
                onClick={deleteAll}
                disabled={deleting}
                className="flex items-center gap-1.5 rounded-md bg-error/90 px-3 py-1.5 font-semibold text-white transition-colors hover:bg-error disabled:opacity-50"
              >
                {deleting && <Loader2 className="size-3.5 animate-spin" />}
                确认删除
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="rounded-md border border-line px-3 py-1.5 text-fg-muted transition-colors hover:bg-hover hover:text-fg disabled:opacity-50"
              >
                取消
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="flex w-fit items-center gap-1.5 rounded-md border border-error/40 bg-error/10 px-3 py-1.5 text-[13px] font-semibold text-error transition-colors hover:bg-error/20"
            >
              <Trash2 className="size-3.5" />
              删除全部 {dropIds.length} 个重复帧
            </button>
          )}
        </div>
      )}
    </div>
  );
}

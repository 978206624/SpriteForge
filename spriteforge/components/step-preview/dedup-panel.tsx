"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, Copy, ListPlus, Loader2 } from "lucide-react";
import { findDuplicates, type DedupGroup } from "@/lib/frames/dedup";
import { framesSignature } from "@/lib/frames/signature";
import { useWorkflowStore } from "@/lib/store/workflow-store";

type Status = "idle" | "scanning" | "done" | "error";

export function DedupPanel() {
  const frames = useWorkflowStore((s) => s.frames);
  const selection = useWorkflowStore((s) => s.selection);
  const addFramesToSelection = useWorkflowStore((s) => s.addFramesToSelection);
  const sig = useMemo(() => framesSignature(frames), [frames]);

  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<{ sig: string; groups: DedupGroup[] }>({
    sig: "",
    groups: [],
  });
  const [error, setError] = useState<string | null>(null);

  // a scan result is only valid for the exact sequence it was computed on; any
  // add/delete/reorder/reprocess changes `sig` and silently invalidates it
  // (no reset effect needed — staleness is derived during render)
  const fresh = result.sig === sig;
  const groups = fresh ? result.groups : [];
  const shownStatus: Status = !fresh && status === "done" ? "idle" : status;
  const dropIds = groups.flatMap((g) => g.drop.map((d) => d.id));

  // derive "added" purely from the live selection so it stays truthful even if
  // the user later deselects those frames in the strip — no local mirror state
  const selectedSet = useMemo(() => new Set(selection), [selection]);
  const allAdded = dropIds.length > 0 && dropIds.every((id) => selectedSet.has(id));

  const scan = async () => {
    const startSig = sig;
    setStatus("scanning");
    setError(null);
    try {
      const found = await findDuplicates(frames);
      setResult({ sig: startSig, groups: found });
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "查重失败");
      setStatus("error");
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
            （每组保留第一帧）。点标签把建议删除的帧加入选择，再用上方「删除选中」删除。
          </p>
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => {
              const ids = g.drop.map((d) => d.id);
              const added = ids.every((id) => selectedSet.has(id));
              const dropLabel = g.drop.map((d) => d.index + 1).join(",");
              return (
                <button
                  key={g.keep.id}
                  type="button"
                  onClick={() => addFramesToSelection(ids)}
                  aria-pressed={added}
                  aria-label={`保留第 ${g.keep.index + 1} 帧，将第 ${dropLabel} 帧加入待删选择${added ? "（已加入）" : ""}`}
                  className={
                    added
                      ? "flex items-center gap-1 rounded-md border border-brand/40 bg-brand/10 px-2 py-1 font-mono text-[12px] text-brand transition-colors"
                      : "rounded-md bg-elevated px-2 py-1 font-mono text-[12px] text-fg-subtle transition-colors hover:bg-hover hover:text-fg"
                  }
                  title={added ? "已加入帧条带多选" : "把建议删除的帧加入帧条带多选"}
                >
                  {added && <Check className="size-3" />}
                  保留 {g.keep.index + 1}，删 {dropLabel}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => addFramesToSelection(dropIds)}
            disabled={allAdded}
            className="flex w-fit items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[13px] font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-fg-muted"
          >
            {allAdded ? <Check className="size-3.5" /> : <ListPlus className="size-3.5" />}
            {allAdded ? "已全部加入选择" : `全部加入选择（${dropIds.length}）`}
          </button>
        </div>
      )}
    </div>
  );
}

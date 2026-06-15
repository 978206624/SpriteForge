"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getThumb } from "@/lib/frames/store";
import { useWorkflowStore } from "@/lib/store/workflow-store";
import type { FrameId } from "@/types";
import { FrameGridItem } from "./frame-grid-item";

/**
 * Lazily resolve a `blob:` URL per frame thumbnail. Each frame is read from
 * IndexedDB only once; URLs are revoked when a frame disappears from the list
 * (re-extract / video swap) and all are revoked on unmount.
 */
function useThumbnailUrls(frameIds: FrameId[]): Map<FrameId, string> {
  const [urls, setUrls] = useState<Map<FrameId, string>>(() => new Map());

  // mirror the latest map into a ref (in an effect, never during render) so the
  // unmount cleanup can revoke whatever URLs are live at teardown
  const latestRef = useRef(urls);
  useEffect(() => {
    latestRef.current = urls;
  }, [urls]);

  useEffect(() => {
    let cancelled = false;
    const wanted = new Set(frameIds);

    // All state updates happen after an await (never synchronously in the
    // effect body), so a single pass both revokes gone URLs and adds new ones.
    void (async () => {
      const have = latestRef.current;
      const missing = frameIds.filter((id) => !have.has(id));
      const gone = [...have.keys()].some((id) => !wanted.has(id));
      // nothing to add or remove — skip the state update entirely (no re-render)
      if (missing.length === 0 && !gone) return;

      const loaded = await Promise.all(
        missing.map(async (id) => {
          const blob = await getThumb(id);
          return blob ? ([id, URL.createObjectURL(blob)] as const) : null;
        }),
      );
      if (cancelled) {
        for (const e of loaded) if (e) URL.revokeObjectURL(e[1]);
        return;
      }
      setUrls((prev) => {
        const next = new Map(prev);
        let changed = false;
        for (const [id, url] of prev) {
          if (!wanted.has(id)) {
            URL.revokeObjectURL(url);
            next.delete(id);
            changed = true;
          }
        }
        for (const e of loaded) {
          if (!e) continue;
          if (next.has(e[0])) URL.revokeObjectURL(e[1]); // raced; keep existing
          else {
            next.set(e[0], e[1]);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [frameIds]);

  // revoke everything on final unmount
  useEffect(() => {
    return () => {
      for (const url of latestRef.current.values()) URL.revokeObjectURL(url);
    };
  }, []);

  return urls;
}

export function FrameGrid() {
  const frames = useWorkflowStore((s) => s.frames);
  const selectedFrameId = useWorkflowStore((s) => s.selectedFrameId);
  const selectFrame = useWorkflowStore((s) => s.selectFrame);

  // stabilize the id list so the thumbnail effect only re-runs when the set of
  // frames actually changes (not on unrelated re-renders like theme toggles)
  const frameIds = useMemo(() => frames.map((f) => f.id), [frames]);
  const urls = useThumbnailUrls(frameIds);

  if (frames.length === 0) return null;

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2.5">
      {frames.map((frame) => (
        <FrameGridItem
          key={frame.id}
          index={frame.index}
          url={urls.get(frame.id) ?? null}
          selected={frame.id === selectedFrameId}
          onSelect={() =>
            selectFrame(frame.id === selectedFrameId ? null : frame.id)
          }
        />
      ))}
    </div>
  );
}

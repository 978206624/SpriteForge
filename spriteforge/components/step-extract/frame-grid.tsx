"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getThumb } from "@/lib/frames/store";
import { useWorkflowStore } from "@/lib/store/workflow-store";
import type { FrameId } from "@/types";
import { FrameGridItem } from "./frame-grid-item";

interface ThumbKey {
  id: FrameId;
  /** bumps when the processed thumbnail changes; forces a reload */
  rev: number;
}

interface CachedUrl {
  url: string;
  rev: number;
}

/**
 * Lazily resolve a `blob:` URL per frame thumbnail. A frame is (re)loaded the
 * first time it appears and whenever its `rev` bumps (e.g. after chroma keying
 * replaces the thumbnail). URLs are revoked when their frame disappears, when a
 * newer rev supersedes them, and all on unmount.
 */
function useThumbnailUrls(keys: ThumbKey[]): Map<FrameId, string> {
  const [urls, setUrls] = useState<Map<FrameId, string>>(() => new Map());

  // mirror the latest revs + urls into refs (in effects, never during render)
  const urlMetaRef = useRef<Map<FrameId, CachedUrl>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const wanted = new Map(keys.map((k) => [k.id, k.rev]));
    const cache = urlMetaRef.current;

    const stale = keys.filter((k) => {
      const c = cache.get(k.id);
      return !c || c.rev !== k.rev;
    });
    const gone = [...cache.keys()].some((id) => !wanted.has(id));
    if (stale.length === 0 && !gone) return;

    void (async () => {
      const loaded = await Promise.all(
        stale.map(async (k) => {
          const blob = await getThumb(k.id);
          return blob
            ? ({ id: k.id, rev: k.rev, url: URL.createObjectURL(blob) } as const)
            : null;
        }),
      );
      if (cancelled) {
        for (const e of loaded) if (e) URL.revokeObjectURL(e.url);
        return;
      }
      // revoke superseded urls for the freshly-loaded frames
      for (const e of loaded) {
        if (!e) continue;
        const prev = cache.get(e.id);
        if (prev && prev.rev !== e.rev) URL.revokeObjectURL(prev.url);
        cache.set(e.id, { url: e.url, rev: e.rev });
      }
      // revoke + drop urls whose frame is gone
      for (const id of [...cache.keys()]) {
        if (!wanted.has(id)) {
          URL.revokeObjectURL(cache.get(id)!.url);
          cache.delete(id);
        }
      }
      setUrls(new Map([...cache].map(([id, c]) => [id, c.url])));
    })();

    return () => {
      cancelled = true;
    };
  }, [keys]);

  // revoke everything on final unmount
  useEffect(() => {
    const cache = urlMetaRef.current;
    return () => {
      for (const c of cache.values()) URL.revokeObjectURL(c.url);
      cache.clear();
    };
  }, []);

  return urls;
}

export function FrameGrid() {
  const frames = useWorkflowStore((s) => s.frames);
  const selectedFrameId = useWorkflowStore((s) => s.selectedFrameId);
  const selectFrame = useWorkflowStore((s) => s.selectFrame);

  // stable id+rev list so the thumbnail effect only re-runs when frames or
  // their processed revisions actually change
  const keys = useMemo(
    () => frames.map((f) => ({ id: f.id, rev: f.rev })),
    [frames],
  );
  const urls = useThumbnailUrls(keys);

  if (frames.length === 0) return null;

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2.5">
      {frames.map((frame) => (
        <FrameGridItem
          key={frame.id}
          index={frame.index}
          url={urls.get(frame.id) ?? null}
          processed={frame.processed}
          needsAttention={frame.needsAttention}
          hasOverride={frame.overrideParams !== null}
          selected={frame.id === selectedFrameId}
          onSelect={() => selectFrame(frame.id)}
        />
      ))}
    </div>
  );
}

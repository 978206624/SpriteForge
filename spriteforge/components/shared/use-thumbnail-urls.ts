"use client";

import { useEffect, useRef, useState } from "react";
import { getThumb } from "@/lib/frames/store";
import type { FrameId } from "@/types";

export interface ThumbKey {
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
 *
 * Pass a memoized `keys` array so the effect only re-runs when the frames or
 * their revisions actually change.
 */
export function useThumbnailUrls(keys: ThumbKey[]): Map<FrameId, string> {
  const [urls, setUrls] = useState<Map<FrameId, string>>(() => new Map());
  const cacheRef = useRef<Map<FrameId, CachedUrl>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const wanted = new Map(keys.map((k) => [k.id, k.rev]));
    const cache = cacheRef.current;

    const stale = keys.filter((k) => {
      const c = cache.get(k.id);
      return !c || c.rev !== k.rev;
    });
    const gone = [...cache.keys()].some((id) => !wanted.has(id));
    if (stale.length === 0 && !gone) return;

    void (async () => {
      const loaded = await Promise.all(
        stale.map(async (k) => {
          try {
            const blob = await getThumb(k.id);
            return blob
              ? ({ id: k.id, rev: k.rev, url: URL.createObjectURL(blob) } as const)
              : null;
          } catch {
            return null; // read failure — skip, no leaked URL
          }
        }),
      );
      if (cancelled) {
        for (const e of loaded) if (e) URL.revokeObjectURL(e.url);
        return;
      }
      for (const e of loaded) {
        if (!e) continue;
        const prev = cache.get(e.id);
        if (prev && prev.rev !== e.rev) URL.revokeObjectURL(prev.url);
        cache.set(e.id, { url: e.url, rev: e.rev });
      }
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

  useEffect(() => {
    const cache = cacheRef.current;
    return () => {
      for (const c of cache.values()) URL.revokeObjectURL(c.url);
      cache.clear();
    };
  }, []);

  return urls;
}

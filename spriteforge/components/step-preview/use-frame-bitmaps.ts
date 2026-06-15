"use client";

import { useEffect, useRef, useState } from "react";
import { getDisplayBlob } from "@/lib/frames/store";
import type { FrameId } from "@/types";

export interface BitmapKey {
  id: FrameId;
  /** bumps when the processed result changes; forces a reload */
  rev: number;
}

interface CachedBitmap {
  bitmap: ImageBitmap;
  rev: number;
}

/** Longest-edge target for preview bitmaps; bounds memory for large sequences. */
const PREVIEW_EDGE = 512;

/**
 * Decode each frame's displayable image (chroma-keyed result, else original) to
 * a downscaled ImageBitmap for smooth animation playback. Bitmaps are cached by
 * id and reloaded when `rev` bumps; superseded / removed bitmaps are closed,
 * and all are closed on unmount.
 */
export function useFrameBitmaps(
  keys: BitmapKey[],
  sourceWidth: number,
  sourceHeight: number,
): Map<FrameId, ImageBitmap> {
  const [bitmaps, setBitmaps] = useState<Map<FrameId, ImageBitmap>>(
    () => new Map(),
  );
  const cacheRef = useRef<Map<FrameId, CachedBitmap>>(new Map());

  const scale =
    sourceWidth > 0 && sourceHeight > 0
      ? Math.min(1, PREVIEW_EDGE / Math.max(sourceWidth, sourceHeight))
      : 1;
  const rw = Math.max(1, Math.round(sourceWidth * scale));
  const rh = Math.max(1, Math.round(sourceHeight * scale));

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
            const blob = await getDisplayBlob(k.id);
            if (!blob) return null;
            const bitmap = await createImageBitmap(blob, {
              resizeWidth: rw,
              resizeHeight: rh,
              resizeQuality: "medium",
            });
            return { id: k.id, rev: k.rev, bitmap } as const;
          } catch {
            return null; // decode/read failure — skip this frame, no leak
          }
        }),
      );
      if (cancelled) {
        for (const e of loaded) if (e) e.bitmap.close();
        return;
      }
      for (const e of loaded) {
        if (!e) continue;
        const prev = cache.get(e.id);
        if (prev && prev.rev !== e.rev) prev.bitmap.close();
        cache.set(e.id, { bitmap: e.bitmap, rev: e.rev });
      }
      for (const id of [...cache.keys()]) {
        if (!wanted.has(id)) {
          cache.get(id)!.bitmap.close();
          cache.delete(id);
        }
      }
      setBitmaps(new Map([...cache].map(([id, c]) => [id, c.bitmap])));
    })();

    return () => {
      cancelled = true;
    };
  }, [keys, rw, rh]);

  useEffect(() => {
    const cache = cacheRef.current;
    return () => {
      for (const c of cache.values()) c.bitmap.close();
      cache.clear();
    };
  }, []);

  return bitmaps;
}

import type { ChromaParams, ExportFps, Frame, FrameId } from "@/types";

/**
 * Frame storage is split across two IndexedDB object stores so the grid and the
 * page-load restore never have to pull megabytes of full-resolution PNGs into
 * memory:
 *
 * - {@link FrameThumb} (light) — grid thumbnail + metadata; scanned in bulk for
 *   rendering and for restoring the Zustand frame list on refresh.
 * - {@link FramePixels} (heavy) — full-resolution source + processed bitmaps;
 *   read on demand only when a specific frame is being chroma-keyed (Phase 4).
 */

/** Light per-frame record: grid display + store restore. */
export interface FrameThumb {
  id: FrameId;
  index: number;
  /** per-frame chroma override; null falls back to global params */
  overrideParams: ChromaParams | null;
  /** small grid thumbnail (JPEG for opaque originals, PNG once processed) */
  thumbBlob: Blob;
  /** true once a chroma-keyed result has been produced */
  processed: boolean;
  /** heuristic: residual background remains (not cleanly keyed) */
  needsAttention: boolean;
  /** bumps when the processed result / thumbnail changes (cache busting) */
  rev: number;
}

/** Heavy per-frame record: full-resolution pixels, read on demand. */
export interface FramePixels {
  id: FrameId;
  index: number;
  width: number;
  height: number;
  /** full-resolution lossless source frame (PNG), input for chroma keying */
  originalBlob: Blob;
  /** chroma-keyed result (PNG with alpha); null until Phase 4 processes it */
  processedBlob: Blob | null;
}

/** Project the light record down to the store-friendly {@link Frame}. */
export function toFrameMeta(thumb: FrameThumb): Frame {
  return {
    id: thumb.id,
    index: thumb.index,
    overrideParams: thumb.overrideParams,
    processed: thumb.processed,
    needsAttention: thumb.needsAttention,
    rev: thumb.rev,
  };
}

/** Stable signature identifying which source video the stored frames belong to.
 *  Used to detect (and discard) frames orphaned by a video swap. */
export function videoSignature(
  name: string,
  size: number,
  duration: number,
): string {
  return `${name}:${size}:${duration.toFixed(3)}`;
}

/**
 * Manifest describing the currently-cached extraction. Persisted to the `meta`
 * store so a refresh can tell a *complete* cache from a partial/aborted/failed
 * one, and so a parameter change (range / fps) invalidates stale frames.
 *
 * Frames are only restorable when `status === "done"`, the video + params match
 * the current selection, and the persisted frame count equals `total`.
 */
export interface FrameManifest {
  /** {@link videoSignature} of the source video */
  signature: string;
  inTime: number;
  outTime: number;
  fps: ExportFps;
  /** expected frame count when extraction completes */
  total: number;
  status: "extracting" | "done";
  /** global chroma params at last "apply to all"; restored so frames without
   *  a per-frame override resolve to the right effective params after refresh */
  globalChromaParams?: ChromaParams;
}

/** True when a persisted manifest is a complete cache matching the given
 *  video + range + fps selection and frame count. */
export function isManifestRestorable(
  manifest: FrameManifest | null,
  signature: string,
  inTime: number,
  outTime: number,
  fps: ExportFps,
  count: number,
): boolean {
  return (
    manifest !== null &&
    manifest.status === "done" &&
    manifest.signature === signature &&
    manifest.inTime === inTime &&
    manifest.outTime === outTime &&
    manifest.fps === fps &&
    manifest.total === count
  );
}

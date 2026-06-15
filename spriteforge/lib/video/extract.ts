import type { ExportFps, Frame, VideoMeta } from "@/types";
import { resolveFps } from "@/lib/video/probe";
import { videoSignature } from "@/lib/frames/model";
import { clearFrames, putFrame, setManifest } from "@/lib/frames/store";
import type {
  FrameEncodeRequest,
  FrameEncodeResponse,
} from "@/workers/frame-extract.worker";

/** Grid thumbnail height in px; width follows the source aspect ratio. */
const THUMB_HEIGHT = 120;
/** HTMLMediaElement.readyState: a decoded frame is available at the position. */
const HAVE_CURRENT_DATA = 2;

class AbortError extends Error {
  constructor() {
    super("aborted");
    this.name = "AbortError";
  }
}

/**
 * Seek the video to `time` and resolve once the frame at that position is
 * decoded.
 *
 * Three cases:
 * - target ≠ current time → assign `currentTime` and wait for `seeked`.
 * - target = current time AND already decoded → resolve immediately (no seek
 *   would be triggered, so `seeked` would never fire).
 * - target = current time but NOT yet decoded (the first frame, typically at
 *   t=0, right after metadata) → wait for `loadeddata`/`canplay`, since
 *   re-assigning the unchanged `currentTime` may not emit `seeked`.
 *
 * Listeners are registered *before* assigning `currentTime` so a fast seek can
 * never slip between the assignment and the subscription. The decode-wait
 * listeners are only added in the same-time case, so they can't resolve a
 * genuine seek (target ≠ current) with the wrong, earlier-decoded frame.
 */
function seekTo(
  video: HTMLVideoElement,
  time: number,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new AbortError());
    const sameTime = Math.abs(video.currentTime - time) < 1e-4;

    const cleanup = () => {
      video.removeEventListener("seeked", onResolve);
      video.removeEventListener("loadeddata", onResolve);
      video.removeEventListener("canplay", onResolve);
      video.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
    };
    const onResolve = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("seek 失败"));
    };
    const onAbort = () => {
      cleanup();
      reject(new AbortError());
    };

    video.addEventListener("seeked", onResolve);
    video.addEventListener("error", onError);
    signal?.addEventListener("abort", onAbort, { once: true });

    if (sameTime) {
      if (video.readyState >= HAVE_CURRENT_DATA) {
        // already decoded at this position — nothing to wait for
        onResolve();
        return;
      }
      // first decode at the current position; no seek to trigger `seeked`
      video.addEventListener("loadeddata", onResolve);
      video.addEventListener("canplay", onResolve);
      return;
    }
    video.currentTime = time;
  });
}

const HAVE_METADATA = 1;

function waitForMetadata(
  video: HTMLVideoElement,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new AbortError());
    if (video.readyState >= HAVE_METADATA) return resolve();
    const cleanup = () => {
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
    };
    const onMeta = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("视频加载失败"));
    };
    const onAbort = () => {
      cleanup();
      reject(new AbortError());
    };
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("error", onError);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Promise-based single-in-flight wrapper around the encode worker. Rejects
 *  with AbortError if the signal fires while the encode is pending (the worker
 *  is terminated by the caller's `finally`, which discards the stale result). */
function encodeOnWorker(
  worker: Worker,
  bitmap: ImageBitmap,
  id: string,
  index: number,
  signal?: AbortSignal,
): Promise<Extract<FrameEncodeResponse, { ok: true }>> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      bitmap.close();
      return reject(new AbortError());
    }
    const cleanup = () => {
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
    };
    const onMessage = (e: MessageEvent<FrameEncodeResponse>) => {
      const res = e.data;
      if (res.id !== id) return; // not ours (defensive; we run one at a time)
      cleanup();
      if (res.ok) resolve(res);
      else reject(new Error(res.error));
    };
    const onError = () => {
      cleanup();
      reject(new Error("帧编码 worker 错误"));
    };
    const onAbort = () => {
      cleanup();
      reject(new AbortError());
    };
    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    signal?.addEventListener("abort", onAbort, { once: true });
    const req: FrameEncodeRequest = {
      id,
      index,
      bitmap,
      thumbHeight: THUMB_HEIGHT,
    };
    worker.postMessage(req, [bitmap]); // bitmap ownership transfers to worker
  });
}

export interface ExtractOptions {
  url: string;
  inTime: number;
  outTime: number;
  fps: ExportFps;
  meta: VideoMeta;
  signal?: AbortSignal;
  /** progress callback: number done out of total */
  onProgress?: (done: number, total: number) => void;
  /** called as each frame's metadata lands (for incremental grid rendering) */
  onFrame?: (frame: Frame) => void;
}

/**
 * Extract frames across [inTime, outTime] at the resolved fps. Seeks the video
 * sequentially (reliable across browsers), captures each frame as an
 * ImageBitmap, offloads PNG + thumbnail encoding to the worker, and persists
 * each result to IndexedDB.
 *
 * Cache lifecycle: clears any previously stored frames first, writes a manifest
 * with `status: "extracting"`, and only marks `status: "done"` once every frame
 * is written. A refresh therefore never restores a partial/aborted/failed
 * cache, and the manifest captures the range/fps so a parameter change
 * invalidates it. A zero-frame range clears the cache rather than leaving stale
 * frames behind.
 *
 * Abort-safe: an aborted signal stops the seek loop, rejects any pending encode,
 * frees the decoder, and terminates the worker. The manifest stays
 * `"extracting"`, so partial frames are not treated as a complete cache.
 */
export async function extractFrames(opts: ExtractOptions): Promise<Frame[]> {
  const { url, inTime, outTime, fps, meta, signal, onProgress, onFrame } = opts;

  const effFps = resolveFps(fps, meta);
  const span = Math.max(0, outTime - inTime);
  const total = Math.max(0, Math.round(span * effFps));

  // always start from a clean slate so a stale cache can never survive
  await clearFrames();
  if (total === 0) return [];

  const signature = videoSignature(meta.name, meta.size, meta.duration);
  await setManifest({ signature, inTime, outTime, fps, total, status: "extracting" });

  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.src = url;

  const worker = new Worker(
    new URL("../../workers/frame-extract.worker.ts", import.meta.url),
    { type: "module" },
  );

  const frames: Frame[] = [];
  try {
    await waitForMetadata(video, signal);

    for (let i = 0; i < total; i++) {
      if (signal?.aborted) throw new AbortError();

      // sample at the start of each frame interval, clamped inside the clip
      const t = Math.min(inTime + i / effFps, meta.duration - 1e-3);
      await seekTo(video, t, signal);

      const bitmap = await createImageBitmap(video);
      const id = `frame-${i.toString().padStart(6, "0")}`;
      const encoded = await encodeOnWorker(worker, bitmap, id, i, signal);

      // a late abort (after encode, before persist) must not write a stale frame
      if (signal?.aborted) throw new AbortError();

      await putFrame(
        {
          id,
          index: i,
          overrideParams: null,
          thumbBlob: encoded.thumbBlob,
          processed: false,
          needsAttention: false,
          rev: 0,
        },
        {
          id,
          index: i,
          width: encoded.width,
          height: encoded.height,
          originalBlob: encoded.originalBlob,
          processedBlob: null,
        },
      );

      // abort during the IndexedDB write must not surface as progress/done
      if (signal?.aborted) throw new AbortError();

      const frame: Frame = {
        id,
        index: i,
        overrideParams: null,
        processed: false,
        needsAttention: false,
        rev: 0,
      };
      frames.push(frame);
      onFrame?.(frame);
      onProgress?.(i + 1, total);
    }

    // abort during the final frame's write must not mark the cache complete
    if (signal?.aborted) throw new AbortError();
    // mark the cache complete only after every frame is written
    await setManifest({ signature, inTime, outTime, fps, total, status: "done" });
  } finally {
    worker.terminate();
    video.removeAttribute("src");
    video.load();
  }

  return frames;
}

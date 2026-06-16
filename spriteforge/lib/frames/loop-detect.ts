import type { Frame } from "@/types";
import { getThumb } from "@/lib/frames/store";
import type {
  LoopCandidate,
  LoopDetectRequest,
  LoopDetectResponse,
} from "@/workers/loop-detect.worker";

export type { LoopCandidate } from "@/workers/loop-detect.worker";

/** Smallest loop length (frames) worth surfacing — shorter "loops" are usually
 *  adjacent near-duplicates, which the dedup panel already handles. */
export const DEFAULT_LOOP_MIN_PERIOD = 4;
/** Max Hamming distance for the closure frame to match the loop start.
 *  Mirrors DEFAULT_DEDUP_THRESHOLD (of 64 bits). */
export const DEFAULT_LOOP_CLOSE_THRESHOLD = 6;
/** Frames after the seam to average when confirming the loop repeats. */
export const DEFAULT_LOOP_WINDOW_K = 4;
/** Max average Hamming distance over the validation window. Slightly looser
 *  than the closure threshold since a real cycle drifts a little. */
export const DEFAULT_LOOP_WINDOW_THRESHOLD = 8;

export interface LoopDetectOptions {
  minPeriod?: number;
  closeThreshold?: number;
  windowK?: number;
  windowThreshold?: number;
}

/**
 * Detect loop-closure candidates across the whole sequence in a one-shot worker.
 * Returns candidates as frame-array positions ({ start, end, period, distance }),
 * sorted by similarity (distance ascending). Positions map 1:1 to the passed
 * `frames` order, so they can be fed straight into `setLoopRange`.
 */
export async function findLoopCandidates(
  frames: Frame[],
  opts: LoopDetectOptions = {},
): Promise<LoopCandidate[]> {
  const minPeriod = opts.minPeriod ?? DEFAULT_LOOP_MIN_PERIOD;
  if (frames.length <= minPeriod) return [];

  // positions must stay aligned with the strip, so every frame must hash —
  // unlike dedup we can't silently skip a frame with a missing thumbnail
  const thumbs = await Promise.all(frames.map((f) => getThumb(f.id)));
  const input: LoopDetectRequest["frames"] = [];
  frames.forEach((f, i) => {
    const blob = thumbs[i];
    if (!blob) throw new Error("部分帧缩略图缺失，无法检测循环");
    input.push({ id: f.id, index: f.index, blob });
  });

  const worker = new Worker(
    new URL("../../workers/loop-detect.worker.ts", import.meta.url),
    { type: "module" },
  );
  try {
    return await new Promise<LoopCandidate[]>((resolve, reject) => {
      worker.addEventListener(
        "message",
        (e: MessageEvent<LoopDetectResponse>) => {
          if (e.data.ok) resolve(e.data.candidates);
          else reject(new Error(e.data.error));
        },
        { once: true },
      );
      worker.addEventListener(
        "error",
        () => reject(new Error("循环检测 worker 错误")),
        { once: true },
      );
      const req: LoopDetectRequest = {
        frames: input,
        minPeriod,
        closeThreshold: opts.closeThreshold ?? DEFAULT_LOOP_CLOSE_THRESHOLD,
        windowK: opts.windowK ?? DEFAULT_LOOP_WINDOW_K,
        windowThreshold: opts.windowThreshold ?? DEFAULT_LOOP_WINDOW_THRESHOLD,
      };
      worker.postMessage(req);
    });
  } finally {
    worker.terminate();
  }
}

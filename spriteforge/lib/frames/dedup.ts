import type { Frame } from "@/types";
import { getThumb } from "@/lib/frames/store";
import type {
  DedupGroup,
  DedupRequest,
  DedupResponse,
} from "@/workers/dedup.worker";

export type { DedupGroup } from "@/workers/dedup.worker";

/** Default Hamming threshold (of 64 bits) for "near-duplicate" adjacent frames. */
export const DEFAULT_DEDUP_THRESHOLD = 6;

/**
 * Detect runs of consecutive near-duplicate frames via perceptual hashing in a
 * one-shot worker. Returns groups, each keeping the first frame and suggesting
 * the rest for deletion. Uses the already-small thumbnails as hash input.
 */
export async function findDuplicates(
  frames: Frame[],
  threshold = DEFAULT_DEDUP_THRESHOLD,
): Promise<DedupGroup[]> {
  if (frames.length < 2) return [];

  const thumbs = await Promise.all(frames.map((f) => getThumb(f.id)));
  const input: DedupRequest["frames"] = [];
  frames.forEach((f, i) => {
    const blob = thumbs[i];
    if (blob) input.push({ id: f.id, index: f.index, blob });
  });
  if (input.length < 2) return [];

  const worker = new Worker(
    new URL("../../workers/dedup.worker.ts", import.meta.url),
    { type: "module" },
  );
  try {
    return await new Promise<DedupGroup[]>((resolve, reject) => {
      worker.addEventListener(
        "message",
        (e: MessageEvent<DedupResponse>) => {
          if (e.data.ok) resolve(e.data.groups);
          else reject(new Error(e.data.error));
        },
        { once: true },
      );
      worker.addEventListener("error", () => reject(new Error("查重 worker 错误")), {
        once: true,
      });
      const req: DedupRequest = { frames: input, threshold };
      worker.postMessage(req);
    });
  } finally {
    worker.terminate();
  }
}

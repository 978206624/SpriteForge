/// <reference lib="webworker" />
//
// Near-duplicate frame detector. Computes a difference hash (dHash) per frame
// from its thumbnail and groups runs of consecutive frames whose hashes are
// within a Hamming-distance threshold — the typical "held pose" stretches that
// bloat a sprite sheet. Runs off the main thread.

import { dHash, hamming } from "@/lib/image/phash";

export interface DedupRequest {
  frames: { id: string; index: number; blob: Blob }[];
  /** max Hamming distance (0-64) for two adjacent frames to count as duplicates */
  threshold: number;
}

export interface DedupGroup {
  /** frame kept (first of the run) */
  keep: { id: string; index: number };
  /** later frames in the run suggested for deletion */
  drop: { id: string; index: number }[];
}

export type DedupResponse =
  | { ok: true; groups: DedupGroup[] }
  | { ok: false; error: string };

self.addEventListener("message", async (e: MessageEvent<DedupRequest>) => {
  const { frames, threshold } = e.data;
  const post = (res: DedupResponse) =>
    (self as DedicatedWorkerGlobalScope).postMessage(res);
  try {
    const hashes: Uint8Array[] = [];
    for (const f of frames) hashes.push(await dHash(f.blob));

    const groups: DedupGroup[] = [];
    let current: DedupGroup | null = null;
    for (let i = 1; i < frames.length; i++) {
      if (hamming(hashes[i - 1], hashes[i]) <= threshold) {
        if (!current) {
          current = {
            keep: { id: frames[i - 1].id, index: frames[i - 1].index },
            drop: [],
          };
        }
        current.drop.push({ id: frames[i].id, index: frames[i].index });
      } else if (current) {
        groups.push(current);
        current = null;
      }
    }
    if (current) groups.push(current);

    post({ ok: true, groups });
  } catch (err) {
    post({ ok: false, error: err instanceof Error ? err.message : "查重失败" });
  }
});

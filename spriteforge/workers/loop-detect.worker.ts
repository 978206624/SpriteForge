/// <reference lib="webworker" />
//
// Loop-point detector. Given the full frame sequence, finds non-adjacent
// closure points where frame Y looks like frame X, so [X, Y-1] is one clean
// animation cycle of period (Y - X). Unlike the adjacent deduplicator this
// compares frames that are far apart. A single accidental look-alike is
// filtered out by validating that a window of K frames after each side of the
// seam also matches — a real loop repeats, a coincidence does not. Runs off the
// main thread.

import { dHash, hamming } from "@/lib/image/phash";

export interface LoopDetectRequest {
  frames: { id: string; index: number; blob: Blob }[];
  /** smallest loop length (in frames) to consider */
  minPeriod: number;
  /** max Hamming distance (0-64) for the closure frame Y to match start X */
  closeThreshold: number;
  /** number of frames after the seam to average for validation */
  windowK: number;
  /** max average Hamming distance over the validation window */
  windowThreshold: number;
}

export interface LoopCandidate {
  /** first frame position of the clean loop (X) */
  start: number;
  /** last frame position of the clean loop (Y-1) */
  end: number;
  /** loop length in frames (Y - X) */
  period: number;
  /** average Hamming distance over the validation window (lower = more similar) */
  distance: number;
}

export type LoopDetectResponse =
  | { ok: true; candidates: LoopCandidate[] }
  | { ok: false; error: string };

/**
 * Scan every period p in [minPeriod, N-1]. For each p, find the start X whose
 * closure (frame X+p ≈ frame X) is best confirmed by a K-frame window, and keep
 * that single best alignment for the period. Returns one candidate per qualifying
 * period, sorted by window distance ascending (most similar first).
 */
function findCandidates(
  hashes: Uint8Array[],
  req: LoopDetectRequest,
): LoopCandidate[] {
  const { minPeriod, closeThreshold, windowK, windowThreshold } = req;
  const n = hashes.length;
  const candidates: LoopCandidate[] = [];

  for (let p = minPeriod; p < n; p++) {
    let best: LoopCandidate | null = null;
    for (let x = 0; x + p < n; x++) {
      const y = x + p;
      // closure: the frame that would restart the loop must resemble the start
      if (hamming(hashes[x], hashes[y]) > closeThreshold) continue;
      // validate periodicity: segment [x, x+K) should repeat at [y, y+K)
      let sum = 0;
      let cnt = 0;
      for (let k = 0; k < windowK && y + k < n; k++) {
        sum += hamming(hashes[x + k], hashes[y + k]);
        cnt++;
      }
      const avg = sum / cnt; // cnt >= 1 since k=0 (y < n) always runs
      if (avg > windowThreshold) continue;
      if (!best || avg < best.distance) {
        best = { start: x, end: y - 1, period: p, distance: avg };
      }
    }
    if (best) candidates.push(best);
  }

  candidates.sort((a, b) => a.distance - b.distance);
  return candidates;
}

self.addEventListener("message", async (e: MessageEvent<LoopDetectRequest>) => {
  const post = (res: LoopDetectResponse) =>
    (self as DedicatedWorkerGlobalScope).postMessage(res);
  try {
    const { frames } = e.data;
    if (frames.length <= e.data.minPeriod) {
      post({ ok: true, candidates: [] });
      return;
    }
    const hashes: Uint8Array[] = [];
    for (const f of frames) hashes.push(await dHash(f.blob));
    post({ ok: true, candidates: findCandidates(hashes, e.data) });
  } catch (err) {
    post({ ok: false, error: err instanceof Error ? err.message : "循环检测失败" });
  }
});

/// <reference lib="webworker" />
//
// Near-duplicate frame detector. Computes a difference hash (dHash) per frame
// from its thumbnail and groups runs of consecutive frames whose hashes are
// within a Hamming-distance threshold — the typical "held pose" stretches that
// bloat a sprite sheet. Runs off the main thread.

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

/** dHash grid: 9×8 grayscale → 8×8 = 64 comparison bits. */
const HW = 9;
const HH = 8;

async function dHash(blob: Blob): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = new OffscreenCanvas(HW, HH);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法创建画布上下文");
    ctx.drawImage(bitmap, 0, 0, HW, HH);
    const { data } = ctx.getImageData(0, 0, HW, HH);
    const gray = new Float32Array(HW * HH);
    for (let i = 0; i < HW * HH; i++) {
      const j = i * 4;
      gray[i] = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
    }
    const bits = new Uint8Array(HH * (HW - 1)); // 8 * 8 = 64
    let b = 0;
    for (let y = 0; y < HH; y++) {
      for (let x = 0; x < HW - 1; x++) {
        bits[b++] = gray[y * HW + x] > gray[y * HW + x + 1] ? 1 : 0;
      }
    }
    return bits;
  } finally {
    bitmap.close();
  }
}

function hamming(a: Uint8Array, b: Uint8Array): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

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

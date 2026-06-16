// Shared perceptual hashing (difference hash). Used by the adjacent-frame
// deduplicator and the loop-point detector so both compare frames the same way.
// Runs in worker contexts (createImageBitmap + OffscreenCanvas are available
// off the main thread).

/** dHash grid: 9×8 grayscale → 8×8 = 64 comparison bits. */
export const DHASH_W = 9;
export const DHASH_H = 8;
/** number of comparison bits a dHash produces */
export const DHASH_BITS = DHASH_H * (DHASH_W - 1); // 64

/**
 * Difference hash of an image blob: downscale to 9×8 grayscale, then emit one
 * bit per horizontal neighbor pair (left brighter than right). Returns 64 bits
 * as a Uint8Array of 0/1 — small enough to compare with a plain loop.
 */
export async function dHash(blob: Blob): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = new OffscreenCanvas(DHASH_W, DHASH_H);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法创建画布上下文");
    ctx.drawImage(bitmap, 0, 0, DHASH_W, DHASH_H);
    const { data } = ctx.getImageData(0, 0, DHASH_W, DHASH_H);
    const gray = new Float32Array(DHASH_W * DHASH_H);
    for (let i = 0; i < DHASH_W * DHASH_H; i++) {
      const j = i * 4;
      gray[i] = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
    }
    const bits = new Uint8Array(DHASH_BITS);
    let b = 0;
    for (let y = 0; y < DHASH_H; y++) {
      for (let x = 0; x < DHASH_W - 1; x++) {
        bits[b++] = gray[y * DHASH_W + x] > gray[y * DHASH_W + x + 1] ? 1 : 0;
      }
    }
    return bits;
  } finally {
    bitmap.close();
  }
}

/** Hamming distance between two equal-length bit arrays (count of differing bits). */
export function hamming(a: Uint8Array, b: Uint8Array): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

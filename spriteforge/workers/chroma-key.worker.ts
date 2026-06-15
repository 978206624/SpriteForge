/// <reference lib="webworker" />
//
// Chroma-key engine. Removes a background color by color-distance thresholding
// (tolerance), softens the edge (feather), and suppresses key-color spill on
// the remaining pixels (spill). Runs off the main thread so live slider drags
// and batch "apply to all" never block the UI.

import type { ChromaParams } from "@/types";
import { hexToRgb } from "@/lib/image/color";

export type ChromaWorkerRequest =
  | {
      kind: "preview";
      id: string;
      width: number;
      height: number;
      data: ArrayBuffer; // RGBA, transferred in
      params: ChromaParams;
    }
  | {
      kind: "encode";
      id: string;
      blob: Blob;
      params: ChromaParams;
      thumbHeight: number;
    };

export type ChromaWorkerResponse =
  | {
      kind: "preview";
      ok: true;
      id: string;
      width: number;
      height: number;
      data: ArrayBuffer; // processed RGBA, transferred out
      needsAttention: boolean;
    }
  | {
      kind: "encode";
      ok: true;
      id: string;
      processedBlob: Blob;
      thumbBlob: Blob;
      needsAttention: boolean;
    }
  | { kind: "error"; ok: false; id: string; error: string };

/** Max possible RGB Euclidean distance, for normalizing distances to [0,1]. */
const MAX_DIST = Math.sqrt(3) * 255;
/** tolerance 0-100 → fully-transparent inner radius in normalized distance. */
const INNER_SCALE = 0.4;
/** feather 0-100 → width of the partial-alpha ramp in normalized distance. */
const FEATHER_SCALE = 0.25;
/** A bg channel counts as "dominant" (chroma key) only if it leads the others
 *  by this margin; grayscale backgrounds (black/white) get no spill removal. */
const DOMINANT_MARGIN = 40;
/** Residual-background detection. We count still-opaque pixels sitting just
 *  past the keep cutoff (`t0 + featherWidth`) — i.e. near-background pixels the
 *  current tolerance failed to remove. The band is relative to the threshold so
 *  it stays meaningful at any tolerance (a fixed absolute radius breaks once
 *  `t0` exceeds it). */
const RESIDUAL_BAND = 0.05;
const RESIDUAL_ALPHA = 128;
/** Fraction of residual pixels above which a frame is flagged "not clean". */
const RESIDUAL_RATIO_FLAG = 0.04;

type Dominant = "r" | "g" | "b" | null;

function dominantChannel(r: number, g: number, b: number): Dominant {
  if (g >= r + DOMINANT_MARGIN && g >= b + DOMINANT_MARGIN) return "g";
  if (b >= r + DOMINANT_MARGIN && b >= g + DOMINANT_MARGIN) return "b";
  if (r >= g + DOMINANT_MARGIN && r >= b + DOMINANT_MARGIN) return "r";
  return null;
}

/**
 * Apply chroma keying to RGBA pixels in place. Returns whether the result still
 * carries a meaningful amount of residual background (heuristic flag).
 */
export function applyChroma(
  data: Uint8ClampedArray,
  params: ChromaParams,
): boolean {
  const bg = hexToRgb(params.backgroundColor) ?? { r: 0, g: 255, b: 0 };
  const t0 = (params.tolerance / 100) * INNER_SCALE;
  const featherWidth = (params.feather / 100) * FEATHER_SCALE;
  const spillAmt = params.spill / 100;
  const dom = dominantChannel(bg.r, bg.g, bg.b);

  const keepThreshold = t0 + featherWidth;
  let residual = 0;
  let total = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const dr = r - bg.r;
    const dg = g - bg.g;
    const db = b - bg.b;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db) / MAX_DIST;

    let alpha: number;
    if (dist <= t0) alpha = 0;
    else if (featherWidth <= 0 || dist >= t0 + featherWidth) alpha = 255;
    else alpha = Math.round((255 * (dist - t0)) / featherWidth);

    // spill suppression on still-visible pixels: pull the dominant key channel
    // down toward the average of the other two
    if (alpha > 0 && spillAmt > 0 && dom) {
      if (dom === "g") {
        const limit = (r + b) / 2;
        if (g > limit) data[i + 1] = g - (g - limit) * spillAmt;
      } else if (dom === "b") {
        const limit = (r + g) / 2;
        if (b > limit) data[i + 2] = b - (b - limit) * spillAmt;
      } else {
        const limit = (g + b) / 2;
        if (r > limit) data[i] = r - (r - limit) * spillAmt;
      }
    }

    data[i + 3] = alpha;

    total++;
    // still-opaque pixels just past the keep cutoff = near-background halo the
    // current tolerance didn't remove
    if (
      alpha > RESIDUAL_ALPHA &&
      dist >= keepThreshold &&
      dist < keepThreshold + RESIDUAL_BAND
    ) {
      residual++;
    }
  }

  return total > 0 && residual / total > RESIDUAL_RATIO_FLAG;
}

async function encodeFrame(
  blob: Blob,
  params: ChromaParams,
  thumbHeight: number,
): Promise<{ processedBlob: Blob; thumbBlob: Blob; needsAttention: boolean }> {
  const bitmap = await createImageBitmap(blob);
  try {
    const { width, height } = bitmap;
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法创建画布上下文");
    ctx.drawImage(bitmap, 0, 0);

    const imageData = ctx.getImageData(0, 0, width, height);
    const needsAttention = applyChroma(imageData.data, params);
    ctx.putImageData(imageData, 0, 0);
    const processedBlob = await canvas.convertToBlob({ type: "image/png" });

    // transparent thumbnail (PNG to preserve alpha)
    const ratio = width / height;
    const tw = Math.max(1, Math.round(thumbHeight * ratio));
    const thumb = new OffscreenCanvas(tw, thumbHeight);
    const thumbCtx = thumb.getContext("2d");
    if (!thumbCtx) throw new Error("无法创建缩略图上下文");
    thumbCtx.drawImage(canvas, 0, 0, tw, thumbHeight);
    const thumbBlob = await thumb.convertToBlob({ type: "image/png" });

    return { processedBlob, thumbBlob, needsAttention };
  } finally {
    bitmap.close();
  }
}

self.addEventListener(
  "message",
  async (e: MessageEvent<ChromaWorkerRequest>) => {
    const req = e.data;
    const post = (res: ChromaWorkerResponse, transfer?: Transferable[]) =>
      (self as DedicatedWorkerGlobalScope).postMessage(res, transfer ?? []);
    try {
      if (req.kind === "preview") {
        const data = new Uint8ClampedArray(req.data);
        const needsAttention = applyChroma(data, req.params);
        post(
          {
            kind: "preview",
            ok: true,
            id: req.id,
            width: req.width,
            height: req.height,
            data: data.buffer,
            needsAttention,
          },
          [data.buffer],
        );
      } else {
        const { processedBlob, thumbBlob, needsAttention } = await encodeFrame(
          req.blob,
          req.params,
          req.thumbHeight,
        );
        post({
          kind: "encode",
          ok: true,
          id: req.id,
          processedBlob,
          thumbBlob,
          needsAttention,
        });
      }
    } catch (err) {
      post({
        kind: "error",
        ok: false,
        id: req.id,
        error: err instanceof Error ? err.message : "抠图失败",
      });
    }
  },
);

import type { Frame, SheetParams } from "@/types";
import { getDisplayBlob } from "@/lib/frames/store";

export interface PackedFrame {
  filename: string;
  /** atlas rect of the drawn (trimmed) pixels */
  x: number;
  y: number;
  width: number;
  height: number;
  /** original (untrimmed) frame size */
  sourceWidth: number;
  sourceHeight: number;
  /** offset of the trimmed content within the original frame */
  trimX: number;
  trimY: number;
}

export interface PackedSheet {
  canvas: OffscreenCanvas;
  width: number;
  height: number;
  frames: PackedFrame[];
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Per-frame measurements from pass 1 (no bitmaps retained). */
interface FrameMeta {
  id: string;
  sourceWidth: number;
  sourceHeight: number;
  /** decoded (possibly downscaled) size */
  w: number;
  h: number;
  /** content rect within the decoded image (trimmed, or the whole image) */
  trim: Rect;
}

/** Guard rails so a runaway grid can't try to allocate a multi-gigapixel canvas. */
const MAX_SHEET_EDGE = 16384;
const MAX_SHEET_PIXELS = 8192 * 8192;

function pad6(n: number): string {
  return n.toString().padStart(6, "0");
}

/** Tight bounding box of non-transparent pixels, or null if fully transparent. */
function alphaBounds(image: ImageData): Rect | null {
  const { width, height, data } = image;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] !== 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Decode a frame blob, optionally downscaled to `maxEdge`. Caller closes. */
async function decode(
  blob: Blob,
  maxEdge: number | undefined,
): Promise<{ bitmap: ImageBitmap; w: number; h: number; srcW: number; srcH: number }> {
  const probe = await createImageBitmap(blob);
  const srcW = probe.width;
  const srcH = probe.height;
  if (maxEdge && Math.max(srcW, srcH) > maxEdge) {
    const s = maxEdge / Math.max(srcW, srcH);
    const w = Math.max(1, Math.round(srcW * s));
    const h = Math.max(1, Math.round(srcH * s));
    try {
      const bitmap = await createImageBitmap(blob, {
        resizeWidth: w,
        resizeHeight: h,
        resizeQuality: "medium",
      });
      return { bitmap, w, h, srcW, srcH };
    } finally {
      probe.close();
    }
  }
  return { bitmap: probe, w: srcW, h: srcH, srcW, srcH };
}

function computeTrim(bitmap: ImageBitmap, w: number, h: number, trim: boolean): Rect {
  if (!trim) return { x: 0, y: 0, w, h };
  const c = new OffscreenCanvas(w, h);
  const cx = c.getContext("2d");
  if (!cx) return { x: 0, y: 0, w, h };
  cx.drawImage(bitmap, 0, 0);
  return alphaBounds(cx.getImageData(0, 0, w, h)) ?? { x: 0, y: 0, w, h };
}

/**
 * Decode each frame's displayable image and pack into a sprite sheet.
 *
 * Two passes keep peak memory to a single decoded frame at a time: pass 1
 * measures (and trims) each frame, closing its bitmap immediately; pass 2
 * allocates the sheet and re-decodes/draws frame-by-frame, again closing as it
 * goes. Pass `maxEdge` to downscale for a cheap live preview; omit for a
 * full-resolution export. With `strict`, a missing frame blob throws rather
 * than being silently dropped (so an export never produces an incomplete set).
 */
export async function buildSheet(
  frames: Frame[],
  params: SheetParams,
  opts: { maxEdge?: number; strict?: boolean } = {},
): Promise<PackedSheet> {
  const { maxEdge, strict } = opts;

  // ---- pass 1: measure ----
  const metas: FrameMeta[] = [];
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const blob = await getDisplayBlob(f.id);
    if (!blob) {
      if (strict) throw new Error(`第 ${i + 1} 帧数据缺失，无法导出`);
      continue;
    }
    const { bitmap, w, h, srcW, srcH } = await decode(blob, maxEdge);
    try {
      const trim = computeTrim(bitmap, w, h, params.trimTransparent);
      metas.push({ id: f.id, sourceWidth: srcW, sourceHeight: srcH, w, h, trim });
    } finally {
      bitmap.close();
    }
  }

  if (metas.length === 0) {
    const canvas = new OffscreenCanvas(1, 1);
    return { canvas, width: 1, height: 1, frames: [] };
  }

  // ---- layout ----
  const cols = Math.max(1, Math.floor(params.columns));
  const rows = Math.max(1, Math.ceil(metas.length / cols));
  const pad = Math.max(0, params.padding);
  const mar = Math.max(0, params.margin);
  const cellW = Math.max(1, ...metas.map((m) => m.trim.w));
  const cellH = Math.max(1, ...metas.map((m) => m.trim.h));
  const width = mar * 2 + cols * cellW + (cols - 1) * pad;
  const height = mar * 2 + rows * cellH + (rows - 1) * pad;

  if (
    width > MAX_SHEET_EDGE ||
    height > MAX_SHEET_EDGE ||
    width * height > MAX_SHEET_PIXELS
  ) {
    throw new Error(
      `拼图尺寸过大（${width}×${height}）。请减少帧数、开启裁剪透明边界或改用 PNG 序列导出。`,
    );
  }

  // ---- pass 2: draw ----
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建拼图画布上下文");

  const packed: PackedFrame[] = [];
  for (let i = 0; i < metas.length; i++) {
    const meta = metas[i];
    const blob = await getDisplayBlob(meta.id);
    if (!blob) {
      if (strict) throw new Error(`第 ${i + 1} 帧数据缺失，无法导出`);
      continue;
    }
    const { bitmap } = await decode(blob, maxEdge);
    try {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const cellX = mar + c * (cellW + pad);
      const cellY = mar + r * (cellH + pad);
      const dw = meta.trim.w;
      const dh = meta.trim.h;
      // integer-align so frames stay crisp (no sub-pixel interpolation)
      const drawX = params.uniformSize
        ? Math.round(cellX + (cellW - dw) / 2)
        : cellX;
      const drawY = params.uniformSize
        ? Math.round(cellY + (cellH - dh) / 2)
        : cellY;

      ctx.drawImage(
        bitmap,
        meta.trim.x,
        meta.trim.y,
        dw,
        dh,
        drawX,
        drawY,
        dw,
        dh,
      );

      // record the actual drawn-pixel rect (consistent TexturePacker semantics:
      // frame.w/h == trimmed content size, never the full cell)
      packed.push({
        filename: `frame_${pad6(i + 1)}.png`,
        x: drawX,
        y: drawY,
        width: dw,
        height: dh,
        sourceWidth: meta.sourceWidth,
        sourceHeight: meta.sourceHeight,
        trimX: meta.trim.x,
        trimY: meta.trim.y,
      });
    } finally {
      bitmap.close();
    }
  }

  return { canvas, width, height, frames: packed };
}

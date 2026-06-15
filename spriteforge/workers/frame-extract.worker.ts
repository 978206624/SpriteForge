/// <reference lib="webworker" />
//
// Off-thread frame encoder. The main thread seeks the <video> and hands us an
// ImageBitmap per frame (transferred, zero-copy); we encode the full-resolution
// PNG (lossless source for chroma keying) plus a small JPEG grid thumbnail via
// OffscreenCanvas so PNG encoding never blocks the UI.

export interface FrameEncodeRequest {
  id: string;
  index: number;
  bitmap: ImageBitmap;
  /** target thumbnail height in px; width follows the source aspect */
  thumbHeight: number;
}

export type FrameEncodeResponse =
  | {
      ok: true;
      id: string;
      index: number;
      width: number;
      height: number;
      originalBlob: Blob;
      thumbBlob: Blob;
    }
  | { ok: false; id: string; index: number; error: string };

/** JPEG quality for opaque original-frame thumbnails. */
const THUMB_QUALITY = 0.7;

async function encode(req: FrameEncodeRequest): Promise<FrameEncodeResponse> {
  const { id, index, bitmap, thumbHeight } = req;
  try {
    const width = bitmap.width;
    const height = bitmap.height;

    // full-resolution lossless original
    const full = new OffscreenCanvas(width, height);
    const fullCtx = full.getContext("2d");
    if (!fullCtx) throw new Error("无法创建画布上下文");
    fullCtx.drawImage(bitmap, 0, 0);
    const originalBlob = await full.convertToBlob({ type: "image/png" });

    // downscaled thumbnail
    const ratio = width / height;
    const tw = Math.max(1, Math.round(thumbHeight * ratio));
    const thumb = new OffscreenCanvas(tw, thumbHeight);
    const thumbCtx = thumb.getContext("2d");
    if (!thumbCtx) throw new Error("无法创建缩略图上下文");
    thumbCtx.drawImage(bitmap, 0, 0, tw, thumbHeight);
    const thumbBlob = await thumb.convertToBlob({
      type: "image/jpeg",
      quality: THUMB_QUALITY,
    });

    return { ok: true, id, index, width, height, originalBlob, thumbBlob };
  } catch (err) {
    return {
      ok: false,
      id,
      index,
      error: err instanceof Error ? err.message : "帧编码失败",
    };
  } finally {
    req.bitmap.close();
  }
}

self.addEventListener("message", async (e: MessageEvent<FrameEncodeRequest>) => {
  const response = await encode(e.data);
  (self as DedicatedWorkerGlobalScope).postMessage(response);
});

/** CSS height in px of timeline strip thumbnails; width follows the source aspect. */
const THUMB_HEIGHT = 44;
/** JPEG quality for the (disposable) timeline thumbnails. */
const THUMB_QUALITY = 0.82;
/** Cap the device-pixel-ratio multiplier so 3x+ screens don't blow up decode cost. */
const MAX_PIXEL_RATIO = 3;

class AbortError extends Error {
  constructor() {
    super("aborted");
    this.name = "AbortError";
  }
}

/** Wait for a one-shot media event, rejecting on `error` or `signal` abort.
 *  All listeners (including the abort listener) are removed on settle so a
 *  pending metadata/seek wait never leaks when the source is swapped. */
function waitForEvent(
  video: HTMLVideoElement,
  event: "loadedmetadata" | "seeked",
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AbortError());
      return;
    }
    const cleanup = () => {
      video.removeEventListener(event, onEvent);
      video.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
    };
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(`${event} 失败`));
    };
    const onAbort = () => {
      cleanup();
      reject(new AbortError());
    };
    video.addEventListener(event, onEvent);
    video.addEventListener("error", onError);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function seekTo(
  video: HTMLVideoElement,
  time: number,
  signal?: AbortSignal,
): Promise<void> {
  const waiter = waitForEvent(video, "seeked", signal);
  video.currentTime = time;
  return waiter;
}

/**
 * Sample `count` evenly-spaced thumbnails across the whole video for the
 * timeline strip. Returns JPEG data URLs in chronological order.
 * Seeks sequentially (drawImage after each `seeked`) to stay reliable.
 *
 * Each thumbnail is rasterized at the on-screen slot's *physical* pixel size
 * (CSS slot size × devicePixelRatio) and the source frame is center-cropped
 * with `cover` semantics. Sizing to the slot — not the source aspect — is what
 * keeps portrait videos crisp: a 9:16 frame previously produced a 25px-wide
 * thumbnail that the strip stretched ~2× to fill a wide slot.
 *
 * `slotWidth`/`slotHeight` are the CSS px size of one thumbnail slot; they
 * default to a square when the caller can't measure the track yet.
 *
 * Abort-safe: passing an already-aborted or later-aborted `signal` interrupts
 * the metadata load / seek wait and releases the decoder (`removeAttribute` +
 * `load()`) via the `finally` block regardless of where it stops.
 */
export async function generateThumbnails(
  url: string,
  count: number,
  opts: { slotWidth?: number; slotHeight?: number; signal?: AbortSignal } = {},
): Promise<string[]> {
  const { slotWidth, slotHeight, signal } = opts;
  if (count <= 0 || signal?.aborted) return [];

  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;

  const thumbs: string[] = [];
  try {
    video.src = url;
    await waitForEvent(video, "loadedmetadata", signal);

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const ctx =
      duration > 0 && video.videoWidth > 0
        ? document.createElement("canvas").getContext("2d")
        : null;

    if (ctx) {
      // rasterize at the slot's physical pixel size so the strip stays crisp on
      // HiDPI screens (44 CSS px = 88+ physical px) instead of being upscaled
      const dpr = Math.min(globalThis.devicePixelRatio || 1, MAX_PIXEL_RATIO);
      const cssH = slotHeight && slotHeight > 0 ? slotHeight : THUMB_HEIGHT;
      const cssW = slotWidth && slotWidth > 0 ? slotWidth : THUMB_HEIGHT;
      const outH = Math.max(1, Math.round(cssH * dpr));
      const outW = Math.max(1, Math.round(cssW * dpr));

      // center-crop the source frame to the slot ("cover"): scale by the larger
      // axis ratio, then take the centered sub-rect of that scaled size
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const scale = Math.max(outW / vw, outH / vh);
      const sw = outW / scale;
      const sh = outH / scale;
      const sx = (vw - sw) / 2;
      const sy = (vh - sh) / 2;

      ctx.canvas.width = outW;
      ctx.canvas.height = outH;
      ctx.imageSmoothingQuality = "high";
      for (let i = 0; i < count; i++) {
        if (signal?.aborted) break;
        // sample the middle of each evenly-sized slice
        const t = ((i + 0.5) / count) * duration;
        await seekTo(video, Math.min(t, duration - 0.01), signal);
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, outW, outH);
        thumbs.push(ctx.canvas.toDataURL("image/jpeg", THUMB_QUALITY));
      }
    }
  } catch {
    // aborted (source swapped) or load/seek failure — return what we collected
  } finally {
    // abort the current media operation and free the decoder
    video.removeAttribute("src");
    video.load();
  }
  return thumbs;
}

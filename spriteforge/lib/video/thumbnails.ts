/** Height in px of timeline strip thumbnails; width follows the source aspect. */
const THUMB_HEIGHT = 44;
/** JPEG quality for the (disposable) timeline thumbnails. */
const THUMB_QUALITY = 0.6;

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
 * Abort-safe: passing an already-aborted or later-aborted `signal` interrupts
 * the metadata load / seek wait and releases the decoder (`removeAttribute` +
 * `load()`) via the `finally` block regardless of where it stops.
 */
export async function generateThumbnails(
  url: string,
  count: number,
  signal?: AbortSignal,
): Promise<string[]> {
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
      const ratio = video.videoWidth / video.videoHeight;
      const w = Math.max(1, Math.round(THUMB_HEIGHT * ratio));
      ctx.canvas.width = w;
      ctx.canvas.height = THUMB_HEIGHT;
      for (let i = 0; i < count; i++) {
        if (signal?.aborted) break;
        // sample the middle of each evenly-sized slice
        const t = ((i + 0.5) / count) * duration;
        await seekTo(video, Math.min(t, duration - 0.01), signal);
        ctx.drawImage(video, 0, 0, w, THUMB_HEIGHT);
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

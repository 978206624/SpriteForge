import type { ExportFps, VideoMeta } from "@/types";

/** Fallback fps when the browser can't measure frame timing. */
export const FALLBACK_FPS = 30;

/** Rough bytes-per-pixel for a transparent sprite PNG. Heuristic only —
 *  used for the "estimated size" hint, not for any real allocation. */
const ESTIMATED_BYTES_PER_PIXEL = 0.6;

/** Number of frame-timing samples to collect before estimating fps. */
const FPS_SAMPLES = 8;
/** Plausible fps bounds; measurements outside fall back (rVFC timing can be
 *  throttled/unreliable, yielding absurd values like 1 fps). */
const MIN_PLAUSIBLE_FPS = 5;
const MAX_PLAUSIBLE_FPS = 240;
/** Safety cap so a stuck measurement never hangs the import. */
const FPS_TIMEOUT_MS = 1500;

const SUPPORTED_EXTENSIONS = ["mp4", "mov", "webm"];
const SUPPORTED_MIME = ["video/mp4", "video/quicktime", "video/webm"];

/** Accept only browser-decodable containers; mkv/avi/etc. are rejected upfront.
 *  Extension is authoritative (Chromium reports video/x-matroska for mkv, so a
 *  naive `video/*` check would let mkv slip through). */
export function isSupportedVideo(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext) return SUPPORTED_EXTENSIONS.includes(ext);
  // no extension — fall back to the reported MIME type
  return SUPPORTED_MIME.includes(file.type);
}

interface VideoFrameMeta {
  mediaTime: number;
  presentedFrames: number;
}
type RVFC = (cb: (now: number, meta: VideoFrameMeta) => void) => number;

/** Estimate source fps via requestVideoFrameCallback, falling back to
 *  FALLBACK_FPS. Uses the presentedFrames/mediaTime span between the first and
 *  last sampled callbacks rather than per-callback mediaTime deltas — this stays
 *  accurate even when the browser drops frames or fires callbacks below the
 *  source rate (a single rVFC callback can cover multiple source frames). */
function estimateFps(video: HTMLVideoElement): Promise<number> {
  return new Promise((resolve) => {
    const rvfc = (video as unknown as { requestVideoFrameCallback?: RVFC })
      .requestVideoFrameCallback?.bind(video);
    if (!rvfc) {
      resolve(FALLBACK_FPS);
      return;
    }

    let first: VideoFrameMeta | null = null;
    let last: VideoFrameMeta | null = null;
    let samples = 0;
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      try {
        video.pause();
      } catch {
        /* detached element — ignore */
      }
      if (!first || !last) {
        resolve(FALLBACK_FPS);
        return;
      }
      const frameSpan = last.presentedFrames - first.presentedFrames;
      const timeSpan = last.mediaTime - first.mediaTime;
      const fps = timeSpan > 0 ? Math.round(frameSpan / timeSpan) : 0;
      resolve(
        fps >= MIN_PLAUSIBLE_FPS && fps <= MAX_PLAUSIBLE_FPS
          ? fps
          : FALLBACK_FPS,
      );
    };

    const onFrame = (_now: number, meta: VideoFrameMeta) => {
      if (done) return;
      if (!first) first = meta;
      last = meta;
      samples += 1;
      if (samples >= FPS_SAMPLES) finish();
      else rvfc(onFrame);
    };

    // `video` here is the disposable element created in probeVideo (cleaned up
    // right after), so playing/leaving currentTime advanced has no side effects.
    video.muted = true;
    video.playsInline = true;
    video
      .play()
      .then(() => rvfc(onFrame))
      .catch(() => finish());

    setTimeout(finish, FPS_TIMEOUT_MS);
  });
}

/** Load a video object URL, read its metadata, and estimate its frame rate. */
export function probeVideo(
  url: string,
  name: string,
  size: number,
): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.src = url;

    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("视频加载失败"));
    };

    video.onloadedmetadata = async () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      if (width === 0 || height === 0 || duration === 0) {
        cleanup();
        reject(new Error("无法读取视频信息"));
        return;
      }
      const estimatedFps = await estimateFps(video);
      cleanup();
      resolve({ name, width, height, duration, estimatedFps, size });
    };
  });
}

/** Resolve an ExportFps selection to a concrete number. */
export function resolveFps(fps: ExportFps, meta: VideoMeta | null): number {
  if (fps === "original") return meta?.estimatedFps ?? FALLBACK_FPS;
  return typeof fps === "number" ? fps : FALLBACK_FPS;
}

/** Estimated number of frames for the selected range at the resolved fps. */
export function estimateFrameCount(
  inTime: number,
  outTime: number,
  fps: ExportFps,
  meta: VideoMeta | null,
): number {
  const span = Math.max(0, outTime - inTime);
  return Math.max(0, Math.round(span * resolveFps(fps, meta)));
}

/** Rough estimated total export size in bytes (heuristic, for the UI hint). */
export function estimateBytes(frameCount: number, meta: VideoMeta | null): number {
  if (!meta) return 0;
  return Math.round(
    frameCount * meta.width * meta.height * ESTIMATED_BYTES_PER_PIXEL,
  );
}

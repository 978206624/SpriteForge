/**
 * Centralized capacity thresholds + warning helpers. Extraction and chroma
 * keying hold per-frame bitmaps in memory transiently, so very high frame
 * counts (long clip × high fps) risk jank or OOM; large source files are slow
 * to decode/seek. These power the pre-extraction warnings.
 */

/** Above this estimated frame count we warn about memory/perf pressure. */
export const FRAME_WARN_THRESHOLD = 300;
/** Above this we strongly warn (extraction may stutter or run out of memory). */
export const FRAME_HARD_THRESHOLD = 800;
/** Source files larger than this get a "may be slow" hint. */
export const LARGE_FILE_BYTES = 300 * 1024 * 1024;

export type FrameCountLevel = "ok" | "warn" | "over";

export function frameCountLevel(count: number): FrameCountLevel {
  if (count > FRAME_HARD_THRESHOLD) return "over";
  if (count > FRAME_WARN_THRESHOLD) return "warn";
  return "ok";
}

export function isLargeFile(bytes: number): boolean {
  return bytes > LARGE_FILE_BYTES;
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

import type { LoopRange } from "@/types";

/**
 * Loop ranges are expressed in frame-array positions (0-based), which equal
 * `frame.index` since frames are re-indexed contiguously on deletion.
 */

/** Clamp a loop range to [0, count-1] and drop it if it no longer makes sense
 *  (empty sequence, or collapsed to a single frame after deletions). */
export function clampLoopRange(
  range: LoopRange | null,
  count: number,
): LoopRange | null {
  if (!range || count <= 1) return null;
  const start = Math.max(0, Math.min(range.start, count - 1));
  const end = Math.max(start, Math.min(range.end, count - 1));
  if (start === end) return null;
  return { start, end };
}

/** Inclusive frame count covered by a loop range, or the full count when unset. */
export function loopLength(range: LoopRange | null, count: number): number {
  if (!range) return count;
  return range.end - range.start + 1;
}

/** Whether a position falls inside the (inclusive) loop range. */
export function inLoop(range: LoopRange | null, pos: number): boolean {
  if (!range) return true;
  return pos >= range.start && pos <= range.end;
}

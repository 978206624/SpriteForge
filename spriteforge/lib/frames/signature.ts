import type { FrameId } from "@/types";

/** Order- and content-sensitive signature of a frame sequence. Includes `rev`
 *  so a re-keyed frame (new thumbnail, same id) also changes the signature —
 *  used to invalidate cached scan results (dedup / loop detect) when any
 *  add/delete/reorder/reprocess changes the sequence. */
export function framesSignature(frames: { id: FrameId; rev: number }[]): string {
  return frames.map((f) => `${f.id}:${f.rev}`).join("|");
}

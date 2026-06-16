import type { Frame } from "@/types";
import { getDisplayBlob } from "@/lib/frames/store";

export interface NamedBlob {
  name: string;
  blob: Blob;
}

/**
 * Collect each frame's displayable PNG (chroma-keyed result, else original) as
 * `frame_000001.png …`, in sequence order. A missing frame blob throws (rather
 * than silently dropping a frame) so an export never produces an incomplete,
 * self-inconsistent set. `onProgress` reports collection progress.
 */
export async function collectFramePngs(
  frames: Frame[],
  onProgress?: (done: number, total: number) => void,
): Promise<NamedBlob[]> {
  const out: NamedBlob[] = [];
  for (let i = 0; i < frames.length; i++) {
    const blob = await getDisplayBlob(frames[i].id);
    if (!blob) throw new Error(`第 ${i + 1} 帧数据缺失，无法导出`);
    out.push({ name: `frame_${(i + 1).toString().padStart(6, "0")}.png`, blob });
    onProgress?.(i + 1, frames.length);
  }
  return out;
}

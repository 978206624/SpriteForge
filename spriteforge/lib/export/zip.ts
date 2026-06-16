import JSZip from "jszip";
import type {
  ChromaParams,
  Frame,
  LoopRange,
  SheetParams,
} from "@/types";
import type { SpritesheetJson } from "@/lib/spritesheet/json";
import type { NamedBlob } from "./png-sequence";

/** Encode an OffscreenCanvas as a PNG blob. */
export function canvasToPng(canvas: OffscreenCanvas): Promise<Blob> {
  return canvas.convertToBlob({ type: "image/png" });
}

/** Trigger a browser download of `blob` as `filename`. */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // keep the object URL alive well past the click so large downloads aren't
  // cut off, then release it
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export interface ExportConfig {
  app: string;
  version: string;
  fps: number;
  inTime: number;
  outTime: number;
  frameCount: number;
  loopRange: LoopRange | null;
  globalChromaParams: ChromaParams;
  /** per-frame chroma overrides, by sequence index */
  overrides: { index: number; params: ChromaParams }[];
  sheet: SheetParams;
}

export function buildExportConfig(input: {
  frames: Frame[];
  fps: number;
  inTime: number;
  outTime: number;
  loopRange: LoopRange | null;
  globalChromaParams: ChromaParams;
  sheet: SheetParams;
}): ExportConfig {
  return {
    app: "SpriteForge",
    version: "1.0",
    fps: input.fps,
    inTime: input.inTime,
    outTime: input.outTime,
    frameCount: input.frames.length,
    loopRange: input.loopRange,
    globalChromaParams: input.globalChromaParams,
    overrides: input.frames
      .filter((f) => f.overrideParams !== null)
      .map((f) => ({ index: f.index, params: f.overrideParams as ChromaParams })),
    sheet: input.sheet,
  };
}

/** Zip of a PNG sequence under `frames/`. */
export async function framesZip(named: NamedBlob[]): Promise<Blob> {
  const zip = new JSZip();
  const dir = zip.folder("frames");
  for (const { name, blob } of named) dir?.file(name, blob);
  return zip.generateAsync({ type: "blob" });
}

/** Zip of a sprite sheet PNG + its JSON descriptor. */
export async function sheetZip(
  sheetPng: Blob,
  json: SpritesheetJson,
): Promise<Blob> {
  const zip = new JSZip();
  zip.file("spritesheet.png", sheetPng);
  zip.file("spritesheet.json", JSON.stringify(json, null, 2));
  return zip.generateAsync({ type: "blob" });
}

/** Full resource bundle: frames/ + spritesheet/(png+json) + config.json. */
export async function bundleZip(input: {
  frames: NamedBlob[];
  sheetPng: Blob;
  json: SpritesheetJson;
  config: ExportConfig;
}): Promise<Blob> {
  const zip = new JSZip();
  const framesDir = zip.folder("frames");
  for (const { name, blob } of input.frames) framesDir?.file(name, blob);
  const sheetDir = zip.folder("spritesheet");
  sheetDir?.file("spritesheet.png", input.sheetPng);
  sheetDir?.file("spritesheet.json", JSON.stringify(input.json, null, 2));
  zip.file("config.json", JSON.stringify(input.config, null, 2));
  return zip.generateAsync({ type: "blob" });
}

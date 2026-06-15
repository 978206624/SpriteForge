// ---- Workflow steps ----

export type StepKey = "import" | "extract" | "preview" | "export";

export interface StepDef {
  key: StepKey;
  /** 1-based index shown in the stepper. */
  index: number;
  label: string;
}

export const STEPS: readonly StepDef[] = [
  { key: "import", index: 1, label: "导入" },
  { key: "extract", index: 2, label: "提取与抠图" },
  { key: "preview", index: 3, label: "预览与管理" },
  { key: "export", index: 4, label: "导出" },
] as const;

// ---- Video ----

export interface VideoMeta {
  name: string;
  width: number;
  height: number;
  /** seconds */
  duration: number;
  /** estimated frames per second of the source video */
  estimatedFps: number;
  /** bytes */
  size: number;
}

export type ExportFpsPreset = "original" | 24 | 12 | 8;
/** `number & {}` keeps the preset literals from being widened away by `number`,
 *  so editor autocomplete still suggests the presets while allowing custom fps. */
export type ExportFps = ExportFpsPreset | (number & {});

// ---- Chroma key ----

export interface ChromaParams {
  /** background color to remove, hex e.g. "#00FF00" */
  backgroundColor: string;
  /** color-distance threshold 0-100 */
  tolerance: number;
  /** edge feather amount 0-100 */
  feather: number;
  /** spill (green/blue edge contamination) removal 0-100 */
  spill: number;
}

export const DEFAULT_CHROMA_PARAMS: ChromaParams = {
  backgroundColor: "#00FF00",
  tolerance: 40,
  feather: 15,
  spill: 30,
};

// ---- Frames ----

export type FrameId = string;

export interface Frame {
  id: FrameId;
  /** 0-based position in the extracted sequence */
  index: number;
  /** per-frame chroma override; falls back to the global params when null */
  overrideParams: ChromaParams | null;
}

/** Inclusive loop range over frame indices, or null when unset. */
export interface LoopRange {
  start: number;
  end: number;
}

// ---- Sprite sheet / export ----

export interface SheetParams {
  columns: number;
  padding: number;
  margin: number;
  trimTransparent: boolean;
  uniformSize: boolean;
}

export const DEFAULT_SHEET_PARAMS: SheetParams = {
  columns: 6,
  padding: 2,
  margin: 0,
  trimTransparent: true,
  uniformSize: false,
};

export type ExportKind = "png-sequence" | "spritesheet" | "zip";

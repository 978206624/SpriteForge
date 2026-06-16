import { create } from "zustand";
import {
  DEFAULT_CHROMA_PARAMS,
  DEFAULT_SHEET_PARAMS,
  STEPS,
  type ChromaParams,
  type ExportFps,
  type ExportKind,
  type Frame,
  type FrameId,
  type LoopRange,
  type SheetParams,
  type StepKey,
  type VideoMeta,
} from "@/types";
import { clampLoopRange } from "@/lib/frames/loop";

const ORDER: StepKey[] = STEPS.map((s) => s.key);

export type ExtractStatus = "idle" | "extracting" | "done";
export type ChromaStatus = "idle" | "processing";

export interface ExtractProgress {
  done: number;
  total: number;
}

interface WorkflowState {
  // ---- Step navigation ----
  currentStep: StepKey;
  /** steps the user has advanced past (eligible for click-to-return) */
  completedSteps: StepKey[];
  goToStep: (step: StepKey) => void;
  next: () => void;
  prev: () => void;
  reset: () => void;

  // ---- Step 1: import & settings ----
  videoFile: File | null;
  /** object URL for the loaded video; revoked when replaced/cleared */
  videoUrl: string | null;
  videoMeta: VideoMeta | null;
  /** export range start, seconds */
  inTime: number;
  /** export range end, seconds */
  outTime: number;
  /** export frame rate; "original" resolves to videoMeta.estimatedFps */
  fps: ExportFps;
  setVideo: (file: File, url: string, meta: VideoMeta) => void;
  clearVideo: () => void;
  setInTime: (t: number) => void;
  setOutTime: (t: number) => void;
  setFps: (fps: ExportFps) => void;

  // ---- Step 2A: frame extraction ----
  /** lightweight per-frame metadata; bitmap blobs live in IndexedDB */
  frames: Frame[];
  extractStatus: ExtractStatus;
  extractProgress: ExtractProgress;
  extractError: string | null;
  /** currently selected frame in the grid */
  selectedFrameId: FrameId | null;
  setFrames: (frames: Frame[]) => void;
  appendFrame: (frame: Frame) => void;
  setExtractStatus: (status: ExtractStatus) => void;
  setExtractProgress: (progress: ExtractProgress) => void;
  setExtractError: (error: string | null) => void;
  selectFrame: (id: FrameId | null) => void;
  /** clear in-memory frame state (does not touch IndexedDB) */
  resetFrames: () => void;

  // ---- Step 2B: chroma key ----
  /** params applied to frames without a per-frame override */
  globalChromaParams: ChromaParams;
  chromaStatus: ChromaStatus;
  chromaProgress: ExtractProgress;
  chromaError: string | null;
  setGlobalChromaParams: (params: ChromaParams) => void;
  setChromaStatus: (status: ChromaStatus) => void;
  setChromaProgress: (progress: ExtractProgress) => void;
  setChromaError: (error: string | null) => void;
  /** patch one frame's metadata in place (processed result / override / rev) */
  updateFrameMeta: (id: FrameId, patch: Partial<Frame>) => void;

  // ---- Step 3: preview & frame management ----
  isPlaying: boolean;
  /** animation preview frame rate */
  playbackFps: number;
  /** loop the preview (vs play once) */
  looping: boolean;
  /** marked loop sub-segment (positions), null = whole sequence */
  loopRange: LoopRange | null;
  /** current playhead position (frame-array index) */
  previewIndex: number;
  /** frames selected in the strip for deletion */
  selection: FrameId[];
  setPlaying: (playing: boolean) => void;
  setPlaybackFps: (fps: number) => void;
  setLooping: (looping: boolean) => void;
  setLoopRange: (range: LoopRange | null) => void;
  setPreviewIndex: (index: number) => void;
  toggleFrameSelection: (id: FrameId) => void;
  /** add frames to the selection without ever deselecting; idempotent on
   *  duplicate/already-selected ids (one state update regardless of count) */
  addFramesToSelection: (ids: FrameId[]) => void;
  clearSelection: () => void;
  /** replace frames after a deletion, clamping loop/playhead and clearing
   *  selection (DB deletion is performed by the caller first) */
  applyDeletion: (frames: Frame[]) => void;

  // ---- Step 4: export ----
  exportKind: ExportKind;
  sheetParams: SheetParams;
  exportStatus: "idle" | "exporting";
  setExportKind: (kind: ExportKind) => void;
  setSheetParams: (params: SheetParams) => void;
  setExportStatus: (status: "idle" | "exporting") => void;
}

const INITIAL_FRAME_STATE = {
  frames: [] as Frame[],
  extractStatus: "idle" as ExtractStatus,
  extractProgress: { done: 0, total: 0 } as ExtractProgress,
  extractError: null as string | null,
  selectedFrameId: null as FrameId | null,
  globalChromaParams: DEFAULT_CHROMA_PARAMS as ChromaParams,
  chromaStatus: "idle" as ChromaStatus,
  chromaProgress: { done: 0, total: 0 } as ExtractProgress,
  chromaError: null as string | null,
  isPlaying: false,
  playbackFps: 12,
  looping: true,
  loopRange: null as LoopRange | null,
  previewIndex: 0,
  selection: [] as FrameId[],
  exportKind: "zip" as ExportKind,
  sheetParams: DEFAULT_SHEET_PARAMS as SheetParams,
  exportStatus: "idle" as "idle" | "exporting",
};

/** Reset extracted frames when the range/fps changes after extraction, so a
 *  stale frame set can't carry into later steps. No-op when none exist yet, so
 *  ordinary slider dragging before extraction stays cheap. The IndexedDB
 *  manifest (which records the params) is reconciled separately on next visit. */
function invalidateFrames(get: () => WorkflowState): Partial<WorkflowState> {
  return get().frames.length > 0 ? { ...INITIAL_FRAME_STATE } : {};
}

function indexOf(step: StepKey): number {
  return ORDER.indexOf(step);
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  // ---- Step navigation ----
  currentStep: "import",
  completedSteps: [],

  goToStep: (step) => {
    const { currentStep } = get();
    // allow jumping back to the current step or any earlier (already-visited) step;
    // forward movement only happens via next() so steps get marked completed in order
    if (indexOf(step) <= indexOf(currentStep)) set({ currentStep: step });
  },

  next: () => {
    const { currentStep, completedSteps } = get();
    const i = indexOf(currentStep);
    if (i >= ORDER.length - 1) return;
    const nextStep = ORDER[i + 1];
    set({
      currentStep: nextStep,
      completedSteps: completedSteps.includes(currentStep)
        ? completedSteps
        : [...completedSteps, currentStep],
    });
  },

  prev: () => {
    const { currentStep } = get();
    const i = indexOf(currentStep);
    if (i <= 0) return;
    set({ currentStep: ORDER[i - 1] });
  },

  reset: () => {
    const { videoUrl } = get();
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    set({
      currentStep: "import",
      completedSteps: [],
      videoFile: null,
      videoUrl: null,
      videoMeta: null,
      inTime: 0,
      outTime: 0,
      fps: "original",
      ...INITIAL_FRAME_STATE,
    });
  },

  // ---- Step 1: import & settings ----
  videoFile: null,
  videoUrl: null,
  videoMeta: null,
  inTime: 0,
  outTime: 0,
  fps: "original",

  setVideo: (file, url, meta) => {
    const prev = get().videoUrl;
    if (prev && prev !== url) URL.revokeObjectURL(prev);
    set({
      videoFile: file,
      videoUrl: url,
      videoMeta: meta,
      inTime: 0,
      outTime: meta.duration,
      fps: "original",
      // a new source invalidates any previously extracted frames
      ...INITIAL_FRAME_STATE,
    });
  },

  clearVideo: () => {
    const { videoUrl } = get();
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    set({
      videoFile: null,
      videoUrl: null,
      videoMeta: null,
      inTime: 0,
      outTime: 0,
      fps: "original",
      ...INITIAL_FRAME_STATE,
    });
  },

  setInTime: (t) => {
    const { outTime } = get();
    set({ inTime: Math.max(0, Math.min(t, outTime)), ...invalidateFrames(get) });
  },

  setOutTime: (t) => {
    const { inTime, videoMeta } = get();
    const max = videoMeta?.duration ?? t;
    set({
      outTime: Math.min(max, Math.max(t, inTime)),
      ...invalidateFrames(get),
    });
  },

  setFps: (fps) => set({ fps, ...invalidateFrames(get) }),

  // ---- Step 2A: frame extraction ----
  ...INITIAL_FRAME_STATE,

  setFrames: (frames) => set({ frames }),
  appendFrame: (frame) =>
    set((s) => ({ frames: [...s.frames, frame] })),
  setExtractStatus: (extractStatus) => set({ extractStatus }),
  setExtractProgress: (extractProgress) => set({ extractProgress }),
  setExtractError: (extractError) => set({ extractError }),
  selectFrame: (selectedFrameId) => set({ selectedFrameId }),
  resetFrames: () => set({ ...INITIAL_FRAME_STATE }),

  // ---- Step 2B: chroma key ----
  setGlobalChromaParams: (globalChromaParams) => set({ globalChromaParams }),
  setChromaStatus: (chromaStatus) => set({ chromaStatus }),
  setChromaProgress: (chromaProgress) => set({ chromaProgress }),
  setChromaError: (chromaError) => set({ chromaError }),
  updateFrameMeta: (id, patch) =>
    set((s) => ({
      frames: s.frames.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    })),

  // ---- Step 3: preview & frame management ----
  setPlaying: (isPlaying) => set({ isPlaying }),
  setPlaybackFps: (playbackFps) =>
    set({ playbackFps: Math.max(1, Math.min(60, Math.round(playbackFps))) }),
  setLooping: (looping) => set({ looping }),
  setLoopRange: (loopRange) =>
    set((s) => ({ loopRange: clampLoopRange(loopRange, s.frames.length) })),
  setPreviewIndex: (index) =>
    set((s) => ({
      previewIndex: Math.max(0, Math.min(index, s.frames.length - 1)),
    })),
  toggleFrameSelection: (id) =>
    set((s) => ({
      selection: s.selection.includes(id)
        ? s.selection.filter((x) => x !== id)
        : [...s.selection, id],
    })),
  addFramesToSelection: (ids) =>
    set((s) => ({ selection: Array.from(new Set([...s.selection, ...ids])) })),
  clearSelection: () => set({ selection: [] }),
  applyDeletion: (frames) =>
    set((s) => ({
      frames,
      selection: [],
      // drop the edit-modal target if that frame was just deleted
      selectedFrameId:
        s.selectedFrameId && frames.some((f) => f.id === s.selectedFrameId)
          ? s.selectedFrameId
          : null,
      loopRange: clampLoopRange(s.loopRange, frames.length),
      previewIndex: Math.max(0, Math.min(s.previewIndex, frames.length - 1)),
    })),

  // ---- Step 4: export ----
  setExportKind: (exportKind) => set({ exportKind }),
  setSheetParams: (sheetParams) => set({ sheetParams }),
  setExportStatus: (exportStatus) => set({ exportStatus }),
}));

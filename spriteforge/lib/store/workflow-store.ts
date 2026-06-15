import { create } from "zustand";
import {
  STEPS,
  type ExportFps,
  type Frame,
  type FrameId,
  type StepKey,
  type VideoMeta,
} from "@/types";

const ORDER: StepKey[] = STEPS.map((s) => s.key);

export type ExtractStatus = "idle" | "extracting" | "done";

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
}

const INITIAL_FRAME_STATE = {
  frames: [] as Frame[],
  extractStatus: "idle" as ExtractStatus,
  extractProgress: { done: 0, total: 0 } as ExtractProgress,
  extractError: null as string | null,
  selectedFrameId: null as FrameId | null,
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
}));

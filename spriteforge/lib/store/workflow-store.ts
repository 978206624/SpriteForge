import { create } from "zustand";
import {
  STEPS,
  type ExportFps,
  type StepKey,
  type VideoMeta,
} from "@/types";

const ORDER: StepKey[] = STEPS.map((s) => s.key);

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
    });
  },

  setInTime: (t) => {
    const { outTime } = get();
    set({ inTime: Math.max(0, Math.min(t, outTime)) });
  },

  setOutTime: (t) => {
    const { inTime, videoMeta } = get();
    const max = videoMeta?.duration ?? t;
    set({ outTime: Math.min(max, Math.max(t, inTime)) });
  },

  setFps: (fps) => set({ fps }),
}));

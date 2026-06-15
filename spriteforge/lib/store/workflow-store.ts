import { create } from "zustand";
import { STEPS, type StepKey } from "@/types";

const ORDER: StepKey[] = STEPS.map((s) => s.key);

interface WorkflowState {
  currentStep: StepKey;
  /** steps the user has advanced past (eligible for click-to-return) */
  completedSteps: StepKey[];
  goToStep: (step: StepKey) => void;
  next: () => void;
  prev: () => void;
  reset: () => void;
}

function indexOf(step: StepKey): number {
  return ORDER.indexOf(step);
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  currentStep: "import",
  completedSteps: [],

  goToStep: (step) => {
    const { currentStep, completedSteps } = get();
    // allow navigating to the current step, any completed step,
    // or the immediate next step
    const canGo =
      step === currentStep ||
      completedSteps.includes(step) ||
      indexOf(step) <= indexOf(currentStep);
    if (canGo) set({ currentStep: step });
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

  reset: () => set({ currentStep: "import", completedSteps: [] }),
}));

"use client";

import { Check } from "lucide-react";
import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { STEPS, type StepKey } from "@/types";
import { useWorkflowStore } from "@/lib/store/workflow-store";

type StepState = "done" | "current" | "todo";

export function Stepper() {
  const currentStep = useWorkflowStore((s) => s.currentStep);
  const completedSteps = useWorkflowStore((s) => s.completedSteps);
  const goToStep = useWorkflowStore((s) => s.goToStep);

  function stateOf(key: StepKey): StepState {
    if (key === currentStep) return "current";
    if (completedSteps.includes(key)) return "done";
    return "todo";
  }

  return (
    <nav className="flex h-16 shrink-0 items-center justify-center gap-3.5 border-b border-line bg-panel px-6">
      {STEPS.map((step, i) => {
        const state = stateOf(step.key);
        const clickable = state === "done";
        return (
          <Fragment key={step.key}>
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && goToStep(step.key)}
              className={cn(
                "flex items-center gap-2",
                clickable ? "cursor-pointer" : "cursor-default",
              )}
            >
              <span
                className={cn(
                  "grid size-[26px] place-items-center rounded-full text-[13px] font-bold transition-colors",
                  state === "current" && "bg-brand text-on-brand",
                  state === "done" &&
                    "bg-brand-soft text-brand ring-1 ring-brand",
                  state === "todo" &&
                    "bg-elevated text-fg-subtle ring-1 ring-line",
                )}
              >
                {state === "done" ? (
                  <Check className="size-3.5" strokeWidth={3} />
                ) : (
                  step.index
                )}
              </span>
              <span
                className={cn(
                  "text-[13px] font-semibold transition-colors",
                  state === "current" && "text-fg",
                  state === "done" && "text-fg-muted",
                  state === "todo" && "text-fg-subtle",
                )}
              >
                {step.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <span className="h-0.5 w-11 rounded-full bg-line" />
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

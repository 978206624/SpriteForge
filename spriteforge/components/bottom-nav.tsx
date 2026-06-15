"use client";

import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { STEPS } from "@/types";
import { useWorkflowStore } from "@/lib/store/workflow-store";

export function BottomNav({
  context,
  nextDisabled = false,
}: {
  context?: ReactNode;
  /** block forward navigation (e.g. import step before a video is loaded) */
  nextDisabled?: boolean;
}) {
  const currentStep = useWorkflowStore((s) => s.currentStep);
  const next = useWorkflowStore((s) => s.next);
  const prev = useWorkflowStore((s) => s.prev);

  const index = STEPS.findIndex((s) => s.key === currentStep);
  const isFirst = index <= 0;
  const isLast = index >= STEPS.length - 1;
  const nextStep = isLast ? null : STEPS[index + 1];

  return (
    <footer className="flex h-16 shrink-0 items-center justify-between border-t border-line bg-panel px-6">
      <div className="font-mono text-[13px] text-fg-muted">{context}</div>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={prev}
          disabled={isFirst}
          className="flex items-center gap-1.5 rounded-md px-3.5 py-2.5 text-sm font-medium text-fg-muted transition-colors hover:bg-hover disabled:pointer-events-none disabled:opacity-40"
        >
          <ArrowLeft className="size-4" />
          上一步
        </button>

        {nextStep && (
          <button
            type="button"
            onClick={next}
            disabled={nextDisabled}
            className="flex items-center gap-2 rounded-md bg-brand-strong px-4 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-strong-hover disabled:pointer-events-none disabled:opacity-40"
          >
            下一步：{nextStep.label}
            <ArrowRight className="size-4" />
          </button>
        )}
      </div>
    </footer>
  );
}

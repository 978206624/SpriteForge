"use client";

import { TopBar } from "@/components/top-bar";
import { Stepper } from "@/components/stepper";
import { BottomNav } from "@/components/bottom-nav";
import { ImportStep } from "@/components/step-import/import-step";
import { useWorkflowStore } from "@/lib/store/workflow-store";
import { STEPS, type StepKey } from "@/types";

// Placeholder bodies for steps not yet built (Phases 3-6).
const PLACEHOLDER: Partial<Record<StepKey, { title: string; hint: string }>> = {
  extract: { title: "第二步 · 提取与抠图", hint: "Phase 3-4：提取帧网格、逐帧去背景" },
  preview: { title: "第三步 · 预览与帧管理", hint: "Phase 5：动画预览、删帧、查重、循环" },
  export: { title: "第四步 · 导出", hint: "Phase 6-7：Sprite Sheet / ZIP、登录导出" },
};

export default function Home() {
  const currentStep = useWorkflowStore((s) => s.currentStep);
  const hasVideo = useWorkflowStore((s) => s.videoMeta !== null);
  const label = STEPS.find((s) => s.key === currentStep)?.label ?? "";
  const placeholder = PLACEHOLDER[currentStep];

  return (
    <div className="flex h-screen flex-col bg-base">
      <TopBar />
      <Stepper />
      <main className="min-h-0 flex-1 overflow-hidden">
        {currentStep === "import" ? (
          <ImportStep />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6">
            <h1 className="text-2xl font-bold text-fg">{placeholder?.title}</h1>
            <p className="text-sm text-fg-subtle">{placeholder?.hint}</p>
          </div>
        )}
      </main>
      <BottomNav
        context={`当前：${label}`}
        nextDisabled={currentStep === "import" && !hasVideo}
      />
    </div>
  );
}

"use client";

import { TopBar } from "@/components/top-bar";
import { Stepper } from "@/components/stepper";
import { BottomNav } from "@/components/bottom-nav";
import { useWorkflowStore } from "@/lib/store/workflow-store";
import { STEPS, type StepKey } from "@/types";

// Placeholder step bodies — replaced by real step modules in Phases 2-6.
const PLACEHOLDER: Record<StepKey, { title: string; hint: string }> = {
  import: { title: "第一步 · 导入与设置", hint: "Phase 2：导入视频、选区间、选帧率" },
  extract: { title: "第二步 · 提取与抠图", hint: "Phase 3-4：提取帧网格、逐帧去背景" },
  preview: { title: "第三步 · 预览与帧管理", hint: "Phase 5：动画预览、删帧、查重、循环" },
  export: { title: "第四步 · 导出", hint: "Phase 6-7：Sprite Sheet / ZIP、登录导出" },
};

export default function Home() {
  const currentStep = useWorkflowStore((s) => s.currentStep);
  const step = PLACEHOLDER[currentStep];
  const label = STEPS.find((s) => s.key === currentStep)?.label ?? "";

  return (
    <div className="flex h-screen flex-col bg-base">
      <TopBar />
      <Stepper />
      <main className="flex flex-1 flex-col items-center justify-center gap-2 p-6">
        <h1 className="text-2xl font-bold text-fg">{step.title}</h1>
        <p className="text-sm text-fg-subtle">{step.hint}</p>
      </main>
      <BottomNav context={`当前：${label}`} />
    </div>
  );
}

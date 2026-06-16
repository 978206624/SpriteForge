"use client";

import { useWorkflowStore } from "@/lib/store/workflow-store";
import { ExportPanel } from "./export-panel";
import { SheetPreview } from "./sheet-preview";
import { SpritesheetPanel } from "./spritesheet-panel";

export function ExportStep() {
  const frameCount = useWorkflowStore((s) => s.frames.length);
  const exportKind = useWorkflowStore((s) => s.exportKind);
  const showSheet = exportKind === "spritesheet" || exportKind === "zip";

  if (frameCount === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-fg-subtle">
          请先在前面的步骤提取并处理帧。
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-4 overflow-y-auto p-4">
      <aside className="flex w-80 shrink-0 flex-col gap-4">
        <ExportPanel />
        {showSheet && <SpritesheetPanel />}
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {showSheet ? (
          <SheetPreview />
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border border-line bg-base">
            <p className="max-w-xs text-center text-[13px] text-fg-subtle">
              将导出 {frameCount} 张 PNG（frame_000001.png …）并打包为 zip。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

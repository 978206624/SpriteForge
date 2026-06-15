"use client";

import { cn } from "@/lib/utils";
import type { ExportFps } from "@/types";
import { useWorkflowStore } from "@/lib/store/workflow-store";

const PRESETS: { value: ExportFps; label: string }[] = [
  { value: "original", label: "原始" },
  { value: 24, label: "24" },
  { value: 12, label: "12" },
  { value: 8, label: "8" },
];

const PRESET_NUMBERS = [24, 12, 8];

export function FpsSelect() {
  const fps = useWorkflowStore((s) => s.fps);
  const setFps = useWorkflowStore((s) => s.setFps);

  const isCustom = typeof fps === "number" && !PRESET_NUMBERS.includes(fps);

  function pill(active: boolean) {
    return cn(
      "rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
      active
        ? "bg-brand-strong text-on-brand"
        : "bg-elevated text-fg-muted ring-1 ring-line hover:bg-hover hover:text-fg",
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-medium text-fg-muted">导出帧率</span>
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={String(p.value)}
            type="button"
            onClick={() => setFps(p.value)}
            className={pill(fps === p.value)}
          >
            {p.label}
          </button>
        ))}

        <button
          type="button"
          onClick={() => setFps(isCustom ? fps : 15)}
          className={pill(isCustom)}
        >
          自定义
        </button>

        {isCustom && (
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={120}
              value={fps}
              onChange={(e) => {
                const n = Math.round(Number(e.target.value));
                if (Number.isFinite(n) && n > 0) setFps(Math.min(120, n));
              }}
              className="w-16 rounded-md border border-line bg-elevated px-2 py-1 text-center font-mono text-[13px] text-fg outline-none focus:border-brand"
            />
            <span className="text-[13px] text-fg-subtle">fps</span>
          </div>
        )}
      </div>
    </div>
  );
}

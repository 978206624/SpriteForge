"use client";

import { cn } from "@/lib/utils";
import { useWorkflowStore } from "@/lib/store/workflow-store";
import type { SheetParams } from "@/types";

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-[13px] text-fg-muted">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Math.round(Number(e.target.value));
          if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, n)));
        }}
        className="w-20 rounded-md border border-line bg-elevated px-2 py-1 text-center font-mono text-[13px] text-fg outline-none focus:border-brand"
      />
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-3"
    >
      <span className="text-[13px] text-fg-muted">{label}</span>
      <span
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors",
          checked ? "bg-brand" : "bg-line-strong",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-white transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

export function SpritesheetPanel() {
  const sheet = useWorkflowStore((s) => s.sheetParams);
  const setSheetParams = useWorkflowStore((s) => s.setSheetParams);
  const set = (patch: Partial<SheetParams>) =>
    setSheetParams({ ...sheet, ...patch });

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-panel p-4">
      <h3 className="text-sm font-semibold text-fg">Sprite Sheet 参数</h3>
      <NumberField
        label="每行帧数"
        value={sheet.columns}
        min={1}
        max={64}
        onChange={(columns) => set({ columns })}
      />
      <NumberField
        label="帧间距 padding"
        value={sheet.padding}
        min={0}
        max={64}
        onChange={(padding) => set({ padding })}
      />
      <NumberField
        label="外边距 margin"
        value={sheet.margin}
        min={0}
        max={64}
        onChange={(margin) => set({ margin })}
      />
      <Toggle
        label="裁剪透明边界"
        checked={sheet.trimTransparent}
        onChange={(trimTransparent) => set({ trimTransparent })}
      />
      <Toggle
        label="统一帧尺寸"
        checked={sheet.uniformSize}
        onChange={(uniformSize) => set({ uniformSize })}
      />
    </div>
  );
}

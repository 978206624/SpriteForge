"use client";

import { Pipette } from "lucide-react";
import { cn } from "@/lib/utils";
import { isValidHex } from "@/lib/image/color";
import type { ChromaParams } from "@/types";

interface ChromaKeyPanelProps {
  params: ChromaParams;
  onChange: (params: ChromaParams) => void;
  eyedropperActive: boolean;
  onToggleEyedropper: () => void;
}

const PRESETS: { label: string; color: string }[] = [
  { label: "绿", color: "#00FF00" },
  { label: "蓝", color: "#0000FF" },
  { label: "黑", color: "#000000" },
  { label: "白", color: "#FFFFFF" },
];

function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-fg-muted">{label}</span>
        <span className="font-mono text-[13px] text-fg">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-elevated accent-brand"
      />
    </label>
  );
}

export function ChromaKeyPanel({
  params,
  onChange,
  eyedropperActive,
  onToggleEyedropper,
}: ChromaKeyPanelProps) {
  const set = (patch: Partial<ChromaParams>) => onChange({ ...params, ...patch });
  const hexValid = isValidHex(params.backgroundColor);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-medium text-fg-muted">背景色</span>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.color}
              type="button"
              onClick={() => set({ backgroundColor: p.color })}
              title={p.label}
              aria-label={`背景色 ${p.label}`}
              aria-pressed={
                params.backgroundColor.toUpperCase() === p.color.toUpperCase()
              }
              className={cn(
                "size-7 rounded-md ring-1 transition-transform hover:scale-105",
                params.backgroundColor.toUpperCase() === p.color.toUpperCase()
                  ? "ring-2 ring-brand"
                  : "ring-line",
              )}
              style={{ backgroundColor: p.color }}
            />
          ))}

          <button
            type="button"
            onClick={onToggleEyedropper}
            aria-pressed={eyedropperActive}
            title="在原图上取色"
            className={cn(
              "flex size-7 items-center justify-center rounded-md ring-1 transition-colors",
              eyedropperActive
                ? "bg-brand-strong text-on-brand ring-brand"
                : "bg-elevated text-fg-muted ring-line hover:bg-hover hover:text-fg",
            )}
          >
            <Pipette className="size-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="size-5 shrink-0 rounded ring-1 ring-line"
            style={{ backgroundColor: hexValid ? params.backgroundColor : "transparent" }}
          />
          <input
            type="text"
            value={params.backgroundColor}
            onChange={(e) => set({ backgroundColor: e.target.value })}
            spellCheck={false}
            className={cn(
              "w-28 rounded-md border bg-elevated px-2 py-1 font-mono text-[13px] text-fg outline-none focus:border-brand",
              hexValid ? "border-line" : "border-error",
            )}
          />
          {!hexValid && (
            <span className="text-[12px] text-error">无效的 HEX</span>
          )}
        </div>
      </div>

      <Slider
        label="容差 Tolerance"
        value={params.tolerance}
        onChange={(tolerance) => set({ tolerance })}
      />
      <Slider
        label="羽化 Feather"
        value={params.feather}
        onChange={(feather) => set({ feather })}
      />
      <Slider
        label="去边 Spill"
        value={params.spill}
        onChange={(spill) => set({ spill })}
      />
    </div>
  );
}

"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkerboard } from "@/components/shared/checkerboard";

interface FrameGridItemProps {
  index: number;
  /** object URL for the frame thumbnail, or null while loading */
  url: string | null;
  /** processed frames show their transparent result over a checkerboard */
  processed: boolean;
  /** residual background remains — surface a warning badge */
  needsAttention: boolean;
  /** frame has per-frame override params (tweaked independently) */
  hasOverride: boolean;
  selected: boolean;
  onSelect: () => void;
}

export function FrameGridItem({
  index,
  url,
  processed,
  needsAttention,
  hasOverride,
  selected,
  onSelect,
}: FrameGridItemProps) {
  const img = url ? (
    // eslint-disable-next-line @next/next/no-img-element -- blob: object URL, not a static asset
    <img
      src={url}
      alt=""
      className="size-full object-contain"
      draggable={false}
    />
  ) : (
    <div className="size-full animate-pulse bg-hover" />
  );

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`编辑第 ${index + 1} 帧`}
      className={cn(
        "group relative aspect-square overflow-hidden rounded-md ring-1 transition-colors",
        processed ? "bg-transparent" : "bg-elevated",
        selected ? "ring-2 ring-brand" : "ring-line hover:ring-line-strong",
      )}
    >
      {processed && url ? (
        <Checkerboard size={8} className="size-full">
          {img}
        </Checkerboard>
      ) : (
        img
      )}

      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] leading-none text-white">
        {index + 1}
      </span>

      {needsAttention && (
        <span
          className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-warning text-black"
          title="可能未抠净，建议检查"
        >
          <AlertTriangle className="size-2.5" />
        </span>
      )}

      {hasOverride && (
        <span
          className="absolute left-1 top-1 size-2 rounded-full bg-brand ring-1 ring-white/50"
          title="此帧使用单独的抠图参数"
        />
      )}
    </button>
  );
}

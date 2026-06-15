"use client";

import { cn } from "@/lib/utils";

interface FrameGridItemProps {
  index: number;
  /** object URL for the frame thumbnail, or null while loading */
  url: string | null;
  selected: boolean;
  onSelect: () => void;
}

export function FrameGridItem({
  index,
  url,
  selected,
  onSelect,
}: FrameGridItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`第 ${index + 1} 帧`}
      className={cn(
        "group relative aspect-square overflow-hidden rounded-md bg-elevated ring-1 transition-colors",
        selected
          ? "ring-2 ring-brand"
          : "ring-line hover:ring-line-strong",
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- blob: object URL, not a static asset
        <img
          src={url}
          alt=""
          className="size-full object-contain"
          draggable={false}
        />
      ) : (
        <div className="size-full animate-pulse bg-hover" />
      )}
      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] leading-none text-white">
        {index + 1}
      </span>
    </button>
  );
}

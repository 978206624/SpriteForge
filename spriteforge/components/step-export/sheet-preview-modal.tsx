"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { buildSheet } from "@/lib/spritesheet/pack";
import { useZoomPan } from "@/lib/hooks/use-zoom-pan";
import { useWorkflowStore } from "@/lib/store/workflow-store";

/**
 * Fullscreen sprite-sheet preview built at full export resolution (no
 * downscaling), with wheel zoom + drag pan so the user can inspect packing,
 * trimming and per-frame detail before exporting.
 */
export function SheetPreviewModal({ onClose }: { onClose: () => void }) {
  const frames = useWorkflowStore((s) => s.frames);
  const sheetParams = useWorkflowStore((s) => s.sheetParams);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const token = useRef(0);
  const [building, setBuilding] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  const {
    attachZoom,
    panHandlers,
    transformStyle,
    transform,
    zoomed,
    dragging,
    reset: resetZoom,
  } = useZoomPan({ maxScale: 16 });

  // build the full-resolution sheet on open / param change. A short debounce +
  // token guard (mirroring SheetPreview) keeps state updates inside the async
  // callback and discards any in-flight build superseded by a param change.
  useEffect(() => {
    const mine = ++token.current;
    let cancelled = false;
    const fresh = () => !cancelled && mine === token.current;
    const timer = setTimeout(() => {
      setBuilding(true);
      setError(null);
      setDims(null); // drop any prior sheet's size while the new one builds
      resetZoom();
      void buildSheet(frames, sheetParams)
        .then((packed) => {
          if (!fresh()) return;
          const canvas = canvasRef.current;
          if (canvas) {
            const bmp = packed.canvas.transferToImageBitmap();
            canvas.width = bmp.width;
            canvas.height = bmp.height;
            canvas.getContext("2d")?.drawImage(bmp, 0, 0);
            setDims({ w: bmp.width, h: bmp.height });
            bmp.close();
          }
          setBuilding(false);
        })
        .catch((e: unknown) => {
          if (!fresh()) return;
          setError(e instanceof Error ? e.message : "生成预览失败");
          setBuilding(false);
        });
    }, 80);
    return () => {
      clearTimeout(timer);
      cancelled = true;
    };
  }, [frames, sheetParams, resetZoom]);

  // Escape to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="拼图大图预览"
      className="fixed inset-0 z-50 flex flex-col bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between pb-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 text-sm text-white">
          <span className="font-semibold">拼图大图预览</span>
          {building && <Loader2 className="size-4 animate-spin" />}
          {dims && (
            <span className="font-mono text-white/60">
              {dims.w}×{dims.h} · {Math.round(transform.scale * 100)}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {zoomed && (
            <button
              type="button"
              onClick={resetZoom}
              className="rounded-md border border-white/20 px-2.5 py-1 text-[12px] text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              复位
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="rounded-md p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>

      <div
        ref={attachZoom}
        onDoubleClick={resetZoom}
        onClick={(e) => e.stopPropagation()}
        {...panHandlers}
        style={{ cursor: zoomed ? (dragging ? "grabbing" : "grab") : "zoom-in" }}
        className="flex min-h-0 flex-1 touch-none select-none items-center justify-center overflow-hidden rounded-lg border border-white/15 bg-base"
      >
        {error ? (
          <p className="max-w-sm px-6 text-center text-[13px] text-warning">
            {error}
          </p>
        ) : (
          <canvas
            ref={canvasRef}
            style={transformStyle}
            className="max-h-full max-w-full object-contain [image-rendering:pixelated]"
          />
        )}
      </div>

      <p className="pt-2 text-center text-[12px] text-white/50">
        原始分辨率 · 滚轮缩放 · 拖动平移 · 双击复位 · Esc 关闭
      </p>
    </div>
  );
}

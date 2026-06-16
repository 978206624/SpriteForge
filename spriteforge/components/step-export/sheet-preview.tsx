"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { buildSheet } from "@/lib/spritesheet/pack";
import { useWorkflowStore } from "@/lib/store/workflow-store";

/** Per-frame longest edge for the (downscaled) live preview sheet. */
const PREVIEW_FRAME_EDGE = 96;
const DEBOUNCE_MS = 200;

export function SheetPreview() {
  const frames = useWorkflowStore((s) => s.frames);
  const sheetParams = useWorkflowStore((s) => s.sheetParams);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const token = useRef(0);
  const [building, setBuilding] = useState(false);
  const [frameCount, setFrameCount] = useState(0);

  useEffect(() => {
    const mine = ++token.current;
    let cancelled = false;
    const fresh = () => !cancelled && mine === token.current;
    const timer = setTimeout(() => {
      setBuilding(true);
      void buildSheet(frames, sheetParams, { maxEdge: PREVIEW_FRAME_EDGE })
        .then((packed) => {
          if (!fresh()) return;
          const canvas = canvasRef.current;
          if (canvas) {
            const bmp = packed.canvas.transferToImageBitmap();
            canvas.width = bmp.width;
            canvas.height = bmp.height;
            canvas.getContext("2d")?.drawImage(bmp, 0, 0);
            bmp.close();
          }
          setFrameCount(packed.frames.length);
          setBuilding(false);
        })
        .catch(() => {
          if (fresh()) setBuilding(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      cancelled = true; // invalidate any in-flight build on unmount / change
    };
  }, [frames, sheetParams]);

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex items-center gap-2 text-[13px] text-fg-muted">
        拼图预览
        {building && <Loader2 className="size-3.5 animate-spin" />}
        <span className="ml-auto font-mono text-fg-subtle">
          {frameCount} 帧 · 每行 {sheetParams.columns}
        </span>
      </div>
      <div className="flex min-h-40 flex-1 items-center justify-center overflow-auto rounded-lg border border-line bg-base p-3">
        <canvas
          ref={canvasRef}
          className="max-h-[42vh] max-w-full object-contain [image-rendering:pixelated]"
        />
      </div>
      <p className="text-[12px] text-fg-subtle">
        预览为缩略示意；导出使用原始分辨率。
      </p>
    </div>
  );
}

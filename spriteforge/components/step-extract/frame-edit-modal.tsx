"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { getPixels } from "@/lib/frames/store";
import { previewChroma } from "@/lib/image/chroma";
import { isValidHex } from "@/lib/image/color";
import { clientToImageCoords, pixelToHex } from "@/lib/image/eyedropper";
import { Checkerboard } from "@/components/shared/checkerboard";
import { useWorkflowStore } from "@/lib/store/workflow-store";
import type { ChromaParams, FrameId } from "@/types";
import { ChromaKeyPanel } from "./chroma-key-panel";

interface FrameEditModalProps {
  frameId: FrameId;
  onClose: () => void;
  /** start a batch apply of `params` to all frames (parent shows progress) */
  onApplyToAll: (params: ChromaParams) => void;
  /** apply `params` as a single-frame override; resolves when persisted */
  onApplySingle: (params: ChromaParams) => Promise<void>;
}

/** Debounce delay for recomputing the live preview on slider drags. */
const PREVIEW_DEBOUNCE_MS = 120;
/** Live preview works on a downscaled copy (longest edge) so slider drags stay
 *  smooth on 1080p/4K sources; the real "apply" re-keys the full-resolution
 *  original from IndexedDB. */
const PREVIEW_MAX_EDGE = 720;

function paint(canvas: HTMLCanvasElement | null, image: ImageData | null) {
  if (!canvas || !image) return;
  if (canvas.width !== image.width) canvas.width = image.width;
  if (canvas.height !== image.height) canvas.height = image.height;
  canvas.getContext("2d")?.putImageData(image, 0, 0);
}

export function FrameEditModal({
  frameId,
  onClose,
  onApplyToAll,
  onApplySingle,
}: FrameEditModalProps) {
  const frame = useWorkflowStore((s) =>
    s.frames.find((f) => f.id === frameId),
  );
  const globalParams = useWorkflowStore((s) => s.globalChromaParams);

  const [params, setParams] = useState<ChromaParams>(
    () => frame?.overrideParams ?? globalParams,
  );
  const [source, setSource] = useState<ImageData | null>(null);
  const [preview, setPreview] = useState<ImageData | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [needsAttention, setNeedsAttention] = useState(false);
  const [eyedropper, setEyedropper] = useState(false);
  const [busy, setBusy] = useState(false);

  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewToken = useRef(0);

  // load the original frame pixels, downscaled for smooth live preview
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const pixels = await getPixels(frameId);
        if (cancelled || !pixels) return;
        const bitmap = await createImageBitmap(pixels.originalBlob);
        if (cancelled) {
          bitmap.close();
          return;
        }
        const scale = Math.min(
          1,
          PREVIEW_MAX_EDGE / Math.max(bitmap.width, bitmap.height),
        );
        const w = Math.max(1, Math.round(bitmap.width * scale));
        const h = Math.max(1, Math.round(bitmap.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(bitmap, 0, 0, w, h);
        bitmap.close();
        if (ctx && !cancelled) setSource(ctx.getImageData(0, 0, w, h));
      } catch {
        // frame missing / decode failure — leave the canvases empty
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [frameId]);

  // recompute the preview (debounced) whenever the source or params change.
  // cleanup aborts the in-flight worker request so a closed/restarted modal
  // never paints a stale result or wastes the worker on a discarded preview.
  useEffect(() => {
    if (!source) return;
    const token = ++previewToken.current;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setPreviewing(true);
      void previewChroma(source, params, ctrl.signal)
        .then((res) => {
          if (token !== previewToken.current) return; // stale
          setPreview(res.imageData);
          setNeedsAttention(res.needsAttention);
          setPreviewing(false);
        })
        .catch(() => {
          // ignore aborted previews (modal closed / params changed)
          if (ctrl.signal.aborted) return;
          if (token === previewToken.current) setPreviewing(false);
        });
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [source, params]);

  // paint canvases
  useEffect(() => paint(sourceCanvasRef.current, source), [source]);
  useEffect(() => paint(previewCanvasRef.current, preview), [preview]);

  // Escape to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const handleEyedrop = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!eyedropper || !source) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const { x, y } = clientToImageCoords(
        e.clientX,
        e.clientY,
        rect,
        source.width,
        source.height,
      );
      const hex = pixelToHex(source, x, y);
      if (hex) setParams((p) => ({ ...p, backgroundColor: hex }));
      setEyedropper(false);
    },
    [eyedropper, source],
  );

  const canApply = isValidHex(params.backgroundColor) && !busy;

  const applyAll = () => {
    if (!canApply) return;
    onApplyToAll(params);
    onClose();
  };

  const applySingle = async () => {
    if (!canApply) return;
    setBusy(true);
    try {
      await onApplySingle(params);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`编辑第 ${(frame?.index ?? 0) + 1} 帧的抠图`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-line bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-fg">
            抠图编辑 · 第 {(frame?.index ?? 0) + 1} 帧
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="关闭"
            className="rounded-md p-1 text-fg-muted transition-colors hover:bg-hover hover:text-fg disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:flex-row">
          {/* comparison */}
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
            <figure className="flex min-h-0 flex-col gap-1.5">
              <figcaption className="text-[12px] text-fg-subtle">原图</figcaption>
              <div className="flex min-h-40 flex-1 items-center justify-center overflow-hidden rounded-md border border-line bg-base">
                <canvas
                  ref={sourceCanvasRef}
                  onClick={handleEyedrop}
                  className={`max-h-[50vh] max-w-full object-contain ${
                    eyedropper ? "cursor-crosshair" : ""
                  }`}
                />
              </div>
            </figure>
            <figure className="flex min-h-0 flex-col gap-1.5">
              <figcaption className="flex items-center gap-2 text-[12px] text-fg-subtle">
                抠图后
                {previewing && <Loader2 className="size-3 animate-spin" />}
                {needsAttention && (
                  <span className="text-warning">可能未抠净</span>
                )}
              </figcaption>
              <Checkerboard
                size={10}
                className="flex min-h-40 flex-1 items-center justify-center overflow-hidden rounded-md border border-line"
              >
                <canvas
                  ref={previewCanvasRef}
                  className="max-h-[50vh] max-w-full object-contain"
                />
              </Checkerboard>
            </figure>
          </div>

          {/* controls */}
          <aside className="flex w-full shrink-0 flex-col gap-5 lg:w-72">
            <ChromaKeyPanel
              params={params}
              onChange={setParams}
              eyedropperActive={eyedropper}
              onToggleEyedropper={() => setEyedropper((v) => !v)}
            />

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={applyAll}
                disabled={!canApply}
                className="flex items-center justify-center gap-2 rounded-md bg-brand-strong px-4 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-strong-hover disabled:opacity-50"
              >
                应用到全部帧
              </button>
              <button
                type="button"
                onClick={applySingle}
                disabled={!canApply}
                className="flex items-center justify-center gap-2 rounded-md border border-line px-4 py-2 text-[13px] font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg disabled:opacity-50"
              >
                {busy && <Loader2 className="size-3.5 animate-spin" />}
                仅应用到本帧
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

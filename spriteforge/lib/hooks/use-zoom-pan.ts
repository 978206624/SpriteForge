"use client";

import { useCallback, useRef, useState } from "react";

export interface ZoomPanTransform {
  scale: number;
  x: number;
  y: number;
}

interface UseZoomPanOptions {
  minScale?: number;
  maxScale?: number;
  /** wheel zoom sensitivity (higher = faster) */
  wheelSensitivity?: number;
}

const IDENTITY: ZoomPanTransform = { scale: 1, x: 0, y: 0 };

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Mouse-wheel zoom + drag-to-pan for a fixed-size container holding a single
 * centered child (canvas/img). The container box stays put; the transform is
 * applied to the child via `transformStyle`. Because the child is scaled
 * uniformly about its center, any proportional pointer→image mapping done off
 * the child's getBoundingClientRect (e.g. the eyedropper) stays correct at any
 * zoom/pan.
 *
 * `attachZoom` is a callback ref: attach it to the container so a non-passive
 * wheel listener can preventDefault (React's onWheel is passive). The same
 * callback can be attached to multiple containers to drive them from one
 * shared state.
 */
export function useZoomPan(options: UseZoomPanOptions = {}) {
  const minScale = options.minScale ?? 1;
  const maxScale = options.maxScale ?? 8;
  const sensitivity = options.wheelSensitivity ?? 0.0015;

  const [transform, setTransform] = useState<ZoomPanTransform>(IDENTITY);
  // `dragging` (state) drives the grab/grabbing cursor; `draggingRef` is the
  // synchronous guard read inside pointer-move (state would lag a frame).
  const [dragging, setDragging] = useState(false);

  const draggingRef = useRef(false);
  const last = useRef({ x: 0, y: 0 });

  // Keep the (scaled) content from being dragged out of view: the allowed pan
  // offset grows with zoom and is pinned to 0 at scale 1 (content centered).
  const clampPan = useCallback(
    (x: number, y: number, scale: number, w: number, h: number) => {
      const maxX = Math.max(0, (w * (scale - 1)) / 2);
      const maxY = Math.max(0, (h * (scale - 1)) / 2);
      return { x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
    },
    [],
  );

  // Zoom by `factor` about the cursor, keeping the point under the cursor fixed.
  // The factor is applied inside the updater so concurrent wheel ticks compose
  // off the latest scale (no stale-ref math).
  const zoomAt = useCallback(
    (clientX: number, clientY: number, rect: DOMRect, factor: number) => {
      setTransform((s) => {
        const scale = clamp(s.scale * factor, minScale, maxScale);
        if (scale === s.scale) return s;
        // cursor offset from the container center
        const cx = clientX - rect.left - rect.width / 2;
        const cy = clientY - rect.top - rect.height / 2;
        // layout point currently under the cursor — keep it fixed while scaling
        const ix = (cx - s.x) / s.scale;
        const iy = (cy - s.y) / s.scale;
        const p = clampPan(
          cx - ix * scale,
          cy - iy * scale,
          scale,
          rect.width,
          rect.height,
        );
        return { scale, x: p.x, y: p.y };
      });
    },
    [minScale, maxScale, clampPan],
  );

  const reset = useCallback(() => setTransform(IDENTITY), []);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      zoomAt(e.clientX, e.clientY, rect, Math.exp(-e.deltaY * sensitivity));
    },
    [zoomAt, sensitivity],
  );

  // callback ref: attach a non-passive wheel listener; React 19 runs the
  // returned cleanup when the node detaches (works across multiple nodes).
  const attachZoom = useCallback(
    (node: HTMLElement | null) => {
      if (!node) return;
      node.addEventListener("wheel", handleWheel, { passive: false });
      return () => node.removeEventListener("wheel", handleWheel);
    },
    [handleWheel],
  );

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    draggingRef.current = true;
    setDragging(true);
    last.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  // Incremental pan: accumulate the per-move delta onto the latest transform so
  // no baseline transform value needs to be read at pointer-down.
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const dx = e.clientX - last.current.x;
      const dy = e.clientY - last.current.y;
      last.current = { x: e.clientX, y: e.clientY };
      setTransform((s) => {
        const p = clampPan(s.x + dx, s.y + dy, s.scale, rect.width, rect.height);
        return { ...s, x: p.x, y: p.y };
      });
    },
    [clampPan],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // pointer already released
    }
  }, []);

  const zoomed = transform.scale > minScale + 1e-3;

  return {
    transform,
    transformStyle: {
      transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
      transformOrigin: "center center",
    } as React.CSSProperties,
    /** true once zoomed past the minimum (use for grab cursor / reset button) */
    zoomed,
    /** true while a drag-pan is in progress (use for the grabbing cursor) */
    dragging,
    reset,
    /** callback ref for each pannable container (non-passive wheel listener) */
    attachZoom,
    /** spread onto the container to enable drag-pan */
    panHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}

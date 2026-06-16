"use client";

import { AlertTriangle, Download, FileArchive, Grid3x3, Images, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveFps } from "@/lib/video/probe";
import { collectFramePngs } from "@/lib/export/png-sequence";
import { buildSheet } from "@/lib/spritesheet/pack";
import { buildSpritesheetJson } from "@/lib/spritesheet/json";
import {
  buildExportConfig,
  bundleZip,
  canvasToPng,
  framesZip,
  sheetZip,
  triggerDownload,
} from "@/lib/export/zip";
import { useWorkflowStore } from "@/lib/store/workflow-store";
import type { ExportKind } from "@/types";

const KINDS: { value: ExportKind; label: string; hint: string; icon: typeof Images }[] = [
  { value: "png-sequence", label: "PNG 序列", hint: "frame_000001.png … 打包为 zip", icon: Images },
  { value: "spritesheet", label: "Sprite Sheet", hint: "拼图 PNG + spritesheet.json", icon: Grid3x3 },
  { value: "zip", label: "完整资源包", hint: "frames/ + spritesheet/ + config.json", icon: FileArchive },
];

export function ExportPanel() {
  const exportKind = useWorkflowStore((s) => s.exportKind);
  const setExportKind = useWorkflowStore((s) => s.setExportKind);
  const status = useWorkflowStore((s) => s.exportStatus);
  const error = useWorkflowStore((s) => s.exportError);
  const frameCount = useWorkflowStore((s) => s.frames.length);
  const setExportStatus = useWorkflowStore((s) => s.setExportStatus);
  const setExportError = useWorkflowStore((s) => s.setExportError);

  const exporting = status === "exporting";

  const handleExport = async () => {
    const s = useWorkflowStore.getState();
    if (s.frames.length === 0 || s.exportStatus === "exporting") return; // reentrancy guard
    setExportError(null);
    setExportStatus("exporting");
    try {
      const fps = resolveFps(s.fps, s.videoMeta);
      if (s.exportKind === "png-sequence") {
        const named = await collectFramePngs(s.frames);
        triggerDownload(await framesZip(named), "spriteforge-frames.zip");
      } else if (s.exportKind === "spritesheet") {
        const packed = await buildSheet(s.frames, s.sheetParams, { strict: true });
        const png = await canvasToPng(packed.canvas);
        const json = buildSpritesheetJson(packed, {
          image: "spritesheet.png",
          fps,
          loop: s.loopRange,
        });
        triggerDownload(await sheetZip(png, json), "spriteforge-spritesheet.zip");
      } else {
        // sequential (not Promise.all) so the sheet's decoded bitmaps are freed
        // before the PNG sequence + zip buffer pile on
        const packed = await buildSheet(s.frames, s.sheetParams, { strict: true });
        const png = await canvasToPng(packed.canvas);
        const named = await collectFramePngs(s.frames);
        const json = buildSpritesheetJson(packed, {
          image: "spritesheet.png",
          fps,
          loop: s.loopRange,
        });
        const config = buildExportConfig({
          frames: s.frames,
          fps,
          inTime: s.inTime,
          outTime: s.outTime,
          loopRange: s.loopRange,
          globalChromaParams: s.globalChromaParams,
          sheet: s.sheetParams,
        });
        triggerDownload(
          await bundleZip({ frames: named, sheetPng: png, json, config }),
          "spriteforge-export.zip",
        );
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "导出失败");
    } finally {
      setExportStatus("idle");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {KINDS.map((k) => {
          const Icon = k.icon;
          const active = exportKind === k.value;
          return (
            <button
              key={k.value}
              type="button"
              onClick={() => setExportKind(k.value)}
              aria-pressed={active}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                active
                  ? "border-brand bg-brand-soft"
                  : "border-line bg-panel hover:bg-hover",
              )}
            >
              <Icon
                className={cn("mt-0.5 size-5", active ? "text-brand" : "text-fg-muted")}
              />
              <span className="flex flex-col">
                <span className="text-sm font-medium text-fg">{k.label}</span>
                <span className="text-[12px] text-fg-subtle">{k.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleExport}
        disabled={exporting || frameCount === 0}
        className="flex items-center justify-center gap-2 rounded-md bg-brand-strong px-4 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-strong-hover disabled:opacity-50"
      >
        {exporting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Download className="size-4" />
        )}
        {exporting ? "正在导出…" : "导出"}
      </button>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-error/40 bg-error/10 px-3.5 py-2.5 text-[13px] text-error">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      )}

      <p className="text-[12px] text-fg-subtle">
        全程在浏览器内打包，视频与帧不会上传服务器。
      </p>
    </div>
  );
}

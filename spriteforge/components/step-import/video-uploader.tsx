"use client";

import { useRef, useState } from "react";
import { AlertTriangle, LoaderCircle, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { isSupportedVideo, probeVideo } from "@/lib/video/probe";
import { useWorkflowStore } from "@/lib/store/workflow-store";

const UNSUPPORTED_MSG = "当前格式暂不支持，建议转为 mp4 / webm";

export function VideoUploader() {
  const setVideo = useWorkflowStore((s) => s.setVideo);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (!isSupportedVideo(file)) {
      setError(UNSUPPORTED_MSG);
      return;
    }
    const url = URL.createObjectURL(file);
    setLoading(true);
    try {
      const meta = await probeVideo(url, file.name, file.size);
      setVideo(file, url, meta);
    } catch {
      URL.revokeObjectURL(url);
      setError("视频加载失败，请尝试其他文件或转为 mp4 / webm");
    } finally {
      setLoading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = "";
  }

  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        disabled={loading}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed px-8 py-16 transition-colors",
          dragging
            ? "border-brand bg-brand-soft"
            : "border-line-strong bg-panel hover:border-brand/60 hover:bg-hover",
          loading && "pointer-events-none opacity-70",
        )}
      >
        <span className="grid size-14 place-items-center rounded-full bg-brand-soft text-brand">
          {loading ? (
            <LoaderCircle className="size-7 animate-spin" />
          ) : (
            <Upload className="size-7" />
          )}
        </span>
        <span className="flex flex-col items-center gap-1.5">
          <span className="text-base font-semibold text-fg">
            {loading ? "正在读取视频…" : "拖拽视频到此处，或点击选择"}
          </span>
          <span className="text-sm text-fg-subtle">
            支持 mp4 / mov / webm · 视频只在本地处理，不上传服务器
          </span>
        </span>
      </button>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-error/40 bg-error/10 px-3.5 py-2.5 text-sm text-error">
          <AlertTriangle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
        className="hidden"
        onChange={onInputChange}
      />
    </div>
  );
}

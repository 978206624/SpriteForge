"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

/**
 * Global error boundary for unexpected render/runtime crashes. The root layout
 * (theme, fonts) still wraps this, so it renders normal content with a recovery
 * action rather than a blank page.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-5 bg-base p-6 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-error/10 text-error">
        <AlertTriangle className="size-7" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-xl font-bold text-fg">出错了</h1>
        <p className="max-w-md text-sm text-fg-muted">
          应用遇到意外错误。你的视频和帧仍保存在本地，可重试或刷新页面继续。
        </p>
      </div>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-1.5 rounded-md bg-brand-strong px-4 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-strong-hover"
        >
          <RotateCcw className="size-4" />
          重试
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md border border-line px-4 py-2.5 text-sm font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg"
        >
          刷新页面
        </button>
      </div>
    </div>
  );
}

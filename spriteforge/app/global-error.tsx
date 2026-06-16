"use client";

import { useEffect } from "react";

/**
 * Root error boundary — the ONLY boundary that catches crashes in the root
 * layout itself (ThemeProvider / ClerkProvider / font setup). It replaces the
 * whole document, so it must render its own <html>/<body> and can't rely on the
 * app's theme/providers; styles are inline for a guaranteed render. Page-level
 * errors are handled by the nicer `app/error.tsx` instead.
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
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          background: "#0e1012",
          color: "#f2f4f7",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>应用出错了</h1>
        <p style={{ maxWidth: 420, color: "#a0a6b0", margin: 0, fontSize: 14 }}>
          应用遇到了无法恢复的错误。你的视频和帧仍保存在本地，可重试或刷新页面继续。
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#c2410c",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 18px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            重试
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              background: "transparent",
              color: "#a0a6b0",
              border: "1px solid #2a2e37",
              borderRadius: 8,
              padding: "10px 18px",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            刷新页面
          </button>
        </div>
      </body>
    </html>
  );
}

"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { SignInButton } from "@clerk/nextjs";

interface LoginModalProps {
  onClose: () => void;
}

/**
 * Login prompt shown when a guest tries to export. The actual auth UI is
 * Clerk's modal (opened by SignInButton); after a successful sign-in the gate
 * hook resumes the queued export automatically. Closing leaves all work intact.
 */
export function LoginModal({ onClose }: LoginModalProps) {
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
      aria-label="登录后导出"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-lg border border-line bg-panel p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭"
          className="absolute right-3 top-3 rounded-md p-1 text-fg-muted transition-colors hover:bg-hover hover:text-fg"
        >
          <X className="size-4" />
        </button>

        <h2 className="text-lg font-bold text-fg">登录后导出</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">
          登录后即可导出 SpriteForge 生成的游戏素材。你的视频与帧已保留，登录后会自动继续导出。
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <SignInButton mode="modal">
            <button
              type="button"
              className="w-full rounded-md bg-brand-strong px-4 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-strong-hover"
            >
              登录 / 注册
            </button>
          </SignInButton>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-md border border-line px-4 py-2 text-[13px] font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg"
          >
            稍后再说
          </button>
        </div>
      </div>
    </div>
  );
}

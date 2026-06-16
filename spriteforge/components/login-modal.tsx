"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";

interface LoginModalProps {
  onClose: () => void;
  /** Called after a successful login/register (once the session is live). The
   *  export gate omits this and resumes via its own `isSignedIn` effect; the
   *  header control passes it to close the modal. */
  onAuthed?: () => void;
}

type Mode = "login" | "register";

/**
 * Email + password login / register form for the self-hosted auth backend.
 * On success it refreshes the auth context so `isSignedIn` flips — the export
 * gate then resumes the queued export automatically. Closing leaves work intact.
 */
export function LoginModal({ onClose, onAuthed }: LoginModalProps) {
  const { refresh } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => null)) as
        | { user?: { email: string }; error?: string }
        | null;
      if (res.ok && data?.user) {
        await refresh();
        onAuthed?.();
      } else {
        setError(data?.error ?? "操作失败，请稍后重试。");
      }
    } catch {
      setError("网络错误，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  };

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

        <h2 className="text-lg font-bold text-fg">
          {mode === "login" ? "登录后导出" : "注册账号"}
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">
          {mode === "login"
            ? "登录后即可导出 SpriteForge 生成的游戏素材。你的视频与帧已保留，登录后会自动继续导出。"
            : "注册一个账号，开启 3 天免费导出试用。你的视频与帧已保留。"}
        </p>

        <form className="mt-5 flex flex-col gap-3" onSubmit={submit}>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-line bg-bg px-3 py-2.5 text-sm text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-brand"
          />
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder="密码（至少 6 位）"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-line bg-bg px-3 py-2.5 text-sm text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-brand"
          />

          {error && (
            <p className="text-[13px] text-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-brand-strong px-4 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-strong-hover disabled:opacity-60"
          >
            {submitting
              ? "处理中…"
              : mode === "login"
                ? "登录"
                : "注册并开始试用"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setError(null);
            setMode((m) => (m === "login" ? "register" : "login"));
          }}
          className="mt-3 w-full text-center text-[13px] text-fg-muted transition-colors hover:text-fg"
        >
          {mode === "login" ? "还没有账号？去注册" : "已有账号？去登录"}
        </button>
      </div>
    </div>
  );
}

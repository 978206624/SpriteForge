"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { LoginModal } from "@/components/login-modal";
import { cn } from "@/lib/utils";

interface TrialInfo {
  allowed: boolean;
  reason?: string;
  started?: boolean;
  daysLeft?: number;
}

/** Trial status pill. Reads the trial via the export API (GET = read-only, does
 *  NOT start the trial). Renders nothing unless a real trial status came back. */
function TrialBadge() {
  const { isSignedIn } = useAuth();
  const [info, setInfo] = useState<TrialInfo | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    void fetch("/api/export", { cache: "no-store" })
      .then(async (r) => (r.ok ? ((await r.json()) as TrialInfo) : null))
      .then((d) => {
        if (!cancelled) setInfo(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  // no badge when auth isn't enforced (auth-disabled) or no day count is known
  if (!info || info.reason === "auth-disabled" || typeof info.daysLeft !== "number") {
    return null;
  }
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-[12px] font-medium",
        info.allowed
          ? "bg-brand-soft text-brand"
          : "bg-warning/15 text-warning",
      )}
    >
      {info.allowed ? `试用 · 剩 ${info.daysLeft} 天` : "试用已结束"}
    </span>
  );
}

/** Login button (guest) / trial badge + email + sign-out (signed in). */
export function AuthControls() {
  const { isLoaded, isSignedIn, user, signOut } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);

  if (!isLoaded) return null;

  return (
    <div className="flex items-center gap-3">
      {isSignedIn ? (
        <>
          <TrialBadge />
          <span
            className="max-w-[160px] truncate text-[13px] text-fg-muted"
            title={user?.email}
          >
            {user?.email}
          </span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg"
          >
            退出
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setLoginOpen(true)}
            className="rounded-md bg-brand-strong px-3 py-1.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-strong-hover"
          >
            登录
          </button>
          {loginOpen && (
            <LoginModal
              onClose={() => setLoginOpen(false)}
              onAuthed={() => setLoginOpen(false)}
            />
          )}
        </>
      )}
    </div>
  );
}

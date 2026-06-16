"use client";

import { useEffect, useState } from "react";
import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";
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

/** Login button (guest) / trial badge + avatar (signed in). */
export function AuthControls() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;

  return (
    <div className="flex items-center gap-3">
      {isSignedIn ? (
        <>
          <TrialBadge />
          <UserButton />
        </>
      ) : (
        <SignInButton mode="modal">
          <button
            type="button"
            className="rounded-md bg-brand-strong px-3 py-1.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-strong-hover"
          >
            登录
          </button>
        </SignInButton>
      )}
    </div>
  );
}

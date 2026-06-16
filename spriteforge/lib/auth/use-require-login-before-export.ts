"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";

export interface ExportGate {
  /** run `action` if allowed; otherwise open the login or upgrade modal and,
   *  after a successful login, continue the original action automatically */
  guard: (action: () => void) => void;
  /** auth state has loaded — the gate can be used */
  ready: boolean;
  /** a trial check is in flight */
  checking: boolean;
  loginOpen: boolean;
  upgradeOpen: boolean;
  /** non-auth failure (network / server error) to surface to the user */
  error: string | null;
  cancelLogin: () => void;
  closeUpgrade: () => void;
  clearError: () => void;
}

/**
 * Gate an export/save action behind login + an active free trial. Guests get a
 * login modal; after signing in the queued action resumes (video/frames/params
 * are untouched in the store the whole time). The export authorization (POST)
 * starts the trial on first use; an expired trial opens the upgrade modal.
 * Cancelling login leaves all work intact.
 */
export function useRequireLoginBeforeExport(): ExportGate {
  const { isLoaded, isSignedIn } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<(() => void) | null>(null);

  const authorizeAndRun = useCallback(async (action: () => void) => {
    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as
        | { allowed?: boolean; reason?: string }
        | null;

      if (res.ok && data?.allowed) {
        action();
      } else if (res.status === 401) {
        // session lapsed — send back through login
        pendingRef.current = action;
        setLoginOpen(true);
      } else if (data?.reason === "trial-expired") {
        setUpgradeOpen(true);
      } else {
        setError("导出授权失败，请稍后重试。");
      }
    } catch {
      setError("网络错误，无法完成导出授权。");
    } finally {
      setChecking(false);
    }
  }, []);

  const guard = useCallback(
    (action: () => void) => {
      if (!isLoaded) return;
      if (!isSignedIn) {
        pendingRef.current = action;
        setLoginOpen(true);
        return;
      }
      void authorizeAndRun(action);
    },
    [isLoaded, isSignedIn, authorizeAndRun],
  );

  // resume the queued action once the user has signed in
  useEffect(() => {
    if (isSignedIn && pendingRef.current) {
      const action = pendingRef.current;
      pendingRef.current = null;
      setLoginOpen(false);
      void authorizeAndRun(action);
    }
  }, [isSignedIn, authorizeAndRun]);

  const cancelLogin = useCallback(() => {
    pendingRef.current = null;
    setLoginOpen(false);
  }, []);

  return {
    guard,
    ready: isLoaded,
    checking,
    loginOpen,
    upgradeOpen,
    error,
    cancelLogin,
    closeUpgrade: useCallback(() => setUpgradeOpen(false), []),
    clearError: useCallback(() => setError(null), []),
  };
}

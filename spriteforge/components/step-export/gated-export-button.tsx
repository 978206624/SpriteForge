"use client";

import { AlertTriangle } from "lucide-react";
import { useRequireLoginBeforeExport } from "@/lib/auth/use-require-login-before-export";
import { LoginModal } from "@/components/login-modal";
import { UpgradeModal } from "@/components/upgrade-modal";
import { ExportActionButton } from "./export-action-button";

interface GatedExportButtonProps {
  onExport: () => void;
  busy: boolean;
  disabled: boolean;
}

/**
 * Export button behind the login + trial gate. Only rendered when Clerk auth is
 * enabled (so its Clerk hooks always run under a ClerkProvider).
 */
export function GatedExportButton({ onExport, busy, disabled }: GatedExportButtonProps) {
  const {
    guard,
    ready,
    checking,
    loginOpen,
    upgradeOpen,
    error,
    cancelLogin,
    closeUpgrade,
  } = useRequireLoginBeforeExport();

  return (
    <>
      <ExportActionButton
        onClick={() => guard(onExport)}
        busy={busy || checking}
        disabled={disabled || checking || !ready}
      />
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-error/40 bg-error/10 px-3.5 py-2.5 text-[13px] text-error">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      )}
      {loginOpen && <LoginModal onClose={cancelLogin} />}
      {upgradeOpen && <UpgradeModal onClose={closeUpgrade} />}
    </>
  );
}

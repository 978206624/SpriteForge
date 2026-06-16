"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface UpgradeModalProps {
  onClose: () => void;
}

const TIERS: { id: string; name: string; price: string; features: string[]; highlight?: boolean }[] = [
  {
    id: "monthly",
    name: "月度会员",
    price: "¥29 / 月",
    features: ["无限导出", "全部导出格式", "后续新功能"],
  },
  {
    id: "lifetime",
    name: "永久会员",
    price: "¥199 一次买断",
    features: ["无限导出", "全部导出格式", "终身更新"],
    highlight: true,
  },
];

/**
 * Trial-expired upgrade prompt. Pricing is a placeholder — payment is not wired
 * up; selecting a tier just shows a "支付即将上线" note.
 */
export function UpgradeModal({ onClose }: UpgradeModalProps) {
  const [notice, setNotice] = useState(false);

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
      aria-label="升级会员"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-lg border border-line bg-panel p-6 shadow-2xl"
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

        <h2 className="text-lg font-bold text-fg">试用已结束</h2>
        <p className="mt-2 text-[13px] text-fg-muted">
          三天免费试用已用完，升级后即可继续导出。
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {TIERS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setNotice(true)}
              className={cn(
                "flex flex-col gap-2 rounded-lg border p-4 text-left transition-colors",
                t.highlight
                  ? "border-brand bg-brand-soft"
                  : "border-line hover:bg-hover",
              )}
            >
              <span className="text-sm font-semibold text-fg">{t.name}</span>
              <span className="text-base font-bold text-brand">{t.price}</span>
              <ul className="mt-1 flex flex-col gap-1">
                {t.features.map((f) => (
                  <li key={f} className="flex items-center gap-1.5 text-[12px] text-fg-muted">
                    <Check className="size-3 text-success" />
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        {notice && (
          <p className="mt-4 rounded-md border border-warning/40 bg-warning/10 px-3.5 py-2.5 text-center text-[13px] text-warning">
            支付即将上线，敬请期待 🚧
          </p>
        )}
      </div>
    </div>
  );
}

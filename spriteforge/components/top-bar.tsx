"use client";

import { useTheme } from "next-themes";
import { Flame, Moon, Sun } from "lucide-react";

function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.2 3.44 9.6 8.21 11.16.6.11.82-.25.82-.56 0-.28-.01-1.02-.02-2-3.34.71-4.04-1.58-4.04-1.58-.55-1.37-1.34-1.74-1.34-1.74-1.09-.73.08-.72.08-.72 1.2.08 1.84 1.22 1.84 1.22 1.07 1.8 2.81 1.28 3.5.98.11-.76.42-1.28.76-1.58-2.67-.3-5.47-1.31-5.47-5.83 0-1.29.47-2.34 1.23-3.17-.12-.3-.53-1.51.12-3.15 0 0 1.01-.32 3.3 1.21a11.6 11.6 0 0 1 3.01-.4c1.02 0 2.05.14 3.01.4 2.29-1.53 3.29-1.21 3.29-1.21.65 1.64.24 2.85.12 3.15.77.83 1.23 1.88 1.23 3.17 0 4.53-2.81 5.53-5.49 5.82.43.37.81 1.1.81 2.22 0 1.6-.01 2.89-.01 3.28 0 .31.21.68.83.56A12.01 12.01 0 0 0 24 12.29C24 5.78 18.63.5 12 .5Z" />
    </svg>
  );
}

export function TopBar() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <header className="flex h-13 shrink-0 items-center justify-between border-b border-line bg-panel px-5">
      <div className="flex items-center gap-2">
        <Flame className="size-[22px] text-brand" />
        <span className="text-base font-bold text-fg">SpriteForge</span>
      </div>

      <div className="flex items-center gap-4">
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
          className="text-fg-muted transition-colors hover:text-fg"
        >
          <GithubMark className="size-[18px]" />
        </a>
        <a
          href="#"
          className="text-sm font-medium text-fg-muted transition-colors hover:text-fg"
        >
          Docs
        </a>
        <div className="h-5 w-px bg-line" />
        <button
          type="button"
          aria-label="切换主题"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="grid size-8 place-items-center rounded-md text-fg-muted transition-colors hover:bg-hover hover:text-fg"
        >
          {/* icon follows the .dark class on <html> — no JS theme read, no hydration flash */}
          <Sun className="size-[18px] dark:hidden" />
          <Moon className="hidden size-[18px] dark:block" />
        </button>
        {/* Login / avatar slot — wired to Clerk in Phase 7 */}
        <button
          type="button"
          className="rounded-md bg-brand-strong px-3 py-1.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-strong-hover"
        >
          登录
        </button>
      </div>
    </header>
  );
}

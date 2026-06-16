import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { authEnabled } from "@/lib/auth/config";
import { AuthProvider } from "@/lib/auth/auth-context";
import { ThemeProvider } from "@/components/providers/theme-provider";

// Self-hosted variable fonts (woff2 in ./fonts) — no build-time Google Fonts
// fetch, so `next build` works on networks that can't reach fonts.googleapis.com.
const inter = localFont({
  src: "./fonts/inter-latin-variable.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

const robotoMono = localFont({
  src: "./fonts/roboto-mono-latin-variable.woff2",
  variable: "--font-roboto-mono",
  weight: "100 700",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SpriteForge — 视频转游戏序列帧",
  description:
    "网页端 2D 游戏角色序列帧生成工具：视频转透明 PNG 序列帧与 Sprite Sheet，本地处理不上传。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const tree = (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={`${inter.variable} ${robotoMono.variable} antialiased`}
    >
      <body className="min-h-full">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );

  // wrap with the auth context only when the login gate is enabled
  return authEnabled ? <AuthProvider>{tree}</AuthProvider> : tree;
}

import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { authEnabled } from "@/lib/auth/config";
import { ThemeProvider } from "@/components/providers/theme-provider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
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

  // wrap with Clerk only when configured, so the app builds/runs without keys
  return authEnabled ? <ClerkProvider>{tree}</ClerkProvider> : tree;
}

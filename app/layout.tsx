import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://codex-pet-club.renxiangjie.workers.dev"),
  title: "Codex Pet Club · 桌宠开源俱乐部",
  description: "发现、安装并分享经过审核的 Codex 动画桌宠。",
  openGraph: {
    title: "Codex Pet Club",
    description: "给你的 Codex，一只会动的搭档。",
    type: "website",
    locale: "zh_CN",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Codex Pet Club 桌宠库" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Codex Pet Club",
    description: "给你的 Codex，一只会动的搭档。",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}

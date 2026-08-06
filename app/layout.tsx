import type { Metadata } from "next";
import { headers } from "next/headers";
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

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const protocol = forwardedProtocol ?? (host?.includes("localhost") ? "http" : "https");
  const origin = host ? `${protocol}://${host}` : "https://sites.openai.com";
  const imageUrl = `${origin}/og.png`;

  return {
    title: "连扫｜连续条码扫描与本地导出",
    description: "连续扫描条码，自动保存到当前设备，并一键导出 CSV 或 JSON。",
    icons: {
      icon: "/favicon.png",
      shortcut: "/favicon.png",
    },
    openGraph: {
      title: "连扫｜连续条码扫描与本地导出",
      description: "无需登录，连续扫描，本地保存，一键导出。",
      type: "website",
      locale: "zh_CN",
      images: [{ url: imageUrl, width: 1731, height: 909, alt: "连扫条码扫描工具" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "连扫｜连续条码扫描与本地导出",
      description: "无需登录，连续扫描，本地保存，一键导出。",
      images: [imageUrl],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}

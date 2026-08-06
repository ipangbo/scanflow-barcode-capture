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
    title: "ScanFlow | Continuous Barcode Scanning & Local Export",
    description: "Scan barcodes continuously, save them on this device, and export CSV or JSON anytime.",
    icons: {
      icon: "/favicon.png",
      shortcut: "/favicon.png",
    },
    openGraph: {
      title: "ScanFlow | Continuous Barcode Scanning",
      description: "Continuous scanning, local storage, and one-click export. No login required.",
      type: "website",
      locale: "en_US",
      images: [{ url: imageUrl, width: 1731, height: 909, alt: "ScanFlow barcode scanner" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "ScanFlow | Continuous Barcode Scanning",
      description: "Continuous scanning, local storage, and one-click export. No login required.",
      images: [imageUrl],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}

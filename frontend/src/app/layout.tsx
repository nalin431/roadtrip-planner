import type { Metadata, Viewport } from "next";
import { Fraunces, Public_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
});

const publicSans = Public_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const viewport: Viewport = {
  colorScheme: "light",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Most-Fun Path — Road Trip Planner",
  description:
    "Plan a road trip that detours for what's worth seeing, within a budget you set.",
  openGraph: {
    title: "Most-Fun Path — Road Trip Planner",
    description:
      "Plan a road trip that detours for what's worth seeing, within a budget you set.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Most-Fun Path — Road Trip Planner",
    description:
      "Plan a road trip that detours for what's worth seeing, within a budget you set.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${fraunces.variable} ${publicSans.variable} ${jetbrainsMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

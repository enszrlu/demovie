import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ThemeSync } from "@/components/theme-toggle";
import { THEME_INIT_SCRIPT } from "@/lib/theme-script";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://harborly.example"),
  title: "Harborly",
  description: "Plan, ship and measure every launch.",
  openGraph: {
    title: "Harborly",
    description: "Plan, ship and measure every launch.",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static theme bootstrap; must run before first paint */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        {children}
        <ThemeSync />
      </body>
    </html>
  );
}

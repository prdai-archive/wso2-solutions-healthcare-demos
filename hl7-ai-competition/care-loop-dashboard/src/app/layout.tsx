import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
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
  title: "Care Loop — Ops",
  description:
    "Internal operations view: vitals ingestion, ML risk scoring, and agentic risk assessment.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex h-full flex-col overflow-hidden">
        <TooltipProvider delayDuration={200}>
          <SiteHeader />
          <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
            {children}
          </div>
        </TooltipProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}

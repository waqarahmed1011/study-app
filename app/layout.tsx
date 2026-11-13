import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import { TopBar } from "@/components/top-bar";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

export const metadata: Metadata = {
  title: { default: "study.ai", template: "%s · study.ai" },
  description: "Turn your notes, PDFs and diagrams into an adaptive study kit.",
  appleWebApp: { capable: true, title: "study.ai", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0b1120",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Applies the saved colour mode before paint so there's no flash.
// For "custom", the derived CSS variables saved by Settings are applied inline.
const themeScript = `try{var d=document.documentElement,t=localStorage.getItem('theme');if(t)d.dataset.theme=t;if(t==='custom'){var v=JSON.parse(localStorage.getItem('themeVars')||'{}');for(var k in v)d.style.setProperty(k,v[k]);if(v['--bg']){var m=document.querySelector('meta[name=theme-color]');if(m)m.setAttribute('content',v['--bg'])}}}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="midnight" className={jakarta.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        <TopBar />
        <Suspense fallback={<div className="mx-auto mt-24 size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading" />}>
          {children}
        </Suspense>
      </body>
    </html>
  );
}

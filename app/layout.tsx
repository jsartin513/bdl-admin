import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import TopNav from "./components/TopNav";
import IncompleteBanner from "./components/IncompleteBanner";
import DevOnlyGate from "./components/DevOnlyGate";
import { ThemeProvider } from "./components/ThemeProvider";
import PreviewEnvironmentRail from "./components/PreviewEnvironmentRail";
import { showTestModeBanner } from "./lib/env-banner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BDL Admin",
  description: "League Admin",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isPreview = showTestModeBanner();

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased bg-background text-foreground`}
        data-deployment={isPreview ? "preview" : "production"}
      >
        {isPreview ? <PreviewEnvironmentRail /> : null}
        {isPreview ? (
          <div className="preview-env-banner bg-amber-400 text-black text-center py-2 px-4 font-semibold text-sm">
            Test mode — preview admin. Production uses the live deployment only.
          </div>
        ) : null}
        <ThemeProvider>
          <a
            href="#main-content"
            className="admin-chrome sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-gray-900 focus:shadow-lg focus:outline focus:outline-2 focus:outline-blue-600 dark:focus:bg-gray-800 dark:focus:text-gray-100"
          >
            Skip to content
          </a>
          <Suspense fallback={<nav className="admin-chrome bg-gray-800 p-4 h-[52px]" aria-label="Loading navigation" />}>
            <TopNav />
          </Suspense>
          <Suspense fallback={null}>
            <IncompleteBanner />
          </Suspense>
          <main id="main-content">
            <Suspense fallback={null}>
              <DevOnlyGate>{children}</DevOnlyGate>
            </Suspense>
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}

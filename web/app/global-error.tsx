"use client";

import { Inter } from "next/font/google";
import Link from "next/link";

import "./globals.css";

import { GlassErrorRecovery } from "@/components/glass-error-recovery";
import { publicAuthMainClassName } from "@/components/public-auth-chrome";
import { PublicMinimalHeader, publicHeaderTrailingClassName } from "@/components/public-minimal-header";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

/**
 * Handles errors in the **root layout** — must include `<html>` / `<body>` (replaces the root layout subtree).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className={`h-full ${inter.variable} antialiased`}>
      <body className="uls-public-app flex min-h-screen flex-col bg-transparent font-sans text-uls-text">
        <PublicMinimalHeader trailing={<Link href="/login" className={publicHeaderTrailingClassName}>Sign in</Link>} />
        <main className={publicAuthMainClassName("spacious")}>
          <GlassErrorRecovery
            logPrefix="[global]"
            error={error}
            reset={reset}
            eyebrow="ULS Stage Director PRO"
            title="Application error"
            description="The app shell failed to load. Try again, or return home and sign in from a fresh page."
            secondaryHref="/"
            secondaryLabel="Home"
            maxWidth="md"
          />
        </main>
      </body>
    </html>
  );
}

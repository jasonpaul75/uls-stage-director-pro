"use client";

import Link from "next/link";

import { GlassErrorRecovery } from "@/components/glass-error-recovery";
import { PublicAuthChrome } from "@/components/public-auth-chrome";
import { publicHeaderTrailingClassName } from "@/components/public-minimal-header";

/**
 * Catches runtime errors under the root layout (pages like `/`).
 * Failures inside `app/layout.tsx` itself still use `global-error.tsx`.
 */
export default function RootSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PublicAuthChrome
      headerTrailing={<Link href="/login" className={publicHeaderTrailingClassName}>Sign in</Link>}
      mainPadding="spacious"
    >
      <GlassErrorRecovery
        logPrefix="[root]"
        error={error}
        reset={reset}
        eyebrow="ULS Stage Director PRO"
        title="Something went wrong"
        description="Reload this page or start again from home."
        secondaryHref="/"
        secondaryLabel="Home"
        maxWidth="md"
      />
    </PublicAuthChrome>
  );
}

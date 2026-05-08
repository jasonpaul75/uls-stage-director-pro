"use client";

import Link from "next/link";

import { GlassErrorRecovery } from "@/components/glass-error-recovery";
import { PublicAuthChrome } from "@/components/public-auth-chrome";
import { publicHeaderTrailingClassName } from "@/components/public-minimal-header";

export default function ResetRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PublicAuthChrome
      headerTrailing={
        <>
          <Link href="/" className={publicHeaderTrailingClassName}>
            Home
          </Link>
          <Link href="/login" className={publicHeaderTrailingClassName}>
            Sign in
          </Link>
        </>
      }
    >
      <GlassErrorRecovery
        logPrefix="[reset]"
        error={error}
        reset={reset}
        eyebrow="Password reset"
        title="Something went wrong"
        description="We couldn&apos;t load the reset form. Try again or request a new reset email from sign-in."
        secondaryHref="/login/forgot-password"
        secondaryLabel="Request reset again"
        maxWidth="md"
      />
    </PublicAuthChrome>
  );
}

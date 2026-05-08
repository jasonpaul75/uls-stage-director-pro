"use client";

import Link from "next/link";

import { GlassErrorRecovery } from "@/components/glass-error-recovery";
import { PublicAuthChrome } from "@/components/public-auth-chrome";
import { publicHeaderTrailingClassName } from "@/components/public-minimal-header";

export default function LoginRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PublicAuthChrome headerTrailing={<Link href="/" className={publicHeaderTrailingClassName}>Home</Link>}>
      <GlassErrorRecovery
        logPrefix="[login]"
        error={error}
        reset={reset}
        eyebrow="Sign in"
        title="Something went wrong"
        description="Reload the sign-in form or start over from home."
        secondaryHref="/login"
        secondaryLabel="Back to sign in"
        maxWidth="md"
      />
    </PublicAuthChrome>
  );
}

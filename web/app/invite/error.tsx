"use client";

import Link from "next/link";

import { GlassErrorRecovery } from "@/components/glass-error-recovery";
import { PublicAuthChrome } from "@/components/public-auth-chrome";
import { publicHeaderTrailingClassName } from "@/components/public-minimal-header";

export default function InviteRouteError({
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
        logPrefix="[invite]"
        error={error}
        reset={reset}
        eyebrow="Invite link"
        title="Something went wrong"
        description="We couldn&apos;t finish loading this step. Try again, or sign in if you already accepted the invite. Ask ULS for a new email if it keeps failing."
        secondaryHref="/login"
        secondaryLabel="Go to sign in"
        maxWidth="md"
      />
    </PublicAuthChrome>
  );
}

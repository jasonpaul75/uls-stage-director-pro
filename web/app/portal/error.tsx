"use client";

import { GlassErrorRecovery } from "@/components/glass-error-recovery";
import { AppShell } from "@/components/ui";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AppShell id="portal-main-content" outerMaxWidth="wide" contentMaxWidth="full" className="py-14">
      <GlassErrorRecovery
        logPrefix="[portal]"
        error={error}
        reset={reset}
        eyebrow="Director portal"
        title="Something went wrong"
        description="Retry loading this page or return to your dashboard."
        secondaryHref="/portal"
        secondaryLabel="Dashboard"
      />
    </AppShell>
  );
}

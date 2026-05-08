"use client";

import { GlassErrorRecovery } from "@/components/glass-error-recovery";
import { AppShell } from "@/components/ui";

export default function ProducerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AppShell id="producer-main-content" outerMaxWidth="wide" contentMaxWidth="full" className="py-14">
      <GlassErrorRecovery
        logPrefix="[producer]"
        error={error}
        reset={reset}
        eyebrow="Production workspace"
        title="Something went wrong"
        description="Retry the action, or open the command center. If this keeps happening, note the timestamp and reach out to tech."
        secondaryHref="/producer"
        secondaryLabel="Command center"
      />
    </AppShell>
  );
}

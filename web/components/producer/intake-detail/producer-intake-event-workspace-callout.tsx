import Link from "next/link";

import type { ProducerEventWorkspaceGateResult } from "@/lib/producer-event-workspace-gate";
import { buttonClassName } from "@/components/ui";

function StatusRow(props: { ok: boolean; label: string }) {
  const { ok, label } = props;
  return (
    <li className="flex items-start gap-2 text-sm text-uls-muted">
      <span className={ok ? "text-emerald-400" : "text-uls-subtle"} aria-hidden>
        {ok ? "✓" : "○"}
      </span>
      <span>{label}</span>
    </li>
  );
}

export function ProducerIntakeEventWorkspaceCallout(props: {
  projectId: string;
  gate: ProducerEventWorkspaceGateResult;
}) {
  const { projectId, gate } = props;
  const href = `/producer/inbox/${projectId}/event`;

  return (
    <section
      className="mb-10 rounded-uls-card border border-violet-500/35 bg-violet-950/20 px-4 py-4 shadow-uls-card sm:px-5"
      aria-labelledby="event-workspace-callout-heading"
    >
      <h2 id="event-workspace-callout-heading" className="text-sm font-semibold text-uls-violet">
        Event workspace
      </h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-uls-muted">
        Run of show, show media, show-day flags, and post-event delivery live here — separate from clerical intake. Access opens
        after DocuSign shows a completed contract and at least one Stripe invoice on this production is marked{" "}
        <span className="font-medium text-uls-text">paid</span> (typically your deposit).
      </p>
      <ul className="mt-4 space-y-1.5 border-t border-violet-500/25 pt-4">
        <StatusRow ok={gate.hasSignedContract} label="Contract completed in DocuSign (mirrored row shows completed)" />
        <StatusRow
          ok={gate.hasDepositInvoicePaid}
          label="Deposit / payment recorded — at least one paid Stripe invoice sync’d here"
        />
      </ul>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {gate.unlocked ? (
          <>
            <Link
              href={href}
              className={`${buttonClassName("secondary", "sm")} border-violet-500/55 bg-violet-600 text-white hover:bg-violet-500`}
            >
              Open Event workspace
            </Link>
            <Link href={`${href}#show-media`} className={`${buttonClassName("ghost", "sm")} text-violet-200 hover:text-white`}>
              Jump to show media
            </Link>
          </>
        ) : (
          <span
            className="cursor-not-allowed rounded-uls-md border border-uls-border-strong bg-uls-surface-inset px-4 py-2 text-sm text-uls-subtle"
            title="Complete the checklist above to unlock"
          >
            Event workspace locked
          </span>
        )}
        {gate.unlocked ? (
          <span className="max-w-xs text-xs text-uls-subtle">
            Show-day tools are only listed on that page — this intake view stays uncluttered.
          </span>
        ) : null}
      </div>
    </section>
  );
}

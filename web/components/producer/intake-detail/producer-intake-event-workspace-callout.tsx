import Link from "next/link";

import type { ProducerEventWorkspaceGateResult } from "@/lib/producer-event-workspace-gate";

function StatusRow(props: { ok: boolean; label: string }) {
  const { ok, label } = props;
  return (
    <li className="flex items-start gap-2 text-sm text-zinc-300">
      <span className={ok ? "text-emerald-400" : "text-zinc-500"} aria-hidden>
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
      className="mb-10 rounded-xl border border-violet-900/55 bg-violet-950/20 px-4 py-4 sm:px-5"
      aria-labelledby="event-workspace-callout-heading"
    >
      <h2 id="event-workspace-callout-heading" className="text-sm font-semibold text-violet-200">
        Event workspace
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        Run of show, show media, show-day flags, and post-event delivery live here — separate from clerical intake.
        Access opens after DocuSign shows a completed contract and at least one Stripe invoice on this production is marked{" "}
        <span className="text-zinc-300">paid</span> (typically your deposit).
      </p>
      <ul className="mt-3 space-y-1.5 border-t border-violet-900/35 pt-3">
        <StatusRow ok={gate.hasSignedContract} label="Contract completed in DocuSign (mirrored row shows completed)" />
        <StatusRow ok={gate.hasDepositInvoicePaid} label="Deposit / payment recorded — at least one paid Stripe invoice sync’d here" />
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {gate.unlocked ? (
          <Link
            href={href}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500"
          >
            Open Event workspace
          </Link>
        ) : (
          <span
            className="cursor-not-allowed rounded-lg border border-zinc-700 bg-zinc-900/50 px-4 py-2 text-sm text-zinc-500"
            title="Complete the checklist above to unlock"
          >
            Event workspace locked
          </span>
        )}
        {gate.unlocked ? (
          <span className="text-xs text-zinc-500">Show-day tools are only listed on that page — this intake view stays uncluttered.</span>
        ) : null}
      </div>
    </section>
  );
}

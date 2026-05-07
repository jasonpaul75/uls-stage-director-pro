import Link from "next/link";

import {
  directorPortalProducerInboxCue,
  DIRECTOR_PORTAL_PRODUCER_INBOX_WARN_DAYS,
} from "@/lib/director-portal-access-window";
import { prisma } from "@/lib/prisma";
import { stripeSecretKeyAppearsSandbox } from "@/lib/stripe-admin";
import { ProjectRole, ProjectStatus } from "@prisma/client";

export default async function ProducerInboxPage() {
  const projects = await prisma.project.findMany({
    where: { status: ProjectStatus.INTAKE_SUBMITTED },
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      name: true,
      venue: true,
      cityState: true,
      stripeCustomerId: true,
      eventConclusionAt: true,
      submittedAt: true,
      additionalNotes: true,
      assignedTo: { select: { email: true, name: true } },
      memberships: {
        where: { role: ProjectRole.DIRECTOR },
        take: 2,
        select: {
          user: { select: { email: true } },
        },
      },
      _count: {
        select: {
          stripeInvoices: {
            where: { status: { in: ["open", "draft"] } },
          },
        },
      },
    },
  });

  const stripeSandbox = stripeSecretKeyAppearsSandbox();

  return (
    <main id="producer-main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 pb-12 pt-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">

      <div className="mt-0 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-widest text-amber-500">Pipeline</p>
          <h1 className="mt-2 text-2xl font-semibold">Intake inbox</h1>
        </div>
        <Link
          href="/producer/inbox/export"
          className="shrink-0 rounded border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
        >
          Export CSV
        </Link>
      </div>
      <p className="mt-3 text-sm text-neutral-500">
        Director submissions awaiting producer triage ({projects.length}). Open a row to invite directors,
        use Stripe billing (optional), and add internal producer notes — all live on that detail page.
        {` `}
        When an event conclusion date is set, this list flags director portal access that has ended or ends within{" "}
        {DIRECTOR_PORTAL_PRODUCER_INBOX_WARN_DAYS} days (UTC deadline).
      </p>
      {stripeSandbox ? (
        <p className="mt-2 text-[11px] leading-relaxed text-sky-200/85">
          Stripe keys read as test mode — invoices and payouts stay simulated across this inbox until you rotate to live keys.
        </p>
      ) : null}

      {projects.length === 0 ? (
        <p className="mt-8 text-neutral-400">No open intake submissions.</p>
      ) : (
        <ul className="mt-8 space-y-4">
          {projects.map((p) => {
            const directorEmails = p.memberships.map((m) => m.user.email).join(", ");
            const assigneeLabel = p.assignedTo
              ? (p.assignedTo.name ?? "").trim() || p.assignedTo.email
              : null;
            const portalCue = directorPortalProducerInboxCue(p.eventConclusionAt);
            const deadlineLabel = portalCue
              ? new Intl.DateTimeFormat("en-US", {
                  dateStyle: "medium",
                  timeZone: "UTC",
                }).format(portalCue.deadlineUtc)
              : null;

            return (
              <li
                key={p.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/producer/inbox/${p.id}`}
                        className="font-semibold text-amber-400 hover:text-amber-300"
                      >
                        {p.name}
                      </Link>
                      {p.stripeCustomerId ? (
                        <span
                          className="rounded-full border border-zinc-700 bg-zinc-900/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400"
                          title={`Stripe customer ${p.stripeCustomerId}`}
                        >
                          Stripe customer
                        </span>
                      ) : null}
                      {p._count.stripeInvoices > 0 ? (
                        <span className="rounded-full border border-emerald-900/70 bg-emerald-950/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-200">
                          Due · {p._count.stripeInvoices} invoice{p._count.stripeInvoices === 1 ? "" : "s"}
                        </span>
                      ) : null}
                      {portalCue?.kind === "access_ended" && deadlineLabel ? (
                        <span
                          className="rounded-full border border-rose-900/65 bg-rose-950/45 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-rose-200"
                          title="Directors cannot sign in for this production anymore (90-day window after event conclusion)."
                        >
                          Portal closed · {deadlineLabel} UTC
                        </span>
                      ) : null}
                      {portalCue?.kind === "access_ending_soon" && deadlineLabel ? (
                        <span
                          className="rounded-full border border-amber-900/60 bg-amber-950/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-100"
                          title={`Director portal access ends ${deadlineLabel} UTC`}
                        >
                          Portal ends · {deadlineLabel} UTC
                        </span>
                      ) : null}
                    </div>
                    <p className="text-zinc-500">
                      {p.venue}
                      {p.cityState ? ` · ${p.cityState}` : ""}
                    </p>
                    {directorEmails ? (
                      <p className="mt-1 text-zinc-500">
                        Director: <span className="text-zinc-300">{directorEmails}</span>
                      </p>
                    ) : null}
                    {assigneeLabel ? (
                      <p className="mt-1 text-xs text-zinc-600">
                        Assigned: <span className="text-zinc-400">{assigneeLabel}</span>
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                    {p.submittedAt
                      ? new Intl.DateTimeFormat("en-US", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(p.submittedAt)
                      : "—"}
                  </span>
                </div>
                {p.additionalNotes ? (
                  <p className="mt-2 border-t border-zinc-800 pt-2 text-zinc-400">{p.additionalNotes}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      </div>
    </main>
  );
}

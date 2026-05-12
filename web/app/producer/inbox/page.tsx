import Link from "next/link";

import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { AppShell, buttonClassName } from "@/components/ui";
import {
  directorPortalProducerInboxCue,
  DIRECTOR_PORTAL_PRODUCER_INBOX_WARN_DAYS,
} from "@/lib/director-portal-access-window";
import { prisma } from "@/lib/prisma";
import { questionnaireSubmissionCountsByProject } from "@/lib/producer-inbox-crew-questionnaire-counts";
import { producerCrewQuestionnaireMissingAndDraftCounts } from "@/lib/producer-crew-questionnaire-stats";
import { producerEventUnlockMap } from "@/lib/producer-event-workspace-server";
import { stripeSecretKeyAppearsSandbox } from "@/lib/stripe-admin";
import { ProjectRole, ProjectStatus } from "@prisma/client";

const inboxLinkFocus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-uls-accent/35 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent";

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
          directorShares: true,
          staffAssignments: true,
        },
      },
    },
  });

  const { rowsByProject, submittedByProject } = await questionnaireSubmissionCountsByProject(projects.map((p) => p.id));

  const eventUnlock = await producerEventUnlockMap(projects.map((p) => p.id));
  const unlockedEventCount = projects.reduce((n, p) => n + (eventUnlock.get(p.id) ? 1 : 0), 0);

  const stripeSandbox = stripeSecretKeyAppearsSandbox();

  return (
    <AppShell id="producer-main-content" outerMaxWidth="wide" contentMaxWidth="full" className="pt-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <header className="min-w-0 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-uls-subtle">Pipeline</p>
          <h1 className="text-pretty text-3xl font-semibold tracking-tight text-uls-text md:text-[2rem]">Intake inbox</h1>
          <div className="max-w-prose space-y-2 text-sm leading-relaxed text-uls-muted">
            <p>
              Director submissions awaiting producer triage ({projects.length}). Open a row for intake clerical work (invite,
              Stripe, DocuSign, internal notes).               Crew pills show headcount plus{" "}
              <span className="text-uls-subtle">Q submitted / assigned</span>, with{" "}
              <span className="text-uls-subtle">−row gaps</span> or <span className="text-uls-subtle">draft counts</span> when crew follow-ups are pending,
              until everyone files travel / meals / payment notes.
              Directors upload reference AV under{" "}
              <span className="text-uls-subtle">Director production files</span>
              {" — "}
              the inbox flags a badge when anything needs attention. Run of show,{" "}
              <span className="text-uls-subtle">
                show media (including cues imported from the cross-show media library)
              </span>
              , and day-of tooling live under <span className="text-uls-subtle">Event workspace</span> once a completed
              contract and a paid deposit invoice sync here. When an event conclusion date is set, this list flags director
              portal access that has ended or ends within {DIRECTOR_PORTAL_PRODUCER_INBOX_WARN_DAYS} days (UTC deadline).
            </p>
            {stripeSandbox ? (
              <p className="rounded-2xl border border-sky-500/28 bg-sky-500/[0.07] px-4 py-3 text-[11px] leading-relaxed text-sky-100 backdrop-blur-sm">
                Stripe keys read as test mode — invoices and payouts stay simulated across this inbox until you rotate to live
                keys.
              </p>
            ) : null}
          </div>
        </header>
        <Link href="/producer/inbox/export" className={buttonClassName("secondary", "sm", "shrink-0 rounded-full")}>
          Export CSV
        </Link>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ProducerGlassCard padding="compact" className="relative overflow-hidden">
          <span aria-hidden className="pointer-events-none absolute -right-4 -top-6 h-20 w-20 rounded-full bg-amber-400/14 blur-2xl" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-uls-muted">Queued intakes</p>
          <p className="mt-1.5 tabular-nums text-2xl font-semibold tracking-tight text-uls-text">{projects.length}</p>
        </ProducerGlassCard>
        <ProducerGlassCard padding="compact" className="relative overflow-hidden">
          <span aria-hidden className="pointer-events-none absolute -right-4 -top-6 h-20 w-20 rounded-full bg-violet-500/18 blur-2xl" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-uls-muted">Event workspace unlocked</p>
          <p className="mt-1.5 tabular-nums text-2xl font-semibold tracking-tight text-uls-text">{unlockedEventCount}</p>
          <p className="mt-2 text-[11px] leading-snug text-uls-subtle">DocuSign complete + deposit invoice marked paid.</p>
        </ProducerGlassCard>
      </div>

      {projects.length === 0 ? (
        <p className="mt-10 text-sm text-uls-muted">No open intake submissions.</p>
      ) : (
        <ul className="mt-10 list-none space-y-3 pl-0">
          {projects.map((p) => {
            const directorEmails = p.memberships.map((m) => m.user.email).join(", ");
            const assigneeLabel = p.assignedTo ? (p.assignedTo.name ?? "").trim() || p.assignedTo.email : null;
            const portalCue = directorPortalProducerInboxCue(p.eventConclusionAt);
            const deadlineLabel = portalCue
              ? new Intl.DateTimeFormat("en-US", {
                  dateStyle: "medium",
                  timeZone: "UTC",
                }).format(portalCue.deadlineUtc)
              : null;

            const crewN = p._count.staffAssignments;
            const qRows = rowsByProject.get(p.id) ?? 0;
            const qSub = submittedByProject.get(p.id) ?? 0;
            const { missingQuestionnaireRows: crewQuestionnaireMissingRows, draftQuestionnaireRows: crewQuestionnaireDrafts } =
              producerCrewQuestionnaireMissingAndDraftCounts({
                assignmentCount: crewN,
                questionnaireRowCount: qRows,
                questionnaireSubmittedCount: qSub,
              });
            const crewQuestionnaireTitle =
              crewN > 0
                ? crewQuestionnaireMissingRows > 0
                  ? `${crewQuestionnaireMissingRows} assigned crew still need questionnaire rows — open Crew & ops and use Prepare questionnaires. Submitted ${qSub} of ${crewN}.${crewQuestionnaireDrafts > 0 ? ` ${crewQuestionnaireDrafts} draft row(s) among prepared questionnaires.` : ""}`
                  : crewQuestionnaireDrafts > 0
                    ? `${crewQuestionnaireDrafts} questionnaire draft(s). Submitted ${qSub} of ${crewN}.`
                    : `All ${crewN} crew questionnaires submitted.`
                : undefined;
            const crewQuestionnaireQTone =
              crewN > 0
                ? crewQuestionnaireMissingRows > 0
                  ? "font-semibold text-amber-100"
                  : crewQuestionnaireDrafts > 0
                    ? "font-medium text-amber-100/95"
                    : "font-medium text-emerald-100/95"
                : "";

            return (
              <li key={p.id} className="list-none">
                <ProducerGlassCard
                  as="div"
                  padding="compact"
                  className="text-sm transition-[border-color] hover:border-white/[0.12]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/producer/inbox/${p.id}`}
                          className={`font-semibold text-uls-accent-strong hover:text-uls-accent-strong/90 hover:underline ${inboxLinkFocus} rounded-sm`}
                        >
                          {p.name}
                        </Link>
                        {eventUnlock.get(p.id) ? (
                          <Link
                            href={`/producer/inbox/${p.id}/event`}
                            className={`rounded-full border border-violet-500/40 bg-uls-violet-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-uls-violet hover:border-violet-400/55 hover:bg-violet-500/20 ${inboxLinkFocus}`}
                            title="Run of show, show media (library imports OK), Director production files, show-day flags, post-event delivery"
                          >
                            Event workspace
                          </Link>
                        ) : (
                          <span
                            className="rounded-full border border-white/[0.1] bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-uls-subtle backdrop-blur-sm"
                            title="Complete a DocuSign contract and mark at least one Stripe invoice paid on intake — then Event unlocks."
                          >
                            Event · locked
                          </span>
                        )}
                        {p._count.directorShares > 0 ? (
                          <Link
                            href={`/producer/inbox/${p.id}#director-shares-production`}
                            className={`rounded-full border border-indigo-500/38 bg-indigo-500/[0.12] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-100 hover:border-indigo-400/50 hover:bg-indigo-500/20 ${inboxLinkFocus}`}
                            title="Director production files — reference AV from the portal; download on intake or event workspace"
                          >
                            Production files · {p._count.directorShares}
                          </Link>
                        ) : null}
                        {crewN > 0 ? (
                          <Link
                            href={`/producer/inbox/${p.id}/crew`}
                            className={`inline-flex flex-wrap items-baseline gap-x-1 rounded-full border border-teal-500/38 bg-teal-500/[0.12] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-100 hover:border-teal-400/55 hover:bg-teal-500/20 ${inboxLinkFocus}`}
                            title={
                              crewQuestionnaireTitle ??
                              "Internal crew assignments, questionnaires, expense ledger"
                            }
                            aria-label={`${crewQuestionnaireTitle ?? "Crew assignments and questionnaires"}. Opens crew workspace for ${p.name}.`}
                          >
                            <span>Crew · {crewN}</span>
                            <span className={`normal-case tracking-normal ${crewQuestionnaireQTone}`}>· Q {qSub}/{crewN}</span>
                            {crewQuestionnaireMissingRows > 0 ? (
                              <span className="normal-case tracking-normal font-semibold text-amber-100">
                                · −{crewQuestionnaireMissingRows} row{crewQuestionnaireMissingRows === 1 ? "" : "s"}
                              </span>
                            ) : crewQuestionnaireDrafts > 0 ? (
                              <span className="normal-case tracking-normal font-medium text-amber-100/95">
                                · {crewQuestionnaireDrafts} draft{crewQuestionnaireDrafts === 1 ? "" : "s"}
                              </span>
                            ) : null}
                          </Link>
                        ) : null}
                        {p.stripeCustomerId ? (
                          <span
                            className="rounded-full border border-white/[0.1] bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-uls-muted backdrop-blur-sm"
                            title={`Stripe customer ${p.stripeCustomerId}`}
                          >
                            Stripe customer
                          </span>
                        ) : null}
                        {p._count.stripeInvoices > 0 ? (
                          <span className="rounded-full border border-emerald-500/35 bg-emerald-500/[0.1] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-200">
                            Due · {p._count.stripeInvoices} invoice{p._count.stripeInvoices === 1 ? "" : "s"}
                          </span>
                        ) : null}
                        {portalCue?.kind === "access_ended" && deadlineLabel ? (
                          <span
                            className="rounded-full border border-rose-500/35 bg-rose-500/[0.12] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-rose-100"
                            title="Directors cannot sign in for this production anymore (90-day window after event conclusion)."
                          >
                            Portal closed · {deadlineLabel} UTC
                          </span>
                        ) : null}
                        {portalCue?.kind === "access_ending_soon" && deadlineLabel ? (
                          <span
                            className="rounded-full border border-amber-500/35 bg-amber-500/[0.1] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-100"
                            title={`Director portal access ends ${deadlineLabel} UTC`}
                          >
                            Portal ends · {deadlineLabel} UTC
                          </span>
                        ) : null}
                      </div>
                      <p className="text-uls-muted">
                        {p.venue}
                        {p.cityState ? ` · ${p.cityState}` : ""}
                      </p>
                      {directorEmails ? (
                        <p className="mt-1 text-uls-muted">
                          Director: <span className="text-uls-text">{directorEmails}</span>
                        </p>
                      ) : null}
                      {assigneeLabel ? (
                        <p className="mt-1 text-xs text-uls-subtle">
                          Assigned: <span className="text-uls-muted">{assigneeLabel}</span>
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 rounded-lg border border-white/[0.08] bg-black/25 px-2 py-0.5 text-xs text-uls-muted">
                      {p.submittedAt
                        ? new Intl.DateTimeFormat("en-US", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(p.submittedAt)
                        : "—"}
                    </span>
                  </div>
                  {p.additionalNotes ? (
                    <p className="mt-2 border-t border-white/[0.08] pt-2 text-uls-muted">{p.additionalNotes}</p>
                  ) : null}
                </ProducerGlassCard>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}

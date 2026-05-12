import Link from "next/link";

import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { AppShell, buttonClassName } from "@/components/ui";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GlobalRole, ProjectStatus } from "@prisma/client";

type Props = { searchParams?: Promise<Record<string, string | undefined>> };

function fmtRange(start: Date | null, end: Date | null): string {
  if (!start && !end) return "Dates TBD";
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  if (start && end && start.toDateString() !== end.toDateString()) {
    return `${start.toLocaleDateString(undefined, opts)} → ${end.toLocaleDateString(undefined, opts)}`;
  }
  const one = start ?? end;
  return one ? one.toLocaleDateString(undefined, opts) : "Dates TBD";
}

export default async function StaffHomePage(props: Props) {
  const session = await auth();
  const userId = session?.user?.id;
  const role = session?.user?.globalRole;
  if (!userId || role !== GlobalRole.STAFF) {
    /* layout redirects — satisfy types */
    return null;
  }

  const sp = (await props.searchParams) ?? {};

  const assignments = await prisma.projectStaffAssignment.findMany({
    where: {
      staffUserId: userId,
      project: { status: ProjectStatus.INTAKE_SUBMITTED },
    },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          venue: true,
          cityState: true,
          requestedEventStart: true,
          requestedEventEnd: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const projectIds = assignments.map((a) => a.projectId);
  const questionnaires =
    projectIds.length === 0
      ? []
      : await prisma.staffEventQuestionnaire.findMany({
          where: { staffUserId: userId, projectId: { in: projectIds } },
          select: { projectId: true, submittedAt: true },
        });
  const questionnaireByProjectId = new Map(questionnaires.map((q) => [q.projectId, q]));

  const questionnaireDraftCount = questionnaires.filter((q) => q.submittedAt == null).length;
  const questionnaireAwaitingPrepCount = assignments.filter((a) => !questionnaireByProjectId.has(a.projectId)).length;

  assignments.sort((a, b) => {
    const ta = a.project.requestedEventStart?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const tb = b.project.requestedEventStart?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return ta - tb;
  });

  const qErr =
    sp.q_err === "forbidden"
      ? "That production is not assigned to you."
      : sp.q_err === "bad"
        ? "Missing production reference."
        : null;

  return (
    <AppShell id="staff-main-content" outerMaxWidth="wide" contentMaxWidth="full" className="pt-10">
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-uls-subtle">Your schedule</p>
        <h1 className="text-pretty text-3xl font-semibold tracking-tight text-uls-text md:text-[2rem]">Assigned productions</h1>
        <p className="max-w-prose text-sm text-uls-muted">
          You only see intakes production assigns you to. Use Availability for blackout dates; open each row for travel, meals, and
          payment notes when questionnaires are prepared.
        </p>
      </header>

      {qErr ? (
        <ProducerGlassCard padding="compact" className="mt-6 border-rose-500/25 bg-rose-950/25">
          <p role="alert" className="text-sm text-rose-100">
            {qErr}
          </p>
        </ProducerGlassCard>
      ) : null}

      {questionnaireAwaitingPrepCount > 0 || questionnaireDraftCount > 0 ? (
        <div className="mt-6 space-y-3">
          {questionnaireAwaitingPrepCount > 0 ? (
            <ProducerGlassCard padding="compact" className="border-sky-500/28 bg-sky-950/20">
              <p role="status" className="text-sm text-sky-100">
                <strong className="font-semibold text-sky-50">{questionnaireAwaitingPrepCount}</strong> assignment
                {questionnaireAwaitingPrepCount === 1 ? "" : "s"} — production hasn&apos;t prepared questionnaire rows yet.
                Production uses <span className="font-medium text-sky-50">Crew &amp; ops → Prepare questionnaires</span>; then open each
                row below to fill travel / meals / payment notes.
              </p>
            </ProducerGlassCard>
          ) : null}
          {questionnaireDraftCount > 0 ? (
            <ProducerGlassCard padding="compact" className="border-amber-500/25 bg-amber-950/25">
              <p role="status" className="text-sm text-amber-100">
                You have{" "}
                <strong className="font-semibold text-amber-50">{questionnaireDraftCount}</strong> production questionnaire
                {questionnaireDraftCount === 1 ? "" : "s"} ready to submit — open each row and tap{" "}
                <span className="font-medium text-amber-50">Submit to production</span> when travel / meals / payment notes are final.
              </p>
            </ProducerGlassCard>
          ) : null}
        </div>
      ) : null}

      <ProducerGlassCard className="mt-8 overflow-hidden p-0">
        <div className="border-b border-white/[0.06] bg-black/20 px-4 py-3">
          <p className="text-xs font-semibold text-uls-text">
            {assignments.length} assignment{assignments.length === 1 ? "" : "s"}
          </p>
        </div>
        <ul className="divide-y divide-white/[0.06]">
          {assignments.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-uls-muted">No productions assigned yet.</li>
          ) : (
            assignments.map((a) => {
              const p = a.project;
              const where = [p.venue, p.cityState].filter(Boolean).join(" · ");
              const qRow = questionnaireByProjectId.get(p.id);
              const qLabel = !qRow
                ? { text: "Questionnaire not prepared yet", className: "text-uls-subtle" as const }
                : qRow.submittedAt
                  ? {
                      text: `Submitted ${qRow.submittedAt.toISOString().slice(0, 10)}`,
                      className: "text-emerald-200/90" as const,
                    }
                  : { text: "Draft — submit when ready", className: "text-amber-200/95" as const };
              return (
                <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-4">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium text-uls-text">{p.name}</p>
                    <p className="text-xs text-uls-subtle">{fmtRange(p.requestedEventStart, p.requestedEventEnd)}</p>
                    {where ? <p className="text-xs text-uls-muted">{where}</p> : null}
                    {a.duties?.trim() ? (
                      <p className="mt-2 max-w-prose text-[11px] leading-relaxed text-uls-muted">
                        <span className="font-medium text-uls-subtle">Duties:</span> {a.duties.trim()}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className={`text-[10px] font-medium ${qLabel.className}`}>{qLabel.text}</span>
                    <Link
                      href={`/staff/events/${p.id}`}
                      className={buttonClassName("primary", "sm")}
                      aria-label={`Travel, meals, and payment questionnaire for ${p.name}. ${qLabel.text}.`}
                    >
                      Questionnaire
                    </Link>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </ProducerGlassCard>
    </AppShell>
  );
}

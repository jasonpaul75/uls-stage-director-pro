import Link from "next/link";

import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { AppShell, buttonClassName } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { questionnaireSubmissionCountsByProject } from "@/lib/producer-inbox-crew-questionnaire-counts";
import { producerCrewQuestionnaireMissingAndDraftCounts } from "@/lib/producer-crew-questionnaire-stats";
import { ProjectStatus } from "@prisma/client";

function formatRange(start: Date | null, end: Date | null): string {
  if (!start && !end) return "Date TBD";
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  if (start && end && start.toDateString() !== end.toDateString()) {
    return `${start.toLocaleDateString(undefined, opts)} → ${end.toLocaleDateString(undefined, opts)}`;
  }
  const one = start ?? end;
  return one ? one.toLocaleDateString(undefined, opts) : "Date TBD";
}

export default async function ProducerCalendarPage() {
  const projects = await prisma.project.findMany({
    where: { status: ProjectStatus.INTAKE_SUBMITTED },
    select: {
      id: true,
      name: true,
      venue: true,
      cityState: true,
      requestedEventStart: true,
      requestedEventEnd: true,
      updatedAt: true,
      _count: {
        select: { staffAssignments: true },
      },
    },
  });

  const { rowsByProject, submittedByProject } = await questionnaireSubmissionCountsByProject(projects.map((p) => p.id));

  projects.sort((a, b) => {
    const ta = a.requestedEventStart?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const tb = b.requestedEventStart?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (ta !== tb) return ta - tb;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  const datedCount = projects.filter((p) => p.requestedEventStart || p.requestedEventEnd).length;

  return (
    <AppShell id="producer-main-content" outerMaxWidth="wide" contentMaxWidth="full" className="pt-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <header className="min-w-0 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-uls-subtle">Business hub</p>
          <h1 className="text-pretty text-3xl font-semibold tracking-tight text-uls-text md:text-[2rem]">Event calendar</h1>
          <p className="max-w-prose text-sm leading-relaxed text-uls-muted">
            All queued intake productions with requested dates — newest updates surface first inside each date bucket. Crew assignments,
            questionnaires, and expense detail stay on each intake&apos;s Crew & ops page.
          </p>
        </header>
        <Link href="/producer" className={buttonClassName("ghost", "sm")}>
          ← Command center
        </Link>
      </div>

      <ProducerGlassCard className="mt-8 overflow-hidden p-0">
        <div className="border-b border-white/[0.06] bg-black/20 px-4 py-3">
          <p className="text-xs font-semibold text-uls-text">
            {projects.length} production{projects.length === 1 ? "" : "s"} · {datedCount} dated ·{" "}
            {projects.length - datedCount} date TBD
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left text-sm">
            <thead className="border-b border-white/[0.06] bg-black/25 text-[10px] font-semibold uppercase tracking-wide text-uls-subtle">
              <tr>
                <th className="px-4 py-2.5">When</th>
                <th className="px-4 py-2.5">Production</th>
                <th className="px-4 py-2.5">Where</th>
                <th className="px-4 py-2.5 text-center">Crew</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="text-uls-muted">
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm">
                    No queued intakes yet.
                  </td>
                </tr>
              ) : (
                projects.map((p) => {
                  const where = [p.venue, p.cityState].filter(Boolean).join(" · ") || "—";
                  const crewN = p._count.staffAssignments;
                  const qRows = rowsByProject.get(p.id) ?? 0;
                  const qSub = submittedByProject.get(p.id) ?? 0;
                  const { missingQuestionnaireRows: crewQuestionnaireMissingRows, draftQuestionnaireRows: crewQuestionnaireDrafts } =
                    producerCrewQuestionnaireMissingAndDraftCounts({
                      assignmentCount: crewN,
                      questionnaireRowCount: qRows,
                      questionnaireSubmittedCount: qSub,
                    });
                  const crewCalendarTitle =
                    crewN > 0
                      ? `Crew ${crewN}. Questionnaire rows ${qRows}/${crewN}. Submitted ${qSub}/${crewN}.${crewQuestionnaireMissingRows > 0 ? ` ${crewQuestionnaireMissingRows} row gap(s) — Prepare questionnaires on Crew & ops.` : ""}${crewQuestionnaireDrafts > 0 ? ` ${crewQuestionnaireDrafts} draft(s).` : ""} Open Crew & ops for detail.`
                      : undefined;
                  return (
                    <tr key={p.id} className="border-b border-white/[0.04] last:border-b-0">
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-xs text-uls-subtle">
                        {formatRange(p.requestedEventStart, p.requestedEventEnd)}
                      </td>
                      <td className="max-w-[240px] px-4 py-3 font-medium text-uls-text">{p.name}</td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-xs">{where}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-center text-xs text-uls-subtle">
                        {crewN > 0 ? (
                          <Link
                            href={`/producer/inbox/${p.id}/crew`}
                            className="font-medium text-uls-accent underline underline-offset-2 hover:text-uls-text"
                            title={crewCalendarTitle}
                            aria-label={`${crewCalendarTitle}. Opens crew workspace for ${p.name}.`}
                          >
                            {crewN}
                            <span className="block text-[10px] font-normal leading-tight text-uls-subtle">
                              Q {qSub}/{crewN}
                            </span>
                            {crewQuestionnaireMissingRows > 0 ? (
                              <span className="block text-[10px] font-medium leading-tight text-amber-200/95">
                                −{crewQuestionnaireMissingRows} row{crewQuestionnaireMissingRows === 1 ? "" : "s"}
                              </span>
                            ) : crewQuestionnaireDrafts > 0 ? (
                              <span className="block text-[10px] font-medium leading-tight text-amber-200/95">
                                {crewQuestionnaireDrafts} draft{crewQuestionnaireDrafts === 1 ? "" : "s"}
                              </span>
                            ) : null}
                          </Link>
                        ) : (
                          <span className="tabular-nums">0</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Link href={`/producer/inbox/${p.id}`} className={buttonClassName("secondary", "sm")}>
                          Open intake
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </ProducerGlassCard>
    </AppShell>
  );
}

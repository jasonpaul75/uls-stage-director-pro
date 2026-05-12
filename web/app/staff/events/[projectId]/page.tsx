import Link from "next/link";
import { notFound } from "next/navigation";

import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { AppShell, Button, buttonClassName } from "@/components/ui";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GlobalRole, ProjectStatus } from "@prisma/client";

import { saveStaffQuestionnaire } from "../../actions";

type Props = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | undefined>>;
};

function fmtRange(start: Date | null, end: Date | null): string {
  if (!start && !end) return "Dates TBD";
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  if (start && end && start.toDateString() !== end.toDateString()) {
    return `${start.toLocaleDateString(undefined, opts)} → ${end.toLocaleDateString(undefined, opts)}`;
  }
  const one = start ?? end;
  return one ? one.toLocaleDateString(undefined, opts) : "Dates TBD";
}

export default async function StaffEventQuestionnairePage(props: Props) {
  const session = await auth();
  const userId = session?.user?.id;
  const role = session?.user?.globalRole;
  if (!userId || role !== GlobalRole.STAFF) return null;

  const { projectId } = await props.params;
  const sp = (await props.searchParams) ?? {};

  const assignment = await prisma.projectStaffAssignment.findFirst({
    where: {
      projectId,
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
  });

  if (!assignment) notFound();

  const questionnaire = await prisma.staffEventQuestionnaire.findUnique({
    where: { projectId_staffUserId: { projectId, staffUserId: userId } },
  });

  const p = assignment.project;
  const where = [p.venue, p.cityState].filter(Boolean).join(" · ");

  const qFlashErr =
    sp.q_err === "missing"
      ? "Your questionnaire row is not ready yet. Production prepares rows from Crew and ops — check back soon."
      : null;

  return (
    <AppShell id="staff-main-content" outerMaxWidth="standard" contentMaxWidth="full" className="pt-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <header className="min-w-0 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-uls-subtle">Event questionnaire</p>
          <h1 className="text-pretty text-2xl font-semibold tracking-tight text-uls-text">{p.name}</h1>
          <p className="text-xs text-uls-muted">{fmtRange(p.requestedEventStart, p.requestedEventEnd)}</p>
          {where ? <p className="text-xs text-uls-subtle">{where}</p> : null}
        </header>
        <Link href="/staff" className={buttonClassName("ghost", "sm")} aria-label="Back to assigned productions schedule">
          ← Schedule
        </Link>
      </div>

      {assignment.duties?.trim() ? (
        <ProducerGlassCard padding="compact" className="mt-6">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-uls-subtle">Your duties</p>
          <p className="mt-2 text-sm text-uls-muted">{assignment.duties.trim()}</p>
        </ProducerGlassCard>
      ) : null}

      {sp.q_saved === "1" ? (
        <ProducerGlassCard padding="compact" className="mt-6 border-emerald-500/25 bg-emerald-950/25">
          <p role="status" className="text-sm text-emerald-100">
            Responses saved.
          </p>
        </ProducerGlassCard>
      ) : null}

      {!questionnaire ? (
        <ProducerGlassCard
          className={`mt-8 ${qFlashErr ? "border-amber-500/28 bg-amber-950/15" : ""}`}
        >
          <p role={qFlashErr ? "alert" : undefined} className={`text-sm ${qFlashErr ? "text-amber-100" : "text-uls-muted"}`}>
            {qFlashErr ?? (
              <>
                Production still needs to tap <strong className="font-medium text-uls-subtle">Prepare questionnaires</strong> on the crew
                workspace — check back after they publish your row.
              </>
            )}
          </p>
        </ProducerGlassCard>
      ) : (
        <ProducerGlassCard className="mt-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-uls-text">Travel · meals · payment</p>
            {questionnaire.submittedAt ? (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-200/90">
                Submitted {questionnaire.submittedAt.toISOString().slice(0, 10)}
              </span>
            ) : (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-uls-subtle">Draft</span>
            )}
          </div>

          <form action={saveStaffQuestionnaire} className="space-y-4">
            <input type="hidden" name="projectId" value={projectId} readOnly />

            <label className="flex flex-col gap-1 text-xs text-uls-muted">
              <span>Travel / lodging needs</span>
              <textarea
                name="travelNotes"
                rows={4}
                defaultValue={questionnaire.travelNotes ?? ""}
                placeholder="Flight preference, arrival windows, hotel nights…"
                className="rounded-md border border-white/[0.12] bg-black/35 px-2 py-2 text-sm text-uls-text"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-uls-muted">
              <span>Meals / dietary</span>
              <textarea
                name="foodNotes"
                rows={3}
                defaultValue={questionnaire.foodNotes ?? ""}
                placeholder="Allergies, per-diem preference…"
                className="rounded-md border border-white/[0.12] bg-black/35 px-2 py-2 text-sm text-uls-text"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-uls-muted">
              <span>Payment / payroll notes</span>
              <textarea
                name="paymentNotes"
                rows={3}
                defaultValue={questionnaire.paymentNotes ?? ""}
                placeholder="ACH vs check, employer-of-record questions…"
                className="rounded-md border border-white/[0.12] bg-black/35 px-2 py-2 text-sm text-uls-text"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-uls-muted">
              <span>Anything else production should know</span>
              <textarea
                name="otherNotes"
                rows={2}
                defaultValue={questionnaire.otherNotes ?? ""}
                className="rounded-md border border-white/[0.12] bg-black/35 px-2 py-2 text-sm text-uls-text"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                name="intent"
                value="draft"
                variant="secondary"
                size="sm"
                aria-label={`Save questionnaire draft for ${p.name}`}
              >
                Save draft
              </Button>
              <Button
                type="submit"
                name="intent"
                value="submit"
                variant="primary"
                size="sm"
                aria-label={`Submit travel, meals, and payment questionnaire to production for ${p.name}`}
              >
                Submit to production
              </Button>
            </div>
          </form>
        </ProducerGlassCard>
      )}
    </AppShell>
  );
}

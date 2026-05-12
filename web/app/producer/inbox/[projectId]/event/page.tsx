import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ProducerEventSectionNav } from "@/components/producer-event-section-nav";
import { ProducerIntakeDirectorSharesSection } from "@/components/producer/intake-detail/producer-intake-director-shares-section";
import { ProducerIntakeFlashMessages } from "@/components/producer/intake-detail/producer-intake-detail-feedback";
import { ProducerIntakePostEventSection } from "@/components/producer/intake-detail/producer-intake-detail-post-event";
import { ProducerIntakeRunOfShowSection } from "@/components/producer/intake-detail/producer-intake-detail-run-of-show";
import { ProducerIntakeShowDaySection } from "@/components/producer/intake-detail/producer-intake-detail-show-day";
import { ProducerIntakeShowMediaSection } from "@/components/producer/intake-detail/producer-intake-detail-show-media";
import { AppShell, buttonClassName } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { producerEventWorkspaceGate } from "@/lib/producer-event-workspace-gate";
import {
  PRODUCER_INTAKE_DETAIL_INCLUDE,
  type ProducerIntakeDetailSearchParams,
} from "@/lib/producer-intake-detail";
import { ProjectStatus } from "@prisma/client";

type Props = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<ProducerIntakeDetailSearchParams>;
};

export default async function ProducerEventWorkspacePage(props: Props) {
  const { projectId } = await props.params;
  const sp = (await props.searchParams) ?? {};

  const [project, libraryItems, crossProjectPicklist] = await Promise.all([
    prisma.project.findFirst({
      where: { id: projectId, status: ProjectStatus.INTAKE_SUBMITTED },
      include: PRODUCER_INTAKE_DETAIL_INCLUDE,
    }),
    prisma.showMediaLibraryItem.findMany({
      orderBy: { createdAt: "desc" },
      take: 120,
      select: { id: true, fileName: true, lane: true, contentType: true },
    }),
    prisma.project.findMany({
      where: {
        id: { not: projectId },
        status: ProjectStatus.INTAKE_SUBMITTED,
        showMediaItems: { some: {} },
      },
      select: {
        id: true,
        name: true,
        showMediaItems: {
          orderBy: [{ lane: "asc" }, { sortOrder: "asc" }],
          select: { id: true, fileName: true, lane: true },
        },
      },
      take: 40,
      orderBy: { name: "asc" },
    }),
  ]);

  if (!project) notFound();

  const gate = producerEventWorkspaceGate({
    docuSignEnvelopes: project.docuSignEnvelopes,
    stripeInvoices: project.stripeInvoices,
  });
  if (!gate.unlocked) {
    redirect(`/producer/inbox/${projectId}?event_locked=1`);
  }

  return (
    <AppShell id="producer-main-content" outerMaxWidth="wide" contentMaxWidth="full" className="pt-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <header className="min-w-0 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-uls-violet">Event workspace</p>
          <h1 className="text-pretty text-3xl font-semibold tracking-tight text-uls-text md:text-[2rem]">{project.name}</h1>
          <p className="max-w-prose text-sm leading-relaxed text-uls-muted">
            Run of show, media, day-of flags, and post-event delivery — separate from clerical intake so booking through
            deposit stays easy to scan.
          </p>
        </header>
        <div className="flex flex-wrap gap-2">
          <Link href={`/producer/inbox/${projectId}/stage-design`} className={buttonClassName("secondary", "sm")}>
            Stage design
          </Link>
          <Link href={`/producer/inbox/${projectId}`} className={buttonClassName("ghost", "sm")}>
            ← Intake & contracts
          </Link>
        </div>
      </div>

      <ProducerIntakeFlashMessages sp={sp} project={project} />

      <div className="flex flex-col gap-8 lg:flex-row lg:justify-center lg:gap-10 xl:gap-14">
        <ProducerEventSectionNav projectId={projectId} />
        <div className="min-w-0 flex-1 lg:max-w-3xl">
          <ProducerIntakeRunOfShowSection project={project} />
          <ProducerIntakeShowMediaSection
            project={project}
            libraryItems={libraryItems}
            crossProjectPicklist={crossProjectPicklist}
          />
          <ProducerIntakeDirectorSharesSection projectId={project.id} shares={project.directorShares} returnTo="event" />
          <ProducerIntakeShowDaySection project={project} />
          <ProducerIntakePostEventSection project={project} />
        </div>
      </div>
    </AppShell>
  );
}

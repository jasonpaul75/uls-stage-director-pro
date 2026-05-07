import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ProducerEventSectionNav } from "@/components/producer-event-section-nav";
import { ProducerIntakeFlashMessages } from "@/components/producer/intake-detail/producer-intake-detail-feedback";
import { ProducerIntakePostEventSection } from "@/components/producer/intake-detail/producer-intake-detail-post-event";
import { ProducerIntakeRunOfShowSection } from "@/components/producer/intake-detail/producer-intake-detail-run-of-show";
import { ProducerIntakeShowDaySection } from "@/components/producer/intake-detail/producer-intake-detail-show-day";
import { ProducerIntakeShowMediaSection } from "@/components/producer/intake-detail/producer-intake-detail-show-media";
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
    <main id="producer-main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 pb-12 pt-8 sm:px-6 lg:px-8">
      <p className="text-sm uppercase tracking-widest text-violet-400/95">Event workspace</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold text-zinc-100">{project.name}</h1>
        <Link
          href={`/producer/inbox/${projectId}`}
          className="shrink-0 text-sm text-zinc-400 underline-offset-4 hover:text-amber-400 hover:underline"
        >
          ← Intake &amp; contracts
        </Link>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-zinc-500">
        Run of show, media, day-of flags, and post-event delivery — separate from clerical intake so booking through deposit
        stays easy to scan.
      </p>

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
          <ProducerIntakeShowDaySection project={project} />
          <ProducerIntakePostEventSection project={project} />
        </div>
      </div>
    </main>
  );
}

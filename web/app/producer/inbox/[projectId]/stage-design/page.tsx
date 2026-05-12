import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ProducerStageDesignFormClientDynamic } from "@/components/stage-design/producer-stage-design-form-client-dynamic";
import { AppShell, buttonClassName } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { producerEventWorkspaceGate } from "@/lib/producer-event-workspace-gate";
import { parseStageDesignCanvas } from "@/lib/stage-design-canvas";
import { ProjectStatus, StageDesignUnit } from "@prisma/client";

type Props = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<{ saved?: string; stage_design_err?: string }>;
};

export default async function ProducerStageDesignPage(props: Props) {
  const { projectId } = await props.params;
  const sp = (await props.searchParams) ?? {};

  const project = await prisma.project.findFirst({
    where: { id: projectId, status: ProjectStatus.INTAKE_SUBMITTED },
    select: {
      id: true,
      name: true,
      stageDesignDirectorVisible: true,
      stripeInvoices: {
        orderBy: { createdAt: "desc" },
        take: 24,
        select: { status: true },
      },
      docuSignEnvelopes: {
        orderBy: { updatedAt: "desc" },
        take: 24,
        select: { completedAt: true },
      },
      stageDesign: true,
    },
  });

  if (!project) notFound();

  const gate = producerEventWorkspaceGate({
    docuSignEnvelopes: project.docuSignEnvelopes,
    stripeInvoices: project.stripeInvoices,
  });
  if (!gate.unlocked) {
    redirect(`/producer/inbox/${projectId}?event_locked=1`);
  }

  const row = project.stageDesign;
  const unit = row?.unit ?? StageDesignUnit.FEET;
  const snapshot = parseStageDesignCanvas(row?.canvasJson, unit);

  return (
    <AppShell id="producer-main-content" outerMaxWidth="wide" contentMaxWidth="full" className="pt-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <header className="min-w-0 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-uls-violet">
            Stage design · proportional diagram workspace
          </p>
          <h1 className="text-pretty text-3xl font-semibold tracking-tight text-uls-text md:text-[2rem]">{project.name}</h1>
          <p className="max-w-prose text-sm leading-relaxed text-uls-muted">
            Proportional floor plans with real-world units. Publish below so directors get a{" "}
            <span className="text-uls-text">clean read-only snapshot</span> (no authoring grid); they route diagram questions or
            change requests via <span className="text-uls-text">Production support</span> from Show workspace once booking is
            secured.
          </p>
        </header>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/producer/inbox/${projectId}/event`} className={buttonClassName("secondary", "sm")}>
            Event workspace
          </Link>
          <Link href={`/producer/inbox/${projectId}`} className={buttonClassName("ghost", "sm")}>
            ← Intake &amp; contracts
          </Link>
        </div>
      </div>

      {row?.updatedAt ? (
        <p className="mt-3 text-[11px] tabular-nums text-uls-subtle">
          Last saved {row.updatedAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
        </p>
      ) : null}

      {sp.saved === "1" ? (
        <div className="mt-6 rounded-2xl border border-emerald-500/35 bg-emerald-500/[0.1] px-4 py-3 text-sm text-emerald-50">
          Diagram saved — footprint and units are persisted for this production.
        </div>
      ) : null}
      {sp.stage_design_err === "too_large" ? (
        <p role="alert" className="mt-4 text-sm text-rose-300">
          That diagram payload is too large to store — contact production engineering if you need a higher limit.
        </p>
      ) : null}

      <div className="mt-8">
        <ProducerStageDesignFormClientDynamic
          key={`${project.id}:${row?.updatedAt?.toISOString() ?? "new"}`}
          projectId={project.id}
          initialTitle={row?.title ?? "Stage diagram"}
          unit={unit}
          canvas={snapshot}
          directorVisible={project.stageDesignDirectorVisible}
        />
      </div>
    </AppShell>
  );
}

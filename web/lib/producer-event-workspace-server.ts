import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { producerEventWorkspaceGate } from "@/lib/producer-event-workspace-gate";
import { ProjectStatus } from "@prisma/client";

async function envelopeAndInvoiceRows(projectId: string) {
  return Promise.all([
    prisma.projectDocuSignEnvelope.findMany({
      where: { projectId },
      select: { completedAt: true },
    }),
    prisma.projectStripeInvoice.findMany({
      where: { projectId },
      select: { status: true },
    }),
  ]);
}

/** Completed DocuSign + at least one paid Stripe invoice (mirrored rows on this production). */
export async function isProducerEventWorkspaceUnlocked(projectId: string): Promise<boolean> {
  const [docuSignEnvelopes, stripeInvoices] = await envelopeAndInvoiceRows(projectId);
  return producerEventWorkspaceGate({ docuSignEnvelopes, stripeInvoices }).unlocked;
}

/** Ensures INTAKE_SUBMITTED project exists and Event workspace gate passes (contract + paid invoice). */
export async function requireProducerEventWorkspaceUnlocked(projectId: string): Promise<void> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, status: ProjectStatus.INTAKE_SUBMITTED },
    select: { id: true },
  });
  if (!project) {
    redirect("/producer/inbox");
  }

  const unlocked = await isProducerEventWorkspaceUnlocked(projectId);
  if (!unlocked) {
    redirect(`/producer/inbox/${projectId}?event_locked=1`);
  }
}

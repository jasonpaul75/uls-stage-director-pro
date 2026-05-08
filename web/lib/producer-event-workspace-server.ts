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

/** Which project IDs satisfy Event workspace unlock (batch for inbox list views). */
export async function producerEventUnlockMap(projectIds: string[]): Promise<Map<string, boolean>> {
  const uniq = [...new Set(projectIds.filter(Boolean))];
  const map = new Map<string, boolean>(uniq.map((id) => [id, false]));
  if (uniq.length === 0) return map;

  const [completedEnvelopes, invoices] = await Promise.all([
    prisma.projectDocuSignEnvelope.findMany({
      where: { projectId: { in: uniq }, completedAt: { not: null } },
      distinct: ["projectId"],
      select: { projectId: true },
    }),
    prisma.projectStripeInvoice.findMany({
      where: { projectId: { in: uniq } },
      select: { projectId: true, status: true },
    }),
  ]);

  const contractDone = new Set(completedEnvelopes.map((r) => r.projectId));
  const depositPaid = new Set<string>();
  for (const inv of invoices) {
    if (inv.status.trim().toLowerCase() === "paid") {
      depositPaid.add(inv.projectId);
    }
  }

  for (const id of uniq) {
    map.set(id, contractDone.has(id) && depositPaid.has(id));
  }
  return map;
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

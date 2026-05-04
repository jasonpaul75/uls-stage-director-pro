import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { GlobalRole, ProjectRole } from "@prisma/client";

const portalProductionInclude = {
  stripeInvoices: {
    orderBy: { createdAt: "desc" as const },
    take: 24,
    select: {
      id: true,
      stripeInvoiceId: true,
      status: true,
      hostedInvoiceUrl: true,
      invoiceNumber: true,
      amountDueCents: true,
      currency: true,
      updatedAt: true,
      attemptCount: true,
      nextPaymentAttemptAt: true,
      lastStripeErrorSummary: true,
      lastSyncedFromStripeAt: true,
    },
  },
  docuSignEnvelopes: {
    orderBy: { updatedAt: "desc" as const },
    take: 24,
    select: {
      id: true,
      envelopeId: true,
      subject: true,
      status: true,
      statusChangedAt: true,
      completedAt: true,
      voidedAt: true,
      lastWebhookEvent: true,
    },
  },
  showDayFlags: {
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
    select: { id: true, body: true, createdAt: true },
  },
};

/** Director may only load projects where they hold DIRECTOR membership; admins may load any project. */
export async function loadProjectForPortalViewer(
  projectId: string,
  viewer: { userId: string; globalRole: GlobalRole },
) {
  if (viewer.globalRole === GlobalRole.ULS_ADMIN) {
    return prisma.project.findUnique({
      where: { id: projectId },
      include: portalProductionInclude,
    });
  }

  if (viewer.globalRole !== GlobalRole.DIRECTOR) {
    redirect("/portal");
  }

  const membership = await prisma.projectMember.findFirst({
    where: {
      projectId,
      userId: viewer.userId,
      role: ProjectRole.DIRECTOR,
    },
    select: { project: { include: portalProductionInclude } },
  });

  return membership?.project ?? null;
}

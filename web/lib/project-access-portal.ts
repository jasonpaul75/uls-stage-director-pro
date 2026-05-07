import { redirect } from "next/navigation";

import { isDirectorPortalAccessRevoked } from "@/lib/director-portal-access-window";
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
  showMediaItems: {
    orderBy: [{ lane: "asc" as const }, { sortOrder: "asc" as const }, { createdAt: "asc" as const }],
    select: {
      id: true,
      lane: true,
      sortOrder: true,
      fileName: true,
      contentType: true,
      sizeBytes: true,
      createdAt: true,
    },
  },
};

/** Director may only load projects where they hold DIRECTOR membership; admins may load any project.
 * Directors are redirected to `/portal?access_ended=1` when `eventConclusionAt` is past the 90-day access window. */
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

  const project = membership?.project ?? null;
  if (!project) return null;

  /** ULS_Stage_Director_PRO.md — directors lose portal access 90 calendar days after event conclusion. */
  if (isDirectorPortalAccessRevoked(project.eventConclusionAt)) {
    redirect("/portal?access_ended=1");
  }

  return project;
}

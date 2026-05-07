"use server";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidateProjectMirrorCache, revalidateProducerOverview } from "@/lib/revalidate-project-mirror-cache";
import { GlobalRole, ProjectStatus } from "@prisma/client";

function canProduce(role: GlobalRole | undefined): boolean {
  return role === GlobalRole.PRODUCER || role === GlobalRole.ULS_ADMIN;
}

export async function updateIntakeInternals(formData: FormData) {
  const session = await auth();
  const role = session?.user?.globalRole as GlobalRole | undefined;
  if (!session?.user?.id || !canProduce(role)) {
    redirect("/login?callbackUrl=/producer/inbox");
  }

  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!projectId) {
    redirect("/producer/inbox");
  }

  const existing = await prisma.project.findFirst({
    where: { id: projectId, status: ProjectStatus.INTAKE_SUBMITTED },
    select: { id: true },
  });
  if (!existing) {
    redirect("/producer/inbox?error=not_found");
  }

  const internalNotes = String(formData.get("internalNotes") ?? "");
  const assigneeRaw = formData.get("assignedToUserId");
  const assignedToUserId =
    typeof assigneeRaw === "string" && assigneeRaw.length > 0 ? assigneeRaw : null;

  const retentionLegalHold = formData.get("retentionLegalHold") === "on";
  const retentionLegalHoldNote =
    typeof formData.get("retentionLegalHoldNote") === "string"
      ? String(formData.get("retentionLegalHoldNote")).slice(0, 2000)
      : "";

  const conclusionRaw = formData.get("eventConclusionAt");
  let eventConclusionAt: Date | null = null;
  if (typeof conclusionRaw === "string") {
    const t = conclusionRaw.trim();
    if (t.length > 0) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
      if (m) {
        const y = Number(m[1]);
        const mo = Number(m[2]);
        const d = Number(m[3]);
        if (y >= 1970 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
          eventConclusionAt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
        }
      }
    }
  }

  if (assignedToUserId) {
    const assignee = await prisma.user.findFirst({
      where: {
        id: assignedToUserId,
        globalRole: { in: [GlobalRole.PRODUCER, GlobalRole.ULS_ADMIN] },
        disabledAt: null,
      },
    });
    if (!assignee) {
      redirect(`/producer/inbox/${projectId}?error=bad_assignee`);
    }
  }

  try {
    await prisma.project.update({
      where: { id: projectId },
      data: {
        internalNotes,
        assignedToUserId,
        eventConclusionAt,
        retentionLegalHold,
        retentionLegalHoldNote: retentionLegalHoldNote.trim() || null,
      },
    });
  } catch {
    redirect(`/producer/inbox?error=not_found`);
  }

  revalidateProducerOverview();
  revalidateProjectMirrorCache(projectId);
  redirect(`/producer/inbox/${projectId}?saved=1`);
}

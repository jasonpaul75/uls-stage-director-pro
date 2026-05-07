"use server";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isDirectorPortalAccessRevoked } from "@/lib/director-portal-access-window";
import { revalidateProjectMirrorCache, revalidateProducerOverview, revalidateSupportQueues } from "@/lib/revalidate-project-mirror-cache";
import { GlobalRole, ProjectRole } from "@prisma/client";

function trimLen(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? t.slice(0, max) : t;
}

export async function createSupportTicketForProject(formData: FormData) {
  const session = await auth();
  const uid = session?.user?.id;
  const role = session?.user?.globalRole;
  if (!uid || role === undefined) {
    redirect("/login?callbackUrl=/portal");
  }

  const projectId = String(formData.get("projectId") ?? "").trim();
  const subject = trimLen(String(formData.get("subject") ?? ""), 200);
  const body = trimLen(String(formData.get("body") ?? ""), 10000);

  if (!projectId || !subject || !body) {
    redirect(`/portal/projects/${projectId}/support?err=required`);
  }

  if (role === GlobalRole.DIRECTOR) {
    const membership = await prisma.projectMember.findFirst({
      where: { projectId, userId: uid, role: ProjectRole.DIRECTOR },
      include: { project: { select: { eventConclusionAt: true } } },
    });
    if (!membership || isDirectorPortalAccessRevoked(membership.project.eventConclusionAt)) {
      redirect("/portal?access_ended=1");
    }
  } else if (role === GlobalRole.ULS_ADMIN) {
    const p = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!p) redirect("/portal");
  } else {
    redirect("/portal");
  }

  await prisma.supportTicket.create({
    data: {
      projectId,
      createdByUserId: uid,
      subject,
      body,
    },
  });

  revalidateSupportQueues(projectId);
  revalidateProducerOverview();
  revalidateProjectMirrorCache(projectId);
  redirect(`/portal/projects/${projectId}/support?created=1`);
}

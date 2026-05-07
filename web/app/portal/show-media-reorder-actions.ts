"use server";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { isDirectorPortalAccessRevoked } from "@/lib/director-portal-access-window";
import { prisma } from "@/lib/prisma";
import { revalidateProjectMirrorCache } from "@/lib/revalidate-project-mirror-cache";
import { reorderShowMediaAdjacent } from "@/lib/show-media-adjacent-reorder";
import { GlobalRole, ProjectRole } from "@prisma/client";

export async function reorderShowMediaAsDirector(formData: FormData) {
  const session = await auth();
  const uid = session?.user?.id;
  const role = session?.user?.globalRole as GlobalRole | undefined;
  if (!uid || role === undefined) {
    redirect("/login?callbackUrl=/portal");
  }
  if (role !== GlobalRole.DIRECTOR) {
    redirect("/portal");
  }

  const projectId = String(formData.get("projectId") ?? "").trim();
  const itemId = String(formData.get("itemId") ?? "").trim();
  const direction = String(formData.get("direction") ?? "").trim();

  if (!projectId || !itemId || (direction !== "up" && direction !== "down")) {
    redirect("/portal");
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId },
    select: {
      bookingSecuredAt: true,
      showMediaDirectorVisible: true,
      eventConclusionAt: true,
    },
  });

  if (!project?.bookingSecuredAt) {
    redirect(`/portal/projects/${projectId}?booking=pending`);
  }

  if (isDirectorPortalAccessRevoked(project.eventConclusionAt)) {
    redirect("/portal?access_ended=1");
  }

  if (!project.showMediaDirectorVisible) {
    redirect(`/portal/shows/${projectId}`);
  }

  const member = await prisma.projectMember.findFirst({
    where: { projectId, userId: uid, role: ProjectRole.DIRECTOR },
    select: { id: true },
  });
  if (!member) {
    redirect("/portal");
  }

  const out = await reorderShowMediaAdjacent(prisma, projectId, itemId, direction);
  if (out === "not_found") {
    redirect(`/portal/shows/${projectId}?media_err=not_found#portal-show-media`);
  }
  if (out === "txn_failed") {
    redirect(`/portal/shows/${projectId}?media_err=bad_order#portal-show-media`);
  }
  if (out === "noop") {
    redirect(`/portal/shows/${projectId}#portal-show-media`);
  }

  revalidateProjectMirrorCache(projectId);
  redirect(`/portal/shows/${projectId}?media_reordered=1#portal-show-media`);
}

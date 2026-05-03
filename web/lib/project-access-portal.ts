import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { GlobalRole, ProjectRole } from "@prisma/client";

/** Director may only load projects where they hold DIRECTOR membership; admins may load any project. */
export async function loadProjectForPortalViewer(
  projectId: string,
  viewer: { userId: string; globalRole: GlobalRole },
) {
  if (viewer.globalRole === GlobalRole.ULS_ADMIN) {
    return prisma.project.findUnique({
      where: { id: projectId },
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
    select: { project: true },
  });

  return membership?.project ?? null;
}

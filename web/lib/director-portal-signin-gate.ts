import { isDirectorPortalAccessRevoked } from "@/lib/director-portal-access-window";
import { prisma } from "@/lib/prisma";
import { ProjectRole } from "@prisma/client";

/**
 * Directors may use /portal when they have no memberships yet (new intake flow), or when at least one
 * DIRECTOR membership is still inside the post-conclusion access window (or not concluded).
 */
export async function directorHasActivePortalMembership(userId: string): Promise<boolean> {
  const memberships = await prisma.projectMember.findMany({
    where: { userId, role: ProjectRole.DIRECTOR },
    select: { project: { select: { eventConclusionAt: true } } },
  });

  if (memberships.length === 0) return true;

  return memberships.some((m) => !isDirectorPortalAccessRevoked(m.project.eventConclusionAt));
}

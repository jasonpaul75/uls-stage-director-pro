"use server";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireProducerEventWorkspaceUnlocked } from "@/lib/producer-event-workspace-server";
import { revalidateProjectMirrorCache } from "@/lib/revalidate-project-mirror-cache";
import { GlobalRole, ProjectStatus } from "@prisma/client";

function canProduce(role: GlobalRole | undefined): boolean {
  return role === GlobalRole.PRODUCER || role === GlobalRole.ULS_ADMIN;
}

export async function saveRunOfShow(formData: FormData) {
  const session = await auth();
  const role = session?.user?.globalRole as GlobalRole | undefined;
  if (!session?.user?.id || !canProduce(role)) {
    redirect("/login?callbackUrl=/producer/inbox");
  }

  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!projectId) redirect("/producer/inbox");

  const project = await prisma.project.findFirst({
    where: { id: projectId, status: ProjectStatus.INTAKE_SUBMITTED },
    select: { id: true },
  });
  if (!project) redirect("/producer/inbox");

  await requireProducerEventWorkspaceUnlocked(projectId);

  const raw = String(formData.get("runOfShowBody") ?? "");
  const runOfShowBody = raw.trim() ? raw : null;
  const runOfShowDirectorVisible = formData.get("runOfShowDirectorVisible") === "on";
  const runOfShowFrozen = formData.get("runOfShowFrozen") === "on";

  await prisma.project.update({
    where: { id: projectId },
    data: {
      runOfShowBody,
      runOfShowDirectorVisible,
      runOfShowFrozen,
    },
  });

  revalidateProjectMirrorCache(projectId);
  redirect(`/producer/inbox/${projectId}/event?ros_saved=1`);
}

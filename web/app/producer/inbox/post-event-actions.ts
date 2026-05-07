"use server";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { parseHttpsUrl } from "@/lib/safe-https-url";
import { prisma } from "@/lib/prisma";
import { requireProducerEventWorkspaceUnlocked } from "@/lib/producer-event-workspace-server";
import { revalidateProjectMirrorCache } from "@/lib/revalidate-project-mirror-cache";
import { GlobalRole, ProjectStatus } from "@prisma/client";

function canProduce(role: GlobalRole | undefined): boolean {
  return role === GlobalRole.PRODUCER || role === GlobalRole.ULS_ADMIN;
}

export async function savePostEventVaultPointers(formData: FormData) {
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

  const gallery = parseHttpsUrl(String(formData.get("postEventSmugMugUrl") ?? ""));
  const castr = parseHttpsUrl(String(formData.get("postEventCastrUrl") ?? ""));
  const rawGallery = String(formData.get("postEventSmugMugUrl") ?? "").trim();
  const rawCastr = String(formData.get("postEventCastrUrl") ?? "").trim();

  if ((rawGallery && !gallery) || (rawCastr && !castr)) {
    redirect(`/producer/inbox/${projectId}/event?post_event_err=bad_url`);
  }

  const postEventVaultDirectorVisible = formData.get("postEventVaultDirectorVisible") === "on";

  await prisma.project.update({
    where: { id: projectId },
    data: {
      postEventSmugMugUrl: gallery,
      postEventCastrUrl: castr,
      postEventVaultDirectorVisible,
    },
  });

  revalidateProjectMirrorCache(projectId);
  redirect(`/producer/inbox/${projectId}/event?post_event_saved=1`);
}

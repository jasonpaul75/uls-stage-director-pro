"use server";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidateProjectMirrorCache } from "@/lib/revalidate-project-mirror-cache";
import { deleteProjectAttachmentObject } from "@/lib/s3-project-attachments";
import { GlobalRole, ProjectStatus } from "@prisma/client";

function canProduce(role: GlobalRole | undefined): boolean {
  return role === GlobalRole.PRODUCER || role === GlobalRole.ULS_ADMIN;
}

/** Production removes director-supplied production media from the inbox. */
export async function deleteDirectorShareAsProducer(formData: FormData) {
  const session = await auth();
  const uid = session?.user?.id;
  const role = session?.user?.globalRole as GlobalRole | undefined;
  if (!uid || !canProduce(role)) {
    redirect("/login?callbackUrl=/producer/inbox");
  }

  const shareId = String(formData.get("shareId") ?? "").trim();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const returnTo = String(formData.get("returnTo") ?? "").trim();

  if (!shareId || !projectId) {
    redirect("/producer/inbox?ds_err=bad_request");
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, status: ProjectStatus.INTAKE_SUBMITTED },
    select: { id: true },
  });
  if (!project) {
    redirect(`/producer/inbox/${projectId}?ds_err=bad_project`);
  }

  const row = await prisma.projectDirectorShare.findFirst({
    where: { id: shareId, projectId },
    select: { storageKey: true },
  });
  if (!row) {
    if (returnTo === "event") {
      redirect(`/producer/inbox/${projectId}/event?ds_err=not_found#director-shares-production`);
    }
    redirect(`/producer/inbox/${projectId}?ds_err=not_found#director-shares-production`);
  }

  await prisma.projectDirectorShare.delete({ where: { id: shareId } });
  await deleteProjectAttachmentObject(row.storageKey).catch(() => undefined);

  revalidateProjectMirrorCache(projectId);

  if (returnTo === "event") {
    redirect(`/producer/inbox/${projectId}/event?ds_deleted=1#director-shares-production`);
  }
  redirect(`/producer/inbox/${projectId}?ds_deleted=1#director-shares-production`);
}

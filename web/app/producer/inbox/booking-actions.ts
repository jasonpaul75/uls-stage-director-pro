"use server";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidateProjectMirrorCache } from "@/lib/revalidate-project-mirror-cache";
import { GlobalRole, ProjectStatus } from "@prisma/client";

function canProduce(role: GlobalRole | undefined): boolean {
  return role === GlobalRole.PRODUCER || role === GlobalRole.ULS_ADMIN;
}

/** ULS confirms contract + initial payment — directors move to operational show workspace. */
export async function confirmBookingSecured(formData: FormData) {
  const session = await auth();
  const role = session?.user?.globalRole as GlobalRole | undefined;
  if (!session?.user?.id || !canProduce(role)) {
    redirect("/login?callbackUrl=/producer/inbox");
  }

  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!projectId) redirect("/producer/inbox");

  const project = await prisma.project.findFirst({
    where: { id: projectId, status: ProjectStatus.INTAKE_SUBMITTED },
    select: { id: true, bookingSecuredAt: true },
  });
  if (!project) redirect("/producer/inbox");

  await prisma.project.update({
    where: { id: projectId },
    data: { bookingSecuredAt: project.bookingSecuredAt ?? new Date() },
  });

  revalidateProjectMirrorCache(projectId);
  redirect(`/producer/inbox/${projectId}?booking_confirmed=1`);
}

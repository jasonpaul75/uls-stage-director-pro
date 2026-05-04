"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GlobalRole, ProjectStatus } from "@prisma/client";

function canProduce(role: GlobalRole | undefined): boolean {
  return role === GlobalRole.PRODUCER || role === GlobalRole.ULS_ADMIN;
}

async function assertQueuedIntake(projectId: string) {
  const p = await prisma.project.findFirst({
    where: { id: projectId, status: ProjectStatus.INTAKE_SUBMITTED },
    select: { id: true },
  });
  return Boolean(p);
}

export async function addShowDayFlag(formData: FormData) {
  const session = await auth();
  const role = session?.user?.globalRole as GlobalRole | undefined;
  if (!session?.user?.id || !canProduce(role)) {
    redirect("/login?callbackUrl=/producer/inbox");
  }

  const projectId = String(formData.get("projectId") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim().slice(0, 2000);
  if (!projectId || !body) {
    redirect(projectId ? `/producer/inbox/${projectId}?flag_err=required` : "/producer/inbox");
  }

  if (!(await assertQueuedIntake(projectId))) redirect("/producer/inbox");

  const last = await prisma.projectShowFlag.findFirst({
    where: { projectId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const sortOrder = (last?.sortOrder ?? -1) + 1;

  await prisma.projectShowFlag.create({
    data: { projectId, body, sortOrder },
  });

  revalidatePath(`/producer/inbox/${projectId}`);
  revalidatePath(`/portal/projects/${projectId}`);
  redirect(`/producer/inbox/${projectId}?flag_added=1`);
}

export async function deleteShowDayFlag(formData: FormData) {
  const session = await auth();
  const role = session?.user?.globalRole as GlobalRole | undefined;
  if (!session?.user?.id || !canProduce(role)) {
    redirect("/login?callbackUrl=/producer/inbox");
  }

  const flagId = String(formData.get("flagId") ?? "").trim();
  if (!flagId) redirect("/producer/inbox");

  const row = await prisma.projectShowFlag.findUnique({
    where: { id: flagId },
    select: { projectId: true },
  });
  if (!row || !(await assertQueuedIntake(row.projectId))) {
    redirect("/producer/inbox");
  }

  await prisma.projectShowFlag.delete({ where: { id: flagId } });

  revalidatePath(`/producer/inbox/${row.projectId}`);
  revalidatePath(`/portal/projects/${row.projectId}`);
  redirect(`/producer/inbox/${row.projectId}?flag_removed=1`);
}

export async function saveShowDayFlagsVisibility(formData: FormData) {
  const session = await auth();
  const role = session?.user?.globalRole as GlobalRole | undefined;
  if (!session?.user?.id || !canProduce(role)) {
    redirect("/login?callbackUrl=/producer/inbox");
  }

  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!projectId) redirect("/producer/inbox");
  if (!(await assertQueuedIntake(projectId))) redirect("/producer/inbox");

  const showDayFlagsDirectorVisible = formData.get("showDayFlagsDirectorVisible") === "on";

  await prisma.project.update({
    where: { id: projectId },
    data: { showDayFlagsDirectorVisible },
  });

  revalidatePath(`/producer/inbox/${projectId}`);
  revalidatePath(`/portal/projects/${projectId}`);
  redirect(`/producer/inbox/${projectId}?flags_visibility_saved=1`);
}

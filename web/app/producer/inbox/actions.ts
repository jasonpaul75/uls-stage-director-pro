"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GlobalRole } from "@prisma/client";

function canProduce(role: GlobalRole | undefined): boolean {
  return role === "PRODUCER" || role === "ULS_ADMIN";
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

  const internalNotes = String(formData.get("internalNotes") ?? "");
  const assigneeRaw = formData.get("assignedToUserId");
  const assignedToUserId =
    typeof assigneeRaw === "string" && assigneeRaw.length > 0 ? assigneeRaw : null;

  if (assignedToUserId) {
    const assignee = await prisma.user.findFirst({
      where: {
        id: assignedToUserId,
        globalRole: { in: [GlobalRole.PRODUCER, GlobalRole.ULS_ADMIN] },
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
      },
    });
  } catch {
    redirect(`/producer/inbox?error=not_found`);
  }

  revalidatePath("/producer/inbox");
  revalidatePath(`/producer/inbox/${projectId}`);
  redirect(`/producer/inbox/${projectId}?saved=1`);
}

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

  const conclusionRaw = formData.get("eventConclusionAt");
  let eventConclusionAt: Date | null = null;
  if (typeof conclusionRaw === "string") {
    const t = conclusionRaw.trim();
    if (t.length > 0) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
      if (m) {
        const y = Number(m[1]);
        const mo = Number(m[2]);
        const d = Number(m[3]);
        if (y >= 1970 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
          eventConclusionAt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
        }
      }
    }
  }

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
        eventConclusionAt,
      },
    });
  } catch {
    redirect(`/producer/inbox?error=not_found`);
  }

  revalidatePath("/producer/inbox");
  revalidatePath(`/producer/inbox/${projectId}`);
  revalidatePath("/portal");
  revalidatePath(`/portal/projects/${projectId}`);
  redirect(`/producer/inbox/${projectId}?saved=1`);
}

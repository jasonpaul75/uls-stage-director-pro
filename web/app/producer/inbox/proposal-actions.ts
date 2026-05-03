"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GlobalRole, ProjectStatus } from "@prisma/client";

function canProduce(role: GlobalRole | undefined): boolean {
  return role === GlobalRole.PRODUCER || role === GlobalRole.ULS_ADMIN;
}

/** Save proposal scaffolding for a queued intake — producer-facing only. */
export async function saveProposalDraft(formData: FormData) {
  const session = await auth();
  const role = session?.user?.globalRole as GlobalRole | undefined;
  if (!session?.user?.id || !canProduce(role)) {
    redirect("/login?callbackUrl=/producer/inbox");
  }

  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!projectId) {
    redirect("/producer/inbox");
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, status: ProjectStatus.INTAKE_SUBMITTED },
    select: { id: true },
  });

  if (!project) {
    redirect("/producer/inbox");
  }

  const proposalPricingNotes = String(formData.get("proposalPricingNotes") ?? "");
  const proposalTechRiderNotes = String(formData.get("proposalTechRiderNotes") ?? "");
  const proposalCrewNotes = String(formData.get("proposalCrewNotes") ?? "");
  const proposalDirectorVisible = formData.get("proposalDirectorVisible") === "on";

  await prisma.project.update({
    where: { id: projectId },
    data: {
      proposalPricingNotes: proposalPricingNotes.trim() ? proposalPricingNotes : null,
      proposalTechRiderNotes: proposalTechRiderNotes.trim() ? proposalTechRiderNotes : null,
      proposalCrewNotes: proposalCrewNotes.trim() ? proposalCrewNotes : null,
      proposalDirectorVisible,
    },
  });

  revalidatePath(`/producer/inbox/${projectId}`);
  revalidatePath(`/portal/projects/${projectId}`);
  redirect(`/producer/inbox/${projectId}?proposal_saved=1`);
}

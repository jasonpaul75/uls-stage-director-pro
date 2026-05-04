"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  DOCUSIGN_RFC_DOCUMENTATION_SAMPLE_ENVELOPE_ID,
  envelopeIdLooksValid,
  normalizeDocuSignEnvelopeId,
} from "@/lib/docusign-admin";
import { prisma } from "@/lib/prisma";
import { refreshLinkedEnvelopeFromLatestInbound } from "@/lib/docusign-webhook-persist";
import { GlobalRole, ProjectStatus } from "@prisma/client";

async function gateProducer(projectIdForLoginRedirect: string) {
  const session = await auth();
  const role = session?.user?.globalRole as GlobalRole | undefined;
  const ok =
    session?.user?.id && (role === GlobalRole.PRODUCER || role === GlobalRole.ULS_ADMIN);
  if (!ok) {
    redirect(`/login?callbackUrl=/producer/inbox/${encodeURIComponent(projectIdForLoginRedirect)}`);
  }
}

export async function linkDocuSignEnvelopeToProject(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const envelopeIdRaw = String(formData.get("envelopeId") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim().slice(0, 300);
  const producerNote = String(formData.get("producerNote") ?? "").trim().slice(0, 2000);

  await gateProducer(projectId);

  if (
    envelopeIdRaw.toLowerCase() === DOCUSIGN_RFC_DOCUMENTATION_SAMPLE_ENVELOPE_ID.toLowerCase()
  ) {
    redirect(`/producer/inbox/${projectId}?docusign_err=placeholder_envelope`);
  }

  if (!envelopeIdLooksValid(envelopeIdRaw)) {
    redirect(`/producer/inbox/${projectId}?docusign_err=bad_envelope`);
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, status: ProjectStatus.INTAKE_SUBMITTED },
    select: { id: true },
  });
  if (!project) {
    redirect("/producer/inbox?docusign_err=invalid_project");
  }

  const norm = normalizeDocuSignEnvelopeId(envelopeIdRaw);

  try {
    await prisma.projectDocuSignEnvelope.create({
      data: {
        projectId: project.id,
        envelopeId: norm,
        ...(subject ? { subject } : {}),
        ...(producerNote ? { producerNote } : {}),
        status: "unknown",
      },
    });
  } catch (err: unknown) {
    const code = typeof err === "object" && err !== null ? (err as { code?: string }).code : undefined;
    if (code === "P2002") {
      redirect(`/producer/inbox/${projectId}?docusign_err=envelope_already_linked`);
    }
    console.error("[docusign] link envelope", err);
    redirect(`/producer/inbox/${projectId}?docusign_err=api`);
  }

  try {
    await refreshLinkedEnvelopeFromLatestInbound(norm);
  } catch (err) {
    console.error("[docusign] backfill linked row from prior Connect deliveries", err);
  }

  revalidatePath(`/producer/inbox/${projectId}`);
  revalidatePath(`/portal/projects/${projectId}`);
  redirect(`/producer/inbox/${projectId}?docusign_linked=1`);
}

export async function unlinkDocuSignEnvelopeFromProject(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const rowId = String(formData.get("rowId") ?? "").trim();

  await gateProducer(projectId);

  await prisma.projectDocuSignEnvelope.deleteMany({
    where: {
      id: rowId,
      projectId,
    },
  });

  revalidatePath(`/producer/inbox/${projectId}`);
  revalidatePath(`/portal/projects/${projectId}`);
  redirect(`/producer/inbox/${projectId}?docusign_removed=1`);
}

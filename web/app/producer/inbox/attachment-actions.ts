"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidateProjectMirrorCache } from "@/lib/revalidate-project-mirror-cache";
import {
  attachmentsBucketConfigured,
  deleteProjectAttachmentObject,
  putProjectAttachmentObject,
} from "@/lib/s3-project-attachments";
import { GlobalRole, ProjectAttachmentKind, ProjectStatus } from "@prisma/client";

const MAX_BYTES = 35 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function canProduce(role: GlobalRole | undefined): boolean {
  return role === GlobalRole.PRODUCER || role === GlobalRole.ULS_ADMIN;
}

function safeFileBase(name: string): string {
  const base = name.trim().replace(/^.*[/\\]/, "").slice(0, 200);
  const cleaned = base.replace(/[^\w.\-()+ ]+/g, "_");
  return cleaned.length > 0 ? cleaned : "upload.bin";
}

function parseKind(raw: string | null): ProjectAttachmentKind | null {
  if (raw === "CONTRACT") return ProjectAttachmentKind.CONTRACT;
  if (raw === "INSURANCE_COMPLIANCE") return ProjectAttachmentKind.INSURANCE_COMPLIANCE;
  return null;
}

export async function uploadProjectAttachment(formData: FormData) {
  const session = await auth();
  const uid = session?.user?.id;
  const role = session?.user?.globalRole as GlobalRole | undefined;
  if (!uid || !canProduce(role)) {
    redirect("/login?callbackUrl=/producer/inbox");
  }

  const projectId = String(formData.get("projectId") ?? "").trim();

  if (!attachmentsBucketConfigured()) {
    redirect(
      projectId
        ? `/producer/inbox/${projectId}?attach_err=storage_not_configured`
        : "/producer/inbox?attach_err=storage_not_configured",
    );
  }

  const kind = parseKind(String(formData.get("kind") ?? ""));

  const file = formData.get("file");

  if (!projectId || !kind) {
    redirect("/producer/inbox?attach_err=bad_request");
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, status: ProjectStatus.INTAKE_SUBMITTED },
    select: { id: true },
  });
  if (!project) {
    redirect(`/producer/inbox/${projectId}?attach_err=bad_project`);
  }

  if (!(file instanceof File) || file.size <= 0) {
    redirect(`/producer/inbox/${projectId}?attach_err=empty_file`);
  }

  if (file.size > MAX_BYTES) {
    redirect(`/producer/inbox/${projectId}?attach_err=too_large`);
  }

  const contentType = file.type?.trim() || "application/octet-stream";
  if (!ALLOWED_TYPES.has(contentType)) {
    redirect(`/producer/inbox/${projectId}?attach_err=bad_type`);
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const slug = safeFileBase(file.name);
  const rand = randomBytes(10).toString("hex");
  const storageKey = `uls-stage-director/project-attachments/${projectId}/${rand}-${slug}`;

  try {
    await putProjectAttachmentObject(storageKey, buf, contentType);

    await prisma.projectAttachment.create({
      data: {
        projectId,
        kind,
        fileName: slug,
        contentType,
        sizeBytes: buf.length,
        storageKey,
        uploadedByUserId: uid,
      },
      select: { id: true },
    });
  } catch {
    try {
      await deleteProjectAttachmentObject(storageKey);
    } catch {
      /* ignore */
    }
    redirect(`/producer/inbox/${projectId}?attach_err=server`);
  }

  revalidateProjectMirrorCache(projectId);
  redirect(`/producer/inbox/${projectId}?attach_uploaded=1`);
}

export async function deleteProjectAttachment(formData: FormData) {
  const session = await auth();
  const uid = session?.user?.id;
  const role = session?.user?.globalRole as GlobalRole | undefined;
  if (!uid || !canProduce(role)) {
    redirect("/login?callbackUrl=/producer/inbox");
  }

  const projectId = String(formData.get("projectId") ?? "").trim();
  const attachmentId = String(formData.get("attachmentId") ?? "").trim();

  if (!projectId || !attachmentId) {
    redirect("/producer/inbox?attach_err=bad_request");
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, status: ProjectStatus.INTAKE_SUBMITTED },
    select: { id: true },
  });
  if (!project) {
    redirect(`/producer/inbox/${projectId}?attach_err=bad_project`);
  }

  const attachment = await prisma.projectAttachment.findFirst({
    where: { id: attachmentId, projectId },
    select: { storageKey: true },
  });
  if (!attachment) {
    redirect(`/producer/inbox/${projectId}?attach_err=not_found`);
  }

  try {
    await prisma.projectAttachment.delete({ where: { id: attachmentId } });
  } catch {
    redirect(`/producer/inbox/${projectId}?attach_err=server`);
  }
  await deleteProjectAttachmentObject(attachment.storageKey).catch(() => undefined);

  revalidateProjectMirrorCache(projectId);
  redirect(`/producer/inbox/${projectId}?attach_deleted=1`);
}

"use server";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  DIRECTOR_SHARE_MAX_BYTES,
  isDirectorShareContentTypeAllowed,
} from "@/lib/director-share-upload-policy";
import { effectiveContentTypeAfterS3Put } from "@/lib/show-media-upload-policy";
import { isDirectorPortalAccessRevoked } from "@/lib/director-portal-access-window";
import { notifyDirectorShareUploaded } from "@/lib/email/send-director-share-notification";
import { prisma } from "@/lib/prisma";
import { revalidateProjectMirrorCache } from "@/lib/revalidate-project-mirror-cache";
import {
  attachmentsBucketConfigured,
  deleteProjectAttachmentObject,
  headAttachmentObject,
} from "@/lib/s3-project-attachments";
import { GlobalRole, ProjectRole, ProjectStatus } from "@prisma/client";

function safeFileBase(name: string): string {
  const base = name.trim().replace(/^.*[/\\]/, "").slice(0, 200);
  const cleaned = base.replace(/[^\w.\-()+ ]+/g, "_");
  return cleaned.length > 0 ? cleaned : "media.bin";
}

function truncateNote(raw: string): string | null {
  const t = raw.trim().slice(0, 500);
  return t.length > 0 ? t : null;
}

function portalRedirectBase(projectId: string, portalReturn: string): string {
  return portalReturn === "show" ? `/portal/shows/${projectId}` : `/portal/projects/${projectId}`;
}

export async function finalizeDirectorShareUpload(formData: FormData) {
  const session = await auth();
  const uid = session?.user?.id;
  const role = session?.user?.globalRole as GlobalRole | undefined;
  if (!uid || role !== GlobalRole.DIRECTOR) {
    redirect("/login?callbackUrl=/portal");
  }

  const projectId = String(formData.get("projectId") ?? "").trim();
  const storageKey = String(formData.get("storageKey") ?? "").trim();
  const fileNameRaw = String(formData.get("fileName") ?? "").trim();
  const portalReturn = String(formData.get("portalReturn") ?? "").trim() === "show" ? "show" : "intake";
  const note = truncateNote(String(formData.get("note") ?? ""));

  const base = portalRedirectBase(projectId, portalReturn);

  if (!attachmentsBucketConfigured()) {
    redirect(`${base}?ds_err=storage_not_configured#portal-director-shares`);
  }

  if (!projectId || !storageKey || !fileNameRaw) {
    redirect(`${base}?ds_err=bad_request#portal-director-shares`);
  }

  const expectedPrefix = `uls-stage-director/project-director-shares/${projectId}/`;
  if (!storageKey.startsWith(expectedPrefix)) {
    redirect(`${base}?ds_err=bad_request#portal-director-shares`);
  }

  const membership = await prisma.projectMember.findFirst({
    where: { projectId, userId: uid, role: ProjectRole.DIRECTOR },
    select: {
      project: {
        select: {
          id: true,
          name: true,
          status: true,
          eventConclusionAt: true,
        },
      },
    },
  });
  const proj = membership?.project;
  if (!proj || proj.status !== ProjectStatus.INTAKE_SUBMITTED) {
    redirect(`${base}?ds_err=bad_project#portal-director-shares`);
  }
  if (isDirectorPortalAccessRevoked(proj.eventConclusionAt)) {
    redirect("/portal?access_ended=1");
  }

  const uploaderEmail =
    session.user?.email?.trim() ||
    (await prisma.user.findUnique({ where: { id: uid }, select: { email: true } }))?.email?.trim() ||
    "(unknown)";

  let head: Awaited<ReturnType<typeof headAttachmentObject>>;
  try {
    head = await headAttachmentObject(storageKey);
  } catch {
    redirect(`${base}?ds_err=server#portal-director-shares`);
  }

  if (!head || head.contentLength <= 0) {
    await deleteProjectAttachmentObject(storageKey).catch(() => undefined);
    redirect(`${base}?ds_err=empty_file#portal-director-shares`);
  }

  if (head.contentLength > DIRECTOR_SHARE_MAX_BYTES) {
    await deleteProjectAttachmentObject(storageKey).catch(() => undefined);
    redirect(`${base}?ds_err=too_large#portal-director-shares`);
  }

  const contentType = effectiveContentTypeAfterS3Put(
    head.contentType || "application/octet-stream",
    fileNameRaw,
    { mode: "director_share" },
    isDirectorShareContentTypeAllowed,
  );
  if (!isDirectorShareContentTypeAllowed(contentType)) {
    await deleteProjectAttachmentObject(storageKey).catch(() => undefined);
    redirect(`${base}?ds_err=bad_type#portal-director-shares`);
  }

  const slug = safeFileBase(fileNameRaw).slice(0, 420);

  try {
    await prisma.projectDirectorShare.create({
      data: {
        projectId,
        fileName: slug,
        contentType,
        sizeBytes: head.contentLength,
        storageKey,
        note,
        uploadedByUserId: uid,
      },
      select: { id: true },
    });
  } catch {
    await deleteProjectAttachmentObject(storageKey).catch(() => undefined);
    redirect(`${base}?ds_err=server#portal-director-shares`);
  }

  await notifyDirectorShareUploaded({
    projectId,
    projectName: proj.name,
    fileName: slug,
    contentType,
    sizeBytes: head.contentLength,
    note,
    uploaderEmail,
  });

  revalidateProjectMirrorCache(projectId);
  redirect(`${base}?ds_uploaded=1#portal-director-shares`);
}

/** Director removes a row they uploaded (same project membership). */
export async function deleteMyDirectorShare(formData: FormData) {
  const session = await auth();
  const uid = session?.user?.id;
  const role = session?.user?.globalRole as GlobalRole | undefined;
  if (!uid || role !== GlobalRole.DIRECTOR) {
    redirect("/login?callbackUrl=/portal");
  }

  const shareId = String(formData.get("shareId") ?? "").trim();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const portalReturn = String(formData.get("portalReturn") ?? "").trim() === "show" ? "show" : "intake";
  const base = portalRedirectBase(projectId, portalReturn);

  if (!shareId || !projectId) {
    redirect(`${base}?ds_err=bad_request#portal-director-shares`);
  }

  const proj = await prisma.project.findFirst({
    where: { id: projectId },
    select: { id: true, eventConclusionAt: true },
  });
  if (!proj) redirect(`${base}?ds_err=bad_project#portal-director-shares`);
  if (isDirectorPortalAccessRevoked(proj.eventConclusionAt)) {
    redirect("/portal?access_ended=1");
  }

  const member = await prisma.projectMember.findFirst({
    where: { projectId, userId: uid, role: ProjectRole.DIRECTOR },
    select: { id: true },
  });
  if (!member) redirect("/portal");

  const row = await prisma.projectDirectorShare.findFirst({
    where: {
      id: shareId,
      projectId,
      uploadedByUserId: uid,
    },
    select: { storageKey: true },
  });
  if (!row) {
    redirect(`${base}?ds_err=not_found#portal-director-shares`);
  }

  await prisma.projectDirectorShare.delete({ where: { id: shareId } });
  await deleteProjectAttachmentObject(row.storageKey).catch(() => undefined);

  revalidateProjectMirrorCache(projectId);
  redirect(`${base}?ds_deleted=1#portal-director-shares`);
}

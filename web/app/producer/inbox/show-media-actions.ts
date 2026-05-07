"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireProducerEventWorkspaceUnlocked } from "@/lib/producer-event-workspace-server";
import { revalidateProjectMirrorCache } from "@/lib/revalidate-project-mirror-cache";
import {
  attachmentsBucketConfigured,
  copyObjectInAttachmentsBucket,
  deleteProjectAttachmentObject,
  headAttachmentObject,
} from "@/lib/s3-project-attachments";
import { reorderShowMediaAdjacent } from "@/lib/show-media-adjacent-reorder";
import {
  SHOW_MEDIA_MAX_BYTES,
  isContentTypeAllowedForLane,
} from "@/lib/show-media-upload-policy";
import { GlobalRole, ProjectStatus, ShowMediaLane } from "@prisma/client";

function canProduce(role: GlobalRole | undefined): boolean {
  return role === GlobalRole.PRODUCER || role === GlobalRole.ULS_ADMIN;
}

function safeFileBase(name: string): string {
  const base = name.trim().replace(/^.*[/\\]/, "").slice(0, 200);
  const cleaned = base.replace(/[^\w.\-()+ ]+/g, "_");
  return cleaned.length > 0 ? cleaned : "media.bin";
}

function parseLane(raw: string): ShowMediaLane | null {
  if (raw === "MUSIC") return ShowMediaLane.MUSIC;
  if (raw === "VIDEO") return ShowMediaLane.VIDEO;
  return null;
}

/** "walk-on.mp3" → "walk-on (copy).mp3"; skip if base already ends with (copy). */
function withDuplicateFileLabel(name: string): string {
  const t = name.trim();
  const dot = t.lastIndexOf(".");
  const hasExt = dot > 0 && dot < t.length - 1;
  const base = hasExt ? t.slice(0, dot) : t;
  const ext = hasExt ? t.slice(dot) : "";
  if (/\(copy\)\s*$/i.test(base)) return t;
  return `${base} (copy)${ext}`;
}

async function requireIntakeProject(projectId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, status: ProjectStatus.INTAKE_SUBMITTED },
    select: { id: true },
  });
}

/** After browser PUT to presigned URL (`/api/producer/show-media/presign`). */
export async function finalizeShowMediaItemAfterS3Upload(formData: FormData) {
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
        ? `/producer/inbox/${projectId}?media_err=storage_not_configured`
        : "/producer/inbox?media_err=storage_not_configured",
    );
  }

  const lane = parseLane(String(formData.get("lane") ?? ""));
  const storageKey = String(formData.get("storageKey") ?? "").trim();
  const fileNameRaw = String(formData.get("fileName") ?? "").trim();

  if (!projectId || !lane || !storageKey || !fileNameRaw) {
    redirect("/producer/inbox?media_err=bad_request");
  }

  const expectedPrefix = `uls-stage-director/project-show-media/${projectId}/`;
  if (!storageKey.startsWith(expectedPrefix)) {
    redirect(`/producer/inbox/${projectId}?media_err=bad_request`);
  }

  const project = await requireIntakeProject(projectId);
  if (!project) {
    redirect(`/producer/inbox/${projectId}?media_err=bad_project`);
  }

  await requireProducerEventWorkspaceUnlocked(projectId);

  let head: Awaited<ReturnType<typeof headAttachmentObject>>;
  try {
    head = await headAttachmentObject(storageKey);
  } catch {
    redirect(`/producer/inbox/${projectId}/event?media_err=server`);
  }

  if (!head || head.contentLength <= 0) {
    await deleteProjectAttachmentObject(storageKey).catch(() => undefined);
    redirect(`/producer/inbox/${projectId}/event?media_err=empty_file`);
  }

  if (head.contentLength > SHOW_MEDIA_MAX_BYTES[lane]) {
    await deleteProjectAttachmentObject(storageKey).catch(() => undefined);
    redirect(`/producer/inbox/${projectId}/event?media_err=too_large`);
  }

  const contentType = head.contentType || "application/octet-stream";
  if (!isContentTypeAllowedForLane(lane, contentType)) {
    await deleteProjectAttachmentObject(storageKey).catch(() => undefined);
    redirect(`/producer/inbox/${projectId}/event?media_err=bad_type`);
  }

  const slug = safeFileBase(fileNameRaw).slice(0, 420);

  const agg = await prisma.projectShowMediaItem.aggregate({
    where: { projectId, lane },
    _max: { sortOrder: true },
  });
  const nextOrder = (agg._max.sortOrder ?? -1) + 1;

  try {
    await prisma.projectShowMediaItem.create({
      data: {
        projectId,
        lane,
        sortOrder: nextOrder,
        fileName: slug,
        contentType,
        sizeBytes: head.contentLength,
        storageKey,
        uploadedByUserId: uid,
      },
      select: { id: true },
    });
  } catch {
    await deleteProjectAttachmentObject(storageKey).catch(() => undefined);
    redirect(`/producer/inbox/${projectId}/event?media_err=server`);
  }

  revalidateProjectMirrorCache(projectId);
  redirect(`/producer/inbox/${projectId}/event?media_uploaded=1`);
}

export async function deleteShowMediaItem(formData: FormData) {
  const session = await auth();
  const uid = session?.user?.id;
  const role = session?.user?.globalRole as GlobalRole | undefined;
  if (!uid || !canProduce(role)) {
    redirect("/login?callbackUrl=/producer/inbox");
  }

  const projectId = String(formData.get("projectId") ?? "").trim();
  const itemId = String(formData.get("itemId") ?? "").trim();

  if (!projectId || !itemId) {
    redirect("/producer/inbox?media_err=bad_request");
  }

  const project = await requireIntakeProject(projectId);
  if (!project) {
    redirect(`/producer/inbox/${projectId}?media_err=bad_project`);
  }

  await requireProducerEventWorkspaceUnlocked(projectId);

  const row = await prisma.projectShowMediaItem.findFirst({
    where: { id: itemId, projectId },
    select: { storageKey: true },
  });
  if (!row) {
    redirect(`/producer/inbox/${projectId}/event?media_err=not_found`);
  }

  try {
    await prisma.projectShowMediaItem.delete({ where: { id: itemId } });
  } catch {
    redirect(`/producer/inbox/${projectId}/event?media_err=server`);
  }

  await deleteProjectAttachmentObject(row.storageKey).catch(() => undefined);

  revalidateProjectMirrorCache(projectId);
  redirect(`/producer/inbox/${projectId}/event?media_deleted=1`);
}

export async function duplicateShowMediaItem(formData: FormData) {
  const session = await auth();
  const uid = session?.user?.id;
  const role = session?.user?.globalRole as GlobalRole | undefined;
  if (!uid || !canProduce(role)) {
    redirect("/login?callbackUrl=/producer/inbox");
  }

  const projectId = String(formData.get("projectId") ?? "").trim();
  const itemId = String(formData.get("itemId") ?? "").trim();

  if (!projectId || !itemId) {
    redirect("/producer/inbox?media_err=bad_request");
  }

  if (!attachmentsBucketConfigured()) {
    redirect(`/producer/inbox/${projectId}?media_err=storage_not_configured`);
  }

  const project = await requireIntakeProject(projectId);
  if (!project) {
    redirect(`/producer/inbox/${projectId}?media_err=bad_project`);
  }

  await requireProducerEventWorkspaceUnlocked(projectId);

  const source = await prisma.projectShowMediaItem.findFirst({
    where: { id: itemId, projectId },
    select: {
      storageKey: true,
      lane: true,
      fileName: true,
      contentType: true,
      sizeBytes: true,
    },
  });
  if (!source) {
    redirect(`/producer/inbox/${projectId}/event?media_err=not_found`);
  }

  const newLabel = withDuplicateFileLabel(source.fileName).slice(0, 420);
  const slug = safeFileBase(newLabel);
  const rand = randomBytes(10).toString("hex");
  const destKey = `uls-stage-director/project-show-media/${projectId}/${rand}-${slug}`;

  const agg = await prisma.projectShowMediaItem.aggregate({
    where: { projectId, lane: source.lane },
    _max: { sortOrder: true },
  });
  const nextOrder = (agg._max.sortOrder ?? -1) + 1;

  try {
    await copyObjectInAttachmentsBucket(source.storageKey, destKey);
  } catch {
    redirect(`/producer/inbox/${projectId}/event?media_err=server`);
  }

  try {
    await prisma.projectShowMediaItem.create({
      data: {
        projectId,
        lane: source.lane,
        sortOrder: nextOrder,
        fileName: newLabel,
        contentType: source.contentType,
        sizeBytes: source.sizeBytes,
        storageKey: destKey,
        uploadedByUserId: uid,
      },
    });
  } catch {
    await deleteProjectAttachmentObject(destKey).catch(() => undefined);
    redirect(`/producer/inbox/${projectId}/event?media_err=server`);
  }

  revalidateProjectMirrorCache(projectId);
  redirect(`/producer/inbox/${projectId}/event?media_duplicated=1`);
}

export async function reorderShowMediaItem(formData: FormData) {
  const session = await auth();
  const uid = session?.user?.id;
  const role = session?.user?.globalRole as GlobalRole | undefined;
  if (!uid || !canProduce(role)) {
    redirect("/login?callbackUrl=/producer/inbox");
  }

  const projectId = String(formData.get("projectId") ?? "").trim();
  const itemId = String(formData.get("itemId") ?? "").trim();
  const direction = String(formData.get("direction") ?? "").trim();

  if (!projectId || !itemId || (direction !== "up" && direction !== "down")) {
    redirect("/producer/inbox?media_err=bad_request");
  }

  const project = await requireIntakeProject(projectId);
  if (!project) {
    redirect(`/producer/inbox/${projectId}?media_err=bad_project`);
  }

  await requireProducerEventWorkspaceUnlocked(projectId);

  const out = await reorderShowMediaAdjacent(
    prisma,
    projectId,
    itemId,
    direction === "up" || direction === "down" ? direction : "down",
  );
  if (out === "not_found") {
    redirect(`/producer/inbox/${projectId}/event?media_err=not_found`);
  }
  if (out === "txn_failed") {
    redirect(`/producer/inbox/${projectId}/event?media_err=bad_order`);
  }
  if (out === "noop") {
    redirect(`/producer/inbox/${projectId}/event#show-media`);
  }

  revalidateProjectMirrorCache(projectId);
  redirect(`/producer/inbox/${projectId}/event?media_reordered=1`);
}

export async function importShowMediaFromLibrary(formData: FormData) {
  const session = await auth();
  const uid = session?.user?.id;
  const role = session?.user?.globalRole as GlobalRole | undefined;
  if (!uid || !canProduce(role)) {
    redirect("/login?callbackUrl=/producer/inbox");
  }

  const projectId = String(formData.get("projectId") ?? "").trim();
  const libraryItemId = String(formData.get("libraryItemId") ?? "").trim();

  if (!projectId || !libraryItemId) {
    redirect("/producer/inbox?media_err=bad_request");
  }

  if (!attachmentsBucketConfigured()) {
    redirect(`/producer/inbox/${projectId}?media_err=storage_not_configured`);
  }

  const project = await requireIntakeProject(projectId);
  if (!project) {
    redirect(`/producer/inbox/${projectId}?media_err=bad_project`);
  }

  await requireProducerEventWorkspaceUnlocked(projectId);

  const lib = await prisma.showMediaLibraryItem.findUnique({
    where: { id: libraryItemId },
    select: {
      storageKey: true,
      lane: true,
      fileName: true,
      contentType: true,
      sizeBytes: true,
    },
  });
  if (!lib) {
    redirect(`/producer/inbox/${projectId}/event?media_err=import_missing`);
  }

  const slug = safeFileBase(lib.fileName);
  const rand = randomBytes(10).toString("hex");
  const destKey = `uls-stage-director/project-show-media/${projectId}/${rand}-${slug}`;

  const agg = await prisma.projectShowMediaItem.aggregate({
    where: { projectId, lane: lib.lane },
    _max: { sortOrder: true },
  });
  const nextOrder = (agg._max.sortOrder ?? -1) + 1;

  try {
    await copyObjectInAttachmentsBucket(lib.storageKey, destKey);
  } catch {
    redirect(`/producer/inbox/${projectId}/event?media_err=server`);
  }

  try {
    await prisma.projectShowMediaItem.create({
      data: {
        projectId,
        lane: lib.lane,
        sortOrder: nextOrder,
        fileName: lib.fileName.slice(0, 420),
        contentType: lib.contentType,
        sizeBytes: lib.sizeBytes,
        storageKey: destKey,
        uploadedByUserId: uid,
      },
    });
  } catch {
    await deleteProjectAttachmentObject(destKey).catch(() => undefined);
    redirect(`/producer/inbox/${projectId}/event?media_err=server`);
  }

  revalidateProjectMirrorCache(projectId);
  redirect(`/producer/inbox/${projectId}/event?media_imported=1`);
}

export async function importShowMediaFromOtherProject(formData: FormData) {
  const session = await auth();
  const uid = session?.user?.id;
  const role = session?.user?.globalRole as GlobalRole | undefined;
  if (!uid || !canProduce(role)) {
    redirect("/login?callbackUrl=/producer/inbox");
  }

  const projectId = String(formData.get("projectId") ?? "").trim();
  const ref = String(formData.get("sourceItemRef") ?? "").trim();
  const parts = ref.split("|");
  const sourceProjectId = (parts[0] ?? "").trim();
  const sourceItemId = (parts[1] ?? "").trim();

  if (!projectId || !sourceProjectId || !sourceItemId || sourceProjectId === projectId) {
    redirect("/producer/inbox?media_err=bad_request");
  }

  if (!attachmentsBucketConfigured()) {
    redirect(`/producer/inbox/${projectId}?media_err=storage_not_configured`);
  }

  const target = await requireIntakeProject(projectId);
  if (!target) {
    redirect(`/producer/inbox/${projectId}?media_err=bad_project`);
  }

  await requireProducerEventWorkspaceUnlocked(projectId);

  const sourceProject = await prisma.project.findFirst({
    where: { id: sourceProjectId, status: ProjectStatus.INTAKE_SUBMITTED },
    select: { id: true },
  });
  if (!sourceProject) {
    redirect(`/producer/inbox/${projectId}/event?media_err=import_missing`);
  }

  const source = await prisma.projectShowMediaItem.findFirst({
    where: { id: sourceItemId, projectId: sourceProjectId },
    select: {
      storageKey: true,
      lane: true,
      fileName: true,
      contentType: true,
      sizeBytes: true,
    },
  });
  if (!source) {
    redirect(`/producer/inbox/${projectId}/event?media_err=import_missing`);
  }

  const slug = safeFileBase(source.fileName);
  const rand = randomBytes(10).toString("hex");
  const destKey = `uls-stage-director/project-show-media/${projectId}/${rand}-${slug}`;

  const agg = await prisma.projectShowMediaItem.aggregate({
    where: { projectId, lane: source.lane },
    _max: { sortOrder: true },
  });
  const nextOrder = (agg._max.sortOrder ?? -1) + 1;

  try {
    await copyObjectInAttachmentsBucket(source.storageKey, destKey);
  } catch {
    redirect(`/producer/inbox/${projectId}/event?media_err=server`);
  }

  try {
    await prisma.projectShowMediaItem.create({
      data: {
        projectId,
        lane: source.lane,
        sortOrder: nextOrder,
        fileName: source.fileName.slice(0, 420),
        contentType: source.contentType,
        sizeBytes: source.sizeBytes,
        storageKey: destKey,
        uploadedByUserId: uid,
      },
    });
  } catch {
    await deleteProjectAttachmentObject(destKey).catch(() => undefined);
    redirect(`/producer/inbox/${projectId}/event?media_err=server`);
  }

  revalidateProjectMirrorCache(projectId);
  redirect(`/producer/inbox/${projectId}/event?media_imported=1`);
}

export async function saveShowMediaVisibility(formData: FormData) {
  const session = await auth();
  const uid = session?.user?.id;
  const role = session?.user?.globalRole as GlobalRole | undefined;
  if (!uid || !canProduce(role)) {
    redirect("/login?callbackUrl=/producer/inbox");
  }

  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!projectId) {
    redirect("/producer/inbox");
  }

  const project = await requireIntakeProject(projectId);
  if (!project) {
    redirect(`/producer/inbox/${projectId}?media_err=bad_project`);
  }

  await requireProducerEventWorkspaceUnlocked(projectId);

  const visible = formData.get("showMediaDirectorVisible") === "on";

  await prisma.project.update({
    where: { id: projectId },
    data: { showMediaDirectorVisible: visible },
  });

  revalidateProjectMirrorCache(projectId);
  redirect(`/producer/inbox/${projectId}/event?media_visibility_saved=1`);
}

"use server";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  attachmentsBucketConfigured,
  deleteProjectAttachmentObject,
  headAttachmentObject,
} from "@/lib/s3-project-attachments";
import {
  SHOW_MEDIA_MAX_BYTES,
  isContentTypeAllowedForLane,
} from "@/lib/show-media-upload-policy";
import { GlobalRole, ShowMediaLane } from "@prisma/client";

function canProduce(role: GlobalRole | undefined): boolean {
  return role === GlobalRole.PRODUCER || role === GlobalRole.ULS_ADMIN;
}

function parseLane(raw: string): ShowMediaLane | null {
  if (raw === "MUSIC") return ShowMediaLane.MUSIC;
  if (raw === "VIDEO") return ShowMediaLane.VIDEO;
  return null;
}

function safeFileBase(name: string): string {
  const base = name.trim().replace(/^.*[/\\]/, "").slice(0, 200);
  const cleaned = base.replace(/[^\w.\-()+ ]+/g, "_");
  return cleaned.length > 0 ? cleaned : "media.bin";
}

/** After browser PUT to presigned URL from `/api/producer/media-library/presign`. */
export async function finalizeShowMediaLibraryItemAfterS3Upload(formData: FormData) {
  const session = await auth();
  const uid = session?.user?.id;
  const role = session?.user?.globalRole as GlobalRole | undefined;
  if (!uid || !canProduce(role)) {
    redirect("/login?callbackUrl=/producer/media-library");
  }

  if (!attachmentsBucketConfigured()) {
    redirect("/producer/media-library?lib_err=storage_not_configured");
  }

  const lane = parseLane(String(formData.get("lane") ?? ""));
  const storageKey = String(formData.get("storageKey") ?? "").trim();
  const fileNameRaw = String(formData.get("fileName") ?? "").trim();

  if (!lane || !storageKey || !fileNameRaw) {
    redirect("/producer/media-library?lib_err=bad_request");
  }

  const libPrefix = "uls-stage-director/show-media-library/";
  if (!storageKey.startsWith(libPrefix)) {
    redirect("/producer/media-library?lib_err=bad_request");
  }

  let head: Awaited<ReturnType<typeof headAttachmentObject>>;
  try {
    head = await headAttachmentObject(storageKey);
  } catch {
    redirect("/producer/media-library?lib_err=server");
  }

  if (!head || head.contentLength <= 0) {
    await deleteProjectAttachmentObject(storageKey).catch(() => undefined);
    redirect("/producer/media-library?lib_err=bad_request");
  }

  if (head.contentLength > SHOW_MEDIA_MAX_BYTES[lane]) {
    await deleteProjectAttachmentObject(storageKey).catch(() => undefined);
    redirect("/producer/media-library?lib_err=too_large");
  }

  const contentType = head.contentType || "application/octet-stream";
  if (!isContentTypeAllowedForLane(lane, contentType)) {
    await deleteProjectAttachmentObject(storageKey).catch(() => undefined);
    redirect("/producer/media-library?lib_err=bad_type");
  }

  const slug = safeFileBase(fileNameRaw).slice(0, 420);

  try {
    await prisma.showMediaLibraryItem.create({
      data: {
        lane,
        fileName: slug,
        contentType,
        sizeBytes: head.contentLength,
        storageKey,
        uploadedByUserId: uid,
      },
    });
  } catch {
    await deleteProjectAttachmentObject(storageKey).catch(() => undefined);
    redirect("/producer/media-library?lib_err=server");
  }

  redirect("/producer/media-library?lib_uploaded=1");
}

export async function deleteShowMediaLibraryItem(formData: FormData) {
  const session = await auth();
  const uid = session?.user?.id;
  const role = session?.user?.globalRole as GlobalRole | undefined;
  if (!uid || !canProduce(role)) {
    redirect("/login?callbackUrl=/producer/media-library");
  }

  const itemId = String(formData.get("itemId") ?? "").trim();
  if (!itemId) {
    redirect("/producer/media-library?lib_err=bad_request");
  }

  const row = await prisma.showMediaLibraryItem.findUnique({
    where: { id: itemId },
    select: { storageKey: true },
  });
  if (!row) {
    redirect("/producer/media-library?lib_err=not_found");
  }

  try {
    await prisma.showMediaLibraryItem.delete({ where: { id: itemId } });
  } catch {
    redirect("/producer/media-library?lib_err=server");
  }

  await deleteProjectAttachmentObject(row.storageKey).catch(() => undefined);
  redirect("/producer/media-library?lib_deleted=1");
}

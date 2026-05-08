import { randomBytes } from "crypto";

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  DIRECTOR_SHARE_MAX_BYTES,
  isDirectorShareContentTypeAllowed,
} from "@/lib/director-share-upload-policy";
import { isDirectorPortalAccessRevoked } from "@/lib/director-portal-access-window";
import { prisma } from "@/lib/prisma";
import { attachmentsBucketConfigured, signedPutAttachmentUrl } from "@/lib/s3-project-attachments";
import { GlobalRole, ProjectRole, ProjectStatus } from "@prisma/client";

function safeFileBase(name: string): string {
  const base = name.trim().replace(/^.*[/\\]/, "").slice(0, 200);
  const cleaned = base.replace(/[^\w.\-()+ ]+/g, "_");
  return cleaned.length > 0 ? cleaned : "media.bin";
}

/** Directors only — presigned PUT into `project-director-shares/{projectId}/…`. */
export async function POST(req: Request) {
  const session = await auth();
  const uid = session?.user?.id;
  const role = session?.user?.globalRole as GlobalRole | undefined;
  if (!uid || role !== GlobalRole.DIRECTOR) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!attachmentsBucketConfigured()) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const projectId = String(o.projectId ?? "").trim();
  const fileName = String(o.fileName ?? "").trim();
  const contentType = String(o.contentType ?? "").trim().toLowerCase();
  const sizeBytes =
    typeof o.sizeBytes === "number" && Number.isFinite(o.sizeBytes)
      ? o.sizeBytes
      : Number.parseInt(String(o.sizeBytes ?? ""), 10);

  if (!projectId || !fileName || !contentType || !Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  if (sizeBytes > DIRECTOR_SHARE_MAX_BYTES) {
    return NextResponse.json({ error: "Too large" }, { status: 400 });
  }
  if (!isDirectorShareContentTypeAllowed(contentType)) {
    return NextResponse.json({ error: "Bad type" }, { status: 400 });
  }

  const membership = await prisma.projectMember.findFirst({
    where: { projectId, userId: uid, role: ProjectRole.DIRECTOR },
    select: {
      project: {
        select: { id: true, status: true, eventConclusionAt: true },
      },
    },
  });

  const project = membership?.project ?? null;
  if (!project || project.status !== ProjectStatus.INTAKE_SUBMITTED) {
    return NextResponse.json({ error: "Bad project" }, { status: 400 });
  }

  if (isDirectorPortalAccessRevoked(project.eventConclusionAt)) {
    return NextResponse.json({ error: "Portal access ended" }, { status: 403 });
  }

  const slug = safeFileBase(fileName).slice(0, 420);
  const rand = randomBytes(10).toString("hex");
  const storageKey = `uls-stage-director/project-director-shares/${projectId}/${rand}-${slug}`;

  try {
    const uploadUrl = await signedPutAttachmentUrl(storageKey, contentType, 900);
    return NextResponse.json({ uploadUrl, storageKey, method: "PUT" as const });
  } catch {
    return NextResponse.json({ error: "Could not sign upload" }, { status: 500 });
  }
}

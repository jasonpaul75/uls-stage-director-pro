import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { isDirectorPortalAccessRevoked } from "@/lib/director-portal-access-window";
import { prisma } from "@/lib/prisma";
import { attachmentsBucketConfigured, signedGetAttachmentUrl } from "@/lib/s3-project-attachments";
import { GlobalRole, ProjectRole } from "@prisma/client";

type RouteParams = Promise<{ itemId: string }>;

/** Authenticated GET: 302 redirect to time-limited signed S3 URL by default. Use `?proxy=1` for same-origin streaming (e.g. waveform decode in-browser). */
export async function GET(req: Request, ctx: { params: RouteParams }) {
  const { itemId } = await ctx.params;
  const session = await auth();
  const uid = session?.user?.id;
  const role = session?.user?.globalRole as GlobalRole | undefined;

  if (!uid || role === undefined) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!attachmentsBucketConfigured()) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const proxy = searchParams.get("proxy") === "1";

  const row = await prisma.projectShowMediaItem.findFirst({
    where: { id: itemId },
    select: {
      storageKey: true,
      contentType: true,
      projectId: true,
      project: {
        select: {
          eventConclusionAt: true,
          showMediaDirectorVisible: true,
        },
      },
    },
  });

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let allowed = false;

  if (role === GlobalRole.PRODUCER || role === GlobalRole.ULS_ADMIN) {
    allowed = true;
  } else if (role === GlobalRole.DIRECTOR) {
    if (
      row.project.showMediaDirectorVisible &&
      !isDirectorPortalAccessRevoked(row.project.eventConclusionAt)
    ) {
      const m = await prisma.projectMember.findFirst({
        where: {
          projectId: row.projectId,
          userId: uid,
          role: ProjectRole.DIRECTOR,
        },
        select: { id: true },
      });
      allowed = Boolean(m);
    }
  }

  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const url = await signedGetAttachmentUrl(row.storageKey, 900);
    if (proxy) {
      const upstream = await fetch(url);
      if (!upstream.ok || !upstream.body) {
        return NextResponse.json({ error: "Upstream fetch failed" }, { status: 502 });
      }
      return new NextResponse(upstream.body, {
        status: 200,
        headers: {
          "Content-Type": row.contentType?.trim() || "application/octet-stream",
          "Cache-Control": "private, no-store",
        },
      });
    }
    return NextResponse.redirect(url, 302);
  } catch {
    return NextResponse.json({ error: "Could not sign media URL" }, { status: 500 });
  }
}

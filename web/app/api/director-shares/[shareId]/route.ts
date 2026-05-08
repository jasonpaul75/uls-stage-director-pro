import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { isDirectorPortalAccessRevoked } from "@/lib/director-portal-access-window";
import { prisma } from "@/lib/prisma";
import { attachmentsBucketConfigured, signedGetAttachmentUrl } from "@/lib/s3-project-attachments";
import { GlobalRole, ProjectRole } from "@prisma/client";

type RouteParams = Promise<{ shareId: string }>;

/** Signed download — assigned director (until access revoked) or production/admin. */
export async function GET(_req: Request, ctx: { params: RouteParams }) {
  const { shareId } = await ctx.params;
  const session = await auth();
  const uid = session?.user?.id;
  const role = session?.user?.globalRole as GlobalRole | undefined;

  if (!uid || role === undefined) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!attachmentsBucketConfigured()) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  const row = await prisma.projectDirectorShare.findFirst({
    where: { id: shareId },
    select: {
      storageKey: true,
      projectId: true,
      project: {
        select: {
          eventConclusionAt: true,
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
    if (!isDirectorPortalAccessRevoked(row.project.eventConclusionAt)) {
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
    return NextResponse.redirect(url, 302);
  } catch {
    return NextResponse.json({ error: "Could not sign download" }, { status: 500 });
  }
}

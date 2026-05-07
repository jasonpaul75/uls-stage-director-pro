import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { attachmentsBucketConfigured, signedGetAttachmentUrl } from "@/lib/s3-project-attachments";
import { GlobalRole } from "@prisma/client";

type RouteParams = Promise<{ attachmentId: string }>;

/** Signed redirect to private S3 object — production/admin only (directors cannot access attachments). */
export async function GET(_req: Request, ctx: { params: RouteParams }) {
  const { attachmentId } = await ctx.params;
  const session = await auth();
  const role = session?.user?.globalRole as GlobalRole | undefined;

  if (!session?.user?.id || (role !== GlobalRole.PRODUCER && role !== GlobalRole.ULS_ADMIN)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!attachmentsBucketConfigured()) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  const row = await prisma.projectAttachment.findFirst({
    where: { id: attachmentId },
    select: { storageKey: true },
  });

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const url = await signedGetAttachmentUrl(row.storageKey, 120);
    return NextResponse.redirect(url, 302);
  } catch {
    return NextResponse.json({ error: "Could not sign download" }, { status: 500 });
  }
}

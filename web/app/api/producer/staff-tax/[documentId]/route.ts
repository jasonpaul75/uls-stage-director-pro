import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { attachmentsBucketConfigured, signedGetAttachmentUrl } from "@/lib/s3-project-attachments";
import { GlobalRole } from "@prisma/client";

function canProduce(role: GlobalRole | undefined): boolean {
  return role === GlobalRole.PRODUCER || role === GlobalRole.ULS_ADMIN;
}

function attachmentContentDispositionRfc5987(fileName: string): string {
  const base = fileName.trim().replace(/[\r\n]/g, "") || "download";
  return `attachment; filename*=UTF-8''${encodeURIComponent(base)}`;
}

type RouteParams = Promise<{ documentId: string }>;

/** Producer/admin signed GET for confidential staff tax uploads (W‑9 / W‑2-class PDFs). */
export async function GET(req: Request, ctx: { params: RouteParams }) {
  const { documentId } = await ctx.params;
  const session = await auth();
  const role = session?.user?.globalRole as GlobalRole | undefined;

  if (!session?.user?.id || !canProduce(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!attachmentsBucketConfigured()) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const download = searchParams.get("download") === "1";

  const row = await prisma.staffTaxDocument.findFirst({
    where: { id: documentId },
    select: {
      storageKey: true,
      fileName: true,
      contentType: true,
    },
  });

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ct = row.contentType.trim() || "application/octet-stream";

  try {
    const url = await signedGetAttachmentUrl(
      row.storageKey,
      120,
      download
        ? {
            responseContentType: ct,
            responseContentDisposition: attachmentContentDispositionRfc5987(row.fileName),
          }
        : { responseContentType: ct },
    );
    return NextResponse.redirect(url, 302);
  } catch {
    return NextResponse.json({ error: "Could not sign download" }, { status: 500 });
  }
}

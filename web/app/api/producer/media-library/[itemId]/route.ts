import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { attachmentsBucketConfigured, signedGetAttachmentUrl } from "@/lib/s3-project-attachments";
import { GlobalRole } from "@prisma/client";

const LIBRARY_KEY_PREFIX = "uls-stage-director/show-media-library/";

function canProduce(role: GlobalRole | undefined): boolean {
  return role === GlobalRole.PRODUCER || role === GlobalRole.ULS_ADMIN;
}

function showMediaPlaybackContentType(dbContentType: string | null | undefined): string {
  const t = dbContentType?.trim() ?? "";
  return t !== "" ? t : "application/octet-stream";
}

function attachmentContentDispositionRfc5987(fileName: string): string {
  const base = fileName.trim().replace(/[\r\n]/g, "") || "download";
  return `attachment; filename*=UTF-8''${encodeURIComponent(base)}`;
}

type RouteParams = Promise<{ itemId: string }>;

/** Authenticated GET for shared library objects — same signed-URL pattern as `/api/show-media/[itemId]` (producer + ULS admin only). */
export async function GET(req: Request, ctx: { params: RouteParams }) {
  const { itemId } = await ctx.params;
  const session = await auth();
  const role = session?.user?.globalRole as GlobalRole | undefined;

  if (!session?.user?.id || !canProduce(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!attachmentsBucketConfigured()) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const proxy = searchParams.get("proxy") === "1";
  const download = searchParams.get("download") === "1";

  const row = await prisma.showMediaLibraryItem.findFirst({
    where: { id: itemId },
    select: {
      storageKey: true,
      contentType: true,
      fileName: true,
    },
  });

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!row.storageKey.startsWith(LIBRARY_KEY_PREFIX)) {
    return NextResponse.json({ error: "Invalid media object" }, { status: 500 });
  }

  try {
    const playbackType = showMediaPlaybackContentType(row.contentType);
    const url = await signedGetAttachmentUrl(
      row.storageKey,
      900,
      download
        ? {
            responseContentType: playbackType,
            responseContentDisposition: attachmentContentDispositionRfc5987(row.fileName),
          }
        : {
            responseContentType: playbackType,
            responseContentDisposition: "inline",
          },
    );
    if (proxy) {
      const upstream = await fetch(url);
      if (!upstream.ok || !upstream.body) {
        let upstreamCode: string | undefined;
        if (!upstream.ok) {
          const text = await upstream.text().catch(() => "");
          const m = text.match(/<Code>([^<]+)<\/Code>/);
          upstreamCode = m?.[1];
        }
        const hint =
          upstream.status === 403
            ? "S3 denied GET — ensure the IAM user whose keys sign URLs has s3:GetObject on this bucket’s `uls-stage-director/*` keys (same as presigned playback)."
            : undefined;
        return NextResponse.json(
          {
            error: "Upstream fetch failed",
            upstreamStatus: upstream.status,
            ...(upstreamCode ? { upstreamCode } : {}),
            ...(hint ? { hint } : {}),
          },
          { status: 502 },
        );
      }
      return new NextResponse(upstream.body, {
        status: 200,
        headers: {
          "Content-Type": playbackType,
          "Content-Disposition": "inline",
          "Cache-Control": "private, no-store",
        },
      });
    }
    return NextResponse.redirect(url, 302);
  } catch {
    return NextResponse.json({ error: "Could not sign media URL" }, { status: 500 });
  }
}

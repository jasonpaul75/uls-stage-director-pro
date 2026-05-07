import { randomBytes } from "crypto";

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { attachmentsBucketConfigured, signedPutAttachmentUrl } from "@/lib/s3-project-attachments";
import { SHOW_MEDIA_MAX_BYTES, isContentTypeAllowedForLane } from "@/lib/show-media-upload-policy";
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

/** JSON POST: presigned PUT for shared library objects. */
export async function POST(req: Request) {
  const session = await auth();
  const uid = session?.user?.id;
  const role = session?.user?.globalRole as GlobalRole | undefined;
  if (!uid || !canProduce(role)) {
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
  const lane = parseLane(String(o.lane ?? ""));
  const fileName = String(o.fileName ?? "").trim();
  const contentType = String(o.contentType ?? "").trim().toLowerCase();
  const sizeBytes =
    typeof o.sizeBytes === "number" && Number.isFinite(o.sizeBytes)
      ? o.sizeBytes
      : Number.parseInt(String(o.sizeBytes ?? ""), 10);

  if (!lane || !fileName || !contentType || !Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const max = SHOW_MEDIA_MAX_BYTES[lane];
  if (sizeBytes > max) {
    return NextResponse.json({ error: "Too large" }, { status: 400 });
  }
  if (!isContentTypeAllowedForLane(lane, contentType)) {
    return NextResponse.json({ error: "Bad type" }, { status: 400 });
  }

  const slug = safeFileBase(fileName);
  const rand = randomBytes(10).toString("hex");
  const storageKey = `uls-stage-director/show-media-library/${rand}-${slug}`;

  try {
    const uploadUrl = await signedPutAttachmentUrl(storageKey, contentType, 900);
    return NextResponse.json({ uploadUrl, storageKey, method: "PUT" as const });
  } catch {
    return NextResponse.json({ error: "Could not sign upload" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  docuSignConnectHmacMatchesBody,
  headerDocuSignConnectSignature,
  sha256HexUtf8,
} from "@/lib/docusign-connect-crypto";
import { extractConnectEnvelopeFields } from "@/lib/docusign-connect-parse";
import { persistDocuSignConnectInbound } from "@/lib/docusign-webhook-persist";

export const runtime = "nodejs";

/** Lets you verify routing + Vercel logs; DocuSign always uses POST. */

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      path: "/api/webhooks/docusign",
      hint: "DocuSign Connect sends POST with JSON SIM + HMAC header(s). Demo envelopes use admindemo.docusign.com → Connect.",
    },
    { status: 200 },
  );
}

export async function POST(request: Request) {
  console.info("[docusign webhook] POST ingress");

  const secret = process.env.DOCUSIGN_CONNECT_HMAC_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "DOCUSIGN_CONNECT_HMAC_SECRET not set" }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = headerDocuSignConnectSignature(request.headers);
  if (!signature) {
    console.warn("[docusign webhook] missing HMAC digest header");
    return NextResponse.json({ error: "Missing X-DocuSign-Signature-1" }, { status: 400 });
  }

  if (!docuSignConnectHmacMatchesBody(secret, rawBody, signature)) {
    console.warn("[docusign webhook] HMAC mismatch");
    return NextResponse.json({ error: "Invalid HMAC" }, { status: 401 });
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body must be JSON (Connect SIM)" }, { status: 400 });
  }

  const extracted = extractConnectEnvelopeFields(parsed);
  const digest = sha256HexUtf8(rawBody);

  try {
    await prisma.$transaction(async (tx) => {
      await persistDocuSignConnectInbound(tx, {
        payloadHashSha256: digest,
        parsed,
        extracted,
      });
    });
  } catch (e: unknown) {
    const code = typeof e === "object" && e !== null ? (e as { code?: string }).code : undefined;
    if (code === "P2002") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("[docusign connect]", e);
    return NextResponse.json({ error: "Persist failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

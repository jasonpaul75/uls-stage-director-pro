import type { Prisma } from "@prisma/client";

import {
  extractConnectEnvelopeFields,
  resolveTrackedEnvelopeStatus,
  type ParsedDocuSignConnectEnvelope,
} from "@/lib/docusign-connect-parse";
import { trimDocuSignConnectForStorage } from "@/lib/docusign-connect-payload-storage";
import { prisma } from "@/lib/prisma";

async function mirrorLinkedEnvelopeAfterConnect(
  tx: Prisma.TransactionClient,
  parsedEvent: ParsedDocuSignConnectEnvelope,
  resolvedStatus: string | undefined,
): Promise<boolean> {
  const envelopeId = parsedEvent.envelopeId?.trim();
  if (!envelopeId) return false;

  const row = await tx.projectDocuSignEnvelope.findUnique({
    where: { envelopeId },
  });
  if (!row) return false;

  const now = new Date();
  const normalized = resolvedStatus ?? row.status;
  const lastEv = parsedEvent.event ?? null;

  const completedAtMaybe =
    normalized === "completed" && row.completedAt == null ? now : undefined;
  const voidedAtMaybe = normalized === "voided" && row.voidedAt == null ? now : undefined;

  await tx.projectDocuSignEnvelope.update({
    where: { id: row.id },
    data: {
      status: normalized,
      statusChangedAt: now,
      lastWebhookEvent: lastEv ?? undefined,
      ...(completedAtMaybe !== undefined ? { completedAt: completedAtMaybe } : {}),
      ...(voidedAtMaybe !== undefined ? { voidedAt: voidedAtMaybe } : {}),
    },
  });
  return true;
}

/** Insert inbound audit row + update linked envelope if one exists under this envelopeId. */

export async function persistDocuSignConnectInbound(
  tx: Prisma.TransactionClient,
  body: {
    payloadHashSha256: string;
    parsed: Record<string, unknown>;
    extracted: ParsedDocuSignConnectEnvelope | null;
  },
): Promise<{ envelopeIdExtracted: string | null; updatedLinkedEnvelope: boolean }> {
  const extracted = body.extracted;

  await tx.docuSignInboundEvent.create({
    data: {
      payloadHashSha256: body.payloadHashSha256,
      envelopeId: extracted?.envelopeId?.trim() ?? null,
      eventType: extracted?.event ?? null,
      payload: trimDocuSignConnectForStorage(body.parsed),
    },
  });

  const resolvedStatus = resolveTrackedEnvelopeStatus(extracted);

  let updatedLinkedEnvelope = false;
  if (extracted?.envelopeId?.trim()) {
    updatedLinkedEnvelope = await mirrorLinkedEnvelopeAfterConnect(tx, extracted, resolvedStatus);
  }

  await tx.docuSignInboundEvent.updateMany({
    where: { payloadHashSha256: body.payloadHashSha256 },
    data: { processedAt: new Date() },
  });

  return {
    envelopeIdExtracted: extracted?.envelopeId?.trim() ?? null,
    updatedLinkedEnvelope,
  };
}

/**
 * When producers link an envelope after DocuSign Connect has already delivered events, the row is
 * created too late for those past webhooks to have updated it. Replay the latest stored SIM payload
 * for this envelope ID so the portal reflects known status without waiting for a new event.
 */

export async function refreshLinkedEnvelopeFromLatestInbound(envelopeIdNorm: string): Promise<boolean> {
  const latest = await prisma.docuSignInboundEvent.findFirst({
    where: { envelopeId: envelopeIdNorm },
    orderBy: { createdAt: "desc" },
  });
  const payload = latest?.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  const parsed = payload as Record<string, unknown>;
  const extracted = extractConnectEnvelopeFields(parsed);
  if (!extracted) {
    return false;
  }
  const resolvedStatus = resolveTrackedEnvelopeStatus(extracted);
  const env = extracted.envelopeId?.trim();
  if (!env || env !== envelopeIdNorm) {
    return false;
  }
  if (!resolvedStatus && !extracted.event) {
    return false;
  }

  return prisma.$transaction(async (tx) =>
    mirrorLinkedEnvelopeAfterConnect(tx, extracted, resolvedStatus),
  );
}

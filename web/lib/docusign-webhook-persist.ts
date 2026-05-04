import type { Prisma } from "@prisma/client";

import type { ParsedDocuSignConnectEnvelope } from "@/lib/docusign-connect-parse";
import { resolveTrackedEnvelopeStatus } from "@/lib/docusign-connect-parse";
import { trimDocuSignConnectForStorage } from "@/lib/docusign-connect-payload-storage";

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

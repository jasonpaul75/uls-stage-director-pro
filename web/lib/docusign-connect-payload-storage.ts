import type { Prisma } from "@prisma/client";

/**
 * Persist only Connect metadata — full payloads can include emails / names; truncate before storage.
 */

export function trimDocuSignConnectForStorage(parsed: Record<string, unknown>): Prisma.InputJsonValue {
  const data = parsed.data && typeof parsed.data === "object" ? (parsed.data as Record<string, unknown>) : null;
  const trimmedData: Record<string, Prisma.InputJsonValue | undefined> = {};

  if (data) {
    if (typeof data.envelopeId === "string") trimmedData.envelopeId = data.envelopeId;
    if (data.envelopeSummary && typeof data.envelopeSummary === "object") {
      const es = data.envelopeSummary as Record<string, unknown>;
      const summary: Record<string, Prisma.InputJsonValue | undefined> = {};
      if (typeof es.envelopeId === "string") summary.envelopeId = es.envelopeId;
      if (typeof es.status === "string") summary.status = es.status;
      if (typeof es.emailSubject === "string") summary.emailSubject = es.emailSubject;
      trimmedData.envelopeSummary = summary as unknown as Prisma.InputJsonValue;
    }
    if (data.envelope && typeof data.envelope === "object") {
      const ev = data.envelope as Record<string, unknown>;
      const envelope: Record<string, Prisma.InputJsonValue | undefined> = {};
      if (typeof ev.envelopeId === "string") envelope.envelopeId = ev.envelopeId;
      if (typeof ev.status === "string") envelope.status = ev.status;
      trimmedData.envelope = envelope as unknown as Prisma.InputJsonValue;
    }
  }

  return {
    event: parsed.event ?? null,
    generatedDateTime: parsed.generatedDateTime ?? null,
    apiVersion: parsed.apiVersion ?? null,
    retryCount: parsed.retryCount ?? null,
    configurationId: parsed.configurationId ?? null,
    uri: parsed.uri ?? null,
    data: trimmedData as Prisma.InputJsonValue,
  };
}

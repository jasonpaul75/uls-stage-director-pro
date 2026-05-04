/** Parse DocuSign Connect JSON SIM payloads (subset of fields varies by tenant config — we read common paths). */

export type ParsedDocuSignConnectEnvelope = {
  envelopeId?: string;
  envelopeStatusRaw?: string;
  event?: string;
  generatedDateTime?: string;
};

export function extractConnectEnvelopeFields(parsed: unknown): ParsedDocuSignConnectEnvelope | null {
  if (!parsed || typeof parsed !== "object") return null;
  const root = parsed as Record<string, unknown>;

  const event = typeof root.event === "string" ? root.event : undefined;
  const generatedDateTime =
    typeof root.generatedDateTime === "string" ? root.generatedDateTime : undefined;

  const data = root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : null;

  let envelopeId: string | undefined;
  let envelopeStatusRaw: string | undefined;

  if (data) {
    if (typeof data.envelopeId === "string") envelopeId = data.envelopeId;
    const summary = data.envelopeSummary && typeof data.envelopeSummary === "object" ? data.envelopeSummary : null;
    if (summary && typeof summary === "object") {
      const es = summary as Record<string, unknown>;
      if (typeof es.envelopeId === "string") envelopeId = envelopeId ?? es.envelopeId;
      if (typeof es.status === "string") envelopeStatusRaw = es.status;
    }

    const env = data.envelope && typeof data.envelope === "object" ? (data.envelope as Record<string, unknown>) : null;
    if (env) {
      if (typeof env.envelopeId === "string") envelopeId = envelopeId ?? env.envelopeId;
      if (typeof env.status === "string") envelopeStatusRaw = envelopeStatusRaw ?? env.status;
    }
  }

  return {
    envelopeId,
    envelopeStatusRaw,
    event,
    generatedDateTime,
  };
}

function inferEnvelopeStatusLowerFromEvent(eventLower: string): string | null {
  switch (eventLower) {
    case "envelope-completed":
      return "completed";
    case "envelope-declined":
      return "declined";
    case "envelope-voided":
      return "voided";
    case "envelope-deleted":
      return "deleted";
    case "envelope-sent":
      return "sent";
    case "envelope-delivered":
      return "delivered";
    case "recipient-completed":
    case "recipient-signed":
      return "signed"; // signer finished at least once; webhook may precede envelope-completed
    default:
      return null;
  }
}

/** Returns normalized lowercase status suitable for caching in DB UI. */

export function resolveTrackedEnvelopeStatus(
  parsedEvent: ParsedDocuSignConnectEnvelope | null,
): string | undefined {
  if (!parsedEvent) return undefined;
  const fromSummary = parsedEvent.envelopeStatusRaw?.trim().toLowerCase();
  if (fromSummary && fromSummary.length > 0) return fromSummary;
  const ev = parsedEvent.event?.trim().toLowerCase();
  if (!ev) return undefined;
  return inferEnvelopeStatusLowerFromEvent(ev) ?? undefined;
}

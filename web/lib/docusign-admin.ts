export function docuSignConnectHmacSecretConfigured(): boolean {
  return Boolean(process.env.DOCUSIGN_CONNECT_HMAC_SECRET?.trim());
}

/** When true, sender console links target demo (account-d) apps host. */

export function docuSignUseDemoConsole(): boolean {
  const v = process.env.DOCUSIGN_USE_DEMO?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** DocuSign web / send console deep link by envelope GUID (producer view). */

export function docuSignProducerConsoleEnvelopeUrl(envelopeId: string): string {
  const host = docuSignUseDemoConsole()
    ? "https://apps-d.docusign.com"
    : "https://apps.docusign.com";
  return `${host}/send/documents/details/${encodeURIComponent(envelopeId)}`;
}

const ENVELOPE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** RFC 4122 “sample” UUID printed in specs — DocuSign will never POST for this. */
export const DOCUSIGN_RFC_DOCUMENTATION_SAMPLE_ENVELOPE_ID =
  "550e8400-e29b-41d4-a716-446655440000";

/** DocuSign envelope IDs are hex; lowercase avoids casing-only duplicates vs Connect payloads. */
export function normalizeDocuSignEnvelopeId(raw: string): string {
  return raw.trim().toLowerCase();
}

export function envelopeIdLooksValid(guid: string): boolean {
  const t = guid.trim();
  if (t.toLowerCase() === DOCUSIGN_RFC_DOCUMENTATION_SAMPLE_ENVELOPE_ID.toLowerCase()) {
    return false;
  }
  return ENVELOPE_ID_RE.test(t);
}

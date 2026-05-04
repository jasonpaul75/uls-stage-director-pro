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

export function envelopeIdLooksValid(guid: string): boolean {
  return ENVELOPE_ID_RE.test(guid.trim());
}

import { createHash, createHmac, timingSafeEqual } from "crypto";

/** First signature header DocuSign uses for Connect HMAC (case-insensitive). */

export function headerDocuSignConnectSignature(headers: Headers): string | null {
  for (const [key, val] of headers.entries()) {
    if (key.toLowerCase() === "x-docusign-signature-1" && typeof val === "string" && val.trim()) {
      return val.trim();
    }
  }
  return null;
}

/**
 * Validates Connect HMAC: same secret configured in DocuSign Connect (“Basic HMAC” / signature 1).
 * Body must be raw POST text (exact bytes Stripe-style).
 */

export function docuSignConnectHmacMatchesBody(secret: string, rawBodyUtf8: string, signatureHeader: string): boolean {
  const theirs = Buffer.from(signatureHeader.trim(), "base64");
  if (theirs.length === 0 || secret.length === 0) return false;

  const ours = createHmac("sha256", secret).update(rawBodyUtf8, "utf8").digest();

  return theirs.length === ours.length && timingSafeEqual(theirs, ours);
}

/** SHA-256 hex of raw body — idempotent inbound row keyed on full payload digest. */

export function sha256HexUtf8(rawBodyUtf8: string): string {
  return createHash("sha256").update(rawBodyUtf8, "utf8").digest("hex");
}

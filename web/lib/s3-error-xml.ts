/**
 * Best-effort parse of AWS S3 REST error responses (single top-level `<Error>` envelope).
 */
export function parseAmazonS3ErrorXml(body: string): { code?: string; message?: string } {
  const trimmed = body.trim();
  if (!trimmed.startsWith("<") || !trimmed.includes("<Error")) {
    return {};
  }
  const codeMatch = /<Code>\s*([^<]+)\s*<\/Code>/i.exec(trimmed);
  const msgMatch = /<Message>\s*([^<]+)\s*<\/Message>/i.exec(trimmed);
  return {
    code: codeMatch?.[1]?.trim(),
    message: msgMatch?.[1]?.trim(),
  };
}

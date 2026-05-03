/** Lowercase trimmed email suitable for lookups and uniqueness. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Shared https-only URL guard for producer input and director-facing link rendering. */

const MAX_URL_CHARS = 2048;

export function parseHttpsUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (t.length > MAX_URL_CHARS) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

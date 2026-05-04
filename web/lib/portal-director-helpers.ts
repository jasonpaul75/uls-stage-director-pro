/** Heuristic: envelope still needs signer / counterparty attention (mirrored status string, lowercase). */

export function directorDocuSignLikelyNeedsAction(statusRaw: string): boolean {
  const s = statusRaw.trim().toLowerCase();
  if (!s || s === "unknown") return true;
  const settled = new Set(["completed", "voided", "declined", "deleted"]);
  return !settled.has(s);
}

import { createHash, randomBytes } from "crypto";

/** Opaque URL-safe invitation token (64 hex chars); never store raw token in DB. */
export function createInviteOpaqueToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashInviteToken(opaqueToken: string): string {
  return createHash("sha256").update(opaqueToken, "utf8").digest("hex");
}

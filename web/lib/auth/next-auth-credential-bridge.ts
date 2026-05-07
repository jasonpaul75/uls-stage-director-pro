import type { GlobalRole } from "@prisma/client";

/** Mirrors credential sign-in payload onto JWT fields (called from NextAuth `jwt`). */
export function mergeCredentialsIntoJwt(
  token: { sub?: string; globalRole?: unknown },
  user?: { id?: string | null; globalRole?: GlobalRole | null } | null,
): void {
  if (!user?.id || user.globalRole == null) return;
  token.sub = user.id;
  token.globalRole = user.globalRole;
}

/** Mirrors JWT onto `session.user` (called from NextAuth `session`). */
export function mergeJwtIntoSession(
  session: { user?: { id?: string; globalRole?: GlobalRole | undefined } },
  token: { sub?: string; globalRole?: unknown },
): void {
  if (!session.user || !token.sub) return;
  session.user.id = token.sub;
  session.user.globalRole = token.globalRole as GlobalRole | undefined;
}

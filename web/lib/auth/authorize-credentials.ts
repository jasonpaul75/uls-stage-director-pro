import { GlobalRole } from "@prisma/client";
import { compareSync } from "bcryptjs";

import { directorHasActivePortalMembership } from "@/lib/director-portal-signin-gate";
import { prisma } from "@/lib/prisma";

import { DirectorPortalAccessEndedSignin } from "./director-portal-access-ended-signin";

export type AuthorizedUserPayload = {
  id: string;
  email: string | null;
  name?: string;
  globalRole: GlobalRole;
};

/** Shared by NextAuth credentials provider — keep login rules in one testable unit. */
export async function authorizeCredentials(
  email: unknown,
  password: unknown,
): Promise<AuthorizedUserPayload | null> {
  if (typeof email !== "string" || typeof password !== "string") return null;

  const user = await prisma.user.findUnique({ where: { email: email.trim() } });
  if (!user?.passwordHash) return null;
  if (user.disabledAt != null) return null;
  if (!compareSync(password, user.passwordHash)) return null;

  if (user.globalRole === GlobalRole.DIRECTOR) {
    const allowed = await directorHasActivePortalMembership(user.id);
    if (!allowed) throw new DirectorPortalAccessEndedSignin();
  }
  // STAFF / PRODUCER / ULS_ADMIN — no director portal gate.

  return {
    id: user.id,
    email: user.email,
    name: user.name ?? undefined,
    globalRole: user.globalRole,
  };
}

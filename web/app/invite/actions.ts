"use server";

import { hashSync } from "bcryptjs";
import { redirect } from "next/navigation";

import { hashInviteToken } from "@/lib/invite-token";
import { prisma } from "@/lib/prisma";
import { GlobalRole, ProjectRole } from "@prisma/client";

const TOKEN_RE = /^[a-f0-9]{64}$/;
const MIN_PASSWORD = 10;

export type InviteAcceptResult =
  | { ok: true; emailForSignIn: string }
  | { ok: false; message: string };

type InviteLookup =
  | null
  | { id: string; email: string; projectId: string; expiresAt: Date; status: "expired" }
  | { id: string; email: string; projectId: string; expiresAt: Date; status: "active" };

async function inviteForToken(rawToken: string): Promise<InviteLookup> {
  if (!TOKEN_RE.test(rawToken)) return null;

  const tokenHash = hashInviteToken(rawToken);
  const invite = await prisma.directorInvite.findFirst({
    where: {
      tokenHash,
      consumedAt: null,
    },
    select: {
      id: true,
      email: true,
      projectId: true,
      expiresAt: true,
    },
  });

  if (!invite) return null;
  if (invite.expiresAt.getTime() <= Date.now()) {
    return { ...invite, status: "expired" };
  }
  return { ...invite, status: "active" };
}

/** Existing director joins project from invite token (proof of inbox); redirects to login. */
export async function acceptInviteExistingDirector(formData: FormData) {
  const rawToken = String(formData.get("token") ?? "").trim();

  const row = await inviteForToken(rawToken);
  if (!row || row.status !== "active") {
    redirect("/invite/invalid");
  }

  const user = await prisma.user.findUnique({
    where: { email: row.email },
    select: { id: true, globalRole: true },
  });

  if (
    !user ||
    (user.globalRole !== GlobalRole.DIRECTOR && user.globalRole !== GlobalRole.ULS_ADMIN)
  ) {
    redirect(`/invite/${rawToken}?error=mismatch`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.projectMember.upsert({
      where: {
        projectId_userId: { projectId: row.projectId, userId: user.id },
      },
      create: {
        projectId: row.projectId,
        userId: user.id,
        role: ProjectRole.DIRECTOR,
      },
      update: {},
    });

    await tx.directorInvite.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    });
  });

  redirect(
    `/login?joined=1&callbackUrl=${encodeURIComponent("/portal")}&prefill=${encodeURIComponent(row.email)}`,
  );
}

/** New director creates password and account; caller signs in on the client. */
export async function acceptInviteNewDirectorAccount(formData: FormData): Promise<InviteAcceptResult> {
  const rawToken = String(formData.get("token") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim() || undefined;
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const row = await inviteForToken(rawToken);
  if (!row || row.status !== "active") {
    return {
      ok: false,
      message:
        row?.status === "expired"
          ? "This invite has expired."
          : "This invite link is no longer valid.",
    };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: row.email },
    select: { id: true, globalRole: true },
  });

  if (
    existingUser?.globalRole === GlobalRole.DIRECTOR ||
    existingUser?.globalRole === GlobalRole.ULS_ADMIN
  ) {
    return {
      ok: false,
      message:
        "That email already has an account — use “Join production & sign in” above instead.",
    };
  }

  if (existingUser) {
    return {
      ok: false,
      message: "That email belongs to an internal/production account — use another address.",
    };
  }

  if (!password || password.length < MIN_PASSWORD) {
    return { ok: false, message: `Password must be at least ${MIN_PASSWORD} characters.` };
  }

  if (password !== confirm) {
    return { ok: false, message: "Passwords do not match." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: row.email,
          name,
          passwordHash: hashSync(password, 12),
          globalRole: GlobalRole.DIRECTOR,
        },
      });

      await tx.projectMember.create({
        data: {
          projectId: row.projectId,
          userId: user.id,
          role: ProjectRole.DIRECTOR,
        },
      });

      await tx.directorInvite.update({
        where: { id: row.id },
        data: { consumedAt: new Date() },
      });
    });

    return { ok: true, emailForSignIn: row.email };
  } catch {
    return { ok: false, message: "Something went wrong. Try again or ask for a new invite." };
  }
}

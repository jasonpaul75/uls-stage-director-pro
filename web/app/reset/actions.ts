"use server";

import { hashSync } from "bcryptjs";

import { hashInviteToken } from "@/lib/invite-token";
import { prisma } from "@/lib/prisma";

const TOKEN_RE = /^[a-f0-9]{64}$/;
const MIN_PASSWORD = 10;

export type ResetPasswordResult =
  | { ok: true; emailForSignIn: string }
  | { ok: false; message: string };

export async function submitPasswordReset(formData: FormData): Promise<ResetPasswordResult> {
  const rawToken = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!TOKEN_RE.test(rawToken)) {
    return { ok: false, message: "Invalid reset link." };
  }

  const tokenHash = hashInviteToken(rawToken);
  const row = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true, userId: true },
  });

  if (!row) {
    return { ok: false, message: "This reset link expired or was already used. Request a new one from sign-in." };
  }

  if (!password || password.length < MIN_PASSWORD) {
    return { ok: false, message: `Choose a password of at least ${MIN_PASSWORD} characters.` };
  }

  if (password !== confirm) {
    return { ok: false, message: "Passwords do not match." };
  }

  const userEmail = await prisma.user.findUnique({
    where: { id: row.userId },
    select: { email: true },
  });

  if (!userEmail?.email) {
    return { ok: false, message: "Something went wrong. Request a fresh reset email." };
  }

  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: row.userId },
        data: { passwordHash: hashSync(password, 12) },
      }),
      prisma.passwordResetToken.update({
        where: { id: row.id },
        data: { consumedAt: new Date() },
      }),
    ]);

    return { ok: true, emailForSignIn: userEmail.email };
  } catch {
    return { ok: false, message: "Could not reset password right now." };
  }
}
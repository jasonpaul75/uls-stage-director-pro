"use server";

import { redirect } from "next/navigation";

import { sendPasswordResetEmail } from "@/lib/email/send-password-reset";
import { normalizeEmail } from "@/lib/email/normalize-email";
import { prisma } from "@/lib/prisma";
import { createInviteOpaqueToken, hashInviteToken } from "@/lib/invite-token";

const RESET_HOURS = 1;

function invalidEmailShape(raw: string): boolean {
  if (raw.length < 5 || raw.length > 254) return true;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return true;
  return false;
}

export async function requestPasswordReset(formData: FormData) {
  const emailRaw = String(formData.get("email") ?? "").trim();
  const email = normalizeEmail(emailRaw);

  if (!email || invalidEmailShape(email)) {
    redirect("/login/forgot-password?sent=1");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  if (!user?.passwordHash) {
    redirect("/login/forgot-password?sent=1");
  }

  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id, consumedAt: null },
  });

  const opaque = createInviteOpaqueToken();
  const tokenHash = hashInviteToken(opaque);

  let row;
  try {
    row = await prisma.passwordResetToken.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt: new Date(Date.now() + RESET_HOURS * 3600_000),
      },
      select: { id: true },
    });
  } catch {
    redirect("/login/forgot-password?err=server");
  }

  const baseUrl = (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const resetUrl = `${baseUrl}/reset/${opaque}`;
  const sent = await sendPasswordResetEmail({
    toEmail: email,
    resetUrl,
  });

  if (!sent) {
    await prisma.passwordResetToken.delete({ where: { id: row.id } }).catch(() => {});
    redirect("/login/forgot-password?err=mail");
  }

  redirect("/login/forgot-password?sent=1");
}

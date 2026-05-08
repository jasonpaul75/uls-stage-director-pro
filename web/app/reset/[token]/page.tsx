import Link from "next/link";
import { redirect } from "next/navigation";

import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { PublicAuthChrome } from "@/components/public-auth-chrome";
import { publicHeaderTrailingClassName } from "@/components/public-minimal-header";

import { ResetPasswordForm } from "./reset-password-form";
import { hashInviteToken } from "@/lib/invite-token";
import { prisma } from "@/lib/prisma";

const TOKEN_RE = /^[a-f0-9]{64}$/;

type Props = {
  params: Promise<{ token: string }>;
};

export default async function ResetPasswordPage(props: Props) {
  const { token: rawToken } = await props.params;

  if (!TOKEN_RE.test(rawToken)) {
    redirect("/reset/invalid");
  }

  const tokenHash = hashInviteToken(rawToken);
  const row = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { expiresAt: true },
  });

  if (!row) {
    redirect("/reset/invalid");
  }

  return (
    <PublicAuthChrome headerTrailing={<Link href="/" className={publicHeaderTrailingClassName}>Home</Link>}>
      <ProducerGlassCard as="div" className="mx-auto w-full max-w-md">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-uls-accent">ULS Stage Director PRO</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-uls-text">Set a new password</h1>

        <p className="mt-3 text-sm text-uls-muted">
          Links stop working once used or after about an hour. After saving, we&apos;ll sign you in when possible.
        </p>

        <ResetPasswordForm token={rawToken} />

        <p className="mt-8 text-center text-xs text-uls-muted">
          <Link href="/login" className="text-uls-subtle hover:text-uls-accent">
            Back to sign in
          </Link>
        </p>
      </ProducerGlassCard>
    </PublicAuthChrome>
  );
}

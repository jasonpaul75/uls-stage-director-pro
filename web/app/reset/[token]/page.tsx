import Link from "next/link";
import { redirect } from "next/navigation";

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
    },
    select: { expiresAt: true },
  });

  if (!row || row.expiresAt.getTime() <= Date.now()) {
    redirect("/reset/invalid");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-black px-6 text-neutral-50">
      <p className="text-sm uppercase tracking-widest text-amber-500">ULS Stage Director PRO</p>
      <h1 className="mt-2 text-2xl font-semibold">Set a new password</h1>

      <p className="mt-3 text-sm text-neutral-400">
        Links stop working once used or after about an hour. After saving, we&apos;ll sign you in when possible.
      </p>

      <ResetPasswordForm token={rawToken} />

      <p className="mt-8 text-center text-xs text-neutral-600">
        <Link href="/login" className="text-neutral-400 hover:text-amber-400">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}

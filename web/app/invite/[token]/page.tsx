import Link from "next/link";
import { redirect } from "next/navigation";

import { InviteAcceptForms } from "./invite-accept-forms";
import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { PublicAuthChrome } from "@/components/public-auth-chrome";
import { publicHeaderTrailingClassName } from "@/components/public-minimal-header";
import { hashInviteToken } from "@/lib/invite-token";
import { prisma } from "@/lib/prisma";
import { GlobalRole } from "@prisma/client";

const TOKEN_RE = /^[a-f0-9]{64}$/;

type Props = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ error?: string }>;
};

export default async function InviteLandingPage(props: Props) {
  const { token: rawToken } = await props.params;
  const sp = (await props.searchParams) ?? {};

  if (!TOKEN_RE.test(rawToken)) {
    redirect("/invite/invalid");
  }

  const tokenHash = hashInviteToken(rawToken);
  const invite = await prisma.directorInvite.findFirst({
    where: {
      tokenHash,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      email: true,
      expiresAt: true,
      projectId: true,
    },
  });

  if (!invite) {
    redirect("/invite/invalid");
  }

  const project = await prisma.project.findUnique({
    where: { id: invite.projectId },
    select: { name: true },
  });

  const projectName = project?.name ?? "this production";

  const existingUser = await prisma.user.findUnique({
    where: { email: invite.email },
    select: { globalRole: true },
  });

  const existingDirectorFlow =
    existingUser?.globalRole === GlobalRole.DIRECTOR || existingUser?.globalRole === GlobalRole.ULS_ADMIN;

  return (
    <PublicAuthChrome headerTrailing={<Link href="/" className={publicHeaderTrailingClassName}>Home</Link>}>
      <ProducerGlassCard as="div" className="mx-auto w-full max-w-md">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-uls-accent">ULS Stage Director PRO</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-uls-text">Join {projectName}</h1>

        <p className="mt-3 text-sm text-uls-muted">
          Invite for <span className="font-medium text-uls-text">{invite.email}</span>
        </p>

        {sp.error === "mismatch" ? (
          <p role="alert" className="mt-4 rounded-xl border border-rose-500/25 bg-rose-950/20 px-3 py-2 text-sm text-rose-100">
            This invite doesn&apos;t match the account path you started. Ask ULS for a new invite if you&apos;re
            unsure.
          </p>
        ) : null}

        <InviteAcceptForms token={rawToken} existingDirectorFlow={!!existingDirectorFlow} />

        <p className="mt-8 text-center text-xs text-uls-muted">
          <Link href="/login" className="text-uls-subtle hover:text-uls-accent">
            Already logged in elsewhere? Sign in
          </Link>
        </p>
      </ProducerGlassCard>
    </PublicAuthChrome>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";

import { InviteAcceptForms } from "./invite-accept-forms";
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
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-black px-6 text-neutral-50">
      <p className="text-sm uppercase tracking-widest text-amber-500">ULS Stage Director PRO</p>
      <h1 className="mt-2 text-2xl font-semibold">Join {projectName}</h1>

      <p className="mt-3 text-sm text-neutral-400">
        Invite for <span className="font-medium text-neutral-200">{invite.email}</span>
      </p>

      {sp.error === "mismatch" ? (
        <p className="mt-4 rounded border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          This invite doesn&apos;t match the account path you started. Ask ULS for a new invite if you&apos;re unsure.
        </p>
      ) : null}

      <InviteAcceptForms token={rawToken} existingDirectorFlow={!!existingDirectorFlow} />

      <p className="mt-8 text-center text-xs text-neutral-600">
        <Link href="/login" className="text-neutral-400 hover:text-amber-400">
          Already logged in elsewhere? Sign in
        </Link>
      </p>
    </main>
  );
}

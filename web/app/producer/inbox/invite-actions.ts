"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { sendDirectorInviteEmail } from "@/lib/email/send-director-invite";
import { normalizeEmail } from "@/lib/email/normalize-email";
import { createInviteOpaqueToken, hashInviteToken } from "@/lib/invite-token";
import { prisma } from "@/lib/prisma";
import { GlobalRole, ProjectRole, ProjectStatus } from "@prisma/client";

function canProduce(role: GlobalRole | undefined): boolean {
  return role === GlobalRole.PRODUCER || role === GlobalRole.ULS_ADMIN;
}

function invalidEmailShape(raw: string): boolean {
  if (raw.length < 5 || raw.length > 254) return true;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return true;
  return false;
}

const INVITE_DAYS = 7;

type InviteContext = {
  producerId: string;
  projectId: string;
  email: string;
  projectName: string;
};

/** Shared validation for send + resend; redirects on eligibility failure or auth failure. */
async function validatedDirectorInviteContext(formData: FormData): Promise<InviteContext> {
  const session = await auth();
  const role = session?.user?.globalRole as GlobalRole | undefined;
  if (!session?.user?.id || !canProduce(role)) {
    redirect("/login?callbackUrl=/producer/inbox");
  }

  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!projectId) redirect("/producer/inbox");

  const emailRaw = String(formData.get("directorEmail") ?? "").trim();
  if (!emailRaw) redirect(`/producer/inbox/${projectId}?invite_err=missing_email`);

  const email = normalizeEmail(emailRaw);
  if (invalidEmailShape(email)) {
    redirect(`/producer/inbox/${projectId}?invite_err=bad_email`);
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, status: ProjectStatus.INTAKE_SUBMITTED },
    select: { id: true, name: true },
  });

  if (!project) redirect("/producer/inbox?invite_err=invalid_project");

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      globalRole: true,
      memberships: {
        where: { projectId, role: ProjectRole.DIRECTOR },
        select: { id: true },
      },
    },
  });

  if (existingUser?.memberships?.length) {
    redirect(`/producer/inbox/${projectId}?invite_err=already_member`);
  }

  if (existingUser && existingUser.globalRole !== GlobalRole.DIRECTOR) {
    redirect(`/producer/inbox/${projectId}?invite_err=producer_account`);
  }

  return {
    producerId: session.user.id,
    projectId: project.id,
    email,
    projectName: project.name,
  };
}

async function finalizeDirectorInviteDeliver(
  ctx: InviteContext,
  successFlag: "sent" | "resend",
): Promise<never> {
  const opaque = createInviteOpaqueToken();
  const tokenHash = hashInviteToken(opaque);

  let inviteRow;
  try {
    inviteRow = await prisma.directorInvite.create({
      data: {
        email: ctx.email,
        tokenHash,
        projectId: ctx.projectId,
        invitedByUserId: ctx.producerId,
        expiresAt: new Date(Date.now() + INVITE_DAYS * 86400_000),
      },
      select: { id: true },
    });
  } catch {
    redirect(`/producer/inbox/${ctx.projectId}?invite_err=server`);
  }

  const baseUrl = (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const inviteUrl = `${baseUrl}/invite/${opaque}`;

  const sent = await sendDirectorInviteEmail({
    toEmail: ctx.email,
    projectName: ctx.projectName,
    inviteUrl,
  });

  if (!sent) {
    await prisma.directorInvite.delete({ where: { id: inviteRow.id } }).catch(() => {});
    redirect(`/producer/inbox/${ctx.projectId}?invite_err=mail_failed`);
  }

  revalidatePath(`/producer/inbox/${ctx.projectId}`);
  const q =
    successFlag === "resend"
      ? "invite_sent=1&invite_resend=1"
      : "invite_sent=1";
  redirect(`/producer/inbox/${ctx.projectId}?${q}`);
}

export async function sendDirectorInvite(formData: FormData) {
  const ctx = await validatedDirectorInviteContext(formData);
  return finalizeDirectorInviteDeliver(ctx, "sent");
}

export async function resendDirectorInvite(formData: FormData) {
  const ctx = await validatedDirectorInviteContext(formData);

  await prisma.directorInvite.deleteMany({
    where: {
      projectId: ctx.projectId,
      email: ctx.email,
      consumedAt: null,
    },
  });

  return finalizeDirectorInviteDeliver(ctx, "resend");
}

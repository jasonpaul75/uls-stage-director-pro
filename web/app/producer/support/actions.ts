"use server";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  revalidateProducerOverview,
  revalidateProducerSupportTicketDetail,
  revalidateProjectMirrorCache,
  revalidateSupportQueues,
} from "@/lib/revalidate-project-mirror-cache";
import { GlobalRole, SupportTicketStatus } from "@prisma/client";

function canProduce(role: GlobalRole | undefined): boolean {
  return role === GlobalRole.PRODUCER || role === GlobalRole.ULS_ADMIN;
}

function trimLen(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? t.slice(0, max) : t;
}

export async function saveProducerSupportReply(formData: FormData) {
  const session = await auth();
  const role = session?.user?.globalRole as GlobalRole | undefined;
  if (!session?.user?.id || !canProduce(role)) {
    redirect("/login?callbackUrl=/producer/support");
  }

  const ticketId = String(formData.get("ticketId") ?? "").trim();
  const reply = trimLen(String(formData.get("producerReply") ?? ""), 8000);
  if (!ticketId || !reply) {
    redirect(
      ticketId ? `/producer/support/${ticketId}?err=required` : "/producer/support?err=required",
    );
  }

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, projectId: true },
  });
  if (!ticket) redirect("/producer/support");

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { producerReply: reply },
  });

  revalidateProducerSupportTicketDetail(ticketId);
  revalidateSupportQueues(ticket.projectId);
  revalidateProducerOverview();
  revalidateProjectMirrorCache(ticket.projectId);
  redirect(`/producer/support/${ticketId}?saved=1`);
}

export async function resolveSupportTicketProducer(formData: FormData) {
  const session = await auth();
  const role = session?.user?.globalRole as GlobalRole | undefined;
  if (!session?.user?.id || !canProduce(role)) {
    redirect("/login?callbackUrl=/producer/support");
  }

  const ticketId = String(formData.get("ticketId") ?? "").trim();
  if (!ticketId) redirect("/producer/support");

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, projectId: true },
  });
  if (!ticket) redirect("/producer/support");

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      status: SupportTicketStatus.RESOLVED,
      resolvedAt: new Date(),
    },
  });

  revalidateProducerSupportTicketDetail(ticketId);
  revalidateSupportQueues(ticket.projectId);
  revalidateProducerOverview();
  revalidateProjectMirrorCache(ticket.projectId);
  redirect(`/producer/support/${ticketId}?resolved=1`);
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { saveProducerSupportReply, resolveSupportTicketProducer } from "../actions";
import { AppShell, Button, buttonClassName } from "@/components/ui";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GlobalRole, SupportTicketStatus } from "@prisma/client";

type Props = {
  params: Promise<{ ticketId: string }>;
  searchParams?: Promise<{ saved?: string; resolved?: string; err?: string }>;
};

const fieldClass =
  "rounded-md border border-uls-border-strong bg-uls-surface-inset px-3 py-2 text-sm text-uls-text placeholder:text-uls-subtle";

export default async function ProducerSupportTicketDetailPage(props: Props) {
  const { ticketId } = await props.params;
  const sp = (await props.searchParams) ?? {};

  const session = await auth();
  const role = session?.user?.globalRole;
  if (!session?.user?.id || (role !== GlobalRole.PRODUCER && role !== GlobalRole.ULS_ADMIN)) {
    redirect("/login?callbackUrl=/producer/support");
  }

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      project: { select: { id: true, name: true } },
      createdBy: { select: { email: true, name: true } },
    },
  });

  if (!ticket) notFound();

  const isOpen = ticket.status === SupportTicketStatus.OPEN;

  return (
    <AppShell id="producer-main-content" outerMaxWidth="wide" contentMaxWidth="full" className="pt-10">
      <nav className="mb-6 text-sm text-uls-muted">
        <Link href="/producer/support" className={buttonClassName("link", "sm")}>
          ← Support queue
        </Link>
      </nav>

      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-uls-subtle">Ticket</p>
        <h1 className="text-pretty text-3xl font-semibold tracking-tight text-uls-text md:text-[2rem]">{ticket.subject}</h1>
        <p className="max-w-prose text-sm leading-relaxed text-uls-muted">
          <Link
            href={`/producer/inbox/${ticket.project.id}`}
            className="text-uls-text underline-offset-2 hover:text-uls-accent hover:underline"
          >
            {ticket.project.name}
          </Link>
          {" · "}
          {(ticket.createdBy.name ?? "").trim() || ticket.createdBy.email}
          {" · "}
          {ticket.createdAt.toLocaleString()}
          {" · "}
          <span className={isOpen ? "font-medium text-uls-accent-strong" : "text-uls-subtle"}>
            {isOpen ? "Open" : "Resolved"}
          </span>
        </p>
      </header>

      {sp.saved === "1" ? (
        <ProducerGlassCard padding="compact" className="mt-6 border-emerald-500/25 bg-emerald-950/25">
          <p role="status" className="text-sm text-emerald-100">
            Reply saved — visible to the director on the production support page.
          </p>
        </ProducerGlassCard>
      ) : null}
      {sp.resolved === "1" ? (
        <ProducerGlassCard padding="compact" className="mt-6 border-emerald-500/25 bg-emerald-950/25">
          <p role="status" className="text-sm text-emerald-100">Marked resolved.</p>
        </ProducerGlassCard>
      ) : null}
      {sp.err === "required" ? (
        <ProducerGlassCard padding="compact" className="mt-6 border-rose-500/25 bg-rose-950/25">
          <p role="alert" className="text-sm text-rose-100">Enter a reply before saving.</p>
        </ProducerGlassCard>
      ) : null}

      <ProducerGlassCard className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-uls-subtle">Director message</h2>
        <pre className="mt-2 whitespace-pre-wrap text-sm text-uls-text">{ticket.body}</pre>
      </ProducerGlassCard>

      {ticket.producerReply ? (
        <ProducerGlassCard className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-uls-subtle">Your reply (visible to director)</h2>
          <pre className="mt-2 whitespace-pre-wrap text-sm text-uls-text">{ticket.producerReply}</pre>
        </ProducerGlassCard>
      ) : null}

      {isOpen ? (
        <ProducerGlassCard className="mt-8 space-y-6">
          <form action={saveProducerSupportReply} className="flex flex-col gap-3">
            <input type="hidden" name="ticketId" value={ticket.id} />
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-uls-muted">{ticket.producerReply ? "Update reply" : "Reply"}</span>
              <textarea
                name="producerReply"
                rows={5}
                required
                maxLength={8000}
                defaultValue={ticket.producerReply ?? ""}
                placeholder="Response shown to the director in the portal…"
                className={fieldClass}
              />
            </label>
            <Button type="submit" variant="primary" size="sm" className="w-fit">
              Save reply
            </Button>
          </form>

          <form action={resolveSupportTicketProducer}>
            <input type="hidden" name="ticketId" value={ticket.id} />
            <button
              type="submit"
              className="text-sm font-medium text-uls-subtle underline-offset-2 hover:text-uls-text hover:underline"
            >
              Mark resolved
            </button>
            <p className="mt-1 text-xs text-uls-subtle">
              Directors can still read the thread after resolve; use when no further action is needed.
            </p>
          </form>
        </ProducerGlassCard>
      ) : (
        ticket.resolvedAt && (
          <p className="mt-8 text-xs text-uls-subtle">Resolved {ticket.resolvedAt.toLocaleString()}</p>
        )
      )}
    </AppShell>
  );
}

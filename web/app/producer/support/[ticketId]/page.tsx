import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { saveProducerSupportReply, resolveSupportTicketProducer } from "../actions";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GlobalRole, SupportTicketStatus } from "@prisma/client";

type Props = {
  params: Promise<{ ticketId: string }>;
  searchParams?: Promise<{ saved?: string; resolved?: string; err?: string }>;
};

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
    <main className="mx-auto max-w-3xl p-8">
      <nav className="text-sm text-zinc-500">
        <Link href="/producer/support" className="text-amber-500 hover:text-amber-400">
          ← Support queue
        </Link>
      </nav>

      <p className="mt-6 text-sm uppercase tracking-widest text-amber-500">Ticket</p>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-100">{ticket.subject}</h1>
      <p className="mt-2 text-sm text-zinc-500">
        <Link
          href={`/producer/inbox/${ticket.project.id}`}
          className="text-zinc-400 underline-offset-2 hover:text-amber-400 hover:underline"
        >
          {ticket.project.name}
        </Link>
        {" · "}
        {(ticket.createdBy.name ?? "").trim() || ticket.createdBy.email}
        {" · "}
        {ticket.createdAt.toLocaleString()}
        {" · "}
        <span className={isOpen ? "text-amber-400" : "text-zinc-500"}>
          {isOpen ? "Open" : "Resolved"}
        </span>
      </p>

      {sp.saved === "1" ? (
        <p className="mt-4 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Reply saved — visible to the director on the production support page.
        </p>
      ) : null}
      {sp.resolved === "1" ? (
        <p className="mt-4 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Marked resolved.
        </p>
      ) : null}
      {sp.err === "required" ? (
        <p className="mt-4 rounded border border-rose-900/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-100">
          Enter a reply before saving.
        </p>
      ) : null}

      <section className="mt-8">
        <h2 className="text-xs uppercase tracking-wide text-zinc-500">Director message</h2>
        <pre className="mt-2 whitespace-pre-wrap rounded border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-zinc-200">
          {ticket.body}
        </pre>
      </section>

      {ticket.producerReply ? (
        <section className="mt-8">
          <h2 className="text-xs uppercase tracking-wide text-zinc-500">Your reply (visible to director)</h2>
          <pre className="mt-2 whitespace-pre-wrap rounded border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-zinc-200">
            {ticket.producerReply}
          </pre>
        </section>
      ) : null}

      {isOpen ? (
        <div className="mt-10 space-y-6">
          <form action={saveProducerSupportReply} className="flex flex-col gap-3">
            <input type="hidden" name="ticketId" value={ticket.id} />
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-400">{ticket.producerReply ? "Update reply" : "Reply"}</span>
              <textarea
                name="producerReply"
                rows={5}
                required
                maxLength={8000}
                defaultValue={ticket.producerReply ?? ""}
                placeholder="Response shown to the director in the portal…"
                className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
              />
            </label>
            <button
              type="submit"
              className="w-fit rounded bg-amber-600 px-4 py-2 text-sm font-medium text-black hover:bg-amber-500"
            >
              Save reply
            </button>
          </form>

          <form action={resolveSupportTicketProducer}>
            <input type="hidden" name="ticketId" value={ticket.id} />
            <button
              type="submit"
              className="text-sm font-medium text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
            >
              Mark resolved
            </button>
            <p className="mt-1 text-xs text-zinc-600">
              Directors can still read the thread after resolve; use when no further action is needed.
            </p>
          </form>
        </div>
      ) : (
        ticket.resolvedAt && (
          <p className="mt-8 text-xs text-zinc-600">
            Resolved {ticket.resolvedAt.toLocaleString()}
          </p>
        )
      )}
    </main>
  );
}

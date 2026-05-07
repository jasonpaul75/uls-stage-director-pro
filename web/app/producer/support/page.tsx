import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GlobalRole, SupportTicketStatus } from "@prisma/client";

export default async function ProducerSupportQueuePage() {
  const session = await auth();
  const role = session?.user?.globalRole;
  if (!session?.user?.id || (role !== GlobalRole.PRODUCER && role !== GlobalRole.ULS_ADMIN)) {
    redirect("/login?callbackUrl=/producer/support");
  }

  const [tickets, openCount] = await Promise.all([
    prisma.supportTicket.findMany({
      orderBy: { createdAt: "desc" },
      take: 150,
      include: {
        project: { select: { id: true, name: true } },
        createdBy: { select: { email: true, name: true } },
      },
    }),
    prisma.supportTicket.count({ where: { status: SupportTicketStatus.OPEN } }),
  ]);

  return (
    <main id="producer-main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 pb-12 pt-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
      <p className="mt-0 text-sm uppercase tracking-widest text-amber-500">Support queue</p>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-100">Director tickets</h1>
      <p className="mt-3 text-sm text-zinc-500">
        In-app escalation channel (see product spec).{" "}
        <span className="text-zinc-400">{openCount}</span>{" "}
        {openCount === 1 ? "open ticket" : "open tickets"}.
      </p>

      {tickets.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">No tickets yet.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {tickets.map((t) => (
            <li
              key={t.id}
              className="rounded border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/producer/support/${t.id}`}
                    className="font-medium text-amber-400 hover:text-amber-300"
                  >
                    {t.subject}
                  </Link>
                  <p className="mt-1 text-xs text-zinc-500">
                    {t.project.name} · {(t.createdBy.name ?? "").trim() || t.createdBy.email} ·{" "}
                    {t.createdAt.toLocaleString()}
                  </p>
                </div>
                <span
                  className={
                    t.status === SupportTicketStatus.OPEN
                      ? "shrink-0 text-xs font-medium text-amber-400"
                      : "shrink-0 text-xs font-medium text-zinc-500"
                  }
                >
                  {t.status === SupportTicketStatus.OPEN ? "Open" : "Resolved"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      </div>
    </main>
  );
}

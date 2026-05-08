import Link from "next/link";
import { redirect } from "next/navigation";

import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { AppShell } from "@/components/ui";
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
    <AppShell id="producer-main-content" outerMaxWidth="wide" contentMaxWidth="full" className="pt-10">
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-uls-subtle">Support queue</p>
        <h1 className="text-pretty text-3xl font-semibold tracking-tight text-uls-text md:text-[2rem]">Director tickets</h1>
        <p className="max-w-prose text-sm leading-relaxed text-uls-muted">
          In-app escalation channel (see product spec). <span className="text-uls-text">{openCount}</span>{" "}
          {openCount === 1 ? "open ticket" : "open tickets"}.
        </p>
      </header>

      <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ProducerGlassCard padding="compact" className="relative overflow-hidden">
          <span
            aria-hidden
            className={`pointer-events-none absolute -right-4 -top-6 h-20 w-20 rounded-full blur-2xl ${openCount > 0 ? "bg-amber-400/18" : "bg-zinc-500/10"}`}
          />
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-uls-muted">Open</p>
          <p className="mt-1.5 tabular-nums text-2xl font-semibold tracking-tight text-uls-text">{openCount}</p>
        </ProducerGlassCard>
        <ProducerGlassCard padding="compact" className="relative overflow-hidden">
          <span aria-hidden className="pointer-events-none absolute -right-4 -top-6 h-20 w-20 rounded-full bg-violet-500/14 blur-2xl" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-uls-muted">Loaded</p>
          <p className="mt-1.5 tabular-nums text-2xl font-semibold tracking-tight text-uls-text">{tickets.length}</p>
          <p className="mt-2 text-[11px] leading-snug text-uls-subtle">Most recent 150.</p>
        </ProducerGlassCard>
      </div>

      {tickets.length === 0 ? (
        <p className="mt-10 text-sm text-uls-muted">No tickets yet.</p>
      ) : (
        <ul className="mt-10 list-none space-y-3 pl-0">
          {tickets.map((t) => (
            <li key={t.id} className="list-none">
              <ProducerGlassCard as="div" padding="compact" className="transition-[border-color] hover:border-white/[0.12]">
                <div className="flex flex-wrap items-start justify-between gap-3 text-sm">
                  <div>
                    <Link
                      href={`/producer/support/${t.id}`}
                      className="font-medium text-uls-accent-strong hover:text-uls-accent-strong/90 hover:underline"
                    >
                      {t.subject}
                    </Link>
                    <p className="mt-1 text-xs text-uls-muted">
                      {t.project.name} · {(t.createdBy.name ?? "").trim() || t.createdBy.email} · {t.createdAt.toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={
                      t.status === SupportTicketStatus.OPEN
                        ? "shrink-0 text-xs font-medium text-uls-accent-strong"
                        : "shrink-0 text-xs font-medium text-uls-subtle"
                    }
                  >
                    {t.status === SupportTicketStatus.OPEN ? "Open" : "Resolved"}
                  </span>
                </div>
              </ProducerGlassCard>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}

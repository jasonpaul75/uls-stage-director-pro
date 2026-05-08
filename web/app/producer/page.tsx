import Link from "next/link";

import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { AppShell, buttonClassName } from "@/components/ui";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatStripeRecordSynced } from "@/lib/stripe-invoice-ui";
import { webhookSecretConfigured, stripeSecretKeyAppearsSandbox } from "@/lib/stripe-admin";
import { GlobalRole, ProjectStatus, SupportTicketStatus } from "@prisma/client";

function statTile(label: string, value: number, accent?: "amber") {
  return (
    <ProducerGlassCard padding="compact" className="relative overflow-hidden">
      <span
        aria-hidden
        className={`pointer-events-none absolute -right-4 -top-6 h-20 w-20 rounded-full ${
          accent === "amber" ? "bg-amber-400/14" : "bg-violet-500/12"
        } blur-2xl`}
      />
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-uls-muted">{label}</p>
      <p className="mt-1.5 tabular-nums text-2xl font-semibold tracking-tight text-uls-text">{value}</p>
    </ProducerGlassCard>
  );
}

function sidebarLink(label: string, href: string) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.03] px-3 py-2.5 text-sm font-medium text-uls-muted transition-colors hover:border-white/[0.1] hover:bg-white/[0.06] hover:text-uls-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-uls-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
    >
      <span>{label}</span>
      <span aria-hidden className="text-xs text-uls-subtle transition-transform group-hover:translate-x-0.5">
        →
      </span>
    </Link>
  );
}

export default async function ProducerHome() {
  const session = await auth();
  const intakeWhere = { status: ProjectStatus.INTAKE_SUBMITTED };

  const [
    intakeCount,
    intakeAssignedCount,
    stripeProductionsUncollectible,
    stripeProductionsDraftOrOpen,
    stripePendingInvoiceRows,
    stripeCustomerLinkedCount,
    latestInvoiceWebhook,
    supportOpenCount,
    recentProjects,
  ] = await Promise.all([
    prisma.project.count({ where: intakeWhere }),
    prisma.project.count({ where: { ...intakeWhere, assignedToUserId: { not: null } } }),
    prisma.project.count({
      where: {
        ...intakeWhere,
        stripeInvoices: { some: { status: "uncollectible" } },
      },
    }),
    prisma.project.count({
      where: {
        ...intakeWhere,
        stripeInvoices: { some: { status: { in: ["open", "draft"] } } },
      },
    }),
    prisma.projectStripeInvoice.count({
      where: {
        status: { in: ["open", "draft"] },
        project: intakeWhere,
      },
    }),
    prisma.project.count({ where: { ...intakeWhere, stripeCustomerId: { not: null } } }),
    prisma.stripeInboundEvent.findFirst({
      where: {
        processedAt: { not: null },
        type: { startsWith: "invoice." },
      },
      orderBy: { processedAt: "desc" },
      select: { processedAt: true },
    }),
    prisma.supportTicket.count({ where: { status: SupportTicketStatus.OPEN } }),
    prisma.project.findMany({
      where: intakeWhere,
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: {
        id: true,
        name: true,
        cityState: true,
        venue: true,
        updatedAt: true,
      },
    }),
  ]);

  const intakeUnassignedCount = Math.max(0, intakeCount - intakeAssignedCount);
  const webhookOk = webhookSecretConfigured();
  const stripeSandbox = stripeSecretKeyAppearsSandbox();
  const isAdmin = session?.user?.globalRole === GlobalRole.ULS_ADMIN;

  return (
    <AppShell id="producer-main-content" outerMaxWidth="wide" contentMaxWidth="full" className="pt-10">
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_min(20rem,100%)] xl:gap-10">
        <div className="min-w-0 space-y-8">
          <header className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-uls-subtle">Production</p>
              {isAdmin ? (
                <span className="rounded-full border border-amber-400/35 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-100/95">
                  Admin
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <h1 className="text-pretty text-3xl font-semibold tracking-tight text-uls-text md:text-[2rem]">
                Command center
              </h1>
            </div>
            <p className="max-w-prose text-sm leading-relaxed text-uls-muted">
              Live snapshot of queued director work — intake, Stripe links, the cross-show media library, support, and webhook
              health. Per-production event workspace and show media attach inside each intake.
            </p>
          </header>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {statTile("Queued intakes", intakeCount)}
            {statTile("Open support", supportOpenCount, "amber")}
            {statTile("Stripe customers", stripeCustomerLinkedCount)}
            {statTile("Open / draft invoices", stripePendingInvoiceRows, "amber")}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ProducerGlassCard>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-uls-text">Director intake inbox</p>
                  <p className="mt-2 text-xs leading-relaxed text-uls-muted">
                    {intakeCount} submission{intakeCount === 1 ? "" : "s"} queued for review · {intakeAssignedCount}{" "}
                    assigned · {intakeUnassignedCount} unassigned.
                  </p>
                </div>
                <Link href="/producer/inbox" className={buttonClassName("primary", "sm", "shrink-0 sm:self-start")}>
                  Open inbox
                </Link>
              </div>
            </ProducerGlassCard>

            <ProducerGlassCard>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-uls-text">Director support tickets</p>
                  <p className="mt-2 text-xs leading-relaxed text-uls-muted">
                    {supportOpenCount} open ticket{supportOpenCount === 1 ? "" : "s"} — replies stay in-thread for continuity.
                  </p>
                </div>
                <Link href="/producer/support" className={buttonClassName("secondary", "sm", "shrink-0 sm:self-start")}>
                  Open queue
                </Link>
              </div>
            </ProducerGlassCard>
          </div>

          <ProducerGlassCard id="stripe-billing" className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="text-sm font-semibold text-uls-text">Stripe billing pulse</p>
            </div>
            {stripeSandbox ? (
              <p className="text-[10px] leading-relaxed text-sky-200/85">
                Test-mode keys (<code className="rounded bg-black/50 px-1">sk_test…</code>) — payouts and ACH are simulated until
                you promote live Stripe credentials.
              </p>
            ) : (
              <p className="text-[10px] leading-relaxed text-emerald-200/85">
                Live Stripe keys — counts and invoice statuses reflect production settlement; coach directors to use receipts on hosted
                invoice PDFs.
              </p>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-uls-muted">Customers linked</p>
                <p className="mt-1 tabular-nums text-xl font-semibold text-uls-text">{stripeCustomerLinkedCount}</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-uls-muted">
                  Productions w/ open · draft
                </p>
                <p className="mt-1 tabular-nums text-xl font-semibold text-amber-100/95">{stripeProductionsDraftOrOpen}</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-uls-muted">Uncollectible</p>
                <p
                  className={`mt-1 tabular-nums text-xl font-semibold ${
                    stripeProductionsUncollectible > 0 ? "text-rose-200/95" : "text-uls-text"
                  }`}
                >
                  {stripeProductionsUncollectible}
                </p>
              </div>
            </div>

            {webhookOk && latestInvoiceWebhook?.processedAt ? (
              <p className="border-t border-white/[0.06] pt-4 text-[10px] leading-relaxed text-uls-muted">
                Last invoice webhook (app-wide):{" "}
                <span className="text-uls-subtle">{formatStripeRecordSynced(latestInvoiceWebhook.processedAt)}</span>
              </p>
            ) : webhookOk ? (
              <p className="border-t border-white/[0.06] pt-4 text-[10px] text-uls-muted">
                No invoice webhook events recorded yet.
              </p>
            ) : (
              <p className="border-t border-white/[0.06] pt-4 text-[10px] leading-relaxed text-amber-200/85">
                Set <code className="rounded bg-black/60 px-1 text-[10px]">STRIPE_WEBHOOK_SECRET</code> so invoice rows and this
                timestamp stay trustworthy.
              </p>
            )}
            <p className="text-[10px] text-uls-subtle">
              Rows above only span queued intake productions. Drill into each row inside the inbox.
            </p>
          </ProducerGlassCard>
        </div>

        <aside className="xl:sticky xl:top-24 xl:self-start xl:pb-12">
          <ProducerGlassCard className="space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-uls-muted">Shortcuts</p>
              <nav className="mt-4 flex flex-col gap-2" aria-label="Production shortcuts">
                {sidebarLink("Intake inbox", "/producer/inbox")}
                {sidebarLink("Media library", "/producer/media-library")}
                {sidebarLink("Support queue", "/producer/support")}
                {sidebarLink("Stripe summary", "/producer#stripe-billing")}
              </nav>
            </div>

            <div className="border-t border-white/[0.06] pt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-uls-muted">Recently updated productions</p>
              {recentProjects.length === 0 ? (
                <p className="mt-3 text-sm text-uls-muted">No queued intakes yet.</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {recentProjects.map((p) => {
                    const sub = [p.cityState, p.venue].filter(Boolean).join(" · ");
                    return (
                      <li key={p.id}>
                        <Link
                          href={`/producer/inbox/${p.id}`}
                          className="block rounded-xl border border-transparent px-2 py-2 transition-colors hover:border-white/[0.08] hover:bg-white/[0.04]"
                        >
                          <span className="block truncate text-sm font-medium text-uls-text">{p.name}</span>
                          {sub ? <span className="mt-0.5 block truncate text-xs text-uls-muted">{sub}</span> : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </ProducerGlassCard>
        </aside>
      </div>
    </AppShell>
  );
}

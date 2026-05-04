import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatStripeRecordSynced } from "@/lib/stripe-invoice-ui";
import { webhookSecretConfigured, stripeSecretKeyAppearsSandbox } from "@/lib/stripe-admin";
import { ProjectStatus, SupportTicketStatus } from "@prisma/client";

export default async function ProducerHome() {
  const session = await auth();

  const intakeWhere = { status: ProjectStatus.INTAKE_SUBMITTED };

  const [
    intakeCount,
    stripeActiveProductions,
    stripeProductionsUncollectible,
    stripeCustomerLinkedCount,
    latestInvoiceWebhook,
    supportOpenCount,
  ] = await Promise.all([
    prisma.project.count({ where: intakeWhere }),
    prisma.project.count({
      where: {
        ...intakeWhere,
        stripeInvoices: { some: { status: { in: ["open", "draft"] } } },
      },
    }),
    prisma.project.count({
      where: {
        ...intakeWhere,
        stripeInvoices: { some: { status: "uncollectible" } },
      },
    }),
    prisma.project.count({
      where: { ...intakeWhere, stripeCustomerId: { not: null } },
    }),
    prisma.stripeInboundEvent.findFirst({
      where: {
        processedAt: { not: null },
        type: { startsWith: "invoice." },
      },
      orderBy: { processedAt: "desc" },
      select: { processedAt: true },
    }),
    prisma.supportTicket.count({ where: { status: SupportTicketStatus.OPEN } }),
  ]);

  const webhookOk = webhookSecretConfigured();
  const stripeSandbox = stripeSecretKeyAppearsSandbox();

  return (
    <main className="mx-auto max-w-lg p-8">
      <p className="text-sm uppercase tracking-widest text-amber-500">Production</p>
      <h1 className="mt-2 text-2xl font-semibold">Command center</h1>
      <p className="mt-4 text-neutral-400">
        {session?.user?.email} · <span className="text-neutral-200">{session?.user?.globalRole}</span>
      </p>

      <section className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-zinc-200">Director intake inbox</p>
            <p className="text-xs text-zinc-500">{intakeCount} open submission(s)</p>
          </div>
          <Link
            href="/producer/inbox"
            className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-black hover:bg-amber-500"
          >
            Open inbox
          </Link>
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-zinc-200">Director support tickets</p>
            <p className="text-xs text-zinc-500">
              {supportOpenCount} open ticket{supportOpenCount === 1 ? "" : "s"} — reply in the app
            </p>
          </div>
          <Link
            href="/producer/support"
            className="rounded-md border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
          >
            Open queue
          </Link>
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <p className="text-sm font-medium text-zinc-200">Stripe billing pulse</p>
        {stripeSandbox ? (
          <p className="mt-2 text-[10px] leading-relaxed text-sky-200/85">
            Test-mode keys (<code className="rounded bg-black/50 px-1">sk_test…</code>) — payouts and ACH are simulated until you promote live Stripe credentials.
          </p>
        ) : (
          <p className="mt-2 text-[10px] leading-relaxed text-emerald-200/85">
            Live Stripe keys — counts and invoice statuses reflect production settlement; coach directors to use receipts on
            the hosted invoice PDFs.
          </p>
        )}
        <dl className="mt-3 space-y-2 text-xs text-zinc-500">
          <div className="flex justify-between gap-4">
            <dt>Customers linked (Stripe)</dt>
            <dd className="text-zinc-300">{stripeCustomerLinkedCount}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Productions · draft / open invoices</dt>
            <dd className="font-medium text-amber-500/95">{stripeActiveProductions}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Productions · uncollection flag</dt>
            <dd className={stripeProductionsUncollectible > 0 ? "font-medium text-rose-400/95" : "text-zinc-300"}>
              {stripeProductionsUncollectible}
            </dd>
          </div>
        </dl>
        {webhookOk && latestInvoiceWebhook?.processedAt ? (
          <p className="mt-3 border-t border-zinc-800 pt-3 text-[10px] leading-relaxed text-zinc-600">
            Last invoice webhook (app-wide):{" "}
            <span className="text-zinc-500">{formatStripeRecordSynced(latestInvoiceWebhook.processedAt)}</span>
          </p>
        ) : webhookOk ? (
          <p className="mt-3 border-t border-zinc-800 pt-3 text-[10px] text-zinc-600">
            No invoice webhook events recorded yet.
          </p>
        ) : (
          <p className="mt-3 border-t border-zinc-800 pt-3 text-[10px] leading-relaxed text-amber-200/85">
            Set <code className="rounded bg-black/60 px-1 text-[10px]">STRIPE_WEBHOOK_SECRET</code> so invoice rows and
            this timestamp stay trustworthy.
          </p>
        )}
        <p className="mt-2 text-[10px] text-zinc-600">
          Counts span only queued intake productions. Drill into rows in the inbox.
        </p>
      </section>

      <p className="mt-8 text-sm text-neutral-500">RoS builder and show-day tools ship here.</p>
    </main>
  );
}

import {
  addStripeDraftLineItem,
  cancelStripeInvoice,
  createDepositDraftInvoice,
  ensureStripeCustomerForProject,
  finalizeAndSendStripeInvoice,
  resyncTrackedStripeInvoice,
} from "@/app/producer/inbox/stripe-actions";
import { parseHttpsUrl } from "@/lib/safe-https-url";
import { stripeInvoiceDashboardUrl } from "@/lib/stripe-admin";
import {
  formatMoneyFromCents,
  formatStripeRecordSynced,
  stripeInvoiceProducerHint,
  stripeInvoiceStatusLabel,
  stripeOpenInvoiceRetryGuide,
} from "@/lib/stripe-invoice-ui";
import type { ProducerIntakeDetailProject } from "@/lib/producer-intake-detail";

type InvoiceRow = ProducerIntakeDetailProject["stripeInvoices"][number];

export function ProducerIntakeStripeSection(props: {
  project: Pick<
    ProducerIntakeDetailProject,
    "id" | "stripeCustomerId" | "stripeInvoices"
  >;
  directorsCsv: string;
  stripeSandbox: boolean;
  webhookOk: boolean;
  latestInvoiceStripeWebhookProcessedAt: Date | null;
  combinedDueCentsInFlight: number;
  totalsSingleCurrency: string | null;
  openInvoiceRetryCoach: boolean;
}) {
  const {
    project,
    directorsCsv,
    stripeSandbox,
    webhookOk,
    latestInvoiceStripeWebhookProcessedAt,
    combinedDueCentsInFlight,
    totalsSingleCurrency,
    openInvoiceRetryCoach,
  } = props;

  return (
    <section id="stripe" className="scroll-mt-6 mt-10">
      <h2 className="text-sm font-medium text-zinc-200">Stripe (payments — ULS merchant)</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Funds settle to ULS billing per locked spec — Connect not required for v1 foundations. Billing contact email comes
        from the first director membership on intake.
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
        Pricing is <strong className="font-medium text-zinc-400">scoped per director / production</strong> — ULS invoices
        the line items agreed for each event (no fixed platform convenience fee layered on directors in this MVP).
      </p>
      {stripeSandbox ? (
        <p className="mt-2 rounded border border-sky-900/60 bg-sky-950/35 px-3 py-2 text-[11px] leading-relaxed text-sky-100">
          <span className="font-semibold">Test mode:</span> Charges, emails, and payouts are simulated. Swap to live{" "}
          <code className="rounded bg-black/40 px-1">STRIPE_*</code> keys plus a live webhook endpoint when you are
          production-ready.
        </p>
      ) : (
        <p className="mt-2 rounded border border-emerald-950/60 bg-emerald-950/25 px-3 py-2 text-[11px] leading-relaxed text-emerald-100">
          <span className="font-semibold">Live Stripe keys detected.</span> Double-check roles, refund policy, and Stripe
          Radar before sending large invoices.
        </p>
      )}

      <div className="mt-4 rounded border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-400">
        <span className="text-zinc-500">Stripe customer:</span>{" "}
        <span className="font-mono text-zinc-200">{project.stripeCustomerId ?? "—"}</span>
        {!project.stripeCustomerId ? (
          <form action={ensureStripeCustomerForProject} className="mt-3 inline-block sm:block">
            <input type="hidden" name="projectId" value={project.id} />
            <button
              type="submit"
              disabled={directorsCsv === ""}
              className="rounded bg-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Create Stripe customer from first director
            </button>
          </form>
        ) : null}
      </div>

      <form action={createDepositDraftInvoice} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <input type="hidden" name="projectId" value={project.id} />
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-sm">
          <span className="text-zinc-400">Deposit (USD)</span>
          <input
            type="number"
            name="depositUsd"
            min={1}
            step="0.01"
            placeholder="2500"
            disabled={!project.stripeCustomerId}
            required
            className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-600 disabled:opacity-40"
          />
        </label>
        <button
          type="submit"
          disabled={!project.stripeCustomerId}
          className="rounded border border-amber-800/70 bg-transparent px-4 py-2 text-sm font-medium text-amber-500 hover:bg-amber-950/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Add draft invoice (deposit line)
        </button>
      </form>

      {project.stripeInvoices.length > 0 ? (
        <div className="mt-6 space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Invoices synced here</h3>
          {combinedDueCentsInFlight > 0 && totalsSingleCurrency ? (
            <p className="rounded border border-zinc-700/80 bg-black/30 px-2 py-1.5 text-[11px] text-zinc-200">
              Combined{" "}
              <span className="font-medium">
                {formatMoneyFromCents(combinedDueCentsInFlight, totalsSingleCurrency)}
              </span>{" "}
              still marked due across <strong>draft + open</strong> invoices below (review before telling the client a single
              number).
            </p>
          ) : null}
          {combinedDueCentsInFlight > 0 && !totalsSingleCurrency ? (
            <p className="rounded border border-amber-900/50 bg-amber-950/25 px-2 py-1.5 text-[11px] text-amber-100">
              Multiple currencies in flight — add each invoice line below instead of quoting one total.
            </p>
          ) : null}
          <p className="text-[11px] text-zinc-600">
            Labels mirror Stripe. Amounts refresh when webhooks run — keep{" "}
            <code className="rounded bg-black/40 px-1 text-zinc-400">STRIPE_WEBHOOK_SECRET</code> set in production.
            Webhook receipts only store Stripe event ids/types (not full payloads) to avoid persisting stray card metadata.
            <span className="block pt-2 text-zinc-500">
              Also: on <span className="font-mono text-zinc-400">invoice.payment_failed</span> the server re-requests the
              invoice with expanded nested payments so payer decline excerpts match what producers see after a Dashboard resync.
            </span>
          </p>
          {openInvoiceRetryCoach ? (
            <p className="text-[11px] leading-relaxed text-zinc-500">{stripeOpenInvoiceRetryGuide}</p>
          ) : null}
          <ul className="space-y-2 text-xs">
            {project.stripeInvoices.map((inv) => (
              <StripeInvoiceCard key={inv.id} inv={inv} projectId={project.id} />
            ))}
          </ul>
          {webhookOk && latestInvoiceStripeWebhookProcessedAt ? (
            <p className="mt-3 text-[10px] text-zinc-600">
              Last invoice webhook processed (entire app):{" "}
              <span className="text-zinc-500">
                {formatStripeRecordSynced(latestInvoiceStripeWebhookProcessedAt)}
              </span>
            </p>
          ) : webhookOk ? (
            <p className="mt-3 text-[10px] text-zinc-600">
              No invoice webhook deliveries recorded yet — create or change an invoice in Stripe to populate this.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function StripeInvoiceCard(props: { inv: InvoiceRow; projectId: string }) {
  const { inv, projectId } = props;
  const hint = stripeInvoiceProducerHint(inv.status);
  const rawHosted = inv.hostedInvoiceUrl?.trim() ?? "";
  const hostedHttps = rawHosted ? parseHttpsUrl(rawHosted) : null;
  const hostedUrlRejected = Boolean(rawHosted && !hostedHttps);
  const dueLine =
    typeof inv.amountDueCents === "number"
      ? inv.status === "paid"
        ? "Paid — thank you recorded in Stripe"
        : inv.status === "void"
          ? "Voided — no payment due"
          : inv.amountDueCents <= 0
            ? `${formatMoneyFromCents(0, inv.currency)} balance shown`
            : `${formatMoneyFromCents(inv.amountDueCents, inv.currency)} due`
      : null;

  return (
    <li className="rounded border border-zinc-800 bg-black/40 px-3 py-2 text-zinc-300">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-medium text-zinc-100">{stripeInvoiceStatusLabel(inv.status)}</span>
        {inv.invoiceNumber ? <span className="text-zinc-500">Invoice #{inv.invoiceNumber}</span> : null}
        <span className="font-mono text-[10px] text-zinc-600">{inv.stripeInvoiceId}</span>
      </div>
      {hint ? <p className="mt-1 text-[11px] text-zinc-500">{hint}</p> : null}
      <p className="mt-1 text-[10px] text-zinc-600">
        Row updated {formatStripeRecordSynced(inv.updatedAt)}
        {inv.lastSyncedFromStripeAt ? (
          <>
            {" "}
            · last Stripe payload applied {formatStripeRecordSynced(inv.lastSyncedFromStripeAt)}
          </>
        ) : null}
      </p>
      {typeof inv.attemptCount === "number" && inv.attemptCount > 0 ? (
        <p className="mt-1 text-[11px] text-zinc-500">
          Stripe billing <span className="font-medium text-zinc-300">attempt count {inv.attemptCount}</span> (automatic schedule
          + first collection).
        </p>
      ) : null}
      {inv.nextPaymentAttemptAt && inv.status === "open" ? (
        <p className="mt-1 text-[11px] text-zinc-500">
          Next dashboard-indicated retry window ≈{" "}
          <span className="font-medium text-zinc-400">{formatStripeRecordSynced(inv.nextPaymentAttemptAt)}</span>. Send-invoice
          productions may still rely on the payer reopening their hosted invoice link.
        </p>
      ) : null}
      {inv.lastStripeErrorSummary ? (
        <p className="mt-1 text-[11px] leading-relaxed text-rose-300/95">
          <span className="font-semibold text-rose-200/95">Stripe error excerpt:</span> {inv.lastStripeErrorSummary}
        </p>
      ) : null}
      {inv.status === "open" &&
      typeof inv.attemptCount === "number" &&
      inv.attemptCount > 0 &&
      !inv.lastStripeErrorSummary ? (
        <p className="mt-1 text-[10px] text-zinc-600">
          Stripe did not attach a finalization error snippet here — open the Dashboard payment log for card/ACH decline
          details.
        </p>
      ) : null}
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2 text-zinc-500">
        {dueLine ? <span>{dueLine}</span> : null}
        <a
          href={stripeInvoiceDashboardUrl(inv.stripeInvoiceId)}
          target="_blank"
          rel="noreferrer"
          className="text-amber-500 hover:text-amber-400"
        >
          Open in Stripe Dashboard
        </a>
        {hostedHttps ? (
          <a href={hostedHttps} target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:text-amber-400">
            Hosted invoice
          </a>
        ) : null}
        {hostedUrlRejected ? (
          <span className="text-[11px] text-rose-400/95" title={rawHosted}>
            Hosted URL invalid (not https) — resync
          </span>
        ) : null}
        <form action={resyncTrackedStripeInvoice} className="inline">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="stripeInvoiceId" value={inv.stripeInvoiceId} />
          <button
            type="submit"
            className="text-[11px] font-medium text-zinc-400 underline decoration-zinc-600 underline-offset-2 hover:text-zinc-200"
          >
            Resync from Stripe
          </button>
        </form>
      </div>
      {inv.status === "draft" ? (
        <div className="mt-3 space-y-3 border-t border-zinc-800/80 pt-3">
          <form action={finalizeAndSendStripeInvoice} className="flex flex-wrap items-end gap-2 text-xs text-zinc-400">
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="stripeInvoiceId" value={inv.stripeInvoiceId} />
            <button
              type="submit"
              className="rounded border border-emerald-800/70 bg-emerald-950/30 px-3 py-1.5 font-medium text-emerald-200 hover:bg-emerald-900/40"
            >
              Finalize &amp; send
            </button>
          </form>
          <form action={addStripeDraftLineItem} className="flex flex-wrap items-end gap-2 gap-y-2 text-xs">
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="stripeInvoiceId" value={inv.stripeInvoiceId} />
            <label className="flex min-w-[7rem] flex-col gap-0.5">
              <span className="text-zinc-500">Amount (USD)</span>
              <input
                type="number"
                name="lineUsd"
                min={0.01}
                step="0.01"
                placeholder="500"
                required
                className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-zinc-100"
              />
            </label>
            <label className="flex min-w-[12rem] flex-1 flex-col gap-0.5">
              <span className="text-zinc-500">Description</span>
              <input
                type="text"
                name="lineDescription"
                maxLength={420}
                required
                placeholder="e.g. travel advance"
                className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-100"
              />
            </label>
            <button
              type="submit"
              className="rounded border border-zinc-600 bg-zinc-900 px-3 py-1.5 font-medium text-zinc-200 hover:bg-zinc-800"
            >
              Add line
            </button>
          </form>
          <form action={cancelStripeInvoice}>
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="stripeInvoiceId" value={inv.stripeInvoiceId} />
            <button
              type="submit"
              className="text-xs text-red-400/90 underline-offset-2 hover:text-red-300 hover:underline"
            >
              Delete draft invoice
            </button>
          </form>
        </div>
      ) : null}
      {inv.status === "open" ? (
        <div className="mt-3 border-t border-zinc-800/80 pt-3">
          <form action={cancelStripeInvoice}>
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="stripeInvoiceId" value={inv.stripeInvoiceId} />
            <button type="submit" className="text-xs font-medium text-amber-700/90 hover:text-amber-500">
              Void open invoice
            </button>
          </form>
          <p className="mt-1 text-[11px] text-zinc-600">Voids unsettled Stripe invoices — use only when you mean to unwind billing.</p>
        </div>
      ) : null}
    </li>
  );
}

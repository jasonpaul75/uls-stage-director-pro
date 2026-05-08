import {
  addStripeDraftLineItem,
  cancelStripeInvoice,
  createDepositDraftInvoice,
  ensureStripeCustomerForProject,
  finalizeAndSendStripeInvoice,
  resyncTrackedStripeInvoice,
} from "@/app/producer/inbox/stripe-actions";
import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { Button } from "@/components/ui";
import { parseHttpsUrl } from "@/lib/safe-https-url";
import { stripeInvoiceDashboardUrl } from "@/lib/stripe-admin";
import type { ProducerIntakeDetailProject } from "@/lib/producer-intake-detail";
import {
  producerIntakeFieldClass,
  producerIntakeMutedBoxClass,
  producerIntakeMonoFieldClass,
} from "@/lib/producer-intake-ui";
import {
  formatMoneyFromCents,
  formatStripeRecordSynced,
  stripeInvoiceProducerHint,
  stripeInvoiceStatusLabel,
  stripeOpenInvoiceRetryGuide,
} from "@/lib/stripe-invoice-ui";

import { ProducerIntakeCollapsible } from "./producer-intake-collapsible";
import { ProducerIntakeSectionShell } from "./producer-intake-section-shell";

type InvoiceRow = ProducerIntakeDetailProject["stripeInvoices"][number];

export function ProducerIntakeStripeSection(props: {
  project: Pick<ProducerIntakeDetailProject, "id" | "stripeCustomerId" | "stripeInvoices">;
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
    <ProducerIntakeSectionShell id="stripe" title="Stripe (payments — ULS merchant)">
      <p className="text-xs text-uls-muted">
        Funds settle to ULS billing per locked spec — Connect not required for v1 foundations. Billing contact email comes from
        the first director membership on intake.
      </p>
      <p className="text-[11px] leading-relaxed text-uls-muted">
        Pricing is <strong className="font-medium text-uls-text">scoped per director / production</strong> — ULS invoices the line
        items agreed for each event (no fixed platform convenience fee layered on directors in this MVP).
      </p>
      {stripeSandbox ? (
        <p
          role="status"
          className="rounded-md border border-sky-900/60 bg-sky-950/35 px-3 py-2 text-[11px] leading-relaxed text-sky-100"
        >
          <span className="font-semibold">Test mode:</span> Charges, emails, and payouts are simulated. Swap to live{" "}
          <code className="rounded bg-black/40 px-1">STRIPE_*</code> keys plus a live webhook endpoint when you are production-ready.
        </p>
      ) : (
        <p
          role="status"
          className="rounded-md border border-emerald-950/60 bg-emerald-950/25 px-3 py-2 text-[11px] leading-relaxed text-emerald-100"
        >
          <span className="font-semibold">Live Stripe keys detected.</span> Double-check roles, refund policy, and Stripe Radar
          before sending large invoices.
        </p>
      )}

      <div className={producerIntakeMutedBoxClass}>
        <span className="text-uls-subtle">Stripe customer:</span>{" "}
        <span className="font-mono text-uls-text">{project.stripeCustomerId ?? "—"}</span>
        {!project.stripeCustomerId ? (
          <form action={ensureStripeCustomerForProject} className="mt-3 inline-block sm:block">
            <input type="hidden" name="projectId" value={project.id} />
            <Button type="submit" variant="primary" size="sm" disabled={directorsCsv === ""}>
              Create Stripe customer from first director
            </Button>
          </form>
        ) : null}
      </div>

      <form action={createDepositDraftInvoice} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <input type="hidden" name="projectId" value={project.id} />
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-sm">
          <span className="text-uls-muted">Deposit (USD)</span>
          <input
            type="number"
            name="depositUsd"
            min={1}
            step="0.01"
            placeholder="2500"
            disabled={!project.stripeCustomerId}
            required
            className={producerIntakeFieldClass}
          />
        </label>
        <Button type="submit" variant="secondary" size="sm" disabled={!project.stripeCustomerId} className="border-amber-800/65 text-amber-200 hover:bg-amber-950/35">
          Add draft invoice (deposit line)
        </Button>
      </form>

      {project.stripeInvoices.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wider text-uls-subtle">Invoices synced here</h3>
          {combinedDueCentsInFlight > 0 && totalsSingleCurrency ? (
            <p
              role="status"
              className="rounded-md border border-uls-border-strong/80 bg-uls-surface-inset px-3 py-2 text-[11px] text-uls-text"
            >
              Combined{" "}
              <span className="font-medium">{formatMoneyFromCents(combinedDueCentsInFlight, totalsSingleCurrency)}</span> still
              marked due across <strong>draft + open</strong> invoices below (review before telling the client a single number).
            </p>
          ) : null}
          {combinedDueCentsInFlight > 0 && !totalsSingleCurrency ? (
            <p
              role="status"
              className="rounded-md border border-amber-900/50 bg-amber-950/25 px-3 py-2 text-[11px] text-amber-100"
            >
              Multiple currencies in flight — add each invoice line below instead of quoting one total.
            </p>
          ) : null}
          <ProducerIntakeCollapsible title="Webhook &amp; sync internals" defaultOpen={false}>
            <div className="space-y-2 text-[11px] text-uls-subtle">
              <p>
                Labels mirror Stripe. Amounts refresh when webhooks run — keep{" "}
                <code className="rounded bg-uls-surface-inset px-1 font-mono text-uls-muted">STRIPE_WEBHOOK_SECRET</code> set in
                production. Webhook receipts only store Stripe event ids/types (not full payloads) to avoid persisting stray card
                metadata.
              </p>
              <p className="text-uls-muted">
                Also: on <span className="font-mono text-uls-text">invoice.payment_failed</span> the server re-requests the
                invoice with expanded nested payments so payer decline excerpts match what producers see after a Dashboard resync.
              </p>
            </div>
          </ProducerIntakeCollapsible>
          {openInvoiceRetryCoach ? (
            <p role="status" className="text-[11px] leading-relaxed text-uls-muted">{stripeOpenInvoiceRetryGuide}</p>
          ) : null}
          <ul className="list-none space-y-2 text-xs">
            {project.stripeInvoices.map((inv) => (
              <StripeInvoiceCard key={inv.id} inv={inv} projectId={project.id} />
            ))}
          </ul>
          {webhookOk && latestInvoiceStripeWebhookProcessedAt ? (
            <p className="text-[10px] text-uls-subtle">
              Last invoice webhook processed (entire app):{" "}
              <span className="text-uls-muted">{formatStripeRecordSynced(latestInvoiceStripeWebhookProcessedAt)}</span>
            </p>
          ) : webhookOk ? (
            <p className="text-[10px] text-uls-subtle">
              No invoice webhook deliveries recorded yet — create or change an invoice in Stripe to populate this.
            </p>
          ) : null}
        </div>
      ) : null}
    </ProducerIntakeSectionShell>
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
    <li>
      <ProducerGlassCard as="div" padding="compact" className="bg-uls-surface-inset/25 shadow-[inset_0_2px_6px_rgb(0_0_0/0.22)]">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-medium text-uls-text">{stripeInvoiceStatusLabel(inv.status)}</span>
          {inv.invoiceNumber ? <span className="text-uls-subtle">Invoice #{inv.invoiceNumber}</span> : null}
          <span className="font-mono text-[10px] text-uls-subtle">{inv.stripeInvoiceId}</span>
        </div>
        {hint ? <p className="mt-1 text-[11px] text-uls-muted">{hint}</p> : null}
        <p className="mt-1 text-[10px] text-uls-subtle">
          Row updated {formatStripeRecordSynced(inv.updatedAt)}
          {inv.lastSyncedFromStripeAt ? (
            <>
              {" "}
              · last Stripe payload applied {formatStripeRecordSynced(inv.lastSyncedFromStripeAt)}
            </>
          ) : null}
        </p>
      {typeof inv.attemptCount === "number" && inv.attemptCount > 0 ? (
        <p className="mt-1 text-[11px] text-uls-muted">
          Stripe billing <span className="font-medium text-uls-text">attempt count {inv.attemptCount}</span> (automatic schedule
          + first collection).
        </p>
      ) : null}
      {inv.nextPaymentAttemptAt && inv.status === "open" ? (
        <p className="mt-1 text-[11px] text-uls-muted">
          Next dashboard-indicated retry window ≈{" "}
          <span className="font-medium text-uls-text">{formatStripeRecordSynced(inv.nextPaymentAttemptAt)}</span>. Send-invoice
          productions may still rely on the payer reopening their hosted invoice link.
        </p>
      ) : null}
      {inv.lastStripeErrorSummary ? (
        <p role="alert" className="mt-1 text-[11px] leading-relaxed text-rose-300/95">
          <span className="font-semibold text-rose-200/95">Stripe error excerpt:</span> {inv.lastStripeErrorSummary}
        </p>
      ) : null}
      {inv.status === "open" &&
      typeof inv.attemptCount === "number" &&
      inv.attemptCount > 0 &&
      !inv.lastStripeErrorSummary ? (
        <p className="mt-1 text-[10px] text-uls-subtle">
          Stripe did not attach a finalization error snippet here — open the Dashboard payment log for card/ACH decline details.
        </p>
      ) : null}
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2 text-uls-muted">
        {dueLine ? <span>{dueLine}</span> : null}
        <a href={stripeInvoiceDashboardUrl(inv.stripeInvoiceId)} target="_blank" rel="noreferrer" className="text-amber-500 hover:text-amber-400">
          Open in Stripe Dashboard
        </a>
        {hostedHttps ? (
          <a href={hostedHttps} target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:text-amber-400">
            Hosted invoice
          </a>
        ) : null}
        {hostedUrlRejected ? (
          <span role="alert" className="text-[11px] text-rose-400/95" title={rawHosted}>
            Hosted URL invalid (not https) — resync
          </span>
        ) : null}
        <form action={resyncTrackedStripeInvoice} className="inline">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="stripeInvoiceId" value={inv.stripeInvoiceId} />
          <button
            type="submit"
            className="text-[11px] font-medium text-uls-muted underline decoration-uls-border-strong underline-offset-2 hover:text-uls-text"
          >
            Resync from Stripe
          </button>
        </form>
      </div>
      {inv.status === "draft" ? (
        <div className="mt-3 space-y-3 border-t border-uls-border pt-3">
          <form action={finalizeAndSendStripeInvoice} className="flex flex-wrap items-end gap-2 text-xs text-uls-muted">
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="stripeInvoiceId" value={inv.stripeInvoiceId} />
            <button
              type="submit"
              className="rounded-md border border-emerald-800/70 bg-emerald-950/30 px-3 py-1.5 font-medium text-emerald-200 hover:bg-emerald-900/40"
            >
              Finalize &amp; send
            </button>
          </form>
          <form action={addStripeDraftLineItem} className="flex flex-wrap items-end gap-2 gap-y-2 text-xs">
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="stripeInvoiceId" value={inv.stripeInvoiceId} />
            <label className="flex min-w-[7rem] flex-col gap-0.5">
              <span className="text-uls-subtle">Amount (USD)</span>
              <input
                type="number"
                name="lineUsd"
                min={0.01}
                step="0.01"
                placeholder="500"
                required
                className={`${producerIntakeMonoFieldClass} px-2 py-1`}
              />
            </label>
            <label className="flex min-w-[12rem] flex-1 flex-col gap-0.5">
              <span className="text-uls-subtle">Description</span>
              <input
                type="text"
                name="lineDescription"
                maxLength={420}
                required
                placeholder="e.g. travel advance"
                className={`${producerIntakeFieldClass} px-2 py-1`}
              />
            </label>
            <button type="submit" className="rounded-md border border-uls-border-strong bg-uls-surface-inset px-3 py-1.5 font-medium text-uls-text hover:bg-uls-surface">
              Add line
            </button>
          </form>
          <form action={cancelStripeInvoice}>
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="stripeInvoiceId" value={inv.stripeInvoiceId} />
            <button type="submit" className="text-xs text-red-400/90 underline-offset-2 hover:text-red-300 hover:underline">
              Delete draft invoice
            </button>
          </form>
        </div>
      ) : null}
      {inv.status === "open" ? (
        <div className="mt-3 border-t border-uls-border pt-3">
          <form action={cancelStripeInvoice}>
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="stripeInvoiceId" value={inv.stripeInvoiceId} />
            <button type="submit" className="text-xs font-medium text-amber-700/90 hover:text-amber-500">
              Void open invoice
            </button>
          </form>
          <p className="mt-1 text-[11px] text-uls-subtle">Voids unsettled Stripe invoices — use only when you mean to unwind billing.</p>
        </div>
      ) : null}
      </ProducerGlassCard>
    </li>
  );
}

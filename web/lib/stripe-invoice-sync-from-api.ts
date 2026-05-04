import type Stripe from "stripe";

/** Map Stripe Invoice API object → DB columns refreshed on webhook or manual resync (no FK fields). */

export type StripeInvoiceSyncPayload = {
  status: string;
  hostedInvoiceUrl: string | null;
  invoiceNumber: string | null;
  amountDueCents: number | null;
  currency: string;
  attemptCount: number | null;
  nextPaymentAttemptAt: Date | null;
  lastStripeErrorSummary: string | null;
  lastSyncedFromStripeAt: Date;
};

function truncateErrorSnippet(s: string, maxChars: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (!t.length) return "";
  if (t.length <= maxChars) return t;
  return `${t.slice(0, Math.max(maxChars - 1, 0))}…`;
}

/** Join Stripe error primitives into one short snippet (without duplicating separators). */

function stringifyStripeErrorPieces(...parts: (string | null | undefined)[]): string | null {
  const merged = parts
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean)
    .join(" · ")
    .replace(/\s+/g, " ")
    .trim();
  return merged.length ? merged : null;
}

function summarizePaymentIntentLastPaymentError(pi: Stripe.PaymentIntent): string | null {
  const err = pi.last_payment_error;
  if (!err || typeof err !== "object") return null;
  const code = typeof err.code === "string" ? err.code : null;
  const decline = typeof err.decline_code === "string" ? err.decline_code : null;
  const msg = typeof err.message === "string" ? err.message.trim() : null;
  return stringifyStripeErrorPieces(code, decline, msg);
}

function summarizeChargeFailure(ch: Stripe.Charge): string | null {
  if (ch.object !== "charge") return null;
  const code = typeof ch.failure_code === "string" ? ch.failure_code : null;
  const msg = typeof ch.failure_message === "string" ? ch.failure_message.trim() : null;
  return stringifyStripeErrorPieces(code, msg);
}

/** Walk Stripe invoice nested `payments` (requires Retrieve `expand`). Newest-ish entries preferred. */

function payerFailureSummaryFromExpandedInvoice(inv: Stripe.Invoice): string | null {
  const payments = inv.payments?.data;
  if (!payments?.length) return null;

  for (let i = payments.length - 1; i >= 0; i--) {
    const row = payments[i];
    const p = row?.payment;
    if (!p) continue;

    if (p.payment_intent && typeof p.payment_intent === "object") {
      const pi = p.payment_intent as Stripe.PaymentIntent;
      if (pi.object === "payment_intent") {
        const s = summarizePaymentIntentLastPaymentError(pi);
        if (s) return s;
      }
    }

    if (p.charge && typeof p.charge === "object") {
      const ch = p.charge as Stripe.Charge;
      const s = summarizeChargeFailure(ch);
      if (s) return s;
    }
  }
  return null;
}

function finalizeStripeErrorRaw(inv: Stripe.Invoice): string | null {
  const fe = inv.last_finalization_error;
  if (!fe || typeof fe !== "object") return null;
  return stringifyStripeErrorPieces(
    typeof fe.code === "string" ? fe.code : undefined,
    typeof fe.decline_code === "string" ? fe.decline_code : undefined,
    typeof fe.message === "string" ? fe.message.trim() : undefined,
  );
}

export function summarizeStripeInvoiceLastError(inv: Stripe.Invoice): string | null {
  const raw = finalizeStripeErrorRaw(inv);
  return raw ? truncateErrorSnippet(raw, 500) : null;
}

/**
 * Persisted payer/finalization context: prefers expanded payment failures (hosted invoice declines),
 * then falls back to `last_finalization_error`.
 */

export function summarizeStoredInvoiceErrorSnippet(inv: Stripe.Invoice): string | null {
  const payerFail = payerFailureSummaryFromExpandedInvoice(inv);
  const finalizeFailRaw = finalizeStripeErrorRaw(inv);

  let combined: string | null = null;

  if (payerFail && finalizeFailRaw) {
    combined = `${payerFail} · Invoice finalize · ${finalizeFailRaw}`;
  } else if (payerFail) {
    combined = payerFail;
  } else if (finalizeFailRaw) {
    combined = finalizeFailRaw;
  }

  return combined ? truncateErrorSnippet(combined, 500) : null;
}

export function prismaInvoicePayloadFromStripe(inv: Stripe.Invoice): StripeInvoiceSyncPayload {
  const attemptRaw = inv.attempt_count;
  const attemptCount =
    typeof attemptRaw === "number" && Number.isFinite(attemptRaw)
      ? Math.round(Math.min(Math.max(attemptRaw, 0), 2_147_483_647))
      : null;

  const npa = inv.next_payment_attempt;

  return {
    status: inv.status ?? "unknown",
    hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
    invoiceNumber: inv.number ?? null,
    amountDueCents: typeof inv.amount_due === "number" ? inv.amount_due : null,
    currency: inv.currency ?? "usd",
    attemptCount,
    nextPaymentAttemptAt:
      typeof npa === "number" && npa > 0 ? new Date(npa * 1000) : null,
    lastStripeErrorSummary: summarizeStoredInvoiceErrorSnippet(inv),
    lastSyncedFromStripeAt: new Date(),
  };
}

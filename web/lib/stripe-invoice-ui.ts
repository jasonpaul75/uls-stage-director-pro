/** Human-readable labels for Stripe invoice `status` strings (synced from webhooks). */

export function stripeInvoiceStatusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "open":
      return "Open — payment due";
    case "paid":
      return "Paid";
    case "void":
      return "Voided";
    case "uncollectible":
      return "Uncollectible";
    default:
      return status.replace(/_/g, " ");
  }
}

/** Short producer hint for triage (optional). */
export function stripeInvoiceProducerHint(status: string): string | null {
  switch (status) {
    case "draft":
      return "Add lines, then finalize & send from here or the Dashboard.";
    case "open":
      return "Customer can pay via hosted invoice or Dashboard.";
    case "paid":
      return "Settled in Stripe.";
    case "void":
      return "Invoice was voided.";
    case "uncollectible":
      return "Marked uncollectible in Stripe — align with billing before emailing the client.";
    default:
      return null;
  }
}

/** Short locale string for invoice freshness (typically updated via webhooks). */
export function formatStripeRecordSynced(updatedAt: Date): string {
  return updatedAt.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Stripe `amount_*` fields use the smallest currency unit. Most currencies use cent-style /100 semantics;
 * zero-decimal currencies use whole major units — see Stripe presentment currencies.
 */
const STRIPE_ZERO_DECIMAL_CURRENCIES = new Set<string>([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "JPY",
  "KMF",
  "KRW",
  "MGA",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
]);

function divisorForStripeMinorUnit(currencyCode: string): number {
  return STRIPE_ZERO_DECIMAL_CURRENCIES.has((currencyCode || "usd").toUpperCase()) ? 1 : 100;
}

/** Format an amount stored in Stripe's smallest currency unit (minor unit). */
export function formatMoneyFromCents(amountSmallestCurrencyUnit: number, currencyCode = "usd"): string {
  const cc = currencyCode.toUpperCase() || "USD";
  const major = amountSmallestCurrencyUnit / divisorForStripeMinorUnit(cc);
  return major.toLocaleString(undefined, {
    style: "currency",
    currency: cc,
  });
}

type StripeDueSnapshot = {
  status: string;
  amountDueCents: number | null;
};

/** True when at least one invoice is still collectible with a positive Stripe `amount_due`. */
export function stripeHasOpenBalanceDue(invoices: StripeDueSnapshot[]): boolean {
  return invoices.some(
    (inv) =>
      inv.status === "open" && typeof inv.amountDueCents === "number" && inv.amountDueCents > 0,
  );
}

/** Director / producer copy for declines, ACH timing, webhook lag vs Stripe Dashboard */
export const stripeOpenInvoiceRetryGuide =
  "If payment does not complete, Stripe normally emails whoever is billed with next steps. The hosted invoice link accepts retries with another payment method. If Stripe shows paid but totals here briefly lag, webhook sync is usually still catching up.";

type OpenInvoiceStripePublic = {
  status: string;
  amountDueCents: number | null;
  attemptCount: number | null;
};

/** Director-visible when Stripe already logged collection attempts on an unpaid open invoice. */

export function stripeDirectorOpenInvoiceAttemptsNote(inv: OpenInvoiceStripePublic): string | null {
  if (inv.status !== "open") return null;
  if (typeof inv.amountDueCents !== "number" || inv.amountDueCents <= 0) return null;
  if (typeof inv.attemptCount !== "number" || inv.attemptCount < 1) return null;
  return "Stripe has logged at least one automated collection milestone on this balance (for example card declines or ACH timing). Continue with the pay link below unless ULS directs otherwise.";
}

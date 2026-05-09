/** Human-readable labels for Stripe invoice `status` strings (synced from webhooks). */

export function stripeInvoiceStatusLabel(status: string | null | undefined): string {
  if (typeof status !== "string") return "Invoice status unavailable";
  const key = status.trim().toLowerCase();
  switch (key) {
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
      return status.trim().replace(/_/g, " ") || "Invoice status unavailable";
  }
}

/** Short producer hint for triage (optional). */
export function stripeInvoiceProducerHint(status: string | null | undefined): string | null {
  if (typeof status !== "string") return null;
  const key = status.trim().toLowerCase();
  switch (key) {
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

/** Short locale string for invoice freshness. Tolerates nullish or invalid values — avoids RSC crashes on partial rows. */
export function formatStripeRecordSynced(updatedAt: Date | string | number | null | undefined): string {
  if (updatedAt == null) return "—";
  const d =
    typeof updatedAt === "object" && updatedAt instanceof Date ? updatedAt : new Date(updatedAt);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
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

/** ISO 4217-style codes Stripe uses (`usd` → `USD`). Wrong length / garbage must not reach `Intl`; it throws RangeError. */
const STRIPE_PRESENTMENT_CURRENCY = /^[A-Z]{3}$/;

/** Synced rows may omit currency or carry typos (`US`, empty). Never trust raw DB strings for Intl. */
export function normalizedStripeCurrencyCode(currency: string | null | undefined): string {
  const raw = typeof currency === "string" ? currency.trim().toUpperCase() : "";
  if (raw.length === 3 && STRIPE_PRESENTMENT_CURRENCY.test(raw)) return raw;
  return "USD";
}

/** Format an amount stored in Stripe's smallest currency unit (minor unit). */
export function formatMoneyFromCents(amountSmallestCurrencyUnit: number, currencyCode?: string | null): string {
  const cc = normalizedStripeCurrencyCode(currencyCode);
  const major = amountSmallestCurrencyUnit / divisorForStripeMinorUnit(cc);
  try {
    return major.toLocaleString(undefined, {
      style: "currency",
      currency: cc,
    });
  } catch {
    const fallbackMajor = amountSmallestCurrencyUnit / divisorForStripeMinorUnit("USD");
    return `${fallbackMajor.toFixed(2)} USD (currency fix needed)`;
  }
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
  if (typeof inv.attemptCount !== "number" || !Number.isFinite(inv.attemptCount) || inv.attemptCount < 1) return null;
  return "Stripe has logged at least one automated collection milestone on this balance (for example card declines or ACH timing). Continue with the pay link below unless ULS directs otherwise.";
}

/** Normalize Stripe-synced invoice rows into countable buckets (DB or in-memory). */

export type StripeInvoiceStatusTotals = {
  draft: number;
  open: number;
  paid: number;
  void: number;
  uncollectible: number;
  other: number;
};

export function tallyStripeInvoiceStatuses(invoices: { status: string }[]): StripeInvoiceStatusTotals {
  const out: StripeInvoiceStatusTotals = {
    draft: 0,
    open: 0,
    paid: 0,
    void: 0,
    uncollectible: 0,
    other: 0,
  };

  for (const inv of invoices) {
    switch (inv.status) {
      case "draft":
        out.draft++;
        break;
      case "open":
        out.open++;
        break;
      case "paid":
        out.paid++;
        break;
      case "void":
        out.void++;
        break;
      case "uncollectible":
        out.uncollectible++;
        break;
      default:
        out.other++;
        break;
    }
  }

  return out;
}

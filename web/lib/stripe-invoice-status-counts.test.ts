import { describe, expect, it } from "vitest";

import { tallyStripeInvoiceStatuses } from "./stripe-invoice-status-counts";

describe("tallyStripeInvoiceStatuses", () => {
  it("returns zeros for empty input", () => {
    expect(tallyStripeInvoiceStatuses([])).toEqual({
      draft: 0,
      open: 0,
      paid: 0,
      void: 0,
      uncollectible: 0,
      other: 0,
    });
  });

  it("aggregates canonical statuses into buckets", () => {
    const out = tallyStripeInvoiceStatuses([
      { status: "draft" },
      { status: "open" },
      { status: "open" },
      { status: "paid" },
      { status: "void" },
      { status: "uncollectible" },
    ]);
    expect(out).toEqual({
      draft: 1,
      open: 2,
      paid: 1,
      void: 1,
      uncollectible: 1,
      other: 0,
    });
  });

  it("counts unknown statuses as other", () => {
    const out = tallyStripeInvoiceStatuses([
      { status: "past_due" },
      { status: "CUSTOM" },
    ]);
    expect(out.other).toBe(2);
    expect(out.draft).toBe(0);
    expect(out.open).toBe(0);
  });

  it("matches Stripe statuses case-sensitively (non-lowercase → other)", () => {
    const out = tallyStripeInvoiceStatuses([{ status: "Open" }, { status: "PAID" }]);
    expect(out.other).toBe(2);
    expect(out.open).toBe(0);
    expect(out.paid).toBe(0);
  });
});

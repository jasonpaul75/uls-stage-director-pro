import { describe, expect, it, vi } from "vitest";

import type Stripe from "stripe";

import { stripeInvoiceRetrieveExpandPayments } from "./stripe-invoice-expand";
import { retrieveInvoiceExpandedAfterPaymentFailure } from "./stripe-invoice-webhook-enrich";

describe("retrieveInvoiceExpandedAfterPaymentFailure", () => {
  it("returns null when webhook invoice is absent or wrong shape", async () => {
    const retrieve = vi.fn();
    const stripe = { invoices: { retrieve: retrieve } } as unknown as Stripe;

    expect(await retrieveInvoiceExpandedAfterPaymentFailure(stripe, undefined)).toBeNull();
    expect(
      await retrieveInvoiceExpandedAfterPaymentFailure(stripe, { object: "charge" } as unknown as Stripe.Invoice),
    ).toBeNull();
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("returns null when invoice id is missing or not a string", async () => {
    const retrieve = vi.fn();
    const stripe = { invoices: { retrieve } } as unknown as Stripe;

    expect(await retrieveInvoiceExpandedAfterPaymentFailure(stripe, { object: "invoice" } as Stripe.Invoice)).toBeNull();

    expect(
      await retrieveInvoiceExpandedAfterPaymentFailure(stripe, {
        id: 123,
        object: "invoice",
      } as unknown as Stripe.Invoice),
    ).toBeNull();
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("retrieves with payment expand paths", async () => {
    const expanded = { id: "in_99", object: "invoice" } as Stripe.Invoice;
    const retrieve = vi.fn().mockResolvedValue(expanded);
    const stripe = { invoices: { retrieve } } as unknown as Stripe;

    const wh = { id: "in_99", object: "invoice" } as Stripe.Invoice;
    const out = await retrieveInvoiceExpandedAfterPaymentFailure(stripe, wh);

    expect(out).toBe(expanded);
    expect(retrieve).toHaveBeenCalledWith("in_99", { expand: stripeInvoiceRetrieveExpandPayments() });
  });

  it("returns null when retrieve throws", async () => {
    const retrieve = vi.fn().mockRejectedValue(new Error("boom"));
    const stripe = { invoices: { retrieve } } as unknown as Stripe;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const out = await retrieveInvoiceExpandedAfterPaymentFailure(stripe, {
      id: "in_x",
      object: "invoice",
    } as Stripe.Invoice);

    expect(out).toBeNull();
    warn.mockRestore();
  });
});

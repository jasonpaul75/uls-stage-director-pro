import { describe, expect, it } from "vitest";

import { stripeInvoiceRetrieveExpandPayments } from "./stripe-invoice-expand";

describe("stripeInvoiceRetrieveExpandPayments", () => {
  it("returns stable expand paths for payment failure traversal", () => {
    expect(stripeInvoiceRetrieveExpandPayments()).toEqual([
      "payments.data.payment.payment_intent",
      "payments.data.payment.charge",
    ]);
  });
});

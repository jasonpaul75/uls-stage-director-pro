import { describe, expect, it } from "vitest";

import type Stripe from "stripe";

import {
  prismaInvoicePayloadFromStripe,
  summarizeStripeInvoiceLastError,
  summarizeStoredInvoiceErrorSnippet,
} from "./stripe-invoice-sync-from-api";

/** Narrow invoice-shaped stub for mapper tests */

function invoice(partial: Record<string, unknown>): Stripe.Invoice {
  return partial as unknown as Stripe.Invoice;
}

describe("summarizeStripeInvoiceLastError", () => {
  it("joins finalize error fields into a short snippet", () => {
    const inv = invoice({
      last_finalization_error: {
        code: "amount_too_small",
        message: "Amount must be at least 50 cents",
      },
    });
    expect(summarizeStripeInvoiceLastError(inv)).toBe("amount_too_small · Amount must be at least 50 cents");
  });

  it("includes decline_code with code and message for finalization errors", () => {
    const inv = invoice({
      last_finalization_error: {
        code: "card_declined",
        decline_code: "insufficient_funds",
        message: "Not enough funds.",
      },
    });
    expect(summarizeStripeInvoiceLastError(inv)).toBe(
      "card_declined · insufficient_funds · Not enough funds.",
    );
  });

  it("summarizes finalize message when Stripe omits discrete code fields", () => {
    const inv = invoice({
      last_finalization_error: {
        message: "  Narrative-only failure  ",
      },
    });
    expect(summarizeStripeInvoiceLastError(inv)).toBe("Narrative-only failure");
  });

  it("returns null when no finalization error", () => {
    expect(summarizeStripeInvoiceLastError(invoice({}))).toBeNull();
  });

  it("returns null when finalization error has no usable string fields", () => {
    expect(summarizeStripeInvoiceLastError(invoice({ last_finalization_error: {} }))).toBeNull();
  });

  it("returns null when finalization code and message collapse to whitespace only", () => {
    expect(
      summarizeStripeInvoiceLastError(
        invoice({ last_finalization_error: { code: "   ", message: " \n ", decline_code: "  " } }),
      ),
    ).toBeNull();
  });

  it("truncates long finalize messages to 500 characters with an ellipsis suffix", () => {
    const inv = invoice({
      last_finalization_error: {
        code: "c",
        message: "z".repeat(600),
      },
    });
    const s = summarizeStripeInvoiceLastError(inv);
    expect(s).toBeDefined();
    expect(s!.length).toBe(500);
    expect(s!.endsWith("…")).toBe(true);
  });
});

describe("summarizeStoredInvoiceErrorSnippet", () => {
  it("prefers expanded payment failure over finalization error", () => {
    const inv = invoice({
      payments: {
        data: [
          {
            payment: {
              payment_intent: {
                object: "payment_intent",
                last_payment_error: {
                  code: "card_declined",
                  decline_code: "generic_decline",
                  message: "Your card was declined.",
                },
              },
            },
          },
        ],
      },
      last_finalization_error: { code: "other", message: "Finalize fail" },
    });
    const s = summarizeStoredInvoiceErrorSnippet(inv);
    expect(s).toContain("card_declined");
    expect(s).toContain("Invoice finalize");
    expect(s).toContain("other");
  });

  it("returns null when neither payer nor finalize context exists", () => {
    expect(summarizeStoredInvoiceErrorSnippet(invoice({}))).toBeNull();
  });

  it("uses last_finalization_error when payer expansion has no usable failures", () => {
    expect(
      summarizeStoredInvoiceErrorSnippet(
        invoice({
          last_finalization_error: { code: "finalize_only", message: "No PI expand" },
        }),
      ),
    ).toBe("finalize_only · No PI expand");
  });

  it("ignores nested charge shapes that are not object type charge", () => {
    expect(
      summarizeStoredInvoiceErrorSnippet(
        invoice({
          payments: {
            data: [
              {
                payment: {
                  charge: { object: "refund", failure_code: "should_not_surface" },
                },
              },
            ],
          },
        }),
      ),
    ).toBeNull();
  });

  it("skips expanded payment rows whose payment_intent is not a Stripe payment_intent object", () => {
    expect(
      summarizeStoredInvoiceErrorSnippet(
        invoice({
          payments: {
            data: [
              {
                payment: {
                  payment_intent: {
                    object: "subscription",
                    last_payment_error: { code: "ignored", message: "x" },
                  },
                },
              },
            ],
          },
        }),
      ),
    ).toBeNull();
  });

  it("walks older rows until it finds an expanded PI failure snippet", () => {
    expect(
      summarizeStoredInvoiceErrorSnippet(
        invoice({
          payments: {
            data: [
              {
                payment: {
                  payment_intent: {
                    object: "unexpected",
                  },
                },
              },
              {
                payment: {
                  payment_intent: {
                    object: "payment_intent",
                    last_payment_error: { code: "second_row", message: "hit" },
                  },
                },
              },
            ],
          },
        }),
      ),
    ).toContain("second_row");
  });

  it("ignores non-object last_payment_error on an otherwise valid payment_intent", () => {
    expect(
      summarizeStoredInvoiceErrorSnippet(
        invoice({
          payments: {
            data: [
              {
                payment: {
                  payment_intent: {
                    object: "payment_intent",
                    last_payment_error: "oops",
                  },
                },
              },
            ],
          },
        }),
      ),
    ).toBeNull();
  });

  it("reads expanded charge.failure_code when no payment_intent error is present", () => {
    const inv = invoice({
      payments: {
        data: [
          {
            payment: {
              charge: {
                object: "charge",
                failure_code: "insufficient_funds",
                failure_message: "Insufficient funds.",
              },
            },
          },
        ],
      },
    });
    expect(summarizeStoredInvoiceErrorSnippet(inv)).toContain("insufficient_funds");
    expect(summarizeStoredInvoiceErrorSnippet(inv)).toContain("Insufficient funds.");
  });

  it("uses charge on the same row when payment_intent is valid but carries no failure snippet", () => {
    const s = summarizeStoredInvoiceErrorSnippet(
      invoice({
        payments: {
          data: [
            {
              payment: {
                payment_intent: {
                  object: "payment_intent",
                },
                charge: {
                  object: "charge",
                  failure_code: "lost_card",
                  failure_message: "Card lost.",
                },
              },
            },
          ],
        },
      }),
    );
    expect(s).toContain("lost_card");
    expect(s).toContain("Card lost.");
  });

  it("prefers the later payment rows when iterating expanded payments.data", () => {
    const inv = invoice({
      payments: {
        data: [
          {
            payment: {
              payment_intent: {
                object: "payment_intent",
                last_payment_error: { code: "older_row", message: "first attempt" },
              },
            },
          },
          {
            payment: {
              payment_intent: {
                object: "payment_intent",
                last_payment_error: { code: "newer_row", message: "retry" },
              },
            },
          },
        ],
      },
    });
    const s = summarizeStoredInvoiceErrorSnippet(inv);
    expect(s).toContain("newer_row");
    expect(s).not.toContain("older_row");
  });
});

describe("prismaInvoicePayloadFromStripe", () => {
  it("maps core fields and defaults", () => {
    const before = Date.now();
    const inv = invoice({
      status: "open",
      hosted_invoice_url: "https://pay.stripe.com/i",
      number: "INV-9",
      amount_due: 1099,
      currency: "usd",
      attempt_count: 2,
      next_payment_attempt: 2000000000,
    });
    const p = prismaInvoicePayloadFromStripe(inv);
    expect(p).toMatchObject({
      status: "open",
      hostedInvoiceUrl: "https://pay.stripe.com/i",
      invoiceNumber: "INV-9",
      amountDueCents: 1099,
      amountPaidCents: null,
      totalCents: null,
      currency: "usd",
      attemptCount: 2,
    });
    expect(p.nextPaymentAttemptAt?.getTime()).toBe(2000000000 * 1000);
    expect(p.lastStripeErrorSummary).toBeNull();
    expect(p.lastSyncedFromStripeAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("clamps attempt_count and treats missing amount as null", () => {
    const invNeg = invoice({ status: "draft", attempt_count: -5, amount_due: "x" });
    expect(prismaInvoicePayloadFromStripe(invNeg).attemptCount).toBe(0);

    const invHuge = invoice({ attempt_count: 9e15 });
    expect(prismaInvoicePayloadFromStripe(invHuge).attemptCount).toBe(2_147_483_647);

    expect(prismaInvoicePayloadFromStripe(invoice({ attempt_count: 1.7 })).attemptCount).toBe(2);
  });

  it("drops next_payment_attempt at or below zero", () => {
    expect(prismaInvoicePayloadFromStripe(invoice({ next_payment_attempt: 0 })).nextPaymentAttemptAt).toBeNull();
    expect(prismaInvoicePayloadFromStripe(invoice({ next_payment_attempt: -3 })).nextPaymentAttemptAt).toBeNull();
    expect(
      prismaInvoicePayloadFromStripe(invoice({ next_payment_attempt: undefined })).nextPaymentAttemptAt,
    ).toBeNull();
  });

  it("converts fractional next_payment_attempt epoch seconds to milliseconds", () => {
    expect(
      prismaInvoicePayloadFromStripe(invoice({ next_payment_attempt: 1704067200.25 })).nextPaymentAttemptAt?.getTime(),
    ).toBe(1704067200250);
  });

  it("includes lastStripeErrorSummary from expanded payments on the persisted payload", () => {
    const inv = invoice({
      status: "open",
      hosted_invoice_url: null,
      number: null,
      amount_due: 100,
      currency: "usd",
      payments: {
        data: [
          {
            payment: {
              payment_intent: {
                object: "payment_intent",
                last_payment_error: { code: "card_declined", message: "No." },
              },
            },
          },
        ],
      },
    });
    const p = prismaInvoicePayloadFromStripe(inv);
    expect(p.lastStripeErrorSummary).toContain("card_declined");
  });

  it("maps amount_paid and total when Stripe sends them", () => {
    const p = prismaInvoicePayloadFromStripe(
      invoice({
        status: "paid",
        amount_due: 0,
        amount_paid: 2500,
        total: 2500,
        currency: "usd",
      }),
    );
    expect(p.amountPaidCents).toBe(2500);
    expect(p.totalCents).toBe(2500);
  });

  it("defaults unknown status and currency fallbacks when Stripe omits them", () => {
    const p = prismaInvoicePayloadFromStripe(invoice({}));
    expect(p.status).toBe("unknown");
    expect(p.currency).toBe("usd");
    expect(p.amountPaidCents).toBeNull();
    expect(p.totalCents).toBeNull();
  });

  it("treats non-finite attempt_count as null", () => {
    expect(prismaInvoicePayloadFromStripe(invoice({ attempt_count: Number.POSITIVE_INFINITY })).attemptCount).toBeNull();
    expect(prismaInvoicePayloadFromStripe(invoice({ attempt_count: Number.NaN })).attemptCount).toBeNull();
  });
});

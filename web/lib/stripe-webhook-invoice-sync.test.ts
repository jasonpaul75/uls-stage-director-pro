import { describe, expect, it, vi } from "vitest";

import type Stripe from "stripe";

import {
  applyInvoiceWebhookEvent,
  upsertInvoiceFromStripeObject,
  webhookPayloadForStorage,
} from "./stripe-webhook-invoice-sync";

function minimalInvoice(partial: Partial<Stripe.Invoice> & { id: string; metadata?: Stripe.Metadata }): Stripe.Invoice {
  return {
    object: "invoice",
    id: partial.id,
    status: partial.status ?? "open",
    currency: partial.currency ?? "usd",
    amount_due: partial.amount_due ?? 100,
    hosted_invoice_url: partial.hosted_invoice_url ?? null,
    number: partial.number ?? null,
    attempt_count: partial.attempt_count ?? null,
    next_payment_attempt: partial.next_payment_attempt ?? null,
    metadata: partial.metadata,
    last_finalization_error: partial.last_finalization_error,
    payments: partial.payments,
  } as unknown as Stripe.Invoice;
}

describe("webhookPayloadForStorage", () => {
  it("records core event fields and invoice id for invoice.* events", () => {
    const event = {
      id: "evt_1",
      type: "invoice.paid",
      livemode: false,
      created: 12345,
      data: { object: { id: "in_1", object: "invoice" } },
    } as unknown as Stripe.Event;

    const stored = webhookPayloadForStorage(event);
    expect(stored).toMatchObject({
      id: "evt_1",
      type: "invoice.paid",
      livemode: false,
      created: 12345,
      invoiceId: "in_1",
    });
  });

  it("omits invoice id for non-invoice object types", () => {
    const event = {
      id: "evt_2",
      type: "invoice.paid",
      livemode: true,
      created: 1,
      data: { object: { object: "something_else" } },
    } as unknown as Stripe.Event;

    const stored = webhookPayloadForStorage(event) as Record<string, unknown>;
    expect(stored.invoiceId).toBeUndefined();
  });

  it("omits invoice id when object id is present but not a string", () => {
    const event = {
      id: "evt_str",
      type: "invoice.updated",
      livemode: false,
      created: 2,
      data: { object: { id: 999, object: "invoice" } },
    } as unknown as Stripe.Event;

    const stored = webhookPayloadForStorage(event) as Record<string, unknown>;
    expect(stored.invoiceId).toBeUndefined();
  });

  it("defaults livemode to false when Stripe omits it", () => {
    const event = {
      id: "evt_lm",
      type: "invoice.sent",
      created: 3,
      data: { object: { id: "in_lm", object: "invoice" } },
    } as unknown as Stripe.Event;

    const stored = webhookPayloadForStorage(event) as Record<string, unknown>;
    expect(stored.livemode).toBe(false);
  });

  it("does not infer invoice id when type is empty string", () => {
    const event = {
      id: "evt_blank_type",
      type: "",
      livemode: false,
      created: 4,
      data: { object: { id: "in_plain", object: "invoice" } },
    } as unknown as Stripe.Event;

    const stored = webhookPayloadForStorage(event) as Record<string, unknown>;
    expect(stored.invoiceId).toBeUndefined();
    expect(stored.type).toBe("");
  });

  it("does not attach invoice id when event type is not invoice.*", () => {
    const event = {
      id: "evt_pi",
      type: "payment_intent.succeeded",
      livemode: true,
      created: 9,
      data: { object: { id: "in_leak", object: "invoice" } },
    } as unknown as Stripe.Event;

    const stored = webhookPayloadForStorage(event) as Record<string, unknown>;
    expect(stored.invoiceId).toBeUndefined();
  });
});

describe("applyInvoiceWebhookEvent", () => {
  it("no-ops for unrelated event types", async () => {
    const tx = {
      projectStripeInvoice: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        deleteMany: vi.fn(),
      },
    };
    const event = { type: "charge.succeeded", data: {} } as unknown as Stripe.Event;
    await applyInvoiceWebhookEvent(tx as never, event);
    expect(tx.projectStripeInvoice.upsert).not.toHaveBeenCalled();
    expect(tx.projectStripeInvoice.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes local row on invoice.deleted", async () => {
    const tx = {
      projectStripeInvoice: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        deleteMany: vi.fn(),
      },
    };
    const inv = minimalInvoice({ id: "in_del" });
    const event = {
      type: "invoice.deleted",
      data: { object: inv },
    } as unknown as Stripe.Event;

    await applyInvoiceWebhookEvent(tx as never, event);
    expect(tx.projectStripeInvoice.deleteMany).toHaveBeenCalledWith({
      where: { stripeInvoiceId: "in_del" },
    });
    expect(tx.projectStripeInvoice.upsert).not.toHaveBeenCalled();
  });

  it("no-ops when event object is not an invoice", async () => {
    const tx = {
      projectStripeInvoice: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        deleteMany: vi.fn(),
      },
    };
    const event = {
      type: "invoice.paid",
      data: { object: { object: "customer", id: "cus_1" } },
    } as unknown as Stripe.Event;

    await applyInvoiceWebhookEvent(tx as never, event);
    expect(tx.projectStripeInvoice.upsert).not.toHaveBeenCalled();
    expect(tx.projectStripeInvoice.deleteMany).not.toHaveBeenCalled();
  });

  it("prefers stripeInvoicePayload over event.data.object when provided", async () => {
    const tx = {
      projectStripeInvoice: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn(),
        deleteMany: vi.fn(),
      },
    };
    const overlay = minimalInvoice({ id: "in_overlay", metadata: { projectId: "proj_ov" } });
    const event = {
      type: "invoice.updated",
      data: { object: { object: "not_invoice" } },
    } as unknown as Stripe.Event;

    await applyInvoiceWebhookEvent(tx as never, event, { stripeInvoicePayload: overlay });

    expect(tx.projectStripeInvoice.upsert).toHaveBeenCalledTimes(1);
  });
});

describe("upsertInvoiceFromStripeObject", () => {
  it("returns early when invoice metadata.projectId is missing", async () => {
    const tx = {
      projectStripeInvoice: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
    };
    await upsertInvoiceFromStripeObject(tx as never, minimalInvoice({ id: "in_x", metadata: undefined }));
    expect(tx.projectStripeInvoice.upsert).not.toHaveBeenCalled();
  });

  it("returns early when metadata.projectId is present but not a string", async () => {
    const tx = {
      projectStripeInvoice: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
    };
    await upsertInvoiceFromStripeObject(
      tx as never,
      minimalInvoice({ id: "in_meta", metadata: { projectId: 12345 } as unknown as Stripe.Metadata }),
    );
    expect(tx.projectStripeInvoice.upsert).not.toHaveBeenCalled();
  });

  it("upserts create path with project id from metadata", async () => {
    const tx = {
      projectStripeInvoice: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn(),
      },
    };
    await upsertInvoiceFromStripeObject(
      tx as never,
      minimalInvoice({ id: "in_new", metadata: { projectId: "proj_a" } }),
    );
    expect(tx.projectStripeInvoice.upsert).toHaveBeenCalledTimes(1);
    const call = tx.projectStripeInvoice.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ stripeInvoiceId: "in_new" });
    expect(call.create).toMatchObject({
      projectId: "proj_a",
      stripeInvoiceId: "in_new",
      status: "open",
    });
  });

  it("preserves stored lastStripeErrorSummary on open invoice when Stripe payload omits it", async () => {
    const tx = {
      projectStripeInvoice: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ lastStripeErrorSummary: "card_declined · previous" }),
        upsert: vi.fn(),
      },
    };
    await upsertInvoiceFromStripeObject(
      tx as never,
      minimalInvoice({
        id: "in_retry",
        metadata: { projectId: "p1" },
        status: "open",
      }),
    );
    const payload = tx.projectStripeInvoice.upsert.mock.calls[0][0].update as {
      lastStripeErrorSummary: string | null;
      status: string;
    };
    expect(payload.status).toBe("open");
    expect(payload.lastStripeErrorSummary).toBe("card_declined · previous");
  });

  it("does not replace incoming error text when Stripe payload already carries summary", async () => {
    const tx = {
      projectStripeInvoice: {
        findUnique: vi.fn().mockResolvedValue({ lastStripeErrorSummary: "prior · old" }),
        upsert: vi.fn(),
      },
    };
    await upsertInvoiceFromStripeObject(
      tx as never,
      minimalInvoice({
        id: "in_fresh_err",
        metadata: { projectId: "p1" },
        status: "open",
        last_finalization_error: {
          code: "current_code",
          message: "from webhook",
        },
      }),
    );
    const payload = tx.projectStripeInvoice.upsert.mock.calls[0][0].update as {
      lastStripeErrorSummary: string | null;
    };
    expect(payload.lastStripeErrorSummary).toContain("current_code");
    expect(payload.lastStripeErrorSummary).not.toContain("prior");
  });

  it("does not retain stored error snippet when webhook invoice is no longer open", async () => {
    const tx = {
      projectStripeInvoice: {
        findUnique: vi.fn().mockResolvedValue({ lastStripeErrorSummary: "should_not_stick" }),
        upsert: vi.fn(),
      },
    };
    await upsertInvoiceFromStripeObject(
      tx as never,
      minimalInvoice({
        id: "in_closed",
        metadata: { projectId: "p1" },
        status: "paid",
      }),
    );
    const payload = tx.projectStripeInvoice.upsert.mock.calls[0][0].update as {
      lastStripeErrorSummary: string | null;
      status: string;
    };
    expect(payload.status).toBe("paid");
    expect(payload.lastStripeErrorSummary).toBeNull();
  });
});

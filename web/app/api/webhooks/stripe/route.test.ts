import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";

import type Stripe from "stripe";

import { POST } from "./route";

const prismaMocks = vi.hoisted(() => ({
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: prismaMocks.$transaction,
  },
}));

const getStripeInner = vi.hoisted(() => vi.fn());

const revalidateMocks = vi.hoisted(() => ({
  revalidateProducerOverview: vi.fn(),
  revalidateProjectMirrorCache: vi.fn(),
}));

vi.mock("@/lib/stripe-admin", () => ({
  getStripe: () => getStripeInner(),
}));

vi.mock("@/lib/revalidate-project-mirror-cache", () => ({
  revalidateProducerOverview: revalidateMocks.revalidateProducerOverview,
  revalidateProjectMirrorCache: revalidateMocks.revalidateProjectMirrorCache,
}));

const applyInvoiceWebhookEvent = vi.hoisted(() => vi.fn());
const webhookPayloadForStorage = vi.hoisted(() => vi.fn(() => ({ stripeEventCompact: true })));

vi.mock("@/lib/stripe-webhook-invoice-sync", () => ({
  applyInvoiceWebhookEvent: applyInvoiceWebhookEvent,
  webhookPayloadForStorage: webhookPayloadForStorage,
}));

const retrieveInvoiceExpandedAfterPaymentFailure = vi.hoisted(() => vi.fn().mockResolvedValue(null));

vi.mock("@/lib/stripe-invoice-webhook-enrich", () => ({
  retrieveInvoiceExpandedAfterPaymentFailure: retrieveInvoiceExpandedAfterPaymentFailure,
}));

const ORIG_WH = process.env.STRIPE_WEBHOOK_SECRET;
const ORIG_SK = process.env.STRIPE_SECRET_KEY;

afterEach(() => {
  process.env.STRIPE_WEBHOOK_SECRET = ORIG_WH;
  process.env.STRIPE_SECRET_KEY = ORIG_SK;
  vi.clearAllMocks();
  prismaMocks.$transaction.mockReset();
  webhookPayloadForStorage.mockReturnValue({ stripeEventCompact: true });
});

function stripeWithConstructEvent(impl: (...args: unknown[]) => Stripe.Event) {
  return {
    webhooks: {
      constructEvent: vi.fn(impl),
    },
  };
}

describe("/api/webhooks/stripe POST", () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_route";
    process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
    getStripeInner.mockReset();
    getStripeInner.mockImplementation(
      () =>
        ({
          webhooks: {
            constructEvent: vi.fn(
              () =>
                ({
                  id: "evt_default",
                  type: "customer.updated",
                  livemode: false,
                  created: 0,
                  data: { object: {} },
                }) as Stripe.Event,
            ),
          },
        }) as Stripe,
    );
  });

  it("503 when STRIPE_WEBHOOK_SECRET unset", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = await POST(new Request("http://x/stripe", { method: "POST", body: "{}", headers: {} }));
    expect(res.status).toBe(503);
  });

  it("503 when getStripe resolves null-ish client", async () => {
    getStripeInner.mockReturnValueOnce(null as unknown as Stripe);
    const res = await POST(
      new Request("http://x/stripe", {
        method: "POST",
        body: "{}",
        headers: { "stripe-signature": "sig" },
      }),
    );
    expect(res.status).toBe(503);
  });

  it("400 when Stripe-Signature header missing", async () => {
    getStripeInner.mockImplementation(() =>
      stripeWithConstructEvent(() => {
        throw new Error("never");
      }) as unknown as Stripe,
    );
    const res = await POST(new Request("http://x/stripe", { method: "POST", body: "{}" }));
    expect(res.status).toBe(400);
  });

  it("400 when signature verification fails", async () => {
    getStripeInner.mockImplementation(() =>
      stripeWithConstructEvent(() => {
        throw new Error("bad sig");
      }) as unknown as Stripe,
    );
    const res = await POST(
      new Request("http://x/stripe", {
        method: "POST",
        body: "{}",
        headers: { "stripe-signature": "t=1,v=2" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns duplicate sentinel on P2002", async () => {
    const event = {
      id: "evt_dup",
      type: "invoice.paid",
      livemode: false,
      created: 1,
      data: {
        object: {
          object: "invoice",
          id: "in_99",
          metadata: {},
        },
      },
    } as unknown as Stripe.Event;

    getStripeInner.mockImplementation(() =>
      stripeWithConstructEvent(() => event) as unknown as Stripe,
    );

    prismaMocks.$transaction.mockRejectedValueOnce({ code: "P2002" });

    const res = await POST(
      new Request("http://x/stripe", {
        method: "POST",
        body: '{"x":1}',
        headers: { "stripe-signature": "v1,hmac" },
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, duplicate: true });
    expect(webhookPayloadForStorage).toHaveBeenCalledWith(event);
  });

  it("persists webhook, applies invoice helpers, mirrors revalidate when project metadata present", async () => {
    const event = {
      id: "evt_ok",
      type: "invoice.paid",
      livemode: false,
      created: 2,
      data: {
        object: {
          object: "invoice",
          id: "in_route",
          metadata: { projectId: "proj_stripe_route" },
        },
      },
    } as unknown as Stripe.Event;

    getStripeInner.mockImplementation(() =>
      stripeWithConstructEvent(() => event) as unknown as Stripe,
    );

    const createRow = vi.fn().mockResolvedValue({});
    const updateRow = vi.fn().mockResolvedValue({});

    prismaMocks.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
      await cb({
        stripeInboundEvent: {
          create: createRow,
          update: updateRow,
        },
      });
    });

    const res = await POST(
      new Request("http://x/stripe", {
        method: "POST",
        body: '{"ok":true}',
        headers: { "stripe-signature": "sig" },
      }),
    );

    expect(res.status).toBe(200);
    expect(createRow).toHaveBeenCalled();
    expect(updateRow).toHaveBeenCalled();
    expect(applyInvoiceWebhookEvent).toHaveBeenCalled();
    expect(revalidateMocks.revalidateProducerOverview).toHaveBeenCalled();
    expect(revalidateMocks.revalidateProjectMirrorCache).toHaveBeenCalledWith("proj_stripe_route");
    expect(retrieveInvoiceExpandedAfterPaymentFailure).not.toHaveBeenCalled();
  });

  it("invokes payment_failed retrieve path", async () => {
    const event = {
      id: "evt_pf",
      type: "invoice.payment_failed",
      livemode: false,
      created: 3,
      data: {
        object: {
          object: "invoice",
          id: "in_pf",
          metadata: {},
        },
      },
    } as unknown as Stripe.Event;

    getStripeInner.mockImplementation(() =>
      stripeWithConstructEvent(() => event) as unknown as Stripe,
    );

    const expanded = {
      ...event.data.object,
      payments: [],
    };

    retrieveInvoiceExpandedAfterPaymentFailure.mockResolvedValueOnce(expanded);

    prismaMocks.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
      await cb({
        stripeInboundEvent: {
          create: vi.fn().mockResolvedValue({}),
          update: vi.fn().mockResolvedValue({}),
        },
      });
    });

    await POST(
      new Request("http://x/stripe", {
        method: "POST",
        body: "{}",
        headers: { "stripe-signature": "s" },
      }),
    );

    expect(retrieveInvoiceExpandedAfterPaymentFailure).toHaveBeenCalled();
    expect(applyInvoiceWebhookEvent).toHaveBeenCalledWith(
      expect.anything(),
      event,
      expect.objectContaining({ stripeInvoicePayload: expanded }),
    );
  });
});

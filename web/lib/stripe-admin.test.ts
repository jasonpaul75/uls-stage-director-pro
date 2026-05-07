import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const StripeCtor = vi.hoisted(() =>
  vi.fn((sk: string, opts: { typescript?: boolean }) => ({ sk, opts })),
);

vi.mock("stripe", () => ({
  default: StripeCtor,
}));

import {
  getStripe,
  stripeInvoiceDashboardUrl,
  stripeSecretKeyAppearsSandbox,
  webhookSecretConfigured,
} from "./stripe-admin";

describe("getStripe", () => {
  const orig = process.env.STRIPE_SECRET_KEY;

  afterEach(() => {
    process.env.STRIPE_SECRET_KEY = orig;
  });

  beforeEach(() => {
    StripeCtor.mockClear();
  });

  it("returns null when STRIPE_SECRET_KEY is unset", () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(getStripe()).toBeNull();
    expect(StripeCtor).not.toHaveBeenCalled();
  });

  it("returns null when trimmed secret is empty", () => {
    process.env.STRIPE_SECRET_KEY = " \t ";
    expect(getStripe()).toBeNull();
    expect(StripeCtor).not.toHaveBeenCalled();
  });

  it("instantiates Stripe with trimmed key and typescript option", () => {
    process.env.STRIPE_SECRET_KEY = "  sk_live_abc  ";

    const client = getStripe();

    expect(client).toEqual({
      sk: "sk_live_abc",
      opts: { typescript: true },
    });
    expect(StripeCtor).toHaveBeenCalledExactlyOnceWith("sk_live_abc", { typescript: true });
  });
});

describe("stripeInvoiceDashboardUrl", () => {
  const orig = process.env.STRIPE_SECRET_KEY;

  afterEach(() => {
    process.env.STRIPE_SECRET_KEY = orig;
  });

  it("uses test dashboard prefix for sk_test secrets", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_xxxxxxxx";
    expect(stripeInvoiceDashboardUrl("in_123")).toBe("https://dashboard.stripe.com/test/invoices/in_123");
  });

  it("uses test dashboard after trimming secret with surrounding whitespace", () => {
    process.env.STRIPE_SECRET_KEY = "  sk_test_xxxxxxxx ";
    expect(stripeInvoiceDashboardUrl("in_trim")).toBe("https://dashboard.stripe.com/test/invoices/in_trim");
  });

  it("uses live dashboard for production-style secrets or missing env", () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(stripeInvoiceDashboardUrl("in_live")).toBe("https://dashboard.stripe.com/invoices/in_live");

    process.env.STRIPE_SECRET_KEY = "sk_live_xxx";
    expect(stripeInvoiceDashboardUrl("in_abc")).toBe("https://dashboard.stripe.com/invoices/in_abc");
  });
});

describe("webhookSecretConfigured", () => {
  const orig = process.env.STRIPE_WEBHOOK_SECRET;

  afterEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = orig;
  });

  it("is true only when trimmed secret is present", () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    expect(webhookSecretConfigured()).toBe(false);

    process.env.STRIPE_WEBHOOK_SECRET = "   ";
    expect(webhookSecretConfigured()).toBe(false);

    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    expect(webhookSecretConfigured()).toBe(true);
  });
});

describe("stripeSecretKeyAppearsSandbox", () => {
  const orig = process.env.STRIPE_SECRET_KEY;

  afterEach(() => {
    process.env.STRIPE_SECRET_KEY = orig;
  });

  it("detects sk_test prefix after trim", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_abc";
    expect(stripeSecretKeyAppearsSandbox()).toBe(true);

    process.env.STRIPE_SECRET_KEY = "  sk_test_abc  ";
    expect(stripeSecretKeyAppearsSandbox()).toBe(true);

    process.env.STRIPE_SECRET_KEY = "sk_live_abc";
    expect(stripeSecretKeyAppearsSandbox()).toBe(false);
  });
});

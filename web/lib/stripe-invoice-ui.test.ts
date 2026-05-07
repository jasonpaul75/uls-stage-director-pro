import { describe, expect, it } from "vitest";

import {
  stripeDirectorOpenInvoiceAttemptsNote,
  stripeHasOpenBalanceDue,
  stripeInvoiceProducerHint,
  stripeInvoiceStatusLabel,
  stripeOpenInvoiceRetryGuide,
  formatStripeRecordSynced,
  formatMoneyFromCents,
} from "./stripe-invoice-ui";

describe("stripeInvoiceStatusLabel", () => {
  it("covers known synced statuses", () => {
    expect(stripeInvoiceStatusLabel("draft")).toBe("Draft");
    expect(stripeInvoiceStatusLabel("open")).toBe("Open — payment due");
    expect(stripeInvoiceStatusLabel("paid")).toBe("Paid");
  });

  it("underscore-fallback for unknown statuses", () => {
    expect(stripeInvoiceStatusLabel("past_due_custom")).toBe("past due custom");
  });

  it("passes through simple unknown labels", () => {
    expect(stripeInvoiceStatusLabel("custom")).toBe("custom");
  });
});

describe("stripeInvoiceProducerHint", () => {
  it("returns null for unrecognized status", () => {
    expect(stripeInvoiceProducerHint("weird")).toBeNull();
  });

  it("returns draft guidance", () => {
    expect(stripeInvoiceProducerHint("draft")).toContain("Add lines");
  });

  it("returns guidance for payable and terminal states", () => {
    expect(stripeInvoiceProducerHint("open")).toContain("hosted invoice");
    expect(stripeInvoiceProducerHint("paid")).toContain("Settled");
    expect(stripeInvoiceProducerHint("void")).toContain("voided");
    expect(stripeInvoiceProducerHint("uncollectible")).toContain("uncollectible");
  });
});

describe("formatStripeRecordSynced", () => {
  it("includes calendar year from a fixed UTC instant", () => {
    const s = formatStripeRecordSynced(new Date(Date.UTC(2026, 3, 10, 9, 0, 0)));
    expect(s).toMatch(/2026/);
  });
});

describe("formatMoneyFromCents", () => {
  it("formats USD minor units (/100)", () => {
    const expected = (1099 / 100).toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
    });
    expect(formatMoneyFromCents(1099, "usd")).toBe(expected);
    expect(formatMoneyFromCents(1099)).toBe(expected);
  });

  it("formats zero-decimal currencies without dividing by 100", () => {
    const expected = (2500 / 1).toLocaleString(undefined, {
      style: "currency",
      currency: "JPY",
    });
    expect(formatMoneyFromCents(2500, "jpy")).toBe(expected);
  });

  it("treats empty currency code like USD presentation", () => {
    const expectedUsd = (100 / 100).toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
    });
    expect(formatMoneyFromCents(100, "")).toBe(expectedUsd);
  });

  it("is case-insensitive on ISO currency codes", () => {
    const lower = formatMoneyFromCents(501, "eur");
    const upper = formatMoneyFromCents(501, "EUR");
    expect(lower).toBe(upper);
  });

  it("formats zero balance in major units", () => {
    const expected = (0).toLocaleString(undefined, { style: "currency", currency: "USD" });
    expect(formatMoneyFromCents(0, "usd")).toBe(expected);
  });
});

describe("stripeHasOpenBalanceDue", () => {
  it("detects collectible open invoices with positive amount_due", () => {
    expect(
      stripeHasOpenBalanceDue([
        { status: "paid", amountDueCents: 0 },
        { status: "open", amountDueCents: 50 },
      ]),
    ).toBe(true);
  });

  it("returns false when no qualifying rows", () => {
    expect(
      stripeHasOpenBalanceDue([
        { status: "open", amountDueCents: 0 },
        { status: "open", amountDueCents: null },
        { status: "paid", amountDueCents: 999 },
      ]),
    ).toBe(false);
  });

  it("ignores open invoices with non-positive amount_due including negatives", () => {
    expect(stripeHasOpenBalanceDue([{ status: "open", amountDueCents: -50 }])).toBe(false);
  });
});

describe("stripeDirectorOpenInvoiceAttemptsNote", () => {
  it("shows note only for open unpaid with attempts logged", () => {
    expect(
      stripeDirectorOpenInvoiceAttemptsNote({
        status: "open",
        amountDueCents: 100,
        attemptCount: 2,
      }),
    ).toContain("logged at least one automated collection milestone");
  });

  it("fires at exactly one Stripe collection milestone", () => {
    expect(
      stripeDirectorOpenInvoiceAttemptsNote({
        status: "open",
        amountDueCents: 10,
        attemptCount: 1,
      }),
    ).toContain("at least one automated collection milestone");
  });

  it("returns null otherwise", () => {
    expect(
      stripeDirectorOpenInvoiceAttemptsNote({
        status: "draft",
        amountDueCents: 100,
        attemptCount: 2,
      }),
    ).toBeNull();
    expect(
      stripeDirectorOpenInvoiceAttemptsNote({
        status: "open",
        amountDueCents: 100,
        attemptCount: 0,
      }),
    ).toBeNull();

    expect(
      stripeDirectorOpenInvoiceAttemptsNote({
        status: "open",
        amountDueCents: 100,
        attemptCount: null,
      }),
    ).toBeNull();

    expect(
      stripeDirectorOpenInvoiceAttemptsNote({
        status: "open",
        amountDueCents: 100,
        attemptCount: Number.NaN,
      }),
    ).toBeNull();

    expect(
      stripeDirectorOpenInvoiceAttemptsNote({
        status: "open",
        amountDueCents: 100,
        attemptCount: Number.POSITIVE_INFINITY,
      }),
    ).toBeNull();

    expect(
      stripeDirectorOpenInvoiceAttemptsNote({
        status: "open",
        amountDueCents: 100,
        attemptCount: -1,
      }),
    ).toBeNull();

    expect(
      stripeDirectorOpenInvoiceAttemptsNote({
        status: "open",
        amountDueCents: 100,
        attemptCount: 0.25,
      }),
    ).toBeNull();

    expect(
      stripeDirectorOpenInvoiceAttemptsNote({
        status: "open",
        amountDueCents: 0,
        attemptCount: 3,
      }),
    ).toBeNull();
  });
});

describe("stripeOpenInvoiceRetryGuide", () => {
  it("is non-trivial copy referencing payment retry context", () => {
    expect(stripeOpenInvoiceRetryGuide.length).toBeGreaterThan(80);
    expect(stripeOpenInvoiceRetryGuide.toLowerCase()).toContain("stripe");
    expect(stripeOpenInvoiceRetryGuide.toLowerCase()).toContain("hosted");
  });
});

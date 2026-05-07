import { describe, expect, it } from "vitest";

import { producerEventWorkspaceGate } from "./producer-event-workspace-gate";

describe("producerEventWorkspaceGate", () => {
  it("unlocked only when DocuSign completed and a paid Stripe invoice exists", () => {
    expect(
      producerEventWorkspaceGate({
        docuSignEnvelopes: [{ completedAt: new Date() }],
        stripeInvoices: [{ status: "paid" }],
      }).unlocked,
    ).toBe(true);

    expect(
      producerEventWorkspaceGate({
        docuSignEnvelopes: [{ completedAt: null }],
        stripeInvoices: [{ status: "paid" }],
      }).unlocked,
    ).toBe(false);

    expect(
      producerEventWorkspaceGate({
        docuSignEnvelopes: [{ completedAt: new Date() }],
        stripeInvoices: [{ status: "open" }],
      }).unlocked,
    ).toBe(false);
  });

  it("treats paid status case-insensitively", () => {
    expect(
      producerEventWorkspaceGate({
        docuSignEnvelopes: [{ completedAt: new Date() }],
        stripeInvoices: [{ status: "PAID" }],
      }).unlocked,
    ).toBe(true);
  });
});

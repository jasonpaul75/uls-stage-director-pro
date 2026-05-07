import { describe, expect, it } from "vitest";

import { docuSignEnvelopeStatusLabel } from "./docusign-envelope-ui";

describe("docuSignEnvelopeStatusLabel", () => {
  it("maps known lowercase webhook statuses", () => {
    expect(docuSignEnvelopeStatusLabel("completed")).toBe("Completed");
    expect(docuSignEnvelopeStatusLabel("SENT")).toBe("Sent — awaiting signatures");
    expect(docuSignEnvelopeStatusLabel("unknown")).toBe("Status pending");
    expect(docuSignEnvelopeStatusLabel("  UnKnOwN  ")).toBe("Status pending");
  });

  it("normalizes spaces to underscores before matching switch", () => {
    expect(docuSignEnvelopeStatusLabel("  signed  ")).toBe("Signer action recorded");
  });

  it("falls back to humanized raw string", () => {
    expect(docuSignEnvelopeStatusLabel("custom_vendor_state")).toBe("custom vendor state");
    expect(docuSignEnvelopeStatusLabel("Vendor_Custom")).toBe("Vendor Custom");
  });

  it("matches labels after trimming, lowercasing, and collapsing interior whitespace", () => {
    expect(docuSignEnvelopeStatusLabel("  VoIdEd\t")).toBe("Voided");
    expect(docuSignEnvelopeStatusLabel("  sent ")).toBe("Sent — awaiting signatures");
  });
});

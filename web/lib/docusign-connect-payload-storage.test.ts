import { describe, expect, it } from "vitest";

import { trimDocuSignConnectForStorage } from "./docusign-connect-payload-storage";

describe("trimDocuSignConnectForStorage", () => {
  it("keeps envelope metadata envelopeId/status/subject drops recipient noise", () => {
    const out = trimDocuSignConnectForStorage({
      event: "envelope-sent",
      generatedDateTime: "2026-01-01",
      uri: "/connect",
      data: {
        envelopeId: "from-data",
        envelopeSummary: {
          envelopeId: "summary-id",
          status: "sent",
          emailSubject: "Sign this",
          signers: [{ name: "LEAK", email: "x@y.z" }],
        },
        envelope: {
          envelopeId: "env-id",
          status: "created",
          customFields: { secret: "nope" },
        },
      },
    });

    expect(out).toMatchObject({
      event: "envelope-sent",
      generatedDateTime: "2026-01-01",
      uri: "/connect",
    });
    expect((out as Record<string, unknown>).data).toEqual({
      envelopeId: "from-data",
      envelopeSummary: {
        envelopeId: "summary-id",
        status: "sent",
        emailSubject: "Sign this",
      },
      envelope: {
        envelopeId: "env-id",
        status: "created",
      },
    });
  });

  it("handles missing data object", () => {
    const out = trimDocuSignConnectForStorage({ event: "ping" });
    expect((out as Record<string, unknown>).data).toEqual({});
  });

  it("preserves top-level Connect audit fields alongside trimmed data", () => {
    const out = trimDocuSignConnectForStorage({
      event: "envelope-sent",
      generatedDateTime: "t",
      apiVersion: "v2.1",
      retryCount: 1,
      configurationId: "cfg",
      uri: "/u",
      data: { envelopeId: "e1" },
    });
    expect(out).toMatchObject({
      event: "envelope-sent",
      generatedDateTime: "t",
      apiVersion: "v2.1",
      retryCount: 1,
      configurationId: "cfg",
      uri: "/u",
    });
  });

  it("ignores non-object data property", () => {
    const out = trimDocuSignConnectForStorage({
      event: "x",
      data: "not-an-object" as unknown as Record<string, unknown>,
    });
    expect((out as Record<string, unknown>).data).toEqual({});
  });

  it("keeps envelopeSummary status even when summary omits envelopeId", () => {
    const out = trimDocuSignConnectForStorage({
      event: "envelope-delivered",
      data: {
        envelopeSummary: { status: "Delivered" },
      },
    });
    expect((out as Record<string, unknown>).data).toEqual({
      envelopeSummary: { status: "Delivered" },
    });
  });

  it("copies envelope status when envelopeId is non-string while dropping noise fields", () => {
    const out = trimDocuSignConnectForStorage({
      event: "envelope-sent",
      data: {
        envelope: {
          envelopeId: 12345,
          status: "sent",
          recipients: [{ email: "leak@x.com" }],
        },
      },
    });
    expect((out as Record<string, unknown>).data).toEqual({
      envelope: { status: "sent" },
    });
  });
});

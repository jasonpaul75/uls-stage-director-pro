import { describe, expect, it } from "vitest";

import {
  extractConnectEnvelopeFields,
  resolveTrackedEnvelopeStatus,
} from "./docusign-connect-parse";

describe("extractConnectEnvelopeFields", () => {
  it("returns null for non-object payloads", () => {
    expect(extractConnectEnvelopeFields(null)).toBeNull();
    expect(extractConnectEnvelopeFields("x")).toBeNull();
  });

  it("reads envelopeId + status from data.envelopeSummary", () => {
    const parsed = extractConnectEnvelopeFields({
      event: "envelope-completed",
      data: {
        envelopeSummary: {
          envelopeId: "AAAAAAAA-BBBB-4CCC-DDDD-EEEEEEEEEEEE",
          status: "Completed",
        },
      },
    });
    expect(parsed).toMatchObject({
      envelopeId: "aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee",
      envelopeStatusRaw: "Completed",
      event: "envelope-completed",
    });
  });

  it("falls back to uri segment when envelopeId missing", () => {
    const parsed = extractConnectEnvelopeFields({
      uri: "/restapi/v2.1/accounts/xxx/envelopes/12345678-1234-4123-8123-123456789abc",
    });
    expect(parsed?.envelopeId).toBe("12345678-1234-4123-8123-123456789abc");
  });

  it("reads flat data.envelopeId before nested structures", () => {
    const parsed = extractConnectEnvelopeFields({
      event: "envelope-sent",
      data: {
        envelopeId: "BBBBBBBB-BBBB-4BBB-BBBB-BBBBBBBBBBBB",
        envelopeSummary: { envelopeId: "AAAAAAAA-BBBB-4AAA-BBBB-AAAAAAAAAAAA", status: "Sent" },
      },
    });
    expect(parsed?.envelopeId).toBe("bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb");
    expect(parsed?.envelopeStatusRaw).toBe("Sent");
  });

  it("fills envelopeId and status from data.envelope when summary omits ids", () => {
    const parsed = extractConnectEnvelopeFields({
      data: {
        envelope: {
          envelopeId: "CCCCCCCC-CCCC-4CCC-CCCC-CCCCCCCCCCCC",
          status: "Delivered",
        },
      },
    });
    expect(parsed).toMatchObject({
      envelopeId: "cccccccc-cccc-4ccc-cccc-cccccccccccc",
      envelopeStatusRaw: "Delivered",
    });
  });

  it("reads root envelopeId and generatedDateTime when data absent", () => {
    const parsed = extractConnectEnvelopeFields({
      event: "recipient-completed",
      generatedDateTime: "2026-04-30T12:00:00Z",
      envelopeId: "  DDDDDDDD-DDDD-4DDD-DDDD-DDDDDDDDDDDD  ",
    });
    expect(parsed).toMatchObject({
      envelopeId: "dddddddd-dddd-4ddd-dddd-dddddddddddd",
      event: "recipient-completed",
      generatedDateTime: "2026-04-30T12:00:00Z",
    });
  });

  it("ignores whitespace-only root envelopeId and still parses uri envelope uuid", () => {
    const parsed = extractConnectEnvelopeFields({
      envelopeId: "  \t  ",
      uri: "/restapi/v2.1/accounts/x/envelopes/ab12ab12-ab12-ab12-ab12-ab12ab12ab12/other",
      event: "envelope-sent",
    });
    expect(parsed?.envelopeId).toBe("ab12ab12-ab12-ab12-ab12-ab12ab12ab12");
    expect(parsed?.event).toBe("envelope-sent");
  });

  it("leaves envelopeId unset when uri has no envelopes uuid segment", () => {
    const parsed = extractConnectEnvelopeFields({
      uri: "/health",
      event: "envelope-sent",
    });
    expect(parsed?.envelopeId).toBeUndefined();
    expect(parsed?.event).toBe("envelope-sent");
  });

  it("reads envelopeSummary status when summary omits envelopeId", () => {
    expect(
      extractConnectEnvelopeFields({
        event: "envelope-sent",
        data: { envelopeSummary: { status: "Sent" } },
      }),
    ).toMatchObject({
      envelopeId: undefined,
      envelopeStatusRaw: "Sent",
      event: "envelope-sent",
    });
  });
});

describe("resolveTrackedEnvelopeStatus", () => {
  it("prefers explicit summary status", () => {
    expect(
      resolveTrackedEnvelopeStatus({
        envelopeStatusRaw: "VOIDED",
        event: "envelope-sent",
      }),
    ).toBe("voided");
  });

  it("infers from event type when summary missing", () => {
    expect(
      resolveTrackedEnvelopeStatus({
        event: "envelope-declined",
      }),
    ).toBe("declined");

    expect(
      resolveTrackedEnvelopeStatus({
        event: "recipient-signed",
      }),
    ).toBe("signed");
  });

  it("maps remaining envelope-* events used in Connect", () => {
    expect(resolveTrackedEnvelopeStatus({ event: "envelope-completed" })).toBe("completed");
    expect(resolveTrackedEnvelopeStatus({ event: "envelope-voided" })).toBe("voided");
    expect(resolveTrackedEnvelopeStatus({ event: "envelope-deleted" })).toBe("deleted");
    expect(resolveTrackedEnvelopeStatus({ event: "envelope-sent" })).toBe("sent");
    expect(resolveTrackedEnvelopeStatus({ event: "envelope-delivered" })).toBe("delivered");
    expect(resolveTrackedEnvelopeStatus({ event: "recipient-completed" })).toBe("signed");
  });

  it("ignores whitespace-only summary and infers from event", () => {
    expect(
      resolveTrackedEnvelopeStatus({
        envelopeStatusRaw: "   \t",
        event: "envelope-voided",
      }),
    ).toBe("voided");
  });

  it("returns undefined when nothing resolves", () => {
    expect(resolveTrackedEnvelopeStatus({ event: "ping" })).toBeUndefined();
    expect(resolveTrackedEnvelopeStatus(null)).toBeUndefined();
  });

  it("returns undefined when event is whitespace-only and summary absent", () => {
    expect(resolveTrackedEnvelopeStatus({ event: "  \t\n" })).toBeUndefined();
  });
});

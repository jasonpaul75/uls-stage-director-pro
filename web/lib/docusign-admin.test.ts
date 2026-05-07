import { afterEach, describe, expect, it } from "vitest";

import {
  DOCUSIGN_RFC_DOCUMENTATION_SAMPLE_ENVELOPE_ID,
  docuSignConnectHmacSecretConfigured,
  docuSignProducerConsoleEnvelopeUrl,
  docuSignRecipientDocumentsHubUrl,
  docuSignUseDemoConsole,
  envelopeIdLooksValid,
  normalizeDocuSignEnvelopeId,
} from "./docusign-admin";

const ORIG_DEMO = process.env.DOCUSIGN_USE_DEMO;

afterEach(() => {
  process.env.DOCUSIGN_USE_DEMO = ORIG_DEMO;
});

describe("normalizeDocuSignEnvelopeId", () => {
  it("lowercases and trims", () => {
    expect(normalizeDocuSignEnvelopeId("  ABCD0123-E29B-41D4-A716-4466554400AA ")).toBe(
      "abcd0123-e29b-41d4-a716-4466554400aa",
    );
  });
});

describe("envelopeIdLooksValid", () => {
  it("accepts RFC-like hex GUID envelopes", () => {
    expect(envelopeIdLooksValid("12345678-abcd-4ef0-8123-456789abcdef")).toBe(true);
  });

  it("rejects malformed and documentation sample GUID", () => {
    expect(envelopeIdLooksValid("not-a-guid")).toBe(false);
    expect(envelopeIdLooksValid(DOCUSIGN_RFC_DOCUMENTATION_SAMPLE_ENVELOPE_ID)).toBe(false);
    expect(envelopeIdLooksValid("123456789-abcd-4ef0-8123-456789abcdef")).toBe(false);
  });

  it("trims before validation and rejects variants of the documentation sample", () => {
    expect(envelopeIdLooksValid(`  ${DOCUSIGN_RFC_DOCUMENTATION_SAMPLE_ENVELOPE_ID}  `)).toBe(false);
    expect(
      envelopeIdLooksValid(DOCUSIGN_RFC_DOCUMENTATION_SAMPLE_ENVELOPE_ID.toUpperCase()),
    ).toBe(false);
  });

  it("accepts surround whitespace on real envelope ids", () => {
    const id = "aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee";
    expect(envelopeIdLooksValid(`  ${id}  `)).toBe(true);
  });
});

describe("docuSignConnectHmacSecretConfigured", () => {
  const ORIG = process.env.DOCUSIGN_CONNECT_HMAC_SECRET;

  afterEach(() => {
    process.env.DOCUSIGN_CONNECT_HMAC_SECRET = ORIG;
  });

  it("requires a non-whitespace DOCUSIGN_CONNECT_HMAC_SECRET", () => {
    delete process.env.DOCUSIGN_CONNECT_HMAC_SECRET;
    expect(docuSignConnectHmacSecretConfigured()).toBe(false);

    process.env.DOCUSIGN_CONNECT_HMAC_SECRET = " ";
    expect(docuSignConnectHmacSecretConfigured()).toBe(false);

    process.env.DOCUSIGN_CONNECT_HMAC_SECRET = "shared-secret-here";
    expect(docuSignConnectHmacSecretConfigured()).toBe(true);
  });
});

describe("docuSignUseDemoConsole and URLs", () => {
  it("targets production hosts by default", () => {
    delete process.env.DOCUSIGN_USE_DEMO;
    expect(docuSignUseDemoConsole()).toBe(false);
    expect(docuSignProducerConsoleEnvelopeUrl("env-1")).toBe(
      "https://apps.docusign.com/send/documents/details/env-1",
    );
    expect(docuSignRecipientDocumentsHubUrl()).toBe("https://apps.docusign.com/documents");
  });

  it("honors truthy DEMO flags", () => {
    for (const v of ["1", "TRUE", "Yes"]) {
      process.env.DOCUSIGN_USE_DEMO = v;
      expect(docuSignUseDemoConsole()).toBe(true);
      expect(docuSignProducerConsoleEnvelopeUrl("abc")).toContain("apps-d.docusign.com");
      expect(docuSignRecipientDocumentsHubUrl()).toContain("apps-d.");
    }
  });

  it("treats non-truthy demo env values as production console", () => {
    for (const v of ["0", "false", "NO", "", "  "]) {
      process.env.DOCUSIGN_USE_DEMO = v;
      expect(docuSignUseDemoConsole()).toBe(false);
    }
  });

  it("percent-encodes envelope ids in producer console URLs", () => {
    delete process.env.DOCUSIGN_USE_DEMO;
    expect(docuSignProducerConsoleEnvelopeUrl("env id")).toBe(
      "https://apps.docusign.com/send/documents/details/env%20id",
    );
  });
});

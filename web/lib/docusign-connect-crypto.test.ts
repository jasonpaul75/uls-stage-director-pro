import { createHmac } from "crypto";

import { describe, expect, it } from "vitest";

import {
  docuSignConnectHmacMatchesBody,
  headerDocuSignConnectSignature,
  sha256HexUtf8,
} from "./docusign-connect-crypto";

describe("headerDocuSignConnectSignature", () => {
  it("reads signature-1 with precedence over generic signature header", () => {
    const h = new Headers();
    h.set("X-Docusign-Signature", "second");
    h.set("X-Docusign-Signature-1", " primary ");
    expect(headerDocuSignConnectSignature(h)).toBe("primary");
  });

  it("falls back to x-docusign-signature when signature-1 missing", () => {
    const h = new Headers();
    h.set("X-Docusign-Signature", " abase64 ");
    expect(headerDocuSignConnectSignature(h)).toBe("abase64");
  });

  it("falls back through signature-2 and legacy DocuSignature header keys", () => {
    const h2 = new Headers();
    h2.set("X-Docusign-Signature-2", " second-tier ");
    expect(headerDocuSignConnectSignature(h2)).toBe("second-tier");

    const h3 = new Headers();
    h3.set("X-Docusignature-1", " alt ");
    expect(headerDocuSignConnectSignature(h3)).toBe("alt");
  });

  it("returns null when no known signature header is present", () => {
    expect(headerDocuSignConnectSignature(new Headers())).toBeNull();
  });
});

describe("docuSignConnectHmacMatchesBody", () => {
  it("returns true for a valid base64-encoded SHA-256 HMAC digest", () => {
    const secret = "connect-secret";
    const body = '{"event":"recipient-completed"}';
    const theirs = createHmac("sha256", secret).update(body, "utf8").digest("base64");
    expect(docuSignConnectHmacMatchesBody(secret, body, theirs)).toBe(true);
  });

  it("returns false when secret or header is empty", () => {
    expect(docuSignConnectHmacMatchesBody("", "x", "eA==")).toBe(false);
    expect(docuSignConnectHmacMatchesBody("secret", "x", "   ")).toBe(false);
  });

  it("returns false when body or signature differs", () => {
    const secret = "s";
    const body = "{}";
    const good = createHmac("sha256", secret).update(body, "utf8").digest("base64");
    expect(docuSignConnectHmacMatchesBody(secret, body + " ", good)).toBe(false);
    expect(docuSignConnectHmacMatchesBody("other", body, good)).toBe(false);
  });
});

describe("sha256HexUtf8", () => {
  it("matches the well-known empty-string SHA-256 hex", () => {
    expect(sha256HexUtf8("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("matches UTF-8 single-byte payloads", () => {
    expect(sha256HexUtf8("a")).toBe(
      "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
    );
  });
});

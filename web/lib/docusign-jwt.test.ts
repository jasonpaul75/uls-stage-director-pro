import jwt from "jsonwebtoken";

import { afterEach, describe, expect, it, vi } from "vitest";

import { docusignJwtConfigured, fetchDocuSignAccessToken } from "./docusign-jwt";

const ENV_KEYS = [
  "DOCUSIGN_INTEGRATION_KEY",
  "DOCUSIGN_USER_ID",
  "DOCUSIGN_RSA_PRIVATE_KEY",
  "DOCUSIGN_AUTH_SERVER",
  "DOCUSIGN_USE_DEMO",
] as const;

const ENV_SNAPSHOT: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};
for (const k of ENV_KEYS) {
  ENV_SNAPSHOT[k] = process.env[k];
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const k of ENV_KEYS) {
    const v = ENV_SNAPSHOT[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

function setJwtEnvMinimal() {
  process.env.DOCUSIGN_INTEGRATION_KEY = "ik_test";
  process.env.DOCUSIGN_USER_ID = "user-guid";
  process.env.DOCUSIGN_RSA_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\\nstub\\n-----END PRIVATE KEY-----";
}

describe("docusignJwtConfigured", () => {
  it("requires integration key, user id, and RSA PEM", () => {
    for (const k of ENV_KEYS) delete process.env[k];

    expect(docusignJwtConfigured()).toBe(false);

    setJwtEnvMinimal();
    expect(docusignJwtConfigured()).toBe(true);
  });

  it("treats whitespace-only env values as unset", () => {
    for (const k of ENV_KEYS) delete process.env[k];
    setJwtEnvMinimal();
    process.env.DOCUSIGN_INTEGRATION_KEY = " \t";
    expect(docusignJwtConfigured()).toBe(false);
  });
});

describe("fetchDocuSignAccessToken", () => {
  it("returns null when JWT env trio is incomplete", async () => {
    for (const k of ENV_KEYS) delete process.env[k];
    await expect(fetchDocuSignAccessToken()).resolves.toBeNull();
  });

  it("returns null when jwt.sign throws before network", async () => {
    setJwtEnvMinimal();
    vi.spyOn(jwt, "sign").mockImplementation(() => {
      throw new Error("invalid pem shape");
    });
    await expect(fetchDocuSignAccessToken()).resolves.toBeNull();
  });

  it("POSTs assertion to DocuSign account host and parses access_token", async () => {
    setJwtEnvMinimal();
    delete process.env.DOCUSIGN_AUTH_SERVER;
    delete process.env.DOCUSIGN_USE_DEMO;

    vi.spyOn(jwt, "sign").mockReturnValue("assertion-token");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "access_abc" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchDocuSignAccessToken()).resolves.toBe("access_abc");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://account.docusign.com/oauth/token",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }),
    );

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.body).toBeInstanceOf(URLSearchParams);
    expect((init?.body as URLSearchParams).get("grant_type")).toBe(
      "urn:ietf:params:oauth:grant-type:jwt-bearer",
    );
    expect((init?.body as URLSearchParams).get("assertion")).toBe("assertion-token");
  });

  it("strips https scheme from DOCUSIGN_AUTH_SERVER before building token URL", async () => {
    setJwtEnvMinimal();
    process.env.DOCUSIGN_AUTH_SERVER = "https://pinned-oauth.example";

    vi.spyOn(jwt, "sign").mockReturnValue("j");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "t" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchDocuSignAccessToken();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://pinned-oauth.example/oauth/token",
      expect.any(Object),
    );
  });

  it("strips http scheme from DOCUSIGN_AUTH_SERVER before building token URL", async () => {
    setJwtEnvMinimal();
    process.env.DOCUSIGN_AUTH_SERVER = "http://legacy-oauth.example";

    vi.spyOn(jwt, "sign").mockReturnValue("j");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "t" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchDocuSignAccessToken();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://legacy-oauth.example/oauth/token",
      expect.any(Object),
    );
  });

  it("uses demo OAuth host when DOCUSIGN_USE_DEMO is set and AUTH_SERVER is unset", async () => {
    setJwtEnvMinimal();
    delete process.env.DOCUSIGN_AUTH_SERVER;
    process.env.DOCUSIGN_USE_DEMO = "true";

    vi.spyOn(jwt, "sign").mockReturnValue("x");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "tok" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchDocuSignAccessToken();
    expect(fetchMock).toHaveBeenCalledWith("https://account-d.docusign.com/oauth/token", expect.any(Object));
  });

  it("returns null when token JSON omits access_token", async () => {
    setJwtEnvMinimal();
    vi.spyOn(jwt, "sign").mockReturnValue("j");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ error: "nope" }),
      }),
    );
    await expect(fetchDocuSignAccessToken()).resolves.toBeNull();
  });

  it("returns null when fetch throws after signing", async () => {
    setJwtEnvMinimal();
    vi.spyOn(jwt, "sign").mockReturnValue("j");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(fetchDocuSignAccessToken()).resolves.toBeNull();
  });

  it("respects stripped DOCUSIGN_AUTH_SERVER override host", async () => {
    setJwtEnvMinimal();
    process.env.DOCUSIGN_AUTH_SERVER = "custom-oauth-host.example";
    vi.spyOn(jwt, "sign").mockReturnValue("j");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "t" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchDocuSignAccessToken();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://custom-oauth-host.example/oauth/token",
      expect.any(Object),
    );
  });

  it("returns null on non-OK HTTP", async () => {
    setJwtEnvMinimal();
    vi.spyOn(jwt, "sign").mockReturnValue("j");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({}),
      }),
    );
    await expect(fetchDocuSignAccessToken()).resolves.toBeNull();
  });
});

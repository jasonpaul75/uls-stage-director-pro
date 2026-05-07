import { createHmac } from "crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "./route";

const prismaMocks = vi.hoisted(() => ({
  $transaction: vi.fn(),
}));

const revalidateMocks = vi.hoisted(() => ({
  revalidateProducerOverview: vi.fn(),
  revalidateProjectMirrorCache: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: prismaMocks.$transaction,
  },
}));

vi.mock("@/lib/revalidate-project-mirror-cache", () => ({
  revalidateProducerOverview: revalidateMocks.revalidateProducerOverview,
  revalidateProjectMirrorCache: revalidateMocks.revalidateProjectMirrorCache,
}));

const persistInbound = vi.hoisted(() => vi.fn());

vi.mock("@/lib/docusign-webhook-persist", () => ({
  persistDocuSignConnectInbound: persistInbound,
}));

const ORIG_HMAC = process.env.DOCUSIGN_CONNECT_HMAC_SECRET;

function hmacB64(secret: string, raw: string) {
  return createHmac("sha256", secret).update(raw, "utf8").digest("base64");
}

afterEach(() => {
  process.env.DOCUSIGN_CONNECT_HMAC_SECRET = ORIG_HMAC;
  vi.clearAllMocks();
  prismaMocks.$transaction.mockReset();
  persistInbound.mockReset();
});

describe("/api/webhooks/docusign GET", () => {
  it("returns routing metadata", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; path: string };
    expect(body.ok).toBe(true);
    expect(body.path).toBe("/api/webhooks/docusign");
  });
});

describe("/api/webhooks/docusign POST", () => {
  it("503 when DOCUSIGN_CONNECT_HMAC_SECRET is unset", async () => {
    delete process.env.DOCUSIGN_CONNECT_HMAC_SECRET;
    const res = await POST(new Request("http://x/docusign", { method: "POST", body: "{}" }));
    expect(res.status).toBe(503);
  });

  it("400 when DocuSign HMAC digest header absent", async () => {
    process.env.DOCUSIGN_CONNECT_HMAC_SECRET = "secret";
    const raw = '{"event":"x"}';
    const res = await POST(
      new Request("http://x/docusign", {
        method: "POST",
        body: raw,
      }),
    );
    expect(res.status).toBe(400);
  });

  it("401 when HMAC does not verify", async () => {
    process.env.DOCUSIGN_CONNECT_HMAC_SECRET = "secret";
    const raw = '{"event":"x"}';
    const res = await POST(
      new Request("http://x/docusign", {
        method: "POST",
        headers: { "X-Docusign-Signature-1": "not-valid" },
        body: raw,
      }),
    );
    expect(res.status).toBe(401);
  });

  it("400 when body is not JSON", async () => {
    process.env.DOCUSIGN_CONNECT_HMAC_SECRET = "secret";
    const raw = "{";
    const res = await POST(
      new Request("http://x/docusign", {
        method: "POST",
        headers: {
          "X-Docusign-Signature-1": hmacB64("secret", raw),
        },
        body: raw,
      }),
    );
    expect(res.status).toBe(400);
  });

  it("200 duplicate when unique constraint hits ingest", async () => {
    process.env.DOCUSIGN_CONNECT_HMAC_SECRET = "secret";
    const raw = '{"event":"ping"}';
    prismaMocks.$transaction.mockRejectedValueOnce({ code: "P2002" });

    const res = await POST(
      new Request("http://x/docusign", {
        method: "POST",
        headers: { "X-Docusign-Signature-1": hmacB64("secret", raw) },
        body: raw,
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, duplicate: true });
    expect(persistInbound).not.toHaveBeenCalled();
  });

  it("persists inbound and revalidates project mirror when Producer row resolved", async () => {
    process.env.DOCUSIGN_CONNECT_HMAC_SECRET = "secret";
    const payload = {
      event: "envelope-sent",
      data: { envelopeId: "aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee" },
    };
    const raw = JSON.stringify(payload);

    prismaMocks.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb({}));
    persistInbound.mockResolvedValueOnce({
      envelopeIdExtracted: "aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee",
      updatedLinkedEnvelope: true,
      projectId: "proj_webhook_ds",
    });

    const res = await POST(
      new Request("http://x/docusign", {
        method: "POST",
        headers: { "X-Docusign-Signature-1": hmacB64("secret", raw) },
        body: raw,
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(persistInbound).toHaveBeenCalledTimes(1);
    expect(revalidateMocks.revalidateProducerOverview).toHaveBeenCalledTimes(1);
    expect(revalidateMocks.revalidateProjectMirrorCache).toHaveBeenCalledWith("proj_webhook_ds");
  });
});

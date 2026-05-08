import { expect, test } from "@playwright/test";

/**
 * Webhooks are not bearer-auth like app routes — these checks ensure bogus traffic
 * cannot drive success-shaped responses without vendor secrets/signature posture.
 */
test.describe("Stripe & DocuSign webhook ingress", () => {
  test("DocuSign GET returns routing hint (smoke ping)", async ({ request }) => {
    const res = await request.get("/api/webhooks/docusign");
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { ok?: boolean; path?: string };
    expect(body.ok).toBe(true);
    expect(body.path).toBe("/api/webhooks/docusign");
  });

  test("DocuSign POST without HMAC header is rejected or unconfigured", async ({ request }) => {
    const res = await request.post("/api/webhooks/docusign", {
      data: "{}",
      headers: { "Content-Type": "application/json" },
    });
    expect([400, 503]).toContain(res.status());
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBeTruthy();
  });

  test("Stripe POST without signature is rejected or unconfigured", async ({ request }) => {
    const res = await request.post("/api/webhooks/stripe", {
      data: "{}",
      headers: { "Content-Type": "application/json" },
    });
    expect([400, 503]).toContain(res.status());
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBeTruthy();
  });
});

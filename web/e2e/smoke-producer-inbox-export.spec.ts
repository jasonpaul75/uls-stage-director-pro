import { expect, test } from "@playwright/test";

/**
 * Producer route handlers enforce auth themselves (layouts do not wrap Route Handlers).
 */
test.describe("producer inbox export (unauthenticated)", () => {
  test("GET returns forbidden without session", async ({ request }) => {
    const res = await request.get("/producer/inbox/export");
    expect(res.status()).toBe(403);
    await expect(res.json()).resolves.toMatchObject({ error: "Forbidden" });
  });
});

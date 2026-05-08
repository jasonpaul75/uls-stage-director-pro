import { expect, test } from "@playwright/test";

/** NextAuth/App Router endpoints must resolve for anonymous clients (shell + login form). */
test.describe("NextAuth public endpoints", () => {
  test("GET /api/auth/session is 200 without a signed-in cookie", async ({ request }) => {
    const res = await request.get("/api/auth/session");
    expect(res.status()).toBe(200);
    const data = (await res.json()) as Record<string, unknown> | null;
    const noUser =
      data == null || typeof data !== "object" || data.user === undefined || data.user === null;
    expect(noUser).toBe(true);
  });

  test("GET /api/auth/providers lists credentials provider", async ({ request }) => {
    const res = await request.get("/api/auth/providers");
    expect(res.status()).toBe(200);
    const providers = (await res.json()) as Record<string, { id?: string }>;
    expect(providers.credentials).toBeTruthy();
    expect(providers.credentials?.id).toBe("credentials");
  });

  test("GET /api/auth/csrf returns a csrf token", async ({ request }) => {
    const res = await request.get("/api/auth/csrf");
    expect(res.status()).toBe(200);
    const data = (await res.json()) as { csrfToken?: string };
    expect(typeof data.csrfToken).toBe("string");
    expect(data.csrfToken!.length).toBeGreaterThan(10);
  });
});

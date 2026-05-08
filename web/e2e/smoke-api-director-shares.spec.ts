import { expect, test } from "@playwright/test";

/**
 * Lightweight API gates for director reference uploads/downloads.
 * Unauthenticated callers must fail before touching storage-backed paths.
 */
test.describe("director-shares API (unauthenticated)", () => {
  test("download route returns forbidden without session", async ({ request }) => {
    const res = await request.get(
      "/api/director-shares/00000000-0000-4000-8000-000000000099",
    );
    expect(res.status()).toBe(403);
    await expect(res.json()).resolves.toMatchObject({ error: "Forbidden" });
  });

  test("presign POST returns forbidden without session", async ({ request }) => {
    const res = await request.post("/api/portal/director-shares/presign", {
      data: {
        projectId: "00000000-0000-4000-8000-000000000001",
        fileName: "reference.mp4",
        contentType: "video/mp4",
        sizeBytes: 4096,
      },
    });
    expect(res.status()).toBe(403);
    await expect(res.json()).resolves.toMatchObject({ error: "Forbidden" });
  });
});

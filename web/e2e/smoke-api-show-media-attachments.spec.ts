import { expect, test } from "@playwright/test";

const sampleId = "00000000-0000-4000-8000-0000000000aa";

/** Show media stream/redirect and confidential attachment download must not be public. */
test.describe("show media & producer attachment APIs (unauthenticated)", () => {
  test("show-media GET returns forbidden without session", async ({ request }) => {
    const res = await request.get(`/api/show-media/${sampleId}`);
    expect(res.status()).toBe(403);
    await expect(res.json()).resolves.toMatchObject({ error: "Forbidden" });
  });

  test("producer attachment download GET returns forbidden without session", async ({
    request,
  }) => {
    const res = await request.get(`/api/producer/attachments/${sampleId}/download`);
    expect(res.status()).toBe(403);
    await expect(res.json()).resolves.toMatchObject({ error: "Forbidden" });
  });
});

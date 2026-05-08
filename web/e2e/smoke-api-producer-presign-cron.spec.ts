import { expect, test } from "@playwright/test";

/** Producer upload presign + retention cron must not be callable anonymously. */
test.describe("producer presign & retention cron (unauthenticated)", () => {
  test("show-media presign POST returns forbidden without session", async ({ request }) => {
    const res = await request.post("/api/producer/show-media/presign", {
      data: {
        projectId: "00000000-0000-4000-8000-000000000001",
        lane: "MUSIC",
        fileName: "cue.mp3",
        contentType: "audio/mpeg",
        sizeBytes: 1024,
      },
    });
    expect(res.status()).toBe(403);
    await expect(res.json()).resolves.toMatchObject({ error: "Forbidden" });
  });

  test("media-library presign POST returns forbidden without session", async ({ request }) => {
    const res = await request.post("/api/producer/media-library/presign", {
      data: {
        lane: "VIDEO",
        fileName: "ref.mp4",
        contentType: "video/mp4",
        sizeBytes: 4096,
      },
    });
    expect(res.status()).toBe(403);
    await expect(res.json()).resolves.toMatchObject({ error: "Forbidden" });
  });

  test("retention-preview GET rejects missing cron bearer", async ({ request }) => {
    const res = await request.get("/api/cron/retention-preview");
    expect([401, 503]).toContain(res.status());
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBeTruthy();
  });
});

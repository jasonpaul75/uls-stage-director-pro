import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findMany },
  },
}));

describe("GET /api/cron/retention-preview", () => {
  const ORIG = process.env.CRON_RETENTION_PREVIEW_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    findMany.mockReset();
    process.env.CRON_RETENTION_PREVIEW_SECRET = "cron_test_secret";
  });

  afterEach(() => {
    if (ORIG === undefined) delete process.env.CRON_RETENTION_PREVIEW_SECRET;
    else process.env.CRON_RETENTION_PREVIEW_SECRET = ORIG;
    vi.useRealTimers();
  });

  it("503 when secret is not configured", async () => {
    delete process.env.CRON_RETENTION_PREVIEW_SECRET;
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/cron/retention-preview"));
    expect(res.status).toBe(503);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("401 when bearer does not match", async () => {
    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/cron/retention-preview", {
        headers: { Authorization: "Bearer wrong" },
      }),
    );
    expect(res.status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("returns eligible projects after the 36‑month anchor", async () => {
    vi.useFakeTimers({ now: new Date(Date.UTC(2030, 5, 1, 0, 0, 0)) });
    const conclusion = new Date(Date.UTC(2024, 0, 10, 12, 0, 0));
    findMany.mockResolvedValueOnce([{ id: "p_elig", name: "Show", eventConclusionAt: conclusion }]);

    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/cron/retention-preview", {
        headers: { Authorization: "Bearer cron_test_secret" },
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      eligibleCount: number;
      eligible: { id: string }[];
    };
    expect(body.eligibleCount).toBe(1);
    expect(body.eligible[0]?.id).toBe("p_elig");
  });
});

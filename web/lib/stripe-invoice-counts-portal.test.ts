import { beforeEach, describe, expect, it, vi } from "vitest";

const groupBy = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    projectStripeInvoice: {
      groupBy,
    },
  },
}));

describe("stripeInvoiceBucketsByProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    groupBy.mockReset();
  });

  it("returns an empty map for empty ids", async () => {
    const { stripeInvoiceBucketsByProject } = await import("./stripe-invoice-counts-portal");
    const map = await stripeInvoiceBucketsByProject([]);
    expect(map.size).toBe(0);
    expect(groupBy).not.toHaveBeenCalled();
  });

  it("builds buckets from prisma groupBy rows", async () => {
    const { stripeInvoiceBucketsByProject } = await import("./stripe-invoice-counts-portal");
    groupBy.mockResolvedValueOnce([
      { projectId: "p_alpha", status: "open", _count: { _all: 2 } },
      { projectId: "p_alpha", status: "paid", _count: { _all: 5 } },
      { projectId: "p_beta", status: "archaic", _count: { _all: 3 } },
    ]);

    const map = await stripeInvoiceBucketsByProject(["p_alpha", "p_beta"]);

    expect(map.get("p_alpha")).toMatchObject({
      open: 2,
      paid: 5,
      draft: 0,
      void: 0,
      uncollectible: 0,
      other: 0,
      total: 7,
    });
    expect(map.get("p_beta")).toMatchObject({
      other: 3,
      total: 3,
    });

    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ["projectId", "status"],
        where: { projectId: { in: ["p_alpha", "p_beta"] } },
      }),
    );
  });

  it("keeps zeros per project when groupBy yields no aggregates", async () => {
    const { stripeInvoiceBucketsByProject } = await import("./stripe-invoice-counts-portal");
    groupBy.mockResolvedValueOnce([]);

    const map = await stripeInvoiceBucketsByProject(["p_empty", "p_also_empty"]);

    expect(map.size).toBe(2);
    for (const pid of ["p_empty", "p_also_empty"] as const) {
      expect(map.get(pid)).toEqual({
        draft: 0,
        open: 0,
        paid: 0,
        void: 0,
        uncollectible: 0,
        other: 0,
        total: 0,
      });
    }

    expect(groupBy).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        where: { projectId: { in: ["p_empty", "p_also_empty"] } },
      }),
    );
  });

  it("drops groupBy shards missing from the requested id whitelist", async () => {
    const { stripeInvoiceBucketsByProject } = await import("./stripe-invoice-counts-portal");
    groupBy.mockResolvedValueOnce([
      { projectId: "not_requested", status: "open", _count: { _all: 99 } },
      { projectId: "p_track", status: "open", _count: { _all: 4 } },
    ]);

    const map = await stripeInvoiceBucketsByProject(["p_track"]);

    expect(map.size).toBe(1);
    expect(map.get("p_track")).toMatchObject({
      open: 4,
      paid: 0,
      draft: 0,
      void: 0,
      uncollectible: 0,
      other: 0,
      total: 4,
    });
  });
});

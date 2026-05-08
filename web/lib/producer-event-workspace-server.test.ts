import { beforeEach, describe, expect, it, vi } from "vitest";

const envelopeFindMany = vi.fn();
const invoiceFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    projectDocuSignEnvelope: { findMany: envelopeFindMany },
    projectStripeInvoice: { findMany: invoiceFindMany },
  },
}));

describe("producerEventUnlockMap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty map for empty input", async () => {
    const { producerEventUnlockMap } = await import("./producer-event-workspace-server");
    const m = await producerEventUnlockMap([]);
    expect(m.size).toBe(0);
    expect(envelopeFindMany).not.toHaveBeenCalled();
  });

  it("unlocks only when a project has completed envelope and paid invoice", async () => {
    envelopeFindMany.mockResolvedValueOnce([{ projectId: "a" }]);
    invoiceFindMany.mockResolvedValueOnce([
      { projectId: "a", status: "paid" },
      { projectId: "b", status: "open" },
    ]);

    const { producerEventUnlockMap } = await import("./producer-event-workspace-server");
    const m = await producerEventUnlockMap(["a", "b", "c"]);

    expect(m.get("a")).toBe(true);
    expect(m.get("b")).toBe(false);
    expect(m.get("c")).toBe(false);
  });

  it("does not unlock when contract row exists but no paid invoice", async () => {
    envelopeFindMany.mockResolvedValueOnce([{ projectId: "p" }]);
    invoiceFindMany.mockResolvedValueOnce([{ projectId: "p", status: "draft" }]);

    const { producerEventUnlockMap } = await import("./producer-event-workspace-server");
    const m = await producerEventUnlockMap(["p"]);
    expect(m.get("p")).toBe(false);
  });
});

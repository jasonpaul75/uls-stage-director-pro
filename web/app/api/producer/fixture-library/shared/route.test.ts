import { afterEach, describe, expect, it, vi } from "vitest";

import { GET, POST, PUT } from "./route";
import { GlobalRole } from "@prisma/client";

const authMock = vi.fn();

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

const prismaMock = vi.hoisted(() => ({
  fixtureLibrarySharedPreset: {
    findMany: vi.fn(),
  },
  fixtureLibrarySharedAuditLog: {
    create: vi.fn(() => Promise.resolve({})),
  },
  $transaction: vi.fn((fn: (tx: unknown) => Promise<void>) =>
    fn({
      fixtureLibrarySharedPreset: {
        deleteMany: vi.fn(() => Promise.resolve({ count: 0 })),
        create: vi.fn(() => Promise.resolve({})),
      },
    }),
  ),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("/api/producer/fixture-library/shared", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("GET 403 when unauthenticated", async () => {
    authMock.mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(403);
    expect(prismaMock.fixtureLibrarySharedPreset.findMany).not.toHaveBeenCalled();
  });

  it("GET returns presets for producer", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "p1", globalRole: GlobalRole.PRODUCER } });
    prismaMock.fixtureLibrarySharedPreset.findMany.mockResolvedValueOnce([
      {
        label: "A",
        equipment: { fixtureId: "x" },
        updatedAt: new Date("2026-05-01T12:00:00Z"),
      },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = (await res.json()) as { presets: unknown[]; schemaVersion: number };
    expect(json.schemaVersion).toBe(1);
    expect(json.presets).toEqual([{ label: "A", equipment: { fixtureId: "x" } }]);
  });

  it("POST merge runs transaction for producer", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "p1", globalRole: GlobalRole.PRODUCER } });
    prismaMock.fixtureLibrarySharedPreset.findMany.mockResolvedValueOnce([]);

    const res = await POST(
      new Request("http://localhost/x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presets: [{ label: "New", equipment: { role: "LX" } }] }),
      }),
    );
    expect(res.status).toBe(200);
    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(prismaMock.fixtureLibrarySharedAuditLog.create).toHaveBeenCalled();
  });

  it("PUT 403 for producer (admin only)", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "p1", globalRole: GlobalRole.PRODUCER } });
    const res = await PUT(
      new Request("http://localhost/x", {
        method: "PUT",
        body: JSON.stringify({ presets: [] }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(403);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("PUT allows ULS admin", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "a1", globalRole: GlobalRole.ULS_ADMIN } });

    const res = await PUT(
      new Request("http://localhost/x", {
        method: "PUT",
        body: JSON.stringify({ presets: [{ label: "Only", equipment: { patch: "Dim" } }] }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(200);
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });
});

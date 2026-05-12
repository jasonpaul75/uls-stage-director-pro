import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";
import { GlobalRole } from "@prisma/client";

const authMock = vi.fn();

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

const db = vi.hoisted(() => ({
  findTax: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    staffTaxDocument: { findFirst: db.findTax },
  },
}));

const s3 = vi.hoisted(() => ({
  bucketOk: vi.fn(() => true),
  signedGet: vi.fn(async (..._args: unknown[]) => "https://signed.example/tax"),
}));

vi.mock("@/lib/s3-project-attachments", () => ({
  attachmentsBucketConfigured: () => s3.bucketOk(),
  signedGetAttachmentUrl: (storageKey: string, expires?: number, opts?: unknown) =>
    s3.signedGet(storageKey, expires, opts),
}));

describe("GET /api/producer/staff-tax/[documentId]", () => {
  afterEach(() => {
    vi.clearAllMocks();
    s3.bucketOk.mockReturnValue(true as never);
    s3.signedGet.mockImplementation(async (..._args: unknown[]) => "https://signed.example/tax");
  });

  it("403 when unauthenticated", async () => {
    authMock.mockResolvedValueOnce(null);

    const res = await GET(new Request("http://localhost/x?download=1"), {
      params: Promise.resolve({ documentId: "t1" }),
    });

    expect(res.status).toBe(403);
    expect(db.findTax).not.toHaveBeenCalled();
  });

  it("403 for staff role", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "s1", globalRole: GlobalRole.STAFF } });

    const res = await GET(new Request("http://localhost/x?download=1"), {
      params: Promise.resolve({ documentId: "t1" }),
    });

    expect(res.status).toBe(403);
  });

  it("302 producer to signed URL when download=1", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "p1", globalRole: GlobalRole.PRODUCER } });
    db.findTax.mockResolvedValueOnce({
      storageKey: "uls-stage-director/staff-tax/u/x.pdf",
      fileName: "w9.pdf",
      contentType: "application/pdf",
    });

    const res = await GET(new Request("http://localhost/x?download=1"), {
      params: Promise.resolve({ documentId: "t1" }),
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://signed.example/tax");
    expect(s3.signedGet).toHaveBeenCalled();
  });

  it("404 when row missing", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "p1", globalRole: GlobalRole.PRODUCER } });
    db.findTax.mockResolvedValueOnce(null);

    const res = await GET(new Request("http://localhost/x?download=1"), {
      params: Promise.resolve({ documentId: "missing" }),
    });

    expect(res.status).toBe(404);
  });
});

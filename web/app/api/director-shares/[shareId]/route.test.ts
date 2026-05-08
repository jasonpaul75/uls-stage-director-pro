import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";
import { GlobalRole, ProjectRole } from "@prisma/client";

const authMock = vi.fn();

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

const db = vi.hoisted(() => ({
  findShare: vi.fn(),
  findMember: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    projectDirectorShare: { findFirst: db.findShare },
    projectMember: { findFirst: db.findMember },
  },
}));

const s3 = vi.hoisted(() => ({
  bucketOk: vi.fn(() => true),
  signedGet: vi.fn(() => Promise.resolve("https://signed.example/file")),
}));

vi.mock("@/lib/s3-project-attachments", () => ({
  attachmentsBucketConfigured: () => s3.bucketOk(),
  signedGetAttachmentUrl: (storageKey: string) => s3.signedGet(storageKey),
}));

describe("GET /api/director-shares/[shareId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockReset();
    db.findShare.mockReset();
    db.findMember.mockReset();
    s3.bucketOk.mockReturnValue(true as never);
    s3.signedGet.mockResolvedValue("https://signed.example/file");
  });

  it("403 unauthenticated", async () => {
    authMock.mockResolvedValueOnce(null);
    const res = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ shareId: "s1" }),
    });
    expect(res.status).toBe(403);
  });

  it("302 for producer without membership check", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "p1", globalRole: GlobalRole.PRODUCER } });
    db.findShare.mockResolvedValueOnce({
      storageKey: "key-a",
      projectId: "proj",
      project: { eventConclusionAt: null },
    });

    const res = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ shareId: "s1" }),
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://signed.example/file");
    expect(db.findMember).not.toHaveBeenCalled();
  });

  it("403 director when not member", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "d1", globalRole: GlobalRole.DIRECTOR } });
    db.findShare.mockResolvedValueOnce({
      storageKey: "k",
      projectId: "proj",
      project: { eventConclusionAt: null },
    });
    db.findMember.mockResolvedValueOnce(null);

    const res = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ shareId: "s1" }),
    });

    expect(res.status).toBe(403);
    expect(db.findMember).toHaveBeenCalled();
  });

  it("302 director member with open access window", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "d1", globalRole: GlobalRole.DIRECTOR } });
    db.findShare.mockResolvedValueOnce({
      storageKey: "k2",
      projectId: "proj",
      project: { eventConclusionAt: null },
    });
    db.findMember.mockResolvedValueOnce({ id: "m1" });

    const res = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ shareId: "s1" }),
    });

    expect(res.status).toBe(302);
    expect(db.findMember).toHaveBeenCalledWith({
      where: { projectId: "proj", userId: "d1", role: ProjectRole.DIRECTOR },
      select: { id: true },
    });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";
import { GlobalRole, ProjectRole, ProjectStatus } from "@prisma/client";

const authMock = vi.fn();

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

const db = vi.hoisted(() => ({
  findMember: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    projectMember: { findFirst: db.findMember },
  },
}));

const s3 = vi.hoisted(() => ({
  bucketOk: vi.fn(() => true),
  signedPut: vi.fn(() => Promise.resolve("https://signed.example/upload")),
}));

vi.mock("@/lib/s3-project-attachments", () => ({
  attachmentsBucketConfigured: () => s3.bucketOk(),
  signedPutAttachmentUrl: (storageKey: string, contentType: string) => s3.signedPut(storageKey, contentType),
}));

describe("POST /api/portal/director-shares/presign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockReset();
    db.findMember.mockReset();
    s3.bucketOk.mockReturnValue(true as never);
    s3.signedPut.mockResolvedValue("https://signed.example/upload");
  });

  afterEach(() => {
    s3.bucketOk.mockReturnValue(true as never);
  });

  it("403 for producer", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "p1", globalRole: GlobalRole.PRODUCER } });

    const res = await POST(
      new Request("http://localhost/x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: "proj1",
          fileName: "a.mp3",
          contentType: "audio/mpeg",
          sizeBytes: 100,
        }),
      }),
    );

    expect(res.status).toBe(403);
    expect(db.findMember).not.toHaveBeenCalled();
  });

  it("400 when director not assigned to intake", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "d1", globalRole: GlobalRole.DIRECTOR } });
    db.findMember.mockResolvedValueOnce(null);

    const res = await POST(
      new Request("http://localhost/x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: "proj1",
          fileName: "a.mp3",
          contentType: "audio/mpeg",
          sizeBytes: 100,
        }),
      }),
    );

    expect(res.status).toBe(400);
  });

  it("returns uploadUrl for valid director + submitted project", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "d1", globalRole: GlobalRole.DIRECTOR } });
    db.findMember.mockResolvedValueOnce({
      project: {
        id: "proj1",
        status: ProjectStatus.INTAKE_SUBMITTED,
        eventConclusionAt: null,
      },
    });

    const res = await POST(
      new Request("http://localhost/x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: "proj1",
          fileName: "a.mp3",
          contentType: "audio/mpeg",
          sizeBytes: 100,
        }),
      }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { uploadUrl?: string; storageKey?: string };
    expect(json.uploadUrl).toBe("https://signed.example/upload");
    expect(json.storageKey).toContain("uls-stage-director/project-director-shares/proj1/");
    expect(db.findMember).toHaveBeenCalledWith({
      where: { projectId: "proj1", userId: "d1", role: ProjectRole.DIRECTOR },
      select: { project: { select: { id: true, status: true, eventConclusionAt: true } } },
    });
  });
});

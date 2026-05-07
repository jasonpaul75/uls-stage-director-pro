import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";
import { GlobalRole } from "@prisma/client";

const authMock = vi.fn();

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

const unlockedMock = vi.hoisted(() => vi.fn(() => Promise.resolve(true)));

vi.mock("@/lib/producer-event-workspace-server", () => ({
  isProducerEventWorkspaceUnlocked: () => unlockedMock(),
}));

const db = vi.hoisted(() => ({
  projectFindFirst: vi.fn(),
}));

const signedPutMock = vi.hoisted(() => vi.fn(() => Promise.resolve("https://signed.example/put-target")));

vi.mock("@/lib/s3-project-attachments", () => ({
  attachmentsBucketConfigured: () => true,
  signedPutAttachmentUrl: signedPutMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findFirst: db.projectFindFirst },
  },
}));

describe("POST /api/producer/show-media/presign", () => {
  beforeEach(() => {
    authMock.mockReset();
    signedPutMock.mockClear();
    unlockedMock.mockReset();
    unlockedMock.mockResolvedValue(true);
    db.projectFindFirst.mockReset();
  });

  it("403 when unauthenticated", async () => {
    authMock.mockResolvedValueOnce(null);
    const res = await POST(
      new Request("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({
          projectId: "p1",
          lane: "MUSIC",
          fileName: "a.mp3",
          contentType: "audio/mpeg",
          sizeBytes: 100,
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(403);
    expect(db.projectFindFirst).not.toHaveBeenCalled();
  });

  it("200 returns uploadUrl and storageKey for valid producer request", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "u1", globalRole: GlobalRole.PRODUCER } });
    db.projectFindFirst.mockResolvedValueOnce({ id: "p1" });
    const res = await POST(
      new Request("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({
          projectId: "p1",
          lane: "MUSIC",
          fileName: "cue.mp3",
          contentType: "audio/mpeg",
          sizeBytes: 1024,
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { uploadUrl: string; storageKey: string };
    expect(json.uploadUrl).toBe("https://signed.example/put-target");
    expect(json.storageKey).toMatch(/^uls-stage-director\/project-show-media\/p1\/[a-f0-9]{20}-cue\.mp3$/);
    expect(signedPutMock).toHaveBeenCalled();
  });

  it("403 when event workspace locked", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "u1", globalRole: GlobalRole.PRODUCER } });
    db.projectFindFirst.mockResolvedValueOnce({ id: "p1" });
    unlockedMock.mockResolvedValueOnce(false);
    const res = await POST(
      new Request("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({
          projectId: "p1",
          lane: "MUSIC",
          fileName: "cue.mp3",
          contentType: "audio/mpeg",
          sizeBytes: 1024,
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(403);
    expect(signedPutMock).not.toHaveBeenCalled();
  });

  it("400 when project not intake submitted", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "u1", globalRole: GlobalRole.PRODUCER } });
    db.projectFindFirst.mockResolvedValueOnce(null);
    const res = await POST(
      new Request("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({
          projectId: "p1",
          lane: "MUSIC",
          fileName: "cue.mp3",
          contentType: "audio/mpeg",
          sizeBytes: 1024,
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
  });
});

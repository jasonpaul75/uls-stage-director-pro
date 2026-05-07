import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";
import { GlobalRole } from "@prisma/client";

const authMock = vi.fn();

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

const signedPutMock = vi.hoisted(() => vi.fn(() => Promise.resolve("https://signed.example/put-library-target")));

vi.mock("@/lib/s3-project-attachments", () => ({
  attachmentsBucketConfigured: () => true,
  signedPutAttachmentUrl: signedPutMock,
}));

describe("POST /api/producer/media-library/presign", () => {
  beforeEach(() => {
    authMock.mockReset();
    signedPutMock.mockClear();
  });

  it("403 when unauthenticated", async () => {
    authMock.mockResolvedValueOnce(null);
    const res = await POST(
      new Request("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({
          lane: "MUSIC",
          fileName: "a.mp3",
          contentType: "audio/mpeg",
          sizeBytes: 100,
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(403);
  });

  it("200 returns uploadUrl and storageKey for valid producer request", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "u1", globalRole: GlobalRole.PRODUCER } });
    const res = await POST(
      new Request("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({
          lane: "MUSIC",
          fileName: "cue.mp3",
          contentType: "audio/mpeg",
          sizeBytes: 1024,
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { uploadUrl: string; storageKey: string; method: string };
    expect(json.uploadUrl).toBe("https://signed.example/put-library-target");
    expect(json.method).toBe("PUT");
    expect(json.storageKey).toMatch(/^uls-stage-director\/show-media-library\/[a-f0-9]{20}-cue\.mp3$/);
    expect(signedPutMock).toHaveBeenCalled();
  });

  it("400 when lane is invalid", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "u1", globalRole: GlobalRole.PRODUCER } });
    const res = await POST(
      new Request("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({
          lane: "OTHER",
          fileName: "cue.mp3",
          contentType: "audio/mpeg",
          sizeBytes: 1024,
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("400 when file exceeds lane max", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "u1", globalRole: GlobalRole.PRODUCER } });
    const res = await POST(
      new Request("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({
          lane: "MUSIC",
          fileName: "huge.mp3",
          contentType: "audio/mpeg",
          sizeBytes: 121 * 1024 * 1024,
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
  });
});

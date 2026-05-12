import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";
import { GlobalRole } from "@prisma/client";

const authMock = vi.fn();

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

const db = vi.hoisted(() => ({
  findLibrary: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    showMediaLibraryItem: { findFirst: db.findLibrary },
  },
}));

const s3 = vi.hoisted(() => ({
  bucketOk: vi.fn(() => true),
  signedGet: vi.fn(() => Promise.resolve("https://signed.example/lib-out")),
}));

vi.mock("@/lib/s3-project-attachments", () => ({
  attachmentsBucketConfigured: () => s3.bucketOk(),
  signedGetAttachmentUrl: (storageKey: string, expires?: number, opts?: unknown) =>
    s3.signedGet(storageKey, expires, opts),
}));

describe("GET /api/producer/media-library/[itemId]", () => {
  afterEach(() => {
    vi.clearAllMocks();
    s3.bucketOk.mockReturnValue(true as never);
    s3.signedGet.mockResolvedValue("https://signed.example/lib-out");
    vi.unstubAllGlobals();
  });

  it("403 when unauthenticated", async () => {
    authMock.mockResolvedValueOnce(null);

    const res = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ itemId: "lib1" }),
    });

    expect(res.status).toBe(403);
    expect(db.findLibrary).not.toHaveBeenCalled();
  });

  it("403 for director role", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "d1", globalRole: GlobalRole.DIRECTOR } });

    const res = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ itemId: "lib1" }),
    });

    expect(res.status).toBe(403);
    expect(db.findLibrary).not.toHaveBeenCalled();
  });

  it("503 when S3 bucket not configured", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "p1", globalRole: GlobalRole.PRODUCER } });
    s3.bucketOk.mockReturnValue(false as never);

    const res = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ itemId: "lib1" }),
    });

    expect(res.status).toBe(503);
  });

  it("404 when library row missing", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "p1", globalRole: GlobalRole.PRODUCER } });
    db.findLibrary.mockResolvedValueOnce(null);

    const res = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ itemId: "missing" }),
    });

    expect(res.status).toBe(404);
  });

  it("302 for producer with valid library key", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "p1", globalRole: GlobalRole.PRODUCER } });
    db.findLibrary.mockResolvedValueOnce({
      storageKey: "uls-stage-director/show-media-library/abc/z.mp3",
      contentType: "audio/mpeg",
      fileName: "z.mp3",
    });

    const res = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ itemId: "lib1" }),
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://signed.example/lib-out");
    expect(s3.signedGet).toHaveBeenCalledWith(
      "uls-stage-director/show-media-library/abc/z.mp3",
      900,
      expect.objectContaining({
        responseContentType: "audio/mpeg",
        responseContentDisposition: "inline",
      }),
    );
  });

  it("500 when storage key is outside library prefix", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "p1", globalRole: GlobalRole.PRODUCER } });
    db.findLibrary.mockResolvedValueOnce({
      storageKey: "uls-stage-director/project-show-media/p1/x.mp3",
      contentType: "audio/mpeg",
      fileName: "x.mp3",
    });

    const res = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ itemId: "lib1" }),
    });

    expect(res.status).toBe(500);
    expect(s3.signedGet).not.toHaveBeenCalled();
  });

  it("200 with proxy=1 streams signed URL body", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "a1", globalRole: GlobalRole.ULS_ADMIN } });
    db.findLibrary.mockResolvedValueOnce({
      storageKey: "uls-stage-director/show-media-library/k/t.mp3",
      contentType: "audio/mpeg",
      fileName: "t.mp3",
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response("bytes", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(new Request("http://localhost/x?proxy=1"), {
      params: Promise.resolve({ itemId: "lib1" }),
    });

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("bytes");
    expect(fetchMock).toHaveBeenCalledWith("https://signed.example/lib-out");
  });
});

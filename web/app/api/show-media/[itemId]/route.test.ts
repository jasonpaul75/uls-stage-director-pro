import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";
import { GlobalRole, ProjectRole } from "@prisma/client";

const authMock = vi.fn();

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

const db = vi.hoisted(() => ({
  findMedia: vi.fn(),
  findMember: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    projectShowMediaItem: { findFirst: db.findMedia },
    projectMember: { findFirst: db.findMember },
  },
}));

const s3 = vi.hoisted(() => ({
  bucketOk: vi.fn(() => true),
  signedGet: vi.fn(() => Promise.resolve("https://signed.example/media-out")),
}));

vi.mock("@/lib/s3-project-attachments", () => ({
  attachmentsBucketConfigured: () => s3.bucketOk(),
  signedGetAttachmentUrl: (storageKey: string, expires?: number) => s3.signedGet(storageKey, expires),
}));

describe("GET /api/show-media/[itemId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockReset();
    db.findMedia.mockReset();
    db.findMember.mockReset();
    s3.bucketOk.mockReturnValue(true as never);
    s3.signedGet.mockResolvedValue("https://signed.example/media-out");
  });

  afterEach(() => {
    s3.bucketOk.mockReturnValue(true as never);
    vi.unstubAllGlobals();
  });

  it("403 when unauthenticated", async () => {
    authMock.mockResolvedValueOnce(null);

    const res = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ itemId: "item1" }),
    });

    expect(res.status).toBe(403);
    expect(db.findMedia).not.toHaveBeenCalled();
  });

  it("503 when S3 bucket not configured", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "u1", globalRole: GlobalRole.PRODUCER } });
    s3.bucketOk.mockReturnValue(false as never);

    const res = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ itemId: "item1" }),
    });

    expect(res.status).toBe(503);
    expect(db.findMedia).not.toHaveBeenCalled();
  });

  it("404 when media row missing", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "u1", globalRole: GlobalRole.PRODUCER } });
    db.findMedia.mockResolvedValueOnce(null);

    const res = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ itemId: "missing" }),
    });

    expect(res.status).toBe(404);
    expect(s3.signedGet).not.toHaveBeenCalled();
  });

  it("302 for producer without director checks", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "p1", globalRole: GlobalRole.PRODUCER } });
    db.findMedia.mockResolvedValueOnce({
      storageKey: "uls-stage-director/project-show-media/proj/x.mp3",
      contentType: "audio/mpeg",
      projectId: "proj",
      project: {
        eventConclusionAt: null,
        showMediaDirectorVisible: false,
      },
    });

    const res = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ itemId: "mid" }),
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://signed.example/media-out");
    expect(db.findMember).not.toHaveBeenCalled();
    expect(s3.signedGet).toHaveBeenCalledWith("uls-stage-director/project-show-media/proj/x.mp3", 900);
  });

  it("403 director when playlist not published", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "d1", globalRole: GlobalRole.DIRECTOR } });
    db.findMedia.mockResolvedValueOnce({
      storageKey: "k",
      contentType: "audio/mpeg",
      projectId: "proj",
      project: {
        eventConclusionAt: null,
        showMediaDirectorVisible: false,
      },
    });

    const res = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ itemId: "mid" }),
    });

    expect(res.status).toBe(403);
    expect(db.findMember).not.toHaveBeenCalled();
    expect(s3.signedGet).not.toHaveBeenCalled();
  });

  it("403 director when not a member", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "d1", globalRole: GlobalRole.DIRECTOR } });
    db.findMedia.mockResolvedValueOnce({
      storageKey: "k",
      contentType: "audio/mpeg",
      projectId: "proj",
      project: {
        eventConclusionAt: null,
        showMediaDirectorVisible: true,
      },
    });
    db.findMember.mockResolvedValueOnce(null);

    const res = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ itemId: "mid" }),
    });

    expect(res.status).toBe(403);
    expect(db.findMember).toHaveBeenCalledWith({
      where: { projectId: "proj", userId: "d1", role: ProjectRole.DIRECTOR },
      select: { id: true },
    });
  });

  it("403 director after 90-day portal access window", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "d1", globalRole: GlobalRole.DIRECTOR } });
    const oldConclusion = new Date(Date.UTC(2020, 0, 1, 12, 0, 0));
    db.findMedia.mockResolvedValueOnce({
      storageKey: "k",
      contentType: "audio/mpeg",
      projectId: "proj",
      project: {
        eventConclusionAt: oldConclusion,
        showMediaDirectorVisible: true,
      },
    });

    const res = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ itemId: "mid" }),
    });

    expect(res.status).toBe(403);
    expect(db.findMember).not.toHaveBeenCalled();
  });

  it("302 director when visible, member, and access open", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "d1", globalRole: GlobalRole.DIRECTOR } });
    db.findMedia.mockResolvedValueOnce({
      storageKey: "key2",
      contentType: "audio/mpeg",
      projectId: "proj",
      project: {
        eventConclusionAt: null,
        showMediaDirectorVisible: true,
      },
    });
    db.findMember.mockResolvedValueOnce({ id: "m1" });

    const res = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ itemId: "mid" }),
    });

    expect(res.status).toBe(302);
    expect(s3.signedGet).toHaveBeenCalledWith("key2", 900);
  });

  it("500 when signing throws", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "a1", globalRole: GlobalRole.ULS_ADMIN } });
    db.findMedia.mockResolvedValueOnce({
      storageKey: "k",
      contentType: "audio/mpeg",
      projectId: "proj",
      project: { eventConclusionAt: null, showMediaDirectorVisible: false },
    });
    s3.signedGet.mockRejectedValueOnce(new Error("kms"));

    const res = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ itemId: "mid" }),
    });

    expect(res.status).toBe(500);
  });

  it("200 with proxy=1 streams signed URL body same-origin", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "p1", globalRole: GlobalRole.PRODUCER } });
    db.findMedia.mockResolvedValueOnce({
      storageKey: "k",
      contentType: "audio/mpeg",
      projectId: "proj",
      project: {
        eventConclusionAt: null,
        showMediaDirectorVisible: false,
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response("body-bytes", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(new Request("http://localhost/x?proxy=1"), {
      params: Promise.resolve({ itemId: "mid" }),
    });

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("body-bytes");
    expect(res.headers.get("content-type")).toBe("audio/mpeg");
    expect(fetchMock).toHaveBeenCalledWith("https://signed.example/media-out");
  });

  it("502 with proxy=1 parses S3 error Code when upstream denies", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "p1", globalRole: GlobalRole.PRODUCER } });
    db.findMedia.mockResolvedValueOnce({
      storageKey: "k",
      contentType: "audio/mpeg",
      projectId: "proj",
      project: {
        eventConclusionAt: null,
        showMediaDirectorVisible: false,
      },
    });
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?><Error><Code>AccessDenied</Code><Message>x</Message></Error>';
    const fetchMock = vi.fn().mockResolvedValue(new Response(xml, { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(new Request("http://localhost/x?proxy=1"), {
      params: Promise.resolve({ itemId: "mid" }),
    });

    expect(res.status).toBe(502);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.error).toBe("Upstream fetch failed");
    expect(json.upstreamStatus).toBe(403);
    expect(json.upstreamCode).toBe("AccessDenied");
    expect(String(json.hint ?? "")).toContain("GetObject");
  });
});

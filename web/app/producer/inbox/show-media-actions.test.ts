import { beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalRole, ShowMediaLane } from "@prisma/client";

const authMock = vi.fn();

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

const s3Mocks = vi.hoisted(() => ({
  put: vi.fn(),
  del: vi.fn(),
  copy: vi.fn(),
  head: vi.fn(),
}));

vi.mock("@/lib/s3-project-attachments", () => ({
  attachmentsBucketConfigured: () => true,
  putProjectAttachmentObject: s3Mocks.put,
  deleteProjectAttachmentObject: s3Mocks.del,
  copyObjectInAttachmentsBucket: s3Mocks.copy,
  headAttachmentObject: s3Mocks.head,
}));

const db = vi.hoisted(() => ({
  projectFindFirst: vi.fn(),
  aggregate: vi.fn(),
  create: vi.fn(),
  findFirstMedia: vi.fn(),
  deleteMedia: vi.fn(),
  updateMedia: vi.fn(),
  transaction: vi.fn(),
  projectUpdate: vi.fn(),
}));

const findManyMedia = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: {
      findFirst: db.projectFindFirst,
      update: db.projectUpdate,
    },
    projectShowMediaItem: {
      aggregate: db.aggregate,
      create: db.create,
      findFirst: db.findFirstMedia,
      findMany: findManyMedia,
      delete: db.deleteMedia,
      update: db.updateMedia,
    },
    $transaction: db.transaction,
  },
}));

vi.mock("@/lib/revalidate-project-mirror-cache", () => ({
  revalidateProjectMirrorCache: vi.fn(),
}));

vi.mock("@/lib/producer-event-workspace-server", () => ({
  requireProducerEventWorkspaceUnlocked: vi.fn(() => Promise.resolve()),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));

function producerSession(role: GlobalRole.PRODUCER | GlobalRole.ULS_ADMIN = GlobalRole.PRODUCER) {
  return { user: { id: "prod1", globalRole: role as const } };
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockReset();
  s3Mocks.put.mockReset();
  s3Mocks.del.mockReset();
  s3Mocks.copy.mockReset();
  s3Mocks.head.mockReset();
  findManyMedia.mockReset();
  db.projectFindFirst.mockReset();
  db.aggregate.mockReset();
  db.create.mockReset();
  db.findFirstMedia.mockReset();
  db.deleteMedia.mockReset();
  db.updateMedia.mockReset();
  db.transaction.mockReset();
  db.projectUpdate.mockReset();
});

describe("duplicateShowMediaItem", () => {
  it("copies S3 object and appends new DB row at end of lane", async () => {
    const { duplicateShowMediaItem } = await import("./show-media-actions");
    authMock.mockResolvedValueOnce(producerSession());
    db.projectFindFirst.mockResolvedValueOnce({ id: "p1" });
    db.findFirstMedia.mockResolvedValueOnce({
      storageKey: "uls-stage-director/project-show-media/p1/old.bin",
      lane: ShowMediaLane.MUSIC,
      fileName: "walk.mp3",
      contentType: "audio/mpeg",
      sizeBytes: 444,
    });
    db.aggregate.mockResolvedValueOnce({ _max: { sortOrder: 7 } });
    s3Mocks.copy.mockResolvedValueOnce(undefined);
    db.create.mockResolvedValueOnce({ id: "dup1" });

    const fd = new FormData();
    fd.set("projectId", "p1");
    fd.set("itemId", "item_src");

    await expect(duplicateShowMediaItem(fd)).rejects.toThrow("media_duplicated=1");

    expect(s3Mocks.copy).toHaveBeenCalledTimes(1);
    const copyArgs = s3Mocks.copy.mock.calls[0] as [string, string];
    expect(copyArgs[0]).toBe("uls-stage-director/project-show-media/p1/old.bin");
    expect(copyArgs[1]).toMatch(
      /^uls-stage-director\/project-show-media\/p1\/[a-f0-9]{20}-walk \(copy\)\.mp3$/,
    );

    expect(db.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "p1",
          lane: ShowMediaLane.MUSIC,
          sortOrder: 8,
          fileName: "walk (copy).mp3",
          sizeBytes: 444,
        }),
      }),
    );
  });
});

describe("finalizeShowMediaItemAfterS3Upload", () => {
  it("redirects unauthenticated users", async () => {
    const { finalizeShowMediaItemAfterS3Upload } = await import("./show-media-actions");
    authMock.mockResolvedValueOnce(null);
    const fd = new FormData();
    fd.set("projectId", "p1");
    fd.set("lane", "MUSIC");
    fd.set("storageKey", "uls-stage-director/project-show-media/p1/aaa.mp3");
    fd.set("fileName", "a.mp3");
    await expect(finalizeShowMediaItemAfterS3Upload(fd)).rejects.toThrow(
      "redirect:/login?callbackUrl=/producer/inbox",
    );
  });

  it("creates DB row after S3 object is present (presigned PUT flow)", async () => {
    const { finalizeShowMediaItemAfterS3Upload } = await import("./show-media-actions");
    authMock.mockResolvedValueOnce(producerSession());
    db.projectFindFirst.mockResolvedValueOnce({ id: "p1" });
    db.aggregate.mockResolvedValueOnce({ _max: { sortOrder: 2 } });
    db.create.mockResolvedValueOnce({ id: "m1" });
    s3Mocks.head.mockResolvedValueOnce({ contentLength: 2, contentType: "audio/mpeg" });

    const fd = new FormData();
    fd.set("projectId", "p1");
    fd.set("lane", "MUSIC");
    fd.set("storageKey", "uls-stage-director/project-show-media/p1/xx-cue.mp3");
    fd.set("fileName", "cue.mp3");

    await expect(finalizeShowMediaItemAfterS3Upload(fd)).rejects.toThrow(
      "redirect:/producer/inbox/p1/event?media_uploaded=1",
    );

    expect(s3Mocks.head).toHaveBeenCalledWith("uls-stage-director/project-show-media/p1/xx-cue.mp3");
    expect(db.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "p1",
          lane: ShowMediaLane.MUSIC,
          sortOrder: 3,
          fileName: "cue.mp3",
        }),
      }),
    );
  });

  it("infers audio MIME from filename when HeadObject is generic octet-stream (browser PUT aligned with SignedHeaders=host)", async () => {
    const { finalizeShowMediaItemAfterS3Upload } = await import("./show-media-actions");
    authMock.mockResolvedValueOnce(producerSession());
    db.projectFindFirst.mockResolvedValueOnce({ id: "p1" });
    db.aggregate.mockResolvedValueOnce({ _max: { sortOrder: 0 } });
    db.create.mockResolvedValueOnce({ id: "m1" });
    s3Mocks.head.mockResolvedValueOnce({ contentLength: 2, contentType: "application/octet-stream" });

    const fd = new FormData();
    fd.set("projectId", "p1");
    fd.set("lane", "MUSIC");
    fd.set("storageKey", "uls-stage-director/project-show-media/p1/yy-cue.mp3");
    fd.set("fileName", "cue.mp3");

    await expect(finalizeShowMediaItemAfterS3Upload(fd)).rejects.toThrow(
      "redirect:/producer/inbox/p1/event?media_uploaded=1",
    );

    expect(db.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contentType: "audio/mpeg",
          fileName: "cue.mp3",
        }),
      }),
    );
  });
});

describe("saveShowMediaVisibility", () => {
  it("persists visibility false when checkbox off", async () => {
    const { saveShowMediaVisibility } = await import("./show-media-actions");
    authMock.mockResolvedValueOnce(producerSession(GlobalRole.ULS_ADMIN));
    db.projectFindFirst.mockResolvedValueOnce({ id: "p1" });
    db.projectUpdate.mockResolvedValueOnce({});

    const fd = new FormData();
    fd.set("projectId", "p1");

    await expect(saveShowMediaVisibility(fd)).rejects.toThrow("media_visibility_saved=1");
    expect(db.projectUpdate).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { showMediaDirectorVisible: false },
    });
  });
});

describe("reorderShowMediaItem", () => {
  it("swaps sortOrder with neighbor via transaction", async () => {
    const { reorderShowMediaItem } = await import("./show-media-actions");
    authMock.mockResolvedValueOnce(producerSession());
    db.projectFindFirst.mockResolvedValueOnce({ id: "p1" });
    db.findFirstMedia.mockResolvedValueOnce({ id: "a", lane: ShowMediaLane.MUSIC, sortOrder: 5 });

    findManyMedia.mockResolvedValueOnce([
      { id: "a", sortOrder: 5 },
      { id: "b", sortOrder: 10 },
    ]);

    db.updateMedia.mockResolvedValue({});

    db.transaction.mockImplementationOnce(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));

    const fd = new FormData();
    fd.set("projectId", "p1");
    fd.set("itemId", "a");
    fd.set("direction", "down");

    await expect(reorderShowMediaItem(fd)).rejects.toThrow("media_reordered=1");

    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(db.updateMedia).toHaveBeenCalledTimes(2);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalRole, ProjectStatus } from "@prisma/client";

const authMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

const db = vi.hoisted(() => ({
  projectFindFirst: vi.fn(),
  projectUpdate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: {
      findFirst: db.projectFindFirst,
      update: db.projectUpdate,
    },
  },
}));

const revalidateProjectMirrorCache = vi.fn();
vi.mock("@/lib/revalidate-project-mirror-cache", () => ({
  revalidateProjectMirrorCache,
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
  db.projectFindFirst.mockReset();
  db.projectUpdate.mockReset();
  revalidateProjectMirrorCache.mockReset();
});

describe("savePostEventVaultPointers", () => {
  it("requires producer/admin session — unauthenticated directors blocked", async () => {
    const { savePostEventVaultPointers } = await import("./post-event-actions");

    authMock.mockResolvedValueOnce(null);
    const fd = new FormData();
    fd.set("projectId", "p1");
    await expect(savePostEventVaultPointers(fd)).rejects.toThrow(
      "redirect:/login?callbackUrl=/producer/inbox",
    );

    authMock.mockResolvedValueOnce({ user: { id: "d1", globalRole: GlobalRole.DIRECTOR } });
    await expect(savePostEventVaultPointers(fd)).rejects.toThrow(
      "redirect:/login?callbackUrl=/producer/inbox",
    );

    expect(db.projectFindFirst).not.toHaveBeenCalled();
  });

  it("rejects blank project id without contacting Prisma", async () => {
    const { savePostEventVaultPointers } = await import("./post-event-actions");
    authMock.mockResolvedValueOnce(producerSession(GlobalRole.PRODUCER));

    const fd = new FormData();
    fd.set("projectId", "  ");
    fd.set("postEventCastrUrl", "https://x.com/");
    await expect(savePostEventVaultPointers(fd)).rejects.toThrow("redirect:/producer/inbox");

    expect(db.projectFindFirst).not.toHaveBeenCalled();
  });

  it("bounces unknown or non-intake projects before URL validation", async () => {
    const { savePostEventVaultPointers } = await import("./post-event-actions");
    authMock.mockResolvedValueOnce(producerSession(GlobalRole.ULS_ADMIN));
    db.projectFindFirst.mockResolvedValueOnce(null);

    const fd = new FormData();
    fd.set("projectId", "off_queue");
    fd.set("postEventSmugMugUrl", "https://ok.example/smug");

    await expect(savePostEventVaultPointers(fd)).rejects.toThrow("redirect:/producer/inbox");

    expect(db.projectFindFirst).toHaveBeenCalledWith({
      where: { id: "off_queue", status: ProjectStatus.INTAKE_SUBMITTED },
      select: { id: true },
    });
    expect(db.projectUpdate).not.toHaveBeenCalled();
  });

  it("redirects when a non-https URL is provided", async () => {
    const { savePostEventVaultPointers } = await import("./post-event-actions");
    authMock.mockResolvedValueOnce(producerSession());
    db.projectFindFirst.mockResolvedValueOnce({ id: "p1" });

    const fd = new FormData();
    fd.set("projectId", "p1");
    fd.set("postEventSmugMugUrl", "http://evil.example/smug");
    fd.set("postEventCastrUrl", "");

    await expect(savePostEventVaultPointers(fd)).rejects.toThrow(
      "redirect:/producer/inbox/p1/event?post_event_err=bad_url",
    );
    expect(db.projectUpdate).not.toHaveBeenCalled();
  });

  it("reports bad_url for non-parseable payloads or oversized strings", async () => {
    const { savePostEventVaultPointers } = await import("./post-event-actions");
    authMock.mockResolvedValueOnce(producerSession());
    db.projectFindFirst.mockResolvedValueOnce({ id: "p_bad" });

    const fdGarbage = new FormData();
    fdGarbage.set("projectId", "p_bad");
    fdGarbage.set("postEventSmugMugUrl", ":::not-url:::");
    await expect(savePostEventVaultPointers(fdGarbage)).rejects.toThrow(
      "redirect:/producer/inbox/p_bad/event?post_event_err=bad_url",
    );

    authMock.mockResolvedValueOnce(producerSession());
    db.projectFindFirst.mockResolvedValueOnce({ id: "p_bad" });

    const longHttps = `${"https://x/" + "z".repeat(2040)}`;
    expect(longHttps.length).toBeGreaterThan(2048);
    const fdLong = new FormData();
    fdLong.set("projectId", "p_bad");
    fdLong.set("postEventCastrUrl", longHttps);
    await expect(savePostEventVaultPointers(fdLong)).rejects.toThrow(
      "redirect:/producer/inbox/p_bad/event?post_event_err=bad_url",
    );

    expect(db.projectUpdate).not.toHaveBeenCalled();
  });

  it("persists nulls for blank fields and accepts valid https URLs", async () => {
    const { savePostEventVaultPointers } = await import("./post-event-actions");
    authMock.mockResolvedValueOnce(producerSession());
    db.projectFindFirst.mockResolvedValueOnce({ id: "p9" });

    const fd = new FormData();
    fd.set("projectId", "p9");
    fd.set("postEventSmugMugUrl", "");
    fd.set("postEventCastrUrl", "https://watch.example/live/abc");
    fd.set("postEventVaultDirectorVisible", "on");

    await expect(savePostEventVaultPointers(fd)).rejects.toThrow(
      "redirect:/producer/inbox/p9/event?post_event_saved=1",
    );

    expect(db.projectUpdate).toHaveBeenCalledWith({
      where: { id: "p9" },
      data: {
        postEventSmugMugUrl: null,
        postEventCastrUrl: "https://watch.example/live/abc",
        postEventVaultDirectorVisible: true,
      },
    });
    expect(revalidateProjectMirrorCache).toHaveBeenCalledWith("p9");
    expect(db.projectFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "p9", status: ProjectStatus.INTAKE_SUBMITTED } }),
    );
  });

  it("normalizes URL via URL.toString and defaults visibility toggle off", async () => {
    const { savePostEventVaultPointers } = await import("./post-event-actions");
    authMock.mockResolvedValueOnce(producerSession(GlobalRole.ULS_ADMIN));
    db.projectFindFirst.mockResolvedValueOnce({ id: "p_norm" });
    db.projectUpdate.mockResolvedValueOnce({});

    const fd = new FormData();
    fd.set("projectId", "p_norm");
    fd.set("postEventSmugMugUrl", "https://smug.example/gallery/?x=1#top");
    fd.set("postEventCastrUrl", "");

    await expect(savePostEventVaultPointers(fd)).rejects.toThrow(
      "redirect:/producer/inbox/p_norm/event?post_event_saved=1",
    );

    expect(db.projectUpdate).toHaveBeenCalledExactlyOnceWith({
      where: { id: "p_norm" },
      data: {
        postEventSmugMugUrl: "https://smug.example/gallery/?x=1#top",
        postEventCastrUrl: null,
        postEventVaultDirectorVisible: false,
      },
    });
  });
});

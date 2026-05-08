import { beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalRole, ProjectRole } from "@prisma/client";

const authMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

const isDirectorPortalAccessRevoked = vi.fn(() => false);
vi.mock("@/lib/director-portal-access-window", () => ({
  isDirectorPortalAccessRevoked: (at: Date | null) => isDirectorPortalAccessRevoked(at),
}));

const reorderShowMediaAdjacent = vi.fn<
  Promise<"swapped" | "noop" | "not_found" | "txn_failed">,
  [unknown, string, string, "up" | "down"]
>();
vi.mock("@/lib/show-media-adjacent-reorder", () => ({
  reorderShowMediaAdjacent: (...args: Parameters<typeof reorderShowMediaAdjacent>) =>
    reorderShowMediaAdjacent(...args),
}));

const revalidateProjectMirrorCache = vi.fn();
vi.mock("@/lib/revalidate-project-mirror-cache", () => ({
  revalidateProjectMirrorCache,
}));

const redirectMock = vi.fn((url: string) => {
  throw new Error(`redirect:${url}`);
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

const projectFindFirst = vi.fn();
const projectMemberFindFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findFirst: projectFindFirst },
    projectMember: { findFirst: projectMemberFindFirst },
  },
}));

function form(projectId = "proj_1", itemId = "item_1", direction: "up" | "down" = "up") {
  const fd = new FormData();
  fd.set("projectId", projectId);
  fd.set("itemId", itemId);
  fd.set("direction", direction);
  return fd;
}

describe("reorderShowMediaAsDirector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockReset();
    isDirectorPortalAccessRevoked.mockReturnValue(false);
    projectFindFirst.mockResolvedValue({
      bookingSecuredAt: new Date(),
      showMediaDirectorVisible: true,
      eventConclusionAt: null,
    });
    projectMemberFindFirst.mockResolvedValue({ id: "m1" });
    reorderShowMediaAdjacent.mockResolvedValue("swapped");
  });

  it("redirects to login when unauthenticated", async () => {
    const { reorderShowMediaAsDirector } = await import("./show-media-reorder-actions");
    authMock.mockResolvedValueOnce(null);

    await expect(reorderShowMediaAsDirector(form())).rejects.toThrow("redirect:/login?callbackUrl=/portal");
    expect(projectFindFirst).not.toHaveBeenCalled();
  });

  it("redirects producers away from director reorder path", async () => {
    const { reorderShowMediaAsDirector } = await import("./show-media-reorder-actions");
    authMock.mockResolvedValueOnce({
      user: { id: "u1", globalRole: GlobalRole.PRODUCER },
    });

    await expect(reorderShowMediaAsDirector(form())).rejects.toThrow("redirect:/portal");
    expect(projectFindFirst).not.toHaveBeenCalled();
  });

  it("redirects when form tokens are incomplete", async () => {
    const { reorderShowMediaAsDirector } = await import("./show-media-reorder-actions");
    authMock.mockResolvedValueOnce({ user: { id: "u1", globalRole: GlobalRole.DIRECTOR } });
    const fd = new FormData();
    fd.set("projectId", "p");
    fd.set("itemId", "");
    fd.set("direction", "up");

    await expect(reorderShowMediaAsDirector(fd)).rejects.toThrow("redirect:/portal");
    expect(projectFindFirst).not.toHaveBeenCalled();
  });

  it("redirects to intake booking pending when booking not secured", async () => {
    const { reorderShowMediaAsDirector } = await import("./show-media-reorder-actions");
    authMock.mockResolvedValueOnce({ user: { id: "u1", globalRole: GlobalRole.DIRECTOR } });
    projectFindFirst.mockResolvedValueOnce({
      bookingSecuredAt: null,
      showMediaDirectorVisible: true,
      eventConclusionAt: null,
    });

    await expect(reorderShowMediaAsDirector(form("proj_x"))).rejects.toThrow(
      "redirect:/portal/projects/proj_x?booking=pending",
    );
    expect(projectMemberFindFirst).not.toHaveBeenCalled();
  });

  it("redirects when director access revoked", async () => {
    const { reorderShowMediaAsDirector } = await import("./show-media-reorder-actions");
    authMock.mockResolvedValueOnce({ user: { id: "u1", globalRole: GlobalRole.DIRECTOR } });
    isDirectorPortalAccessRevoked.mockReturnValueOnce(true);
    projectFindFirst.mockResolvedValueOnce({
      bookingSecuredAt: new Date(),
      showMediaDirectorVisible: true,
      eventConclusionAt: new Date(),
    });

    await expect(reorderShowMediaAsDirector(form())).rejects.toThrow("redirect:/portal?access_ended=1");
  });

  it("redirects when show media not visible to directors", async () => {
    const { reorderShowMediaAsDirector } = await import("./show-media-reorder-actions");
    authMock.mockResolvedValueOnce({ user: { id: "u1", globalRole: GlobalRole.DIRECTOR } });
    projectFindFirst.mockResolvedValueOnce({
      bookingSecuredAt: new Date(),
      showMediaDirectorVisible: false,
      eventConclusionAt: null,
    });

    await expect(reorderShowMediaAsDirector(form("proj_show"))).rejects.toThrow(
      "redirect:/portal/shows/proj_show",
    );
  });

  it("redirects when director is not on the project roster", async () => {
    const { reorderShowMediaAsDirector } = await import("./show-media-reorder-actions");
    authMock.mockResolvedValueOnce({ user: { id: "u1", globalRole: GlobalRole.DIRECTOR } });
    projectMemberFindFirst.mockResolvedValueOnce(null);

    await expect(reorderShowMediaAsDirector(form())).rejects.toThrow("redirect:/portal");
    expect(reorderShowMediaAdjacent).not.toHaveBeenCalled();
  });

  it("propagates not_found reorder result", async () => {
    const { reorderShowMediaAsDirector } = await import("./show-media-reorder-actions");
    authMock.mockResolvedValueOnce({ user: { id: "u1", globalRole: GlobalRole.DIRECTOR } });
    reorderShowMediaAdjacent.mockResolvedValueOnce("not_found");

    await expect(reorderShowMediaAsDirector(form("p1", "missing", "down"))).rejects.toThrow(
      "redirect:/portal/shows/p1?media_err=not_found#portal-show-media",
    );
  });

  it("propagates txn_failed reorder result", async () => {
    const { reorderShowMediaAsDirector } = await import("./show-media-reorder-actions");
    authMock.mockResolvedValueOnce({ user: { id: "u1", globalRole: GlobalRole.DIRECTOR } });
    reorderShowMediaAdjacent.mockResolvedValueOnce("txn_failed");

    await expect(reorderShowMediaAsDirector(form())).rejects.toThrow(
      "redirect:/portal/shows/proj_1?media_err=bad_order#portal-show-media",
    );
  });

  it("handles noop lane boundary without revalidate flash", async () => {
    const { reorderShowMediaAsDirector } = await import("./show-media-reorder-actions");
    authMock.mockResolvedValueOnce({ user: { id: "u1", globalRole: GlobalRole.DIRECTOR } });
    reorderShowMediaAdjacent.mockResolvedValueOnce("noop");

    await expect(reorderShowMediaAsDirector(form())).rejects.toThrow(
      "redirect:/portal/shows/proj_1#portal-show-media",
    );
    expect(revalidateProjectMirrorCache).not.toHaveBeenCalled();
  });

  it("revalidates and flashes success after swap", async () => {
    const { reorderShowMediaAsDirector } = await import("./show-media-reorder-actions");
    authMock.mockResolvedValueOnce({ user: { id: "u1", globalRole: GlobalRole.DIRECTOR } });

    await expect(reorderShowMediaAsDirector(form())).rejects.toThrow(
      "redirect:/portal/shows/proj_1?media_reordered=1#portal-show-media",
    );
    expect(reorderShowMediaAdjacent).toHaveBeenCalledWith(expect.any(Object), "proj_1", "item_1", "up");
    expect(revalidateProjectMirrorCache).toHaveBeenCalledWith("proj_1");
  });

  it("looks up roster membership scoped to DIRECTOR role", async () => {
    const { reorderShowMediaAsDirector } = await import("./show-media-reorder-actions");
    authMock.mockResolvedValueOnce({ user: { id: "u1", globalRole: GlobalRole.DIRECTOR } });

    await expect(reorderShowMediaAsDirector(form())).rejects.toThrow("redirect:");
    expect(projectMemberFindFirst).toHaveBeenCalledWith({
      where: { projectId: "proj_1", userId: "u1", role: ProjectRole.DIRECTOR },
      select: { id: true },
    });
  });
});

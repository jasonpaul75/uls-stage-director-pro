import { beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalRole, ProjectRole } from "@prisma/client";

const findUnique = vi.fn();
const findFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findUnique },
    projectMember: { findFirst },
  },
}));

const redirectMock = vi.fn((url: string) => {
  throw new Error(`redirect:${url}`);
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

describe("loadProjectForPortalViewer", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns the project for ULS_ADMIN without membership checks", async () => {
    const { loadProjectForPortalViewer } = await import("./project-access-portal");
    const fake = { id: "proj_admin", name: "Admin view" };
    findUnique.mockResolvedValueOnce(fake);

    const out = await loadProjectForPortalViewer("proj_admin", {
      userId: "u1",
      globalRole: GlobalRole.ULS_ADMIN,
    });

    expect(out).toBe(fake);
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "proj_admin" } }),
    );
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("returns null for ULS_ADMIN when project id is unknown to Prisma", async () => {
    const { loadProjectForPortalViewer } = await import("./project-access-portal");
    findUnique.mockResolvedValueOnce(null);

    const out = await loadProjectForPortalViewer("ghost", {
      userId: "u1",
      globalRole: GlobalRole.ULS_ADMIN,
    });

    expect(out).toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("returns null for DIRECTOR with no DIRECTOR membership on that project", async () => {
    const { loadProjectForPortalViewer } = await import("./project-access-portal");
    findFirst.mockResolvedValueOnce(null);

    const out = await loadProjectForPortalViewer("proj_x", {
      userId: "dir1",
      globalRole: GlobalRole.DIRECTOR,
    });

    expect(out).toBeNull();
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          projectId: "proj_x",
          userId: "dir1",
          role: ProjectRole.DIRECTOR,
        },
      }),
    );
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("returns the nested project for DIRECTOR with membership", async () => {
    const { loadProjectForPortalViewer } = await import("./project-access-portal");
    const inner = { id: "proj_ok", name: "Booked", eventConclusionAt: null };
    findFirst.mockResolvedValueOnce({ project: inner });

    const out = await loadProjectForPortalViewer("proj_ok", {
      userId: "dir2",
      globalRole: GlobalRole.DIRECTOR,
    });

    expect(out).toBe(inner);
  });

  it("redirects DIRECTOR when portal access revoked after event conclusion cutoff", async () => {
    const { loadProjectForPortalViewer } = await import("./project-access-portal");
    const concluded = new Date(Date.UTC(2019, 5, 1));
    findFirst.mockResolvedValueOnce({
      project: { id: "proj_expired", name: "Old", eventConclusionAt: concluded },
    });

    await expect(
      loadProjectForPortalViewer("proj_expired", {
        userId: "dir2",
        globalRole: GlobalRole.DIRECTOR,
      }),
    ).rejects.toThrow("redirect:/portal?access_ended=1");

    expect(redirectMock).toHaveBeenCalledWith("/portal?access_ended=1");
  });

  it("allows DIRECTOR when eventConclusionAt is null (show not concluded in system)", async () => {
    const { loadProjectForPortalViewer } = await import("./project-access-portal");
    const inner = { id: "proj_open", name: "Live", eventConclusionAt: null };
    findFirst.mockResolvedValueOnce({ project: inner });

    const out = await loadProjectForPortalViewer("proj_open", {
      userId: "dir3",
      globalRole: GlobalRole.DIRECTOR,
    });

    expect(out).toBe(inner);
  });

  it("allows DIRECTOR when conclusion is set but 90-day window not elapsed", async () => {
    const { loadProjectForPortalViewer } = await import("./project-access-portal");
    const recent = new Date(Date.UTC(2035, 0, 1));
    const inner = { id: "proj_recent", name: "Recent", eventConclusionAt: recent };
    findFirst.mockResolvedValueOnce({ project: inner });

    const out = await loadProjectForPortalViewer("proj_recent", {
      userId: "dir4",
      globalRole: GlobalRole.DIRECTOR,
    });

    expect(out).toBe(inner);
  });

  it("returns concluded project for ULS_ADMIN (internal retention window)", async () => {
    const { loadProjectForPortalViewer } = await import("./project-access-portal");
    const concluded = new Date(Date.UTC(2018, 0, 1));
    const fake = { id: "proj_ret", name: "Archive", eventConclusionAt: concluded };
    findUnique.mockResolvedValueOnce(fake);

    const out = await loadProjectForPortalViewer("proj_ret", {
      userId: "admin1",
      globalRole: GlobalRole.ULS_ADMIN,
    });

    expect(out).toBe(fake);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects PRODUCER away from portal project load (fail closed)", async () => {
    const { loadProjectForPortalViewer } = await import("./project-access-portal");

    await expect(
      loadProjectForPortalViewer("proj_p", {
        userId: "prod1",
        globalRole: GlobalRole.PRODUCER,
      }),
    ).rejects.toThrow("redirect:/portal");

    expect(redirectMock).toHaveBeenCalledWith("/portal");
    expect(findUnique).not.toHaveBeenCalled();
    expect(findFirst).not.toHaveBeenCalled();
  });
});

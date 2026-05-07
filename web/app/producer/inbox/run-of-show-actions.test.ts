import { beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalRole, ProjectStatus } from "@prisma/client";

const authMock = vi.fn();

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

const projectFindFirst = vi.fn();
const projectUpdate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: {
      findFirst: projectFindFirst,
      update: projectUpdate,
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
  return { user: { id: "ros_op", globalRole: role } };
}

function rosForm(
  projectId: string,
  parts: Partial<{ runOfShowBody: string; runOfShowDirectorVisible: boolean; runOfShowFrozen: boolean }> = {},
) {
  const fd = new FormData();
  fd.set("projectId", projectId);
  fd.set("runOfShowBody", parts.runOfShowBody ?? "");
  if (parts.runOfShowDirectorVisible) fd.set("runOfShowDirectorVisible", "on");
  if (parts.runOfShowFrozen) fd.set("runOfShowFrozen", "on");
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockReset();
  projectFindFirst.mockReset();
  projectUpdate.mockReset();
});

describe("saveRunOfShow", () => {
  it("gates unauthenticated or non-producer roles", async () => {
    const { saveRunOfShow } = await import("./run-of-show-actions");

    authMock.mockResolvedValueOnce(null);
    await expect(saveRunOfShow(rosForm("p"))).rejects.toThrow(
      "redirect:/login?callbackUrl=/producer/inbox",
    );

    authMock.mockResolvedValueOnce({ user: { id: "dx", globalRole: GlobalRole.DIRECTOR } });
    await expect(saveRunOfShow(rosForm("p"))).rejects.toThrow(
      "redirect:/login?callbackUrl=/producer/inbox",
    );
    expect(projectFindFirst).not.toHaveBeenCalled();
  });

  it("rejects empty project id token", async () => {
    const { saveRunOfShow } = await import("./run-of-show-actions");
    authMock.mockResolvedValueOnce(producerSession());

    const fd = new FormData();
    fd.set("projectId", " ");

    await expect(saveRunOfShow(fd)).rejects.toThrow("redirect:/producer/inbox");
    expect(projectFindFirst).not.toHaveBeenCalled();
  });

  it("rejects when intake project row missing", async () => {
    const { saveRunOfShow } = await import("./run-of-show-actions");
    authMock.mockResolvedValueOnce(producerSession(GlobalRole.ULS_ADMIN));
    projectFindFirst.mockResolvedValueOnce(null);

    await expect(saveRunOfShow(rosForm("nope", { runOfShowBody: "x" }))).rejects.toThrow(
      "redirect:/producer/inbox",
    );
    expect(projectFindFirst).toHaveBeenCalledWith({
      where: { id: "nope", status: ProjectStatus.INTAKE_SUBMITTED },
      select: { id: true },
    });
    expect(projectUpdate).not.toHaveBeenCalled();
  });

  it("persists null body for whitespace-only markdown, defaults visibility + freeze off", async () => {
    const { saveRunOfShow } = await import("./run-of-show-actions");
    authMock.mockResolvedValueOnce(producerSession());
    projectFindFirst.mockResolvedValueOnce({ id: "ros_p" });
    projectUpdate.mockResolvedValueOnce({});

    await expect(saveRunOfShow(rosForm("ros_p", { runOfShowBody: "  \n" }))).rejects.toThrow(
      "redirect:/producer/inbox/ros_p/event?ros_saved=1",
    );

    expect(projectUpdate).toHaveBeenCalledExactlyOnceWith({
      where: { id: "ros_p" },
      data: {
        runOfShowBody: null,
        runOfShowDirectorVisible: false,
        runOfShowFrozen: false,
      },
    });
    expect(revalidateProjectMirrorCache).toHaveBeenCalledWith("ros_p");
  });

  it("keeps non-empty body raw (no inner trim) when saving", async () => {
    const { saveRunOfShow } = await import("./run-of-show-actions");
    authMock.mockResolvedValueOnce(producerSession(GlobalRole.PRODUCER));
    projectFindFirst.mockResolvedValueOnce({ id: "ros_p" });
    projectUpdate.mockResolvedValueOnce({});

    await expect(
      saveRunOfShow(
        rosForm("ros_p", {
          runOfShowBody: "  cue block  ",
          runOfShowDirectorVisible: true,
          runOfShowFrozen: true,
        }),
      ),
    ).rejects.toThrow("redirect:/producer/inbox/ros_p/event?ros_saved=1");

    expect(projectUpdate).toHaveBeenCalledExactlyOnceWith({
      where: { id: "ros_p" },
      data: {
        runOfShowBody: "  cue block  ",
        runOfShowDirectorVisible: true,
        runOfShowFrozen: true,
      },
    });
  });
});
